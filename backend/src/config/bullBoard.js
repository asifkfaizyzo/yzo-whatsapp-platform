// src/config/bullBoard.js
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { broadcastQueue } from '../queues/broadcastQueue.js';
import { webhookQueue } from '../queues/webhookQueue.js';
import { dlqQueue } from '../queues/dlqQueue.js';

// 1. Initialize Express adapter for Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// 2. Attach queues to dashboard
createBullBoard({
  queues: [
    new BullMQAdapter(broadcastQueue),
    new BullMQAdapter(webhookQueue),
    new BullMQAdapter(dlqQueue),
  ],
  serverAdapter,
});

export { serverAdapter };