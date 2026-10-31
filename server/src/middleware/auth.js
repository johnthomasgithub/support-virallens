import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import User from '../models/User.js';
import { HttpError, asyncHandler } from './errorHandler.js';

export const COOKIE_NAME = 'token';

/**
 * Generate a signed JWT valid for 7 days
 */
export const generateToken = (userId) => jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });

/**
 * Protect routes via the httpOnly cookie JWT and attach req.user
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new HttpError(401, 'Authentication required.');

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new HttpError(401, 'Your session has expired. Please log in again.');

  req.user = user;
  next();
});
