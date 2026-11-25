// backend/src/modules/email/templates/dataDeletionWarning.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Urgent data deletion warning before account purge.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.daysRemaining - e.g., "7"
 * @param {string} context.deletionDate  - Exact date of deletion
 * @returns {{ subject: string, html: string }}
 */
export default function dataDeletionWarning({ tenantName, daysRemaining, deletionDate }) {
  const subject = "URGENT: SudoReply Data Deletion Warning";
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Data Deletion Warning",
    header: renderHeader({
      title: "Data Deletion Warning",
      subtitle: `Your data will be deleted in ${daysRemaining} days`,
      bgColor: "#DC2626",
      icon: ICONS.TRASH,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your SudoReply subscription has been expired for an extended period. As per our data retention policy, <strong>all your account data will be permanently deleted</strong> on <strong>${deletionDate}</strong>.</p>

      <div class="info-card" style="border-color: #FECACA; background: #FEF2F2;">
        <table>
          <tr>
            <td style="color: #DC2626;">Days Remaining</td>
            <td style="color: #991B1B; font-size: 16px;">${daysRemaining} days</td>
          </tr>
          <tr>
            <td style="color: #DC2626;">Deletion Date</td>
            <td style="color: #991B1B;">${deletionDate}</td>
          </tr>
        </table>
      </div>

      <h3>What will be permanently deleted?</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
        <li>All WhatsApp contacts and conversation history</li>
        <li>Message templates and broadcast campaigns</li>
        <li>Automation flows and chatbot configurations</li>
        <li>Order data and Shopify/WooCommerce sync records</li>
      </ul>

      <p><strong>This action is irreversible.</strong> To keep your data, reactivate your subscription before the deletion date.</p>

      ${renderButton({ href: billingUrl, text: "Reactivate Now", color: "danger" })}
    `,
    footer: renderFooter({ extra: "Need help? Contact info@sudoreply.com immediately." }),
  });

  return { subject, html };
}