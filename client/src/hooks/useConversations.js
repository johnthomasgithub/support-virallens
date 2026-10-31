import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { chatApi } from '../api/chat';
import { getErrorMessage } from '../api/client';

/**
 * The user's conversation list for the sidebar, kept in sync locally
 * (no refetch after every message).
 */
export const useConversations = () => {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    chatApi
      .listConversations()
      .then(setConversations)
      .catch((err) => toast.error(getErrorMessage(err, 'Could not load your conversations.')))
      .finally(() => setIsLoading(false));
  }, []);

  /** Insert or move a conversation to the top (most recently active). */
  const upsert = useCallback((conversation) => {
    setConversations((prev) => [conversation, ...prev.filter((c) => c._id !== conversation._id)]);
  }, []);

  const rename = useCallback(async (id, title) => {
    const updated = await chatApi.renameConversation(id, title);
    setConversations((prev) => prev.map((c) => (c._id === id ? updated : c)));
  }, []);

  const remove = useCallback(async (id) => {
    await chatApi.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c._id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await chatApi.clearHistory();
    setConversations([]);
  }, []);

  return { conversations, isLoading, upsert, rename, remove, clearAll };
};
