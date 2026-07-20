import dotenv from 'dotenv';
dotenv.config();

// ✅ Add environment variable check right after dotenv.config()
const requiredEnvVars = [
  'DATABASE_URL',
  'ACCESS_SECRET',
  'REFRESH_SECRET',
];
const missingEnvs = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvs.length > 0) {
  console.error(`❌ FATAL: Missing required environment variables: ${missingEnvs.join(', ')}`);
  process.exit(1);
}

import http from 'http';
import app from './app.js';
import { initSocket } from './lib/socket.js';
import { startWebhookWorker } from './workers/webhookWorker.js';
import { startBroadcastWorker } from './workers/broadcastWorker.js';
import { startCleanupWorker } from './workers/cleanupWorker.js';
import './jobs/checkExpiredSubscriptions.js';
import './jobs/expiryRemindersJob.js';

const port = process.env.PORT;

// Wrap Express app in HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start BullMQ Background Workers & Cleanup Workers
startWebhookWorker();
startBroadcastWorker();
startCleanupWorker();
console.log('👷 Background workers and cleanup tasks started successfully!');

server.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});

