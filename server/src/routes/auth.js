import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import { COOKIE_NAME, generateToken, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { getAuthCookieOptions, getClearCookieOptions } from '../config/env.js';

const router = express.Router();

const credentialsSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address')
    .max(254, 'Email address cannot exceed 254 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters')
});

const signupSchema = credentialsSchema.extend({
  name: z.string().trim().max(60, 'Name cannot exceed 60 characters').optional()
});

// Compared against when the email doesn't exist, so a login attempt takes the
// same time whether or not the account exists (prevents user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('timing-attack-dummy-password', 12);

const issueSession = (res, user) => {
  res.cookie(COOKIE_NAME, generateToken(user._id), getAuthCookieOptions());
};

/**
 * POST /auth/signup — create an account and start a session
 */
router.post(
  '/signup',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, name } = signupSchema.parse(req.body);

    if (await User.exists({ email })) {
      throw new HttpError(409, 'An account with this email already exists.');
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ email, name: name || undefined, passwordHash });

    issueSession(res, user);
    res.status(201).json({ user });
  })
);

/**
 * POST /auth/login — validate credentials and start a session
 */
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);

    const user = await User.findOne({ email }).select('+passwordHash');
    const isMatch = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !isMatch) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    issueSession(res, user);
    res.status(200).json({ user });
  })
);

/**
 * POST /auth/logout — clear the session cookie
 */
router.post('/logout', requireAuth, (req, res) => {
  res.clearCookie(COOKIE_NAME, getClearCookieOptions());
  res.status(200).json({ message: 'Logged out successfully.' });
});

/**
 * GET /auth/me — current user (used by the client to restore the session)
 */
router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

export default router;
