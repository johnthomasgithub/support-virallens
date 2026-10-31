import mongoose from 'mongoose';
import { MONGODB_URI } from './env.js';
import { logger } from './logger.js';

export const connectDB = async () => {
  const conn = await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  logger.info(`[Database] MongoDB connected: ${conn.connection.host}`);
  return conn;
};

export const disconnectDB = () => mongoose.connection.close();
