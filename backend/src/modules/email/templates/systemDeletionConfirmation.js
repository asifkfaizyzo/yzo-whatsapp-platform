// backend/src/modules/email/templates/systemDeletionConfirmation.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Final confirmation email after system-initiated account deletion.
 * Sent from the expired-subscriptions cron job after data purge.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.tenantEmail
 * @param {string} context.deletionDate - When the deletion occurred
 * @returns {{ subject: string, html: string }}
 */
export default function systemDeletionConfirmation({ tenantName, tenantEmail, deletionDate }) {
  const subject = "Your SudoReply account has been deleted";

  const html = wrapEmail({
    title: "Account Deleted",
    header: renderHeader({
      title: "Account Deletion Complete",
      subtitle: "All data has been permanently removed",
      bgColor: "#64748B",
      icon: ICONS.TRASH,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>This email confirms that your SudoReply account and all associated data have been <strong>permanently deleted</strong> as of <strong>${deletionDate}</strong>.</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Account Email</td>
            <td>${tenantEmail}</td>
          </tr>
          <tr>
            <td>Deletion Date</td>
            <td>${deletionDate}</td>
          </tr>
          <tr>
            <td>Status</td>
            <td><span class="badge badge-danger">DELETED</span></td>
          </tr>
        </table>
      </div>

      <h3>What was deleted?</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
        <li>All WhatsApp contacts and conversation history</li>
        <li>Message templates and broadcast campaigns</li>
        <li>Automation flows and chatbot configurations</li>
        <li>Integration data (Shopify, WooCommerce, Zoho)</li>
        <li>Billing records and invoices</li>
      </ul>

      <p><strong>This action is irreversible.</strong> If you wish to use SudoReply again, you will need to create a new account at sudoreply.com.</p>

      <p style="font-size: 13px; color: #94A3B8;">
        If you believe this deletion was made in error, please contact us immediately at info@sudoreply.com.
      </p>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}