import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cloudoptima',
  jwtSecret: process.env.JWT_SECRET || 'change_me',
  jwtExpiresIn: '1d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  simulatorLive: process.env.SIMULATOR_LIVE !== 'false',
  usdToInr: Number(process.env.USD_TO_INR) || 83.5,
  isProd: process.env.NODE_ENV === 'production',
};
