import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

let instance = null;

export const getRazorpay = () => {
  const key_id = (process.env.RAZORPAY_KEY_ID || "").trim();
  const key_secret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!key_id || !key_secret) {
    console.warn("⚠️ Warning: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing or empty.");
  }

  if (!instance) {
    instance = new Razorpay({
      key_id,
      key_secret,
    });
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
