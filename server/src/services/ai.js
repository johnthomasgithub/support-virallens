import {
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL,
  OPENROUTER_FALLBACK_MODEL,
  CLIENT_URL
} from '../config/env.js';
import { logger } from '../config/logger.js';

const SYSTEM_PROMPT = `You are "Lumi", a polite, concise customer support assistant.
- Help users quickly, accurately and professionally.
- Use short paragraphs and Markdown (bullet lists, **bold**) when it improves readability.
- If you are unsure of an answer, or a question depends on company-specific policies, orders or account data you do not have, say so plainly and recommend contacting a human support agent. Never invent policies, prices, order details or promises.`;

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 30_000; // max wait for the first token, and max silence between tokens

export class AIServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'AIServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Map any upstream failure to a friendly, non-leaky error for the client.
 */
const toFriendlyError = (err) => {
  if (err instanceof AIServiceError) return err;

  const status = err.status;
  if (status === 429) {
    return new AIServiceError(
      'Our AI support assistant is currently experiencing high demand. Please try again in a few moments.',
      429
    );
  }
  if (err.name === 'TimeoutError') {
    return new AIServiceError(
      'The AI assistant took too long to respond. Please try your request again.',
      504
    );
  }
  if (status === 401 || status === 403) {
    return new AIServiceError('AI service authentication error. Please contact the administrator.', 503);
  }
  return new AIServiceError(
    'We are having trouble connecting to our AI assistant. Please try again shortly.',
    502
  );
};

const buildMessages = (contextMessages) => [
  { role: 'system', content: SYSTEM_PROMPT },
  ...contextMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }))
];

/**
 * Yield parsed JSON payloads from an OpenAI-compatible SSE response body.
 */
async function* readSSE(body) {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Skip blanks and SSE comments (OpenRouter sends ": OPENROUTER PROCESSING" keep-alives)
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        yield JSON.parse(data);
      } catch {
        // Ignore malformed partial frames
      }
    }
  }
}

/**
 * Stream one completion from a single model.
 * The timeout is an inactivity timer: it resets on every received chunk.
 */
const streamFromModel = async (model, messages, { signal, onToken }) => {
  const controller = new AbortController();
  let timer;
  const armTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () => controller.abort(new DOMException('AI request timed out', 'TimeoutError')),
      TIMEOUT_MS
    );
  };
  const onClientAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', onClientAbort, { once: true });

  let content = '';
  try {
    armTimeout();
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': CLIENT_URL,
        'X-Title': 'Lumi AI Customer Support'
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: controller.signal
    });

    if (!response.ok) {
      const err = new Error(`OpenRouter responded with ${response.status}`);
      err.status = response.status;
      throw err;
    }

    for await (const payload of readSSE(response.body)) {
      armTimeout();
      if (payload.error) {
        const err = new Error(payload.error.message || 'Provider error');
        err.status = payload.error.code;
        throw err;
      }
      const token = payload.choices?.[0]?.delta?.content;
      if (token) {
        content += token;
        onToken?.(token);
      }
    }

    if (!content.trim()) throw new Error('Empty response received from AI model');
    return content.trim();
  } catch (err) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      if (reason?.name === 'TimeoutError') err = reason;
    }
    // Let callers know how much had already been streamed (fallback is unsafe after that)
    err.partialContent = content;
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onClientAbort);
  }
};

/**
 * Generate an assistant reply, streaming tokens through `onToken` when provided.
 * Tries OPENROUTER_MODEL first, then OPENROUTER_FALLBACK_MODEL if the primary
 * fails before producing any output.
 *
 * @param {Array<{ role: string, content: string }>} contextMessages
 * @param {{ signal?: AbortSignal, onToken?: (token: string) => void }} [options]
 * @returns {Promise<string>} full reply text
 */
export const generateAssistantReply = async (contextMessages = [], options = {}) => {
  if (!OPENROUTER_API_KEY) {
    throw new AIServiceError('AI service is not configured. Please set OPENROUTER_API_KEY.', 503);
  }

  const messages = buildMessages(contextMessages);
  const models = [OPENROUTER_MODEL, OPENROUTER_FALLBACK_MODEL].filter(
    (model, i, all) => model && all.indexOf(model) === i
  );

  let lastError;
  for (const model of models) {
    try {
      return await streamFromModel(model, messages, options);
    } catch (err) {
      // The client went away: stop immediately and surface the abort as-is
      if (options.signal?.aborted) throw err;

      lastError = err;
      logger.warn(`[AI Service] Model "${model}" failed: ${err.message}`);
      if (err.partialContent) break; // tokens already reached the user; don't splice a second answer
    }
  }

  throw toFriendlyError(lastError);
};
