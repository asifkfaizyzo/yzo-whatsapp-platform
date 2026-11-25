// backend/src/modules/email/templates/trialExpiring.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Free trial expiring soon reminder.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} [context.planName="Free Trial"]
 * @param {number} [context.daysLeft=1]
 * @param {string|Date} [context.trialEndsAt]
 * @param {number} [context.retentionDays=7]
 * @returns {{ subject: string, html: string }}
 */
export default function trialExpiring({
  tenantName = "Customer",
  planName = "Free Trial",
  daysLeft = 1,
  trialEndsAt,
  retentionDays = 7,
}) {
  const endFormatted = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : `in ${daysLeft} day(s)`;

  const subject = `Your SudoReply ${planName} ends in ${daysLeft} day(s)`;
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Free Trial Ending Soon",
    header: renderHeader({
      title: "Your Trial Ends Soon",
      subtitle: `${daysLeft} day(s) remaining`,
      bgColor: "#F59E0B",
      icon: ICONS.ALERT,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your <strong>${planName}</strong> trial expires on <strong>${endFormatted}</strong> (${daysLeft} day(s) remaining).</p>

      <div class="info-card" style="border-color: #FDE68A; background: #FFFBEB;">
        <table>
          <tr>
            <td style="color: #B45309;">Trial Plan</td>
            <td style="color: #78350F;">${planName}</td>
          </tr>
          <tr>
            <td style="color: #B45309;">Expires On</td>
            <td style="color: #78350F;">${endFormatted}</td>
          </tr>
          <tr>
            <td style="color: #B45309;">Post-Expiry Retention</td>
            <td style="color: #78350F;">${retentionDays} days</td>
          </tr>
        </table>
      </div>

      <p>Upgrade to a paid plan today to keep your connected channels, templates, automation flows, and team inbox running without interruption. Unconverted trial workspaces are retained for ${retentionDays} days after expiry before permanent deletion.</p>

      ${renderButton({ href: billingUrl, text: "Upgrade to a Paid Plan", color: "primary" })}
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}