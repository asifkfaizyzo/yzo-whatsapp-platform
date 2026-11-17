// backend/src/modules/tenant/auth/pending-otp.store.js (do not remove this comment)

import crypto from "crypto";
import { redisConnection } from "../../../config/redis.js";

// ── Key helpers ──
const PENDING_KEY = (t) => `auth:pending:fb:${t}`;
const OTP_KEY     = (t) => `auth:otp:pending:${t}`;
const EMAIL_KEY   = (e) => `auth:email-rate:${e}`;

// ── TTLs (seconds) ──
const PENDING_TTL    = 900;   // 15 min
const OTP_TTL        = 600;   // 10 min
const EMAIL_RATE_TTL = 3600;  // 1 hour

// ── Limits ──
const MAX_GUESSES        = 3;
const MAX_SENDS_PER_EMAIL = 3;

// ── Health ──
export function isRedisUp() {
  const s = redisConnection.status;
  return s === "ready" || s === "connect";
}

// ── Token / OTP generation ──
export function generatePendingToken() {
  return crypto.randomUUID();
}

export function generateOTP() {
  return String(crypto.randomInt(1000, 10000));
}

// ── Pending profile (providerId, name, email) ──
export async function savePending(pendingToken, data) {
  await redisConnection.setex(
    PENDING_KEY(pendingToken),
    PENDING_TTL,
    JSON.stringify(data),
  );
}

export async function getPending(pendingToken) {
  const raw = await redisConnection.get(PENDING_KEY(pendingToken));
  return raw ? JSON.parse(raw) : null;
}

// ── OTP code ──
export async function saveOtp(pendingToken, code) {
  await redisConnection.setex(
    OTP_KEY(pendingToken),
    OTP_TTL,
    JSON.stringify({ code, attempts: 0 }),
  );
}

export async function verifyOtp(pendingToken, code) {
  const key = OTP_KEY(pendingToken);
  const raw = await redisConnection.get(key);
  if (!raw) return { ok: false, error: "OTP_EXPIRED" };

  const data = JSON.parse(raw);

  if (data.attempts >= MAX_GUESSES) {
    return { ok: false, error: "OTP_LOCKED" };
  }

  if (data.code !== code) {
    data.attempts += 1;
    const ttl = await redisConnection.ttl(key);
    if (ttl > 0) {
      await redisConnection.setex(key, ttl, JSON.stringify(data));
    }
    return { ok: false, error: "OTP_INVALID" };
  }

  // Success — return pending data before cleanup
  const pending = await getPending(pendingToken);
  await redisConnection.del(PENDING_KEY(pendingToken), key);
  return { ok: true, pending };
}

// ── Email rate limit (3 per email per hour) ──
export async function checkEmailRateLimit(email) {
  const key = EMAIL_KEY(email.toLowerCase());
  const n = await redisConnection.incr(key);
  if (n === 1) await redisConnection.expire(key, EMAIL_RATE_TTL);
  return n <= MAX_SENDS_PER_EMAIL;
}