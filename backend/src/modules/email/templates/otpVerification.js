// backend/src/modules/email/templates/otpVerification.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Email verification OTP code.
 *
 * @param {Object} context
 * @param {string} context.otpCode - 4-digit OTP
 * @returns {{ subject: string, html: string }}
 */
export default function otpVerification({ otpCode }) {
  const subject = "Verify Your Email Address";

  const html = wrapEmail({
    title: "Email Verification",
    header: renderHeader({
      title: "Email Verification",
      subtitle: "One-time password",
      icon: ICONS.LOCK,
    }),
    body: `
      <p>Hi there,</p>
      <p>Thank you for signing up. Please use the following One-Time Password (OTP) to verify your email address:</p>

      <div style="background: #F1F5F9; border: 2px dashed #CBD5E1; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #125EF2; font-family: 'Courier New', monospace;">
          ${otpCode}
        </span>
      </div>

      <p>This code is valid for <strong>10 minutes</strong>.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}