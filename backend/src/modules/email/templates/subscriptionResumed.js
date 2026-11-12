// backend/src/modules/email/templates/subscriptionResumed.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Confirmation email to tenant when their subscription is resumed.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.planName
 * @returns {{ subject: string, html: string }}
 */
export default function subscriptionResumed({ tenantName, planName }) {
  const subject = "Your SudoReply subscription is now active!";
  const dashboardUrl = getFrontendUrl("/dashboard");

  const html = wrapEmail({
    title: "Welcome Back",
    header: renderHeader({
      title: "Welcome Back!",
      subtitle: "Your subscription has been resumed",
      bgColor: "#10B981",
      icon: ICONS.PLAY,
    }),
    body: `
      <p>Hi <strong>${tenantName || "there"}</strong>,</p>
      <p>Great news! Your subscription for <strong>${planName || "your plan"}</strong> is now active and ready for business.</p>

      <div class="info-card" style="border-color: #A7F3D0; background: #ECFDF5;">
        <table>
          <tr>
            <td style="color: #047857;">Account Status</td>
            <td style="color: #065F46;"><span class="badge badge-success">ACTIVE</span></td>
          </tr>
          <tr>
            <td style="color: #047857;">Plan</td>
            <td style="color: #1E1B4B;">${planName || "Active Plan"}</td>
          </tr>
          <tr>
            <td style="color: #047857;">Autopay</td>
            <td style="color: #065F46;">Re-enabled on Razorpay</td>
          </tr>
        </table>
      </div>

      <h3>What is now active?</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
        <li><strong>Outbound Campaigns:</strong> You can launch bulk WhatsApp broadcasts immediately.</li>
        <li><strong>Automations:</strong> Keyword triggers and chatbot flows are now listening and replying.</li>
        <li><strong>Team Inbox:</strong> Your live chat queues and agent assignments are fully operational.</li>
      </ul>

      ${renderButton({ href: dashboardUrl, text: "Open Workspace Dashboard", color: "success" })}
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}