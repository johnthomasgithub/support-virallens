import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Error with an HTTP status whose message is safe to show to the client.
 */
export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

/**
 * Wrap an async route handler so rejected promises reach the error handler.
 */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Central error handler. Every error response has the shape { error: string }.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues.map((i) => i.message).join('. ') || 'Invalid request input' });
  }

  // express.json() errors: malformed JSON / payload too large
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join('. ') });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid resource identifier format.' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) logger.error(err.message, { stack: err.stack, path: req.originalUrl });

  // Only errors we created deliberately carry client-safe messages
  const isSafeMessage = err instanceof HttpError || err.name === 'AIServiceError' || !isServerError;
  res.status(statusCode).json({
    error: isSafeMessage ? err.message : 'Internal server error',
    ...(!isProduction && isServerError ? { stack: err.stack } : {})
  });
};
