// backend/src/utils/recaptcha.js (do not remove this comment)

import axios from "axios";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const MIN_SCORE = 0.5; // reCAPTCHA v3 score threshold (0.0 = bot, 1.0 = human)

/**
 * Verify a reCAPTCHA v3 token with Google.
 *
 * Behavior:
 * - If RECAPTCHA_SECRET_KEY is not set → returns true (fail-open for dev)
 * - If Google API is unreachable → returns true (fail-open for availability)
 * - If score < 0.5 → returns false (likely bot)
 *
 * @param {string} token - The reCAPTCHA token from the frontend
 * @param {string} [action] - Optional action name to verify (e.g. "signup", "login")
 * @returns {Promise<boolean>}
 */
export const verifyRecaptcha = async (token, action = null) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  // Fail-open in development or if not configured
  if (!secret) {
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const response = await axios.post(VERIFY_URL, null, {
      params: { secret, response: token },
      timeout: 5000,
    });

    const data = response.data;

    if (!data.success) {
      return false;
    }

    // v3 score check
    if (typeof data.score === "number" && data.score < MIN_SCORE) {
      return false;
    }

    // Optional action verification
    if (action && data.action && data.action !== action) {
      return false;
    }

    return true;
  } catch (err) {
    // Network error — fail-open to avoid blocking real users
    console.error("reCAPTCHA verification failed:", err.message);
    return true;
  }
};