// backend/src/modules/email/templates/enterpriseActivation.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Enterprise account activation notification to the client.
 *
 * @param {Object} context
 * @param {string} context.name
 * @param {string} context.email
 * @returns {{ subject: string, html: string }}
 */
export default function enterpriseActivation({ name, email }) {
  const subject = "Your Enterprise Account is Ready";
  const loginUrl = getFrontendUrl("/login");

  const html = wrapEmail({
    title: "Account Activated",
    header: renderHeader({
      title: "Account Activated",
      subtitle: "Welcome to SudoReply Enterprise",
      bgColor: "#10B981",
      icon: ICONS.CHECK,
    }),
    body: `
      <p>Hi <strong>${name}</strong>,</p>
      <p>We are excited to inform you that your custom <strong>Enterprise Account</strong> has been successfully set up and activated by our team.</p>
      <p>You now have full access to all enterprise platform features, custom APIs, and high-volume messaging queues.</p>

      <div class="info-card" style="border-color: #A7F3D0; background: #ECFDF5;">
        <table>
          <tr>
            <td style="color: #047857;">Account</td>
            <td style="color: #065F46;">${email}</td>
          </tr>
          <tr>
            <td style="color: #047857;">Plan</td>
            <td style="color: #065F46;">Enterprise</td>
          </tr>
          <tr>
            <td style="color: #047857;">Status</td>
            <td><span class="badge badge-success">ACTIVE</span></td>
          </tr>
        </table>
      </div>

      ${renderButton({ href: loginUrl, text: "Go to Dashboard", color: "success" })}

      <p style="font-size: 13px; color: #94A3B8;">
        If you encounter any issues logging in, please contact your account manager directly or email info@sudoreply.com.
      </p>
    `,
    footer: renderFooter({ extra: "SudoReply Enterprise Success Team" }),
  });

  return { subject, html };
}