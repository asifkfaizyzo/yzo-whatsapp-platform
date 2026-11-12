// backend/src/modules/email/templates/statusUpdate.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";
import { EMAIL_CONFIG } from "../email.config.js";

const { brand } = EMAIL_CONFIG;

/**
 * Subscription status update email (admin-triggered plan changes).
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.oldPlan
 * @param {string} context.newPlan
 * @param {string} context.newStatus   - ACTIVE | PAUSED | CANCELLED | EXPIRED
 * @param {string} [context.effectiveDate]
 * @returns {{ subject: string, html: string }}
 */
export default function statusUpdate({ tenantName, oldPlan, newPlan, newStatus, effectiveDate }) {
  const subject = `Your SudoReply plan has been updated to ${newPlan}`;
  const dashboardUrl = getFrontendUrl("/dashboard/billing");

  const statusColors = {
    ACTIVE: { bg: "#DCFCE7", color: "#16A34A", badge: "badge-success" },
    PAUSED: { bg: "#EDE9FE", color: "#7C3AED", badge: "badge-purple" },
    CANCELLED: { bg: "#FEE2E2", color: "#DC2626", badge: "badge-danger" },
    EXPIRED: { bg: "#FEF3C7", color: "#D97706", badge: "badge-warning" },
  };
  const sc = statusColors[newStatus] || statusColors.ACTIVE;

  const html = wrapEmail({
    title: "Plan Update",
    header: renderHeader({
      title: "Plan Updated",
      subtitle: "Your subscription has changed",
      icon: ICONS.REFRESH,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your SudoReply subscription has been updated. Here are the details of the change:</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Previous Plan</td>
            <td style="text-decoration: line-through; color: #94A3B8;">${oldPlan}</td>
          </tr>
          <tr>
            <td>New Plan</td>
            <td style="color: ${brand.primaryColor};">${newPlan}</td>
          </tr>
          <tr>
            <td>Status</td>
            <td><span class="badge ${sc.badge}">${newStatus}</span></td>
          </tr>
          ${effectiveDate ? `
          <tr>
            <td>Effective From</td>
            <td>${effectiveDate}</td>
          </tr>` : ""}
        </table>
      </div>

      <p>Your new plan features and limits are now active. Visit your billing dashboard for full details.</p>

      ${renderButton({ href: dashboardUrl, text: "View Billing Details", color: "primary" })}
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}