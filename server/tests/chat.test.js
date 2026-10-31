import { test, before, after, afterEach, describe } from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Conversation from '../src/models/Conversation.js';
import Message from '../src/models/Message.js';
import { startTestDB, mockAI, mockAIReply, sseResponse, parseSSE } from './helpers.js';

let stopDB;
let user1Cookie;
let user2Cookie;
let user1Id;

const signup = (email) => request(app).post('/auth/signup').send({ email, password: 'Password123!' });

describe('Chat API', () => {
  before(async () => {
    stopDB = await startTestDB();
    const res1 = await signup('user1@example.com');
    user1Cookie = res1.headers['set-cookie'];
    user1Id = res1.body.user._id;
    const res2 = await signup('user2@example.com');
    user2Cookie = res2.headers['set-cookie'];
  });

  after(async () => {
    await stopDB();
  });

  afterEach(() => mock.restoreAll());

  describe('POST /chat/send', () => {
    let conversationId;

    test('rejects unauthenticated requests (401)', async () => {
      const res = await request(app).post('/chat/send').send({ message: 'Hello AI' });
      assert.equal(res.status, 401);
    });

    test('rejects an empty message (400)', async () => {
      const res = await request(app).post('/chat/send').set('Cookie', user1Cookie).send({ message: '   ' });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /empty/);
    });

    test('creates a conversation and returns the assistant reply', async () => {
      mockAIReply('Hello! I am your customer support assistant.');

      const res = await request(app)
        .post('/chat/send')
        .set('Cookie', user1Cookie)
        .send({ message: 'I need help tracking my package delivery please.' });

      assert.equal(res.status, 200);
      assert.ok(res.body.conversationId);
      assert.equal(res.body.userMessage.role, 'user');
      assert.equal(res.body.message.role, 'assistant');
      assert.equal(res.body.message.content, 'Hello! I am your customer support assistant.');

      conversationId = res.body.conversationId;
      const conv = await Conversation.findById(conversationId);
      assert.equal(conv.user.toString(), user1Id);
      assert.ok(conv.title.length <= 41, 'title is derived from the first ~40 chars');
      assert.ok(conv.title.startsWith('I need help tracking my package'));
    });

    test('continues an existing conversation and sends prior messages as context', async () => {
      const ai = mockAIReply('Your package tracking number is TRK-12345.');

      const res = await request(app)
        .post('/chat/send')
        .set('Cookie', user1Cookie)
        .send({ conversationId, message: 'My order number is #9988.' });

      assert.equal(res.status, 200);
      assert.equal(res.body.conversationId, conversationId);

      const payload = JSON.parse(ai.mock.calls[0].arguments[1].body);
      assert.equal(payload.messages[0].role, 'system');
      // system + (user, assistant) from turn 1 + the new user message
      assert.deepEqual(
        payload.messages.slice(1).map((m) => m.role),
        ['user', 'assistant', 'user']
      );
      assert.equal(payload.messages.at(-1).content, 'My order number is #9988.');
    });

    test('limits AI context to the last 10 messages', async () => {
      mockAIReply('ok');
      for (let i = 0; i < 5; i++) {
        await request(app).post('/chat/send').set('Cookie', user1Cookie).send({ conversationId, message: `msg ${i}` });
      }
      const ai = mockAIReply('ok');
      await request(app).post('/chat/send').set('Cookie', user1Cookie).send({ conversationId, message: 'latest' });

      const payload = JSON.parse(ai.mock.calls[0].arguments[1].body);
      assert.equal(payload.messages.length, 11, 'system prompt + 10 context messages');
      assert.equal(payload.messages.at(-1).content, 'latest');
    });

    test('falls back to the secondary model if the primary fails', async () => {
      const models = [];
      mockAI((body) => {
        models.push(body.model);
        if (models.length === 1) return new Response('upstream down', { status: 503 });
        return sseResponse(['Response from fallback model']);
      });

      const res = await request(app).post('/chat/send').set('Cookie', user1Cookie).send({ message: 'Can you assist me?' });

      assert.equal(res.status, 200);
      assert.equal(models.length, 2, 'primary then fallback');
      assert.notEqual(models[0], models[1]);
      assert.equal(res.body.message.content, 'Response from fallback model');
    });

    test('maps provider 429 to a friendly 429 and rolls back the turn', async () => {
      mockAI(() => new Response('rate limited', { status: 429 }));
      const before = await Message.countDocuments({ user: user1Id });
      const convsBefore = await Conversation.countDocuments({ user: user1Id });

      const res = await request(app).post('/chat/send').set('Cookie', user1Cookie).send({ message: 'Rate limit me' });

      assert.equal(res.status, 429);
      assert.match(res.body.error, /high demand/);
      assert.equal(await Message.countDocuments({ user: user1Id }), before, 'no orphan user message');
      assert.equal(await Conversation.countDocuments({ user: user1Id }), convsBefore, 'no empty conversation');
    });

    test('maps a provider timeout to a friendly 504', async () => {
      mockAI(() => {
        throw new DOMException('AI request timed out', 'TimeoutError');
      });

      const res = await request(app).post('/chat/send').set('Cookie', user1Cookie).send({ message: 'Will this time out?' });

      assert.equal(res.status, 504);
      assert.match(res.body.error, /took too long/);
    });

    test('never leaks raw provider errors', async () => {
      mockAI(() => new Response(JSON.stringify({ error: { message: 'secret internal detail' } }), { status: 500 }));

      const res = await request(app).post('/chat/send').set('Cookie', user1Cookie).send({ message: 'hello' });

      assert.equal(res.status, 502);
      assert.doesNotMatch(JSON.stringify(res.body), /secret internal detail/);
    });
  });

  describe('POST /chat/send/stream', () => {
    test('streams meta, tokens and done events, then persists the reply', async () => {
      mockAIReply('Streaming works great.');

      const res = await request(app)
        .post('/chat/send/stream')
        .set('Cookie', user1Cookie)
        .send({ message: 'Stream please' });

      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/event-stream/);

      const events = parseSSE(res.text);
      assert.equal(events[0].event, 'meta');
      const tokens = events.filter((e) => e.event === 'token').map((e) => e.data.content);
      assert.ok(tokens.length > 1, 'reply arrives in multiple chunks');
      assert.equal(tokens.join(''), 'Streaming works great.');

      const done = events.at(-1);
      assert.equal(done.event, 'done');
      assert.equal(done.data.message.content, 'Streaming works great.');

      const saved = await Message.findById(done.data.message._id);
      assert.equal(saved.content, 'Streaming works great.');
    });

    test('emits an error event and rolls back when the AI fails', async () => {
      mockAI(() => new Response('nope', { status: 429 }));
      const convsBefore = await Conversation.countDocuments({ user: user1Id });

      const res = await request(app)
        .post('/chat/send/stream')
        .set('Cookie', user1Cookie)
        .send({ message: 'This will fail' });

      const last = parseSSE(res.text).at(-1);
      assert.equal(last.event, 'error');
      assert.equal(last.data.status, 429);
      assert.equal(await Conversation.countDocuments({ user: user1Id }), convsBefore);
    });

    test('returns a JSON 404 (not a stream) for a conversation the user does not own', async () => {
      const own = await Conversation.findOne({ user: user1Id });
      const res = await request(app)
        .post('/chat/send/stream')
        .set('Cookie', user2Cookie)
        .send({ conversationId: own._id.toString(), message: 'inject' });

      assert.equal(res.status, 404);
      assert.equal(res.body.error, 'Conversation not found.');
    });
  });

  describe('History & multi-tenant isolation', () => {
    let conversationId;

    before(async () => {
      const conv = await Conversation.findOne({ user: user1Id }).sort({ createdAt: 1 });
      conversationId = conv._id.toString();
    });

    test('GET /chat/history lists only the user’s conversations, newest first', async () => {
      const res = await request(app).get('/chat/history').set('Cookie', user1Cookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.conversations.length >= 1);
      const times = res.body.conversations.map((c) => new Date(c.updatedAt).getTime());
      assert.deepEqual(times, [...times].sort((a, b) => b - a));
      assert.ok(res.body.conversations.every((c) => c.user === user1Id));
    });

    test('GET /chat/history/:id returns messages in chronological order', async () => {
      const res = await request(app).get(`/chat/history/${conversationId}`).set('Cookie', user1Cookie);
      assert.equal(res.status, 200);
      assert.equal(res.body.conversation._id, conversationId);
      assert.deepEqual(
        res.body.messages.slice(0, 4).map((m) => m.role),
        ['user', 'assistant', 'user', 'assistant']
      );
    });

    test('User 2 sees an empty history', async () => {
      const res = await request(app).get('/chat/history').set('Cookie', user2Cookie);
      assert.equal(res.status, 200);
      assert.equal(res.body.conversations.length, 0);
    });

    test('User 2 cannot read, send to, rename or delete User 1’s conversation (404)', async () => {
      const attempts = [
        request(app).get(`/chat/history/${conversationId}`),
        request(app).post('/chat/send').send({ conversationId, message: 'inject' }),
        request(app).patch(`/chat/history/${conversationId}`).send({ title: 'pwned' }),
        request(app).delete(`/chat/history/${conversationId}`)
      ];
      for (const attempt of attempts) {
        const res = await attempt.set('Cookie', user2Cookie);
        assert.equal(res.status, 404);
        assert.equal(res.body.error, 'Conversation not found.');
      }
      assert.ok(await Conversation.exists({ _id: conversationId }), 'conversation still exists');
    });

    test('malformed conversation ids return 404', async () => {
      const res = await request(app).get('/chat/history/not-an-id').set('Cookie', user1Cookie);
      assert.equal(res.status, 404);
    });

    test('PATCH /chat/history/:id renames a conversation', async () => {
      const res = await request(app)
        .patch(`/chat/history/${conversationId}`)
        .set('Cookie', user1Cookie)
        .send({ title: '  Package tracking  ' });
      assert.equal(res.status, 200);
      assert.equal(res.body.conversation.title, 'Package tracking');
    });

    test('DELETE /chat/history/:id deletes the conversation and its messages', async () => {
      const res = await request(app).delete(`/chat/history/${conversationId}`).set('Cookie', user1Cookie);
      assert.equal(res.status, 204);
      assert.equal(await Conversation.exists({ _id: conversationId }), null);
      assert.equal(await Message.countDocuments({ conversation: conversationId }), 0);
    });

    test('DELETE /chat/history clears only the current user’s history', async () => {
      mockAIReply('hi');
      await request(app).post('/chat/send').set('Cookie', user2Cookie).send({ message: 'user 2 chat' });
      await request(app).post('/chat/send').set('Cookie', user1Cookie).send({ message: 'user 1 chat' });

      const res = await request(app).delete('/chat/history').set('Cookie', user1Cookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.deletedCount >= 1);

      const mine = await request(app).get('/chat/history').set('Cookie', user1Cookie);
      assert.equal(mine.body.conversations.length, 0);
      const theirs = await request(app).get('/chat/history').set('Cookie', user2Cookie);
      assert.equal(theirs.body.conversations.length, 1, 'other users are unaffected');
    });
  });
});
