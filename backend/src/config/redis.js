import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Mandatory for BullMQ compatibility
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    console.warn(`⚠️ Redis connection lost. Retrying in ${delay}ms (attempt ${times})...`);
    return delay;
  }
};

// Use REDIS_URL if provided (e.g. Upstash, Redis Cloud, Render), else fallback to connection object
export const redisConnection = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
  : new Redis(redisOptions);

redisConnection.on('connect', () => {
  console.log('⚡ Connected to Redis successfully');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err.message);
});

export default redisConnection;
