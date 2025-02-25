// start-worker.js
import stoppable from 'stoppable';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { Logger } from './config/logger.js';

import app from './app.js';

import { gracefulShutdown } from './utils/graceful-shutdown.js';
import 'dotenv/config';

const logger = Logger(fileURLToPath(import.meta.url));
const workerPort = process.env.WORKER_PORT;

const server = app.listen(workerPort, () => {
  logger.info(`Worker ${process.pid} - App running on port ${chalk.greenBright(workerPort)}...`);
});

// Standard error and shutdown handling (as before)
app.on('error', (appErr, appCtx) => {
  logger.error(`Worker ${process.pid} - App Error: '${appErr.stack}' on url: '${appCtx.req.url}' with headers: '${appCtx.req.headers}'`);
});

process.on('unhandledRejection', async err => {
  logger.error(chalk.bgRed('UNHANDLED REJECTION! 💥 Shutting down...'));
  logger.error(err.name, err.message);
  await gracefulShutdown(stoppable(server));
});

process.on('uncaughtException', async uncaughtExc => {
  logger.error(chalk.bgRed('UNCAUGHT EXCEPTION! 💥 Shutting down...'));
  logger.error(`Worker ${process.pid} - UncaughtException Error: ${uncaughtExc}`);
  logger.error(`Worker ${process.pid} - UncaughtException Stack: ${JSON.stringify(uncaughtExc.stack)}`);
  await gracefulShutdown(stoppable(server));
});

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, async () => {
    logger.warn(`Worker ${process.pid} - Received ${signal} signal. Shutting down...`);
    await gracefulShutdown(server);
  });
});

// Handle connection passed from master for sticky sessions
process.on('message', (message, connection) => {
  if (message === 'sticky-session:connection') {
    server.emit('connection', connection);
    connection.resume();
  }
});
