// src/lib/rateLimiter.js
import { redisConnection } from '../config/redis.js';

export const META_TIER_LIMITS = {
  TIER_50:  { name: 'Sandbox / Trial', maxPerSec: 10,  dailyCap: 50,     safetyMargin: 0.95 },
  TIER_250: { name: 'Tier 250 (Unverified)', maxPerSec: 15, dailyCap: 250, safetyMargin: 0.90 },
  TIER_1K:  { name: 'Tier 1K (1,000 / 24h)', maxPerSec: 40, dailyCap: 1000, safetyMargin: 0.90 },
  TIER_10K: { name: 'Tier 10K (10,000 / 24h)', maxPerSec: 200, dailyCap: 10000, safetyMargin: 0.90 },
  TIER_100K:{ name: 'Tier 100K (100,000 / 24h)', maxPerSec: 800, dailyCap: 100000, safetyMargin: 0.90 },
  TIER_UNLIMITED: { name: 'Unlimited Tier', maxPerSec: 1000, dailyCap: Infinity, safetyMargin: 1.0 },
};

/**
 * Normalizes tier name from health/settings to tier limit config.
 */
export const getTierConfig = (tierString) => {
  if (!tierString) return META_TIER_LIMITS.TIER_1K;
  const upper = String(tierString).toUpperCase();
  if (upper.includes('100K') || upper.includes('100000')) return META_TIER_LIMITS.TIER_100K;
  if (upper.includes('10K') || upper.includes('10000'))   return META_TIER_LIMITS.TIER_10K;
  if (upper.includes('1K') || upper.includes('1000'))     return META_TIER_LIMITS.TIER_1K;
  if (upper.includes('250'))                              return META_TIER_LIMITS.TIER_250;
  if (upper.includes('50'))                               return META_TIER_LIMITS.TIER_50;
  if (upper.includes('UNLIMITED'))                        return META_TIER_LIMITS.TIER_UNLIMITED;
  return META_TIER_LIMITS.TIER_1K;
};

/**
 * Tracks and checks 24-hour unique recipient daily limits in Redis per tenant.
 */
export const checkAndIncrementDailyCap = async (tenantId, tierString = 'TIER_1K', recipientPhone) => {
  if (!tenantId || !recipientPhone) return { allowed: true };

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const redisKey = `tenant:${tenantId}:broadcast_contacts:${today}`;
    
    // Add contact to Redis Set for today (returns 1 if new contact today, 0 if already sent to today)
    const isNewToday = await redisConnection.sadd(redisKey, recipientPhone);
    
    // Set 48h TTL on key so it automatically cleans up
    await redisConnection.expire(redisKey, 48 * 60 * 60);

    const currentUniqueCount = await redisConnection.scard(redisKey);
    const tierConfig = getTierConfig(tierString);
    const effectiveCap = Math.floor(tierConfig.dailyCap * tierConfig.safetyMargin);

    if (currentUniqueCount > effectiveCap && isNewToday === 1) {
      return {
        allowed: false,
        currentCount: currentUniqueCount,
        dailyCap: tierConfig.dailyCap,
        effectiveCap,
        reason: `Daily Meta messaging tier cap reached (${currentUniqueCount}/${tierConfig.dailyCap} unique contacts in 24h).`,
      };
    }

    return {
      allowed: true,
      currentCount: currentUniqueCount,
      dailyCap: tierConfig.dailyCap,
      remaining: Math.max(0, tierConfig.dailyCap - currentUniqueCount),
    };
  } catch (error) {
    console.warn('[rateLimiter] Redis daily cap check warning:', error.message);
    return { allowed: true }; // Fail-open gracefully if Redis transient issue
  }
};
