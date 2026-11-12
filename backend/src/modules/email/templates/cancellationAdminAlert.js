// backend/src/modules/email/templates/cancellationAdminAlert.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Internal alert to superadmin when a tenant cancels their subscription.
 *
 * @param {Object} context
 * @param {string} context.companyName
 * @param {string} [context.name]        - Fallback if companyName missing
 * @param {string} context.email         - Tenant email
 * @param {string} [context.reason]
 * @param {string} [context.periodEnd]
 * @param {string} [context.planName]
 * @returns {{ subject: string, html: string }}
 */
export default function cancellationAdminAlert({ companyName, name, email, reason, periodEnd, planName }) {
  const displayName = companyName || name || "Unknown Tenant";
  const subject = `Tenant Cancelled: ${displayName}`;

  const html = wrapEmail({
    title: "Cancellation Alert",
    header: renderHeader({
      title: "Subscription Cancelled",
      subtitle: displayName,
      bgColor: "#EF4444",
      icon: ICONS.ALERT,
    }),
    body: `
      <p>A tenant has cancelled their subscription. Details below:</p>

      <div class="info-card" style="border-color: #FECACA; background: #FEF2F2;">
        <table>
          <tr>
            <td style="color: #DC2626;">Tenant Name</td>
            <td style="color: #991B1B;">${displayName}</td>
          </tr>
          <tr>
            <td style="color: #DC2626;">Tenant Email</td>
            <td style="color: #991B1B;"><a href="mailto:${email}" style="color: #DC2626;">${email}</a></td>
          </tr>
          ${planName ? `
          <tr>
            <td style="color: #DC2626;">Plan</td>
            <td style="color: #991B1B;">${planName}</td>
          </tr>` : ""}
          <tr>
            <td style="color: #DC2626;">Reason</td>
            <td style="color: #991B1B;">${reason || "User requested cancellation"}</td>
          </tr>
          ${periodEnd ? `
          <tr>
            <td style="color: #DC2626;">Access Until</td>
            <td style="color: #991B1B;">${periodEnd}</td>
          </tr>` : ""}
        </table>
      </div>

      <p style="font-size: 13px; color: #94A3B8;">
        Log in to the admin dashboard to review this account and consider a retention outreach.
      </p>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}