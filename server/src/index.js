import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cron from 'node-cron';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { verifyToken } from './middleware/auth.js';
import { setIO } from './services/realtime.js';
import { syncAll } from './services/syncService.js';
import { startLiveTicker } from './simulation/liveTicker.js';
import { logger } from './utils/logger.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev', { skip: (req) => req.path === '/api/health', stream: { write: (m) => logger.debug(m.trim()) } }));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.clientUrl, credentials: true } });

// Only authenticated dashboards may subscribe to live events.
io.use((socket, next) => {
  try {
    socket.data.user = verifyToken(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});
setIO(io);

async function start() {
  await connectDB();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') logger.error(`Port ${env.port} is already in use — stop the other process or change PORT in server/.env`);
    else logger.error(err);
    process.exit(1);
  });
  server.listen(env.port, () => logger.success(`API listening on http://localhost:${env.port}/api`));

  if (env.simulatorLive) {
    startLiveTicker();
    // Catch up on metrics/costs missed while the server was down, then keep costs fresh daily.
    setTimeout(() => syncAll({ quiet: true }).then(() => logger.info('Background catch-up sync complete')).catch(() => {}), 3000);
    cron.schedule('10 0 * * *', () => syncAll({ quiet: true }).catch(() => {}));
  } else {
    logger.warn('SIMULATOR_LIVE=false — live metric ticks are disabled');
  }
}

start();

const shutdown = () => {
  io.close();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
