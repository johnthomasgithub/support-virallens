import axios from 'axios';

/**
 * API base URL.
 * - VITE_API_URL wins if set (local dev, Docker, or calling the API cross-domain).
 * - Production builds otherwise use "/api" on the site's own domain, which the host
 *   proxies to the API (see vercel.json). Same-origin = first-party auth cookie, no CORS.
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000')
).replace(/\/+$/, '');

/** Fired when the server says the session is no longer valid. AuthContext listens for it. */
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send the httpOnly auth cookie
  timeout: 45_000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    // A 401 from anything other than the auth endpoints means the session expired mid-use
    if (error.response?.status === 401 && !url.startsWith('/auth/')) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

const STATUS_MESSAGES = {
  429: 'You are sending requests too quickly. Please wait a moment and try again.',
  502: 'The AI assistant is temporarily unavailable. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
  504: 'The AI assistant took too long to respond. Please try again.'
};

/**
 * Turn any API error (axios error or ApiError) into a human-readable message.
 */
export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error?.name === 'ApiError') return error.message;
  if (error?.response?.data?.error) return error.response.data.error;
  const status = error?.response?.status;
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (!error?.response && (error?.code === 'ERR_NETWORK' || error instanceof TypeError)) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return fallback;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export default api;
