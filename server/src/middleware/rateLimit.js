import rateLimit from 'express-rate-limit';

// Rate limits are skipped in tests unless explicitly enabled
const skipInTest = () => process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_IN_TEST !== 'true';

const createLimiter = ({ windowMs, max, message, keyGenerator, skip }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: (req, res) => skipInTest() || Boolean(skip?.(req, res)),
    message: { error: message }
  });

// Global: 100 requests / 15 min per IP (health checks excluded)
export const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.path === '/health',
  message: 'Too many requests from this IP, please try again after 15 minutes.'
});

// Credential endpoints (signup/login): 10 requests / 15 min per IP — brute-force protection.
// Applied only to these routes so that session checks (/auth/me) and logout
// can never lock a legitimate user out of the app.
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again after 15 minutes.'
});

// Chat send: 20 messages / minute, keyed per user (falls back to IP)
export const chatSendLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req.user ? `user:${req.user._id}` : req.ip),
  message: 'Too many messages sent. Please wait a moment before sending another.'
});
