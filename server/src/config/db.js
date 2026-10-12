import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 4000 });
    logger.success(`MongoDB connected → ${mongoose.connection.name}`);
  } catch (err) {
    logger.error('MongoDB is not running on localhost:27017 — start it with `net start MongoDB` or MongoDB Compass');
    logger.error(err.message);
    process.exit(1);
  }
}
