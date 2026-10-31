import api, { API_BASE_URL, ApiError, SESSION_EXPIRED_EVENT } from './client';

export const chatApi = {
  listConversations: () => api.get('/chat/history').then((res) => res.data.conversations),
  getConversation: (id, config) => api.get(`/chat/history/${id}`, config).then((res) => res.data),
  renameConversation: (id, title) =>
    api.patch(`/chat/history/${id}`, { title }).then((res) => res.data.conversation),
  deleteConversation: (id) => api.delete(`/chat/history/${id}`),
  clearHistory: () => api.delete('/chat/history').then((res) => res.data.deletedCount),
  /** Non-streaming fallback (the spec'd /chat/send endpoint) */
  send: (payload) => api.post('/chat/send', payload).then((res) => res.data)
};

/**
 * Send a message and stream the assistant reply over Server-Sent Events.
 * Uses fetch because axios can't read a streaming response body in the browser.
 *
 * @param {object} params
 * @param {string} params.message
 * @param {string} [params.conversationId]
 * @param {AbortSignal} [params.signal] abort to stop generation
 * @param {(data: { conversation, userMessage }) => void} params.onMeta
 * @param {(token: string) => void} params.onToken
 * @param {(data: { conversation, message }) => void} params.onDone
 */
export const streamMessage = async ({ message, conversationId, signal, onMeta, onToken, onDone }) => {
  const response = await fetch(`${API_BASE_URL}/chat/send/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, ...(conversationId ? { conversationId } : {}) }),
    signal
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    throw new ApiError(data.error || 'Failed to send message. Please try again.', response.status);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    // SSE frames are separated by a blank line
    const frames = buffer.split('\n\n');
    buffer = frames.pop();

    for (const frame of frames) {
      const event = frame.match(/^event: (.*)$/m)?.[1];
      const raw = frame.match(/^data: (.*)$/m)?.[1];
      if (!event || !raw) continue; // keep-alive comments
      const data = JSON.parse(raw);

      if (event === 'meta') onMeta?.(data);
      else if (event === 'token') onToken?.(data.content);
      else if (event === 'done') onDone?.(data);
      else if (event === 'error') throw new ApiError(data.error, data.status);
    }
  }
};
