import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startTestDB } from './helpers.js';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';

let stopDB;

describe('Auth API', () => {
  before(async () => {
    stopDB = await startTestDB();
  });

  after(async () => {
    await stopDB();
  });

  describe('Health Check Endpoint', () => {
    test('GET /health returns { ok: true }', async () => {
      const res = await request(app).get('/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
    });
  });

  describe('Authentication Flow', () => {
    const testUser = {
      email: 'support-test@example.com',
      password: 'Password123!'
    };

    test('POST /auth/signup - creates user, sets httpOnly cookie, returns sanitized user', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send(testUser);

      assert.equal(res.status, 201);
      assert.ok(res.body.user);
      assert.equal(res.body.user.email, testUser.email);
      assert.ok(res.body.user._id);
      assert.ok(res.body.user.createdAt);
      assert.equal(res.body.user.passwordHash, undefined, 'passwordHash must never be exposed');

      // Verify cookie set
      const cookies = res.headers['set-cookie'];
      assert.ok(cookies, 'set-cookie header should be present');
      const authCookie = cookies.find((c) => c.startsWith('token='));
      assert.ok(authCookie, 'token cookie must be set');
      assert.ok(authCookie.includes('HttpOnly'), 'cookie must be HttpOnly');
    });

    test('POST /auth/signup - rejects invalid email', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'invalid-email', password: 'Password123!' });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    test('POST /auth/signup - rejects password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'short@example.com', password: 'short' });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('8 characters'));
    });

    test('POST /auth/signup - rejects duplicate email with 409', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send(testUser);

      assert.equal(res.status, 409);
      assert.ok(res.body.error.includes('already exists'));
    });

    test('POST /auth/login - fails with wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword999!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Invalid email or password.');
    });

    test('POST /auth/login - fails with non-existent email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password123!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, 'Invalid email or password.');
    });

    test('POST /auth/login - succeeds with correct credentials and sets cookie', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send(testUser);

      assert.equal(res.status, 200);
      assert.ok(res.body.user);
      assert.equal(res.body.user.email, testUser.email);
      assert.equal(res.body.user.passwordHash, undefined);

      const cookies = res.headers['set-cookie'];
      assert.ok(cookies);
      const authCookie = cookies.find((c) => c.startsWith('token='));
      assert.ok(authCookie);
    });

    test('GET /auth/me - rejects without cookie (401)', async () => {
      const res = await request(app).get('/auth/me');
      assert.equal(res.status, 401);
      assert.ok(res.body.error);
    });

    test('GET /auth/me - rejects with invalid token (401)', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', ['token=invalid.jwt.token']);
      assert.equal(res.status, 401);
      assert.ok(res.body.error);
    });

    test('GET /auth/me - succeeds with valid session cookie', async () => {
      // Log in first to acquire cookie
      const loginRes = await request(app)
        .post('/auth/login')
        .send(testUser);

      const cookie = loginRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/auth/me')
        .set('Cookie', cookie);

      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.user.email, testUser.email);
      assert.equal(meRes.body.user.passwordHash, undefined);
    });

    test('POST /auth/logout - rejects without cookie (401)', async () => {
      const res = await request(app).post('/auth/logout');
      assert.equal(res.status, 401);
    });

    test('POST /auth/logout - clears cookie and invalidates session', async () => {
      // Log in
      const loginRes = await request(app)
        .post('/auth/login')
        .send(testUser);

      const cookie = loginRes.headers['set-cookie'];

      // Logout
      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookie);

      assert.equal(logoutRes.status, 200);
      assert.ok(logoutRes.body.message);

      // Verify cookie cleared
      const cookies = logoutRes.headers['set-cookie'];
      const clearedCookie = cookies.find((c) => c.startsWith('token='));
      assert.ok(clearedCookie);
      // Express clearCookie sets max-age=0 or expires in the past
      assert.ok(clearedCookie.includes('Expires=') || clearedCookie.includes('Max-Age=0'));
    });
  });


  describe('Auth hardening', () => {
    test('emails are normalized: login is case-insensitive', async () => {
      await request(app).post('/auth/signup').send({ email: 'Mixed.Case@Example.com', password: 'Password123!' });
      const res = await request(app).post('/auth/login').send({ email: 'MIXED.case@example.COM', password: 'Password123!' });
      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'mixed.case@example.com');
    });

    test('passwords are stored as bcrypt hashes, never in plain text', async () => {
      const user = await User.findOne({ email: 'mixed.case@example.com' }).select('+passwordHash');
      assert.match(user.passwordHash, /^\$2[aby]\$12\$/, 'bcrypt with 12 salt rounds');
      assert.ok(!user.passwordHash.includes('Password123!'));
    });

    test('passwordHash is excluded from queries by default', async () => {
      const user = await User.findOne({ email: 'mixed.case@example.com' });
      assert.equal(user.passwordHash, undefined);
    });

    test('dev cookie is HttpOnly, SameSite=Lax, Path=/ and expires in 7 days', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'mixed.case@example.com', password: 'Password123!' });
      const cookie = res.headers['set-cookie'].find((c) => c.startsWith('token='));
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Path=\//);
      assert.match(cookie, /Max-Age=604800/);
    });

    test('signup accepts an optional display name', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({ email: 'named@example.com', password: 'Password123!', name: 'Ada Lovelace' });
      assert.equal(res.status, 201);
      assert.equal(res.body.user.name, 'Ada Lovelace');
    });
  });
});
