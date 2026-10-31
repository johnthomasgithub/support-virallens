import { NODE_ENV, isProduction } from './env.js';

/**
 * Tiny environment-aware logger.
 * - development: human-readable lines
 * - production: one JSON object per line (easy to ingest on Render/Railway)
 * - test: silent
 */
const write = (level, message, meta) => {
  if (NODE_ENV === 'test') return;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (isProduction) {
    out(JSON.stringify({ level, message, time: new Date().toISOString(), ...meta }));
  } else {
    out(`[${level}] ${message}`, ...(meta ? [meta] : []));
  }
};

export const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta)
};

/**
 * Request logger middleware: method, path, status and duration.
 */
export const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
};
