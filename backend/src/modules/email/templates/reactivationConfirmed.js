// backend/src/modules/email/templates/reactivationConfirmed.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Subscription reactivation confirmation.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.planName
 * @param {string} context.renewalDate - Next billing date
 * @returns {{ subject: string, html: string }}
 */
export default function reactivationConfirmed({ tenantName, planName, renewalDate }) {
  const subject = "Welcome back! Reactivation Confirmed";
  const dashboardUrl = getFrontendUrl("/dashboard");

  const html = wrapEmail({
    title: "Reactivation Confirmed",
    header: renderHeader({
      title: "Welcome Back!",
      subtitle: "Your subscription is active again",
      bgColor: "#10B981",
      icon: ICONS.REFRESH,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Great news! Your <strong>${planName}</strong> subscription has been successfully reactivated. All platform features are now fully restored.</p>

      <div class="info-card" style="border-color: #A7F3D0; background: #ECFDF5;">
        <table>
          <tr>
            <td style="color: #047857;">Plan</td>
            <td style="color: #065F46;">${planName}</td>
          </tr>
          <tr>
            <td style="color: #047857;">Status</td>
            <td><span class="badge badge-success">ACTIVE</span></td>
          </tr>
          <tr>
            <td style="color: #047857;">Next Renewal</td>
            <td style="color: #065F46;">${renewalDate}</td>
          </tr>
        </table>
      </div>

      <h3>What is now active?</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
        <li><strong>Outbound messaging:</strong> Broadcasts and automations are live.</li>
        <li><strong>Team inbox:</strong> Live chat queues are operational.</li>
        <li><strong>API access:</strong> All integrations are reconnected.</li>
      </ul>

      ${renderButton({ href: dashboardUrl, text: "Open Dashboard", color: "success" })}
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}