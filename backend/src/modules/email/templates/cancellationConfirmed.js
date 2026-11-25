// backend/src/modules/email/templates/cancellationConfirmed.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Subscription cancellation confirmation to tenant.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.planName
 * @param {string} context.periodEnd - Access continues until this date
 * @param {string} [context.reason]  - Cancellation reason if provided
 * @returns {{ subject: string, html: string }}
 */
export default function cancellationConfirmed({ tenantName, planName, periodEnd, reason }) {
  const subject = "Your subscription has been cancelled";
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Cancellation Confirmed",
    header: renderHeader({
      title: "Subscription Cancelled",
      subtitle: "We're sorry to see you go",
      bgColor: "#64748B",
      icon: ICONS.ALERT,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your <strong>${planName}</strong> subscription has been cancelled as requested. You will continue to have full access until the end of your current billing period.</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Plan</td>
            <td>${planName}</td>
          </tr>
          <tr>
            <td>Access Until</td>
            <td>${periodEnd}</td>
          </tr>
          <tr>
            <td>Autopay</td>
            <td><span class="badge badge-warning">DISABLED</span></td>
          </tr>
          ${reason ? `
          <tr>
            <td>Reason</td>
            <td style="font-weight: 500;">${reason}</td>
          </tr>` : ""}
        </table>
      </div>

      <h3>What happens next?</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
        <li>No further charges will be made to your payment method.</li>
        <li>Full platform access continues until <strong>${periodEnd}</strong>.</li>
        <li>After that date, your account will move to a read-only state.</li>
      </ul>

      <p>Changed your mind? You can reactivate anytime before your access ends.</p>

      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="${billingUrl}" class="btn btn-primary">Reactivate Subscription</a>
      </div>
    `,
    footer: renderFooter({ extra: "We'd love to hear your feedback at info@sudoreply.com" }),
  });

  return { subject, html };
}