import { mock } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Start an isolated in-memory MongoDB and connect mongoose to it.
 * The mongod binary is downloaded and cached on first run
 * (set MONGOMS_SYSTEM_BINARY to use a locally installed mongod instead).
 */
export const startTestDB = async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  return async () => {
    await mongoose.disconnect();
    await mongod.stop();
  };
};

/**
 * Build a streaming Response that looks like OpenRouter's SSE output.
 */
export const sseResponse = (tokens) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': OPENROUTER PROCESSING\n\n'));
      for (const token of tokens) {
        const frame = { choices: [{ delta: { content: token } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
};

/**
 * Replace global fetch (used by the AI service) with a handler.
 * The handler receives the parsed request body and returns a Response or throws.
 * Returns the mock so tests can inspect `mock.calls`.
 */
export const mockAI = (handler) =>
  mock.method(globalThis, 'fetch', async (url, init) => handler(JSON.parse(init.body), init));

/** Convenience: AI replies with the given text, streamed word by word. */
export const mockAIReply = (text) => mockAI(() => sseResponse(text.split(/(?<= )/)));

/**
 * Parse a raw SSE body (as returned by supertest) into [{ event, data }].
 */
export const parseSSE = (raw) =>
  raw
    .split('\n\n')
    .map((frame) => {
      const event = frame.match(/^event: (.*)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      return event && data ? { event, data: JSON.parse(data) } : null;
    })
    .filter(Boolean);
