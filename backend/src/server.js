import dotenv from 'dotenv';
dotenv.config();

// ✅ Environment variables check
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
import { startOrderWebhookWorker } from './workers/orderWebhookWorker.js';
import { startBroadcastWorker } from './workers/broadcastWorker.js';
import { startCleanupWorker } from './workers/cleanupWorker.js';
import './jobs/checkExpiredSubscriptions.js';
import './jobs/expiryRemindersJob.js';
import { startAuditCleanupJob } from './jobs/auditCleanupJob.js';
import { startWebhookEventsCleanupJob } from './jobs/cleanupWebhookEventsJob.js';
import { initQuickReplyIndexes } from './scripts/initQuickReplyIndexes.js';
import { startZohoSyncWorker } from './workers/zohoSyncWorker.js';

import { redisConnection } from './config/redis.js';

const port = process.env.PORT || 5000;

// Wrap Express app in HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start BullMQ Background Workers & Cleanup Workers
const webhookWorker = startWebhookWorker();
const orderWebhookWorker = startOrderWebhookWorker();
const broadcastWorker = startBroadcastWorker();
const zohoSyncWorker = startZohoSyncWorker();
startCleanupWorker();
startAuditCleanupJob(); 
startWebhookEventsCleanupJob();
initQuickReplyIndexes();
console.log('👷 Background workers and cleanup tasks started successfully!');

server.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port} [Updated Enum Fix: ${new Date().toISOString()}]`);
});

// ───────────── Graceful Shutdown for PM2 / Docker / Systemd ─────────────
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️ Received ${signal}. Initiating graceful shutdown...`);
  
  // Stop accepting new incoming HTTP requests
  server.close(async () => {
    console.log('🛑 HTTP server stopped.');
    try {
      // Allow active BullMQ worker jobs to finish safely
      if (webhookWorker) await webhookWorker.close();
      if (orderWebhookWorker) await orderWebhookWorker.close();
      if (broadcastWorker) await broadcastWorker.close();
      if (zohoSyncWorker) await zohoSyncWorker.close();
      console.log('👷 BullMQ workers closed successfully.');

      // Safely close Redis connection
      await redisConnection.quit();
      console.log('⚡ Redis connection closed.');
      
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during graceful shutdown:', err);
      process.exit(1);
    }
  });
};


process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


