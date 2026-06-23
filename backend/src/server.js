// backend/src/server.js
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { initSocket } from './lib/socket.js';

const port = process.env.PORT;

// Wrap Express app in HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
