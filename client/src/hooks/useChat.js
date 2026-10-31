import { useCallback, useEffect, useRef, useState } from 'react';
import { chatApi, streamMessage } from '../api/chat';
import { getErrorMessage } from '../api/client';

let tempCounter = 0;
const tempId = (prefix) => `${prefix}-${Date.now()}-${tempCounter++}`;

/**
 * Message state for one conversation: loading history, streaming replies,
 * stopping generation and retrying failed messages.
 *
 * @param {object} options
 * @param {string|null} options.conversationId conversation from the URL (null = new chat)
 * @param {(conversation: object, opts: { isNew: boolean }) => void} options.onConversationSaved
 *   called once the server has persisted a turn (new conversation or new activity)
 */
export const useChat = ({ conversationId, onConversationSaved }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const abortRef = useRef(null);
  // The conversation whose messages are in state. Lets us skip re-fetching a
  // conversation we just created ourselves when the URL updates to it.
  const currentIdRef = useRef(undefined);
  const loadSeqRef = useRef(0);
  const savedCallbackRef = useRef(onConversationSaved);
  savedCallbackRef.current = onConversationSaved;

  useEffect(() => {
    if (conversationId === currentIdRef.current) return;
    currentIdRef.current = conversationId;

    abortRef.current?.abort(); // leaving a conversation stops its in-flight reply
    setLoadError(null);
    setMessages([]);

    if (!conversationId) {
      setIsLoading(false);
      return;
    }

    // Ignore responses that arrive after the user switched conversations again
    const seq = ++loadSeqRef.current;
    setIsLoading(true);
    chatApi
      .getConversation(conversationId)
      .then((data) => seq === loadSeqRef.current && setMessages(data.messages))
      .catch((err) => seq === loadSeqRef.current && setLoadError(getErrorMessage(err, 'Could not load this conversation.')))
      .finally(() => seq === loadSeqRef.current && setIsLoading(false));
  }, [conversationId]);

  // Abort any in-flight stream on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateMessage = (id, changes) =>
    setMessages((prev) => prev.map((m) => (m._id === id ? { ...m, ...changes } : m)));

  /**
   * Send a message and stream the reply.
   * Resolves to `{ restoreDraft }` when the message was cancelled before the
   * server accepted it, so the caller can put the text back in the input.
   */
  const send = useCallback(
    async (text) => {
      const content = text.trim();
      if (!content || abortRef.current) return undefined;

      const sentFromId = currentIdRef.current || null;
      let userMsgId = tempId('user');
      const aiMsgId = tempId('assistant');
      const now = new Date().toISOString();

      setMessages((prev) => [
        ...prev.filter((m) => !m.failed),
        { _id: userMsgId, role: 'user', content, createdAt: now },
        { _id: aiMsgId, role: 'assistant', content: '', createdAt: now, streaming: true }
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      let saved = null; // conversation from the server once the user message is persisted
      let streamedAny = false;

      const commit = (conversation) => {
        const isNew = !sentFromId;
        // Only adopt the new conversation if the user is still on the "new chat" screen
        if (isNew && currentIdRef.current === null) currentIdRef.current = conversation._id;
        savedCallbackRef.current?.(conversation, { isNew, navigate: isNew && currentIdRef.current === conversation._id });
      };

      try {
        await streamMessage({
          message: content,
          conversationId: sentFromId,
          signal: controller.signal,
          onMeta: ({ conversation, userMessage }) => {
            saved = conversation;
            updateMessage(userMsgId, userMessage);
            userMsgId = userMessage._id;
          },
          onToken: (token) => {
            streamedAny = true;
            setMessages((prev) => prev.map((m) => (m._id === aiMsgId ? { ...m, content: m.content + token } : m)));
          },
          onDone: ({ conversation, message }) => {
            updateMessage(aiMsgId, { ...message, streaming: false });
            commit(conversation);
          }
        });
        return undefined;
      } catch (err) {
        if (err.name === 'AbortError') {
          if (streamedAny) {
            // Keep the partial answer — the server saves it too
            updateMessage(aiMsgId, { streaming: false, stopped: true });
          } else {
            setMessages((prev) => prev.filter((m) => m._id !== aiMsgId));
          }
          if (saved) {
            commit(saved);
            return undefined;
          }
          // Cancelled before the server accepted it: drop the message and hand the text back
          setMessages((prev) => prev.filter((m) => m._id !== userMsgId));
          return { restoreDraft: content };
        }

        // The server rolled the turn back; keep the text on screen with a retry option
        setMessages((prev) =>
          prev
            .filter((m) => m._id !== aiMsgId)
            .map((m) => (m._id === userMsgId ? { ...m, failed: true, error: getErrorMessage(err) } : m))
        );
        return undefined;
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    []
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Read messages through a ref so `retry` stays stable while tokens stream in
  // (otherwise every memoized MessageBubble would re-render on every token)
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const retry = useCallback(
    (messageId) => {
      const failed = messagesRef.current.find((m) => m._id === messageId);
      if (!failed) return;
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      send(failed.content);
    },
    [send]
  );

  return { messages, isLoading, isStreaming, loadError, send, stop, retry };
};
