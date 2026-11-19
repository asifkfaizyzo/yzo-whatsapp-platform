// backend/src/modules/email/templates/accountBlocked.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Account suspended / blocked notification.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} [context.reason]
 * @returns {{ subject: string, html: string }}
 */
export default function accountBlocked({
  tenantName = "Customer",
  reason = "Administrative suspension",
}) {
  const subject = "Important: Your SudoReply account has been suspended";

  const html = wrapEmail({
    title: "Account Suspended",
    header: renderHeader({
      title: "Account Suspended",
      subtitle: "Immediate attention required",
      bgColor: "#EF4444",
      icon: ICONS.ALERT,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your SudoReply workspace has been suspended by an administrator.</p>

      <div class="info-card" style="border-color: #FECACA; background: #FEF2F2;">
        <table>
          <tr>
            <td style="color: #DC2626;">Status</td>
            <td><span class="badge badge-danger">SUSPENDED</span></td>
          </tr>
          <tr>
            <td style="color: #DC2626;">Reason</td>
            <td style="color: #991B1B;">${reason}</td>
          </tr>
        </table>
      </div>

      <p>While suspended, access to the dashboard, APIs, and messaging channels is disabled. If you believe this is an error or need assistance resolving this issue, please contact our support team.</p>
    `,
    footer: renderFooter({ extra: "Contact support at info@sudoreply.com" }),
  });

  return { subject, html };
}