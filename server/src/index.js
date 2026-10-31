import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { PORT, NODE_ENV } from './config/env.js';
import { logger } from './config/logger.js';

const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    logger.error(`[Database] Connection failed: ${error.message}`);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`[Server] Listening on port ${PORT} (${NODE_ENV})`);
  });

  server.on('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`[Server] Port ${PORT} is already in use — another instance is probably running. Stop it or change PORT in .env.`);
    } else {
      logger.error(`[Server] ${error.message}`);
    }
    await disconnectDB();
    process.exit(1);
  });

  // Graceful shutdown: stop accepting connections, then close the DB (Docker sends SIGTERM)
  const shutdown = (signal) => {
    logger.info(`[Server] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();
