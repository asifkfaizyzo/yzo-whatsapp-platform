// backend/src/modules/email/templates/subscriptionExtended.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";

/**
 * Subscription period extended by SuperAdmin notification.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.planName
 * @param {number} context.daysAdded
 * @param {string|Date} context.newPeriodEnd
 * @param {string} [context.reason]
 * @returns {{ subject: string, html: string }}
 */
export default function subscriptionExtended({
  tenantName = "Customer",
  planName = "Subscription",
  daysAdded = 0,
  newPeriodEnd,
  reason,
}) {
  const endFormatted = newPeriodEnd
    ? new Date(newPeriodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Updated";

  const subject = `Good news: Your SudoReply ${planName} subscription has been extended`;
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Subscription Extended",
    header: renderHeader({
      title: "Subscription Extended",
      subtitle: `+${daysAdded} day(s) added`,
      bgColor: "#10B981",
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your <strong>${planName}</strong> subscription has been extended by <strong>${daysAdded} day(s)</strong>.</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Plan</td>
            <td><strong>${planName}</strong></td>
          </tr>
          <tr>
            <td>Days Added</td>
            <td>+${daysAdded} day(s)</td>
          </tr>
          <tr>
            <td>New Period End</td>
            <td><strong>${endFormatted}</strong></td>
          </tr>
          ${
            reason
              ? `<tr>
                  <td>Note</td>
                  <td>${reason}</td>
                </tr>`
              : ""
          }
        </table>
      </div>

      ${renderButton({ href: billingUrl, text: "View Subscription", color: "primary" })}
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}