// backend/src/modules/email/templates/gracePeriodStarted.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Grace period started notification.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.planName
 * @param {number} [context.graceDays=7]
 * @param {string|Date} [context.gracePeriodEnd]
 * @returns {{ subject: string, html: string }}
 */
export default function gracePeriodStarted({
  tenantName = "Customer",
  planName = "Subscription",
  graceDays = 7,
  gracePeriodEnd,
}) {
  const endFormatted = gracePeriodEnd
    ? new Date(gracePeriodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : `${graceDays} days`;

  const subject = `Action Required: Your ${planName} plan is in a ${graceDays}-day grace period`;
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Grace Period Active",
    header: renderHeader({
      title: "Renewal Grace Period Active",
      subtitle: `${graceDays}-day grace window`,
      bgColor: "#F59E0B",
      icon: ICONS.ALERT,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your <strong>${planName}</strong> billing period has ended. To prevent disruption to your live messaging and automations, your workspace is now in a <strong>${graceDays}-day grace period</strong> until <strong>${endFormatted}</strong>.</p>

      <div class="info-card" style="border-color: #FDE68A; background: #FFFBEB;">
        <table>
          <tr>
            <td style="color: #B45309;">Plan</td>
            <td style="color: #78350F;">${planName}</td>
          </tr>
          <tr>
            <td style="color: #B45309;">Grace Ends On</td>
            <td style="color: #78350F;">${endFormatted}</td>
          </tr>
          <tr>
            <td style="color: #B45309;">Status</td>
            <td><span class="badge badge-danger">GRACE PERIOD</span></td>
          </tr>
        </table>
      </div>

      <h3>Important renewal note</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
        <li>All messaging, webhooks, and automations continue working normally during the grace period.</li>
        <li>Renewing on the same or a lower tier deducts used grace days from your next cycle.</li>
        <li>Upgrading to a higher tier waives any used grace days.</li>
      </ul>

      ${renderButton({ href: billingUrl, text: "Renew Subscription Now", color: "primary" })}
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}