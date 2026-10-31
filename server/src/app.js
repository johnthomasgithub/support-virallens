import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { CLIENT_URLS, TRUST_PROXY, isTest } from './config/env.js';
import { requestLogger } from './config/logger.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, HttpError } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY);

app.use(helmet());

// CORS: only the configured client origin(s), with credentials (cookies)
app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without an Origin header (curl, server-to-server, health checks)
      if (!origin || isTest) return callback(null, true);
      if (CLIENT_URLS.includes(origin.replace(/\/+$/, ''))) return callback(null, true);
      return callback(new HttpError(403, 'Access denied by CORS policy.'));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (!isTest) app.use(requestLogger);

app.use(globalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down' });
});

app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use(errorHandler);

export default app;
