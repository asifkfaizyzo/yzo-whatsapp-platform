// backend/src/modules/email/templates/gracePeriodEnding.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Urgent reminder when a grace period is about to end.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.planName
 * @param {number} [context.daysLeft=1]
 * @param {string|Date} [context.gracePeriodEnd]
 * @returns {{ subject: string, html: string }}
 */
export default function gracePeriodEnding({
  tenantName = "Customer",
  planName = "Subscription",
  daysLeft = 1,
  gracePeriodEnd,
}) {
  const endFormatted = gracePeriodEnd
    ? new Date(gracePeriodEnd).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "soon";

  const subject = `Urgent: Your SudoReply grace period ends in ${daysLeft} day(s)`;
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Grace Period Ending Soon",
    header: renderHeader({
      title: "Grace Period Ending Soon",
      subtitle: `${daysLeft} day(s) remaining`,
      bgColor: "#EF4444",
      icon: ICONS.ALERT,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your renewal grace period for the <strong>${planName}</strong> plan expires on <strong>${endFormatted}</strong> (${daysLeft} day(s) left).</p>

      <div class="info-card" style="border-color: #FECACA; background: #FEF2F2;">
        <table>
          <tr>
            <td style="color: #DC2626;">Plan</td>
            <td style="color: #991B1B;">${planName}</td>
          </tr>
          <tr>
            <td style="color: #DC2626;">Grace Ends On</td>
            <td style="color: #991B1B;">${endFormatted}</td>
          </tr>
          <tr>
            <td style="color: #DC2626;">Time Remaining</td>
            <td style="color: #991B1B;">${daysLeft} day(s)</td>
          </tr>
        </table>
      </div>

      <p>Once the grace period ends, outbound messaging, broadcasts, and automations will be paused until you renew.</p>

      ${renderButton({ href: billingUrl, text: "Renew Now", color: "danger" })}
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}