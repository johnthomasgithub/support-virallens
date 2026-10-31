import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startTestDB } from './helpers.js';

// This file runs in its own process (node --test), so enabling limits here
// doesn't affect other test files.
process.env.ENABLE_RATE_LIMIT_IN_TEST = 'true';
const { default: app } = await import('../src/app.js');

let stopDB;
let cookie;

describe('Rate limits', () => {
  before(async () => {
    stopDB = await startTestDB();
    const res = await request(app).post('/auth/signup').send({ email: 'limit@example.com', password: 'Password123!' });
    cookie = res.headers['set-cookie'];
  });

  after(async () => {
    await stopDB();
  });

  describe('Rate limiting', () => {
    test('login/signup are limited to 10 requests per 15 minutes', async () => {
      // The signup in before() already used 1 of the 10
      for (let i = 0; i < 9; i++) {
        const res = await request(app).post('/auth/login').send({ email: 'limit@example.com', password: 'wrong-password' });
        assert.equal(res.status, 401);
      }
      const blocked = await request(app).post('/auth/login').send({ email: 'limit@example.com', password: 'Password123!' });
      assert.equal(blocked.status, 429);
      assert.match(blocked.body.error, /Too many authentication attempts/);
      assert.ok(blocked.headers['ratelimit-limit'], 'standard RateLimit headers are sent');
    });

    test('session checks (/auth/me) are not blocked by the credential limiter', async () => {
      for (let i = 0; i < 15; i++) {
        const res = await request(app).get('/auth/me').set('Cookie', cookie);
        assert.equal(res.status, 200);
      }
    });

    test('/health is never rate limited', async () => {
      for (let i = 0; i < 5; i++) {
        assert.equal((await request(app).get('/health')).status, 200);
      }
      const res = await request(app).get('/health');
      assert.equal(res.headers['ratelimit-limit'], undefined);
    });
  });
});
