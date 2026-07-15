import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { initSocket } from './lib/socket.js';
import { startWebhookWorker } from './workers/webhookWorker.js';
import { startBroadcastWorker } from './workers/broadcastWorker.js';
import { startCleanupWorker } from './workers/cleanupWorker.js';

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

