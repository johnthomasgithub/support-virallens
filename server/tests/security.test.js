import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

describe('Security & Robustness Tests', () => {
  test('Undefined route returns consistent JSON 404 error', async () => {
    const res = await request(app).get('/api/unknown-endpoint-xyz');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Endpoint not found.' });
  });

  test('Payload too large is rejected (exceeding 100kb limit)', async () => {
    const largePayload = {
      email: 'large@example.com',
      password: 'Password123!',
      extra: 'a'.repeat(110 * 1024) // 110 KB
    };

    const res = await request(app)
      .post('/auth/signup')
      .send(largePayload);

    // Express json parser rejects with 413 Payload Too Large
    assert.equal(res.status, 413);
  });

  test('Password exceeding 128 characters is rejected by validation', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({
        email: 'attacker@example.com',
        password: 'A'.repeat(129)
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('128 characters'));
  });

  test('X-Powered-By header is removed for security obfuscation', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});


describe('Security headers & error shape', () => {
  test('Helmet security headers are present', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['content-security-policy']);
  });

  test('malformed JSON returns a clean 400', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Malformed JSON in request body.');
  });
});
