// backend/src/modules/email/templates/passwordReset.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Password reset link email.
 *
 * @param {Object} context
 * @param {string} context.resetLink - Full URL with token
 * @returns {{ subject: string, html: string }}
 */
export default function passwordReset({ resetLink }) {
  const subject = "Reset Your Password";

  const html = wrapEmail({
    title: "Password Reset",
    header: renderHeader({
      title: "Password Reset Request",
      subtitle: "Secure your account",
      icon: ICONS.KEY,
    }),
    body: `
      <p>Hi,</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>

      ${renderButton({ href: resetLink, text: "Reset Password", color: "primary" })}

      <p>This link expires in <strong>1 hour</strong>.</p>
      <p>If you did not request this, you can safely ignore this email. Your password will not change.</p>

      <div class="info-card">
        <p style="color: #94A3B8; font-size: 12px; margin: 0;">
          If the button does not work, copy and paste this link into your browser:
        </p>
        <p style="color: #64748B; font-size: 12px; margin: 6px 0 0 0; word-break: break-all;">
          ${resetLink}
        </p>
      </div>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}