// master.js
import cluster from 'cluster';
import net from 'net';
import os from 'os';
import chalk from 'chalk';
import { Logger } from './config/logger.js';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const logger = Logger(fileURLToPath(import.meta.url));
const numCPUs = os.cpus().length;
const port = process.env.APP_PORT || 3000;

// Array to store ready workers
const workers = [];

if (cluster.isPrimary) {
  logger.info(chalk.greenBright(`Master ${process.pid} is running`));
  logger.info(chalk.greenBright(`Forking ${numCPUs} workers...`));

  // Fork workers and listen for a "ready" message
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork({ WORKER_PORT: port + i });
    worker.on('message', message => {
      if (message === 'worker:ready') {
        // Only store the worker once it's confirmed ready.
        workers.push(worker);
        logger.info(chalk.green(`Worker ${worker.process.pid} is ready and stored.`));
      }
    });
  }

  // Create a TCP server to handle sticky sessions.
// Create a TCP server to handle sticky sessions.
const server = net.createServer({ pauseOnConnect: true }, connection => {
    // Clean and extract the remote IP address.
    let remoteIP = connection.remoteAddress 

// Check for IPv6 loopback and convert to IPv4.
if (remoteIP === '::1') {
    remoteIP = '127.0.0.1';
  }
    // Remove IPv6 prefix if present (e.g. "::ffff:")
    if (remoteIP.startsWith('::ffff:')) {
      remoteIP = remoteIP.replace('::ffff:', '');
    }
    
    console.log(connection.remoteAddress,'remote address')
    // Compute a hash from the IP parts.
    const ipParts = remoteIP.split('.');
    // Make sure we got a valid IPv4 address.
    if (ipParts.length !== 4) {
      remoteIP = '127.0.0.1';
    }
    
    const hashValue = ipParts.reduce((acc, part) => acc + parseInt(part, 10), 0);
    
    // Ensure we have at least one ready worker.
    if (workers.length === 0) {
      logger.error('No workers available!');
      connection.destroy();
      return;
    }
    
    const workerIndex = Math.abs(hashValue) % workers.length;
    const worker = workers[workerIndex];
    
    if (worker && typeof worker.send === 'function') {
      worker.send('sticky-session:connection', connection);
    } else {
      logger.error(`Worker at index ${workerIndex} is not available or does not have a send method.`);
      connection.destroy();
    }
  });
  
  server.listen(port, () => {
    logger.info(chalk.greenBright(`Master TCP server listening on port ${port}`));
  });

  cluster.on('exit', (worker, code, signal) => {
    logger.error(chalk.red(`Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Starting a new worker...`));
    // Optionally remove the dead worker from the array and fork a new one.
    const index = workers.findIndex(w => w.process.pid === worker.process.pid);
    if (index !== -1) workers.splice(index, 1);
    // Fork a new worker
    const newWorker = cluster.fork({ WORKER_PORT: port + worker.id - 1 });
    newWorker.on('message', message => {
      if (message === 'worker:ready') {
        workers.push(newWorker);
        logger.info(chalk.green(`Worker ${newWorker.process.pid} is ready and stored.`));
      }
    });
  });
} else {
  // In worker process, each worker gets its own port from environment variable.
  const workerPort = process.env.WORKER_PORT;

  // Import the worker startup code (start-worker.js)
  import('./start-worker.js').then(() => {
    // After successful startup, notify the master that this worker is ready.
    if (process.send) {
      process.send('worker:ready');
    }
  });
}
