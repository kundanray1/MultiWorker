// server.js

import cors from 'cors';

import chalk from 'chalk';
import stoppable from 'stoppable';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import app from './app.js';
import { gracefulShutdown } from './utils/graceful-shutdown.js';
import { Logger } from './config/logger.js';

const logger = Logger(fileURLToPath(import.meta.url));
const port = process.env.APP_PORT || 3000;
app.use(cors({ origin: '*' }));
// All workers call app.listen(port). They all share the same port.
const server = app.listen(port, () => {
  logger.info(`Worker ${process.pid} - App running on port ${chalk.greenBright(port)}...`);
});

// Your error handling and graceful shutdown logic
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


