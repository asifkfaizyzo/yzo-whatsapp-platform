// backend/src/modules/email/templates/subscriptionExpired.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Subscription expired notification.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.planName
 * @param {string} context.expiredDate
 * @returns {{ subject: string, html: string }}
 */
export default function subscriptionExpired({
  tenantName,
  planName,
  expiredDate,
  retentionDays = 90,
}) {
  const subject = "Your subscription has expired";
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Subscription Expired",
    header: renderHeader({
      title: "Subscription Expired",
      subtitle: "Action required",
      bgColor: "#EF4444",
      icon: ICONS.ALERT,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your <strong>${planName}</strong> subscription expired on <strong>${expiredDate}</strong>.</p>

      <div class="info-card" style="border-color: #FECACA; background: #FEF2F2;">
        <table>
          <tr>
            <td style="color: #DC2626;">Plan</td>
            <td style="color: #991B1B;">${planName}</td>
          </tr>
          <tr>
            <td style="color: #DC2626;">Expired On</td>
            <td style="color: #991B1B;">${expiredDate}</td>
          </tr>
          <tr>
            <td style="color: #DC2626;">Data Retention</td>
            <td style="color: #991B1B;">${retentionDays} days</td>
          </tr>
          <tr>
            <td style="color: #DC2626;">Status</td>
            <td><span class="badge badge-danger">EXPIRED</span></td>
          </tr>
        </table>
      </div>

      <h3>What happens now?</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
        <li>Outbound messaging, broadcasts, and automations are paused.</li>
        <li>Your contacts, templates, and chat history are preserved for ${retentionDays} days.</li>
        <li>Incoming messages will not be processed until you reactivate.</li>
      </ul>

      ${renderButton({ href: billingUrl, text: "Reactivate Subscription", color: "danger" })}
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}