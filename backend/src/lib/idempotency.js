// src/lib/idempotency.js
import redisConnection from '../config/redis.js';

// Meta stops retrying after 24 hours, so we only need to remember for 24h
const DEDUP_TTL_SECONDS = 60 * 60 * 24;

/**
 * Atomically check if a webhook event was already processed.
 * Uses Redis SET NX (set if not exists) for atomicity.
 * 
 * @param {string} eventId - Unique ID from Meta (message.id or status.id + status)
 * @returns {Promise<boolean>} true = NEW event, false = DUPLICATE
 */
export const isNewWebhookEvent = async (eventId) => {
  // Safety fallback — if no ID, process it (don't block)
  if (!eventId) {
    console.warn('⚠️ [Idempotency] No eventId provided — processing anyway');
    return true;
  }

  const key = `webhook:seen:${eventId}`;

  try {
    // SET NX EX 86400 = "set only if not exists, expire in 24h"
    // Returns 'OK' if key was created, null if it already existed
    const result = await redisConnection.set(
      key,
      Date.now().toString(),
      'EX', DEDUP_TTL_SECONDS,
      'NX'
    );

    return result === 'OK';
  } catch (error) {
    console.error('❌ [Idempotency] Redis error:', error.message);
    // If Redis fails, process the webhook anyway (fail open)
    return true;
  }
};