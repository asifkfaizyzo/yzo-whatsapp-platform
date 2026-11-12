// backend/src/modules/email/email.transport.js (do not remove this comment)
import nodemailer from "nodemailer";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

// ── Validate required env vars at module load time ──
// Fails fast with a clear message instead of silently dropping emails
const requiredEnvVars = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "SES_FROM_EMAIL",
];
const missing = requiredEnvVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  throw new Error(
    `[EmailTransport] Missing required env vars: ${missing.join(", ")}. ` +
      `Check your .env file.`,
  );
}

// ── SES Client (AWS SDK v3 — SESv2) ──
const sesClient = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ── Nodemailer Transport (Nodemailer 8 requires SESv2) ──
const transporter = nodemailer.createTransport({
  SES: { sesClient, SendEmailCommand },
});

// ── Verified sender address ──
export const FROM_EMAIL = process.env.SES_FROM_EMAIL;

export default transporter;