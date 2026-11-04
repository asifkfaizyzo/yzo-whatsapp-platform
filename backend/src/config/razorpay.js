// backend/src/config/razorpay.js (do not remove this comment)
import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

let instance = null;
let cachedKeyId = null;

export const getRazorpay = () => {
  const key_id = (process.env.RAZORPAY_KEY_ID || "").trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!key_id || !key_secret) {
    console.error("❌ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from .env");
    throw new Error("Razorpay credentials not configured");
  }

  // Recreate instance if keys changed or if previous instance was broken
  if (!instance || cachedKeyId !== key_id) {
    instance = new Razorpay({ key_id, key_secret });
    cachedKeyId = key_id;
    console.log(`✅ Razorpay initialized (key: ${key_id.slice(0, 10)}...)`);
  }

  return instance;
};

// Proxy to allow direct property access like razorpay.subscriptions.cancel(...)
export const razorpay = new Proxy({}, {
  get(target, prop) {
    const client = getRazorpay();
    return client[prop];
  }
});

export default razorpay;