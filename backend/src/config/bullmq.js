import { redisConnection } from './redis.js';

export const defaultQueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000 // Retry after 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24h
      count: 1000     // Keep maximum 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600 // Keep failed jobs for 7 days for debugging
    }
  }
};
