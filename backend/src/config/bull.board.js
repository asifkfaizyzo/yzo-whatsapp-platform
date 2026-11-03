// backend/src/config/bull.board.js (do not remove this comment)
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { broadcastQueue } from '../cron/queues/broadcast.queue.js';
import { webhookQueue } from '../cron/queues/webhook.queue.js';
import { dlqQueue } from '../cron/queues/dlq.queue.js';
import { orderWebhookQueue } from '../cron/queues/order-webhook.queue.js';

// 1. Initialize Express adapter for Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// 2. Attach queues to dashboard
createBullBoard({
  queues: [
    new BullMQAdapter(broadcastQueue),
    new BullMQAdapter(webhookQueue),
    new BullMQAdapter(orderWebhookQueue),
    new BullMQAdapter(dlqQueue),
  ],
  serverAdapter,
});

export { serverAdapter };