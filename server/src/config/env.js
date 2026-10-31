import dotenv from 'dotenv';

dotenv.config();

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isProduction = NODE_ENV === 'production';
export const isTest = NODE_ENV === 'test';
export const PORT = Number(process.env.PORT) || 5000;
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-support-agent';

export const JWT_SECRET =
  process.env.JWT_SECRET || (isProduction ? undefined : 'dev-only-insecure-secret-change-me');

if (isProduction && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');
}

/**
 * CLIENT_URL may be a single origin or a comma-separated list
 * (e.g. production domain + a preview domain).
 */
export const CLIENT_URLS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);
export const CLIENT_URL = CLIENT_URLS[0];

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || (isTest ? 'test-openrouter-key' : '');
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
export const OPENROUTER_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || '';

/**
 * Number of reverse proxies in front of the app (Render/Railway/Nginx = 1).
 * Needed so rate limiting and secure cookies see the real client IP/protocol.
 */
export const TRUST_PROXY = Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0));

/**
 * Cookie options matching environment requirements:
 * - development: sameSite "lax", not secure (http://localhost)
 * - production: secure, sameSite "none" by default (client and API on different domains).
 *   Set COOKIE_SAMESITE=lax when the client proxies the API under its own domain
 *   (e.g. the Vercel /api rewrite) — the cookie is then first-party and Lax is stricter.
 */
const SAME_SITE_VALUES = ['lax', 'strict', 'none'];
const configuredSameSite = process.env.COOKIE_SAMESITE?.toLowerCase();
const sameSite = SAME_SITE_VALUES.includes(configuredSameSite) ? configuredSameSite : isProduction ? 'none' : 'lax';

const baseCookieOptions = {
  httpOnly: true,
  // SameSite=None is only accepted by browsers on Secure cookies
  secure: isProduction || sameSite === 'none',
  sameSite,
  path: '/'
};

export const getAuthCookieOptions = () => ({
  ...baseCookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days, matches JWT expiry
});

export const getClearCookieOptions = () => ({ ...baseCookieOptions });
