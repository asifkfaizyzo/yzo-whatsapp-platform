// backend/src/modules/email/templates/scheduledPlanChangeCancelled.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Notification when a scheduled plan change at period end cannot be applied
 * because the target plan was discontinued.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.currentPlanName
 * @param {string} context.discontinuedPlanName
 * @returns {{ subject: string, html: string }}
 */
export default function scheduledPlanChangeCancelled({
  tenantName = "Customer",
  currentPlanName = "your current plan",
  discontinuedPlanName = "the scheduled plan",
}) {
  const subject = "Update regarding your scheduled SudoReply plan change";
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Scheduled Plan Change Cancelled",
    header: renderHeader({
      title: "Scheduled Plan Change Update",
      subtitle: "Plan no longer available",
      bgColor: "#F59E0B",
      icon: ICONS.ALERT,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>You had scheduled a plan switch to <strong>${discontinuedPlanName}</strong> at the end of your billing period. However, that plan has since been retired and is no longer available.</p>

      <div class="info-card" style="border-color: #FDE68A; background: #FFFBEB;">
        <table>
          <tr>
            <td style="color: #B45309;">Current Active Plan</td>
            <td style="color: #78350F;"><strong>${currentPlanName}</strong></td>
          </tr>
          <tr>
            <td style="color: #B45309;">Retired Scheduled Plan</td>
            <td style="color: #78350F;">${discontinuedPlanName}</td>
          </tr>
        </table>
      </div>

      <p>Your workspace remains on <strong>${currentPlanName}</strong> so your service is not interrupted. You can visit your billing settings anytime to choose another available plan.</p>

      ${renderButton({ href: billingUrl, text: "View Available Plans", color: "primary" })}
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}