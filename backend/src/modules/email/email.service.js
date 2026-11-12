// backend/src/modules/email/email.service.js (do not remove this comment)
import prisma from "../../config/prisma.js";
import transporter, { FROM_EMAIL } from "./email.transport.js";

/**
 * Central email sender.
 * - Sends via SES transport
 * - Logs every attempt (success + failure) to EmailLog table
 * - Throws on send failure (callers wrap in try/catch if non-critical)
 *
 * @param {Object} opts
 * @param {string} opts.to          - Recipient email
 * @param {string} opts.subject     - Email subject
 * @param {string} opts.html        - HTML body
 * @param {string} opts.category    - AUTH | BILLING | NOTIFICATION | SYSTEM
 * @param {string} [opts.tenantId]  - Tenant ID for audit trail (null for system emails)
 * @param {string} [opts.fromName]  - Display name (default: "SudoReply")
 * @param {Array}  [opts.attachments] - Nodemailer attachment objects
 * @param {Object} [opts.metadata]  - Arbitrary JSON for audit log
 * @returns {Promise<{ messageId: string }>}
 */
export const sendEmail = async ({
  to,
  subject,
  html,
  category,
  tenantId = null,
  fromName = "SudoReply",
  attachments = [],
  metadata = {},
}) => {
  const from = `"${fromName}" <${FROM_EMAIL}>`;
  let messageId = null;
  let errorMessage = null;
  let status = "SENT";

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      ...(attachments.length > 0 ? { attachments } : {}),
    });
    messageId = info.messageId || null;
    return { messageId };
  } catch (err) {
    status = "FAILED";
    errorMessage = err.message || String(err);
    throw err; // Re-throw so callers can handle (or not)
  } finally {
    // ── Audit log: always runs, regardless of success/failure ──
    try {
      await prisma.emailLog.create({
        data: {
          tenantId,
          to,
          from,
          subject,
          category,
          status,
          providerMessageId: messageId,
          errorMessage,
          metadata,
          sentAt: status === "SENT" ? new Date() : null,
        },
      });
    } catch (logErr) {
      // DB logging failure must never block or crash the email flow
      console.error(
        `[EmailAudit] Failed to log email to ${to} (${subject}):`,
        logErr.message,
      );
    }
  }
};