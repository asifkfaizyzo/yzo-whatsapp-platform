// backend/src/modules/email/templates/tenantWelcome.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Welcome email sent after tenant onboarding completes.
 * Replaces the old tenant_onboarded.html template.
 *
 * @param {Object} context
 * @param {string} context.firstName
 * @param {string} [context.lastName]
 * @param {string} context.tenantName - Workspace/company name
 * @param {string} context.email
 * @returns {{ subject: string, html: string }}
 */
export default function tenantWelcome({ firstName, lastName, tenantName, email }) {
  const subject = "Welcome to SudoReply — Your account is ready!";
  const loginUrl = getFrontendUrl("/login");
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "there";

  const html = wrapEmail({
    title: "Welcome to SudoReply",
    header: renderHeader({
      title: "Welcome to SudoReply!",
      subtitle: "Your workspace is ready",
      bgColor: "#10B981",
      icon: ICONS.STAR,
    }),
    body: `
      <p>Hi <strong>${fullName}</strong>,</p>
      <p>Your SudoReply workspace <strong>${tenantName}</strong> has been successfully created and is ready to use.</p>

      <div class="info-card" style="border-color: #A7F3D0; background: #ECFDF5;">
        <table>
          <tr>
            <td style="color: #047857;">Workspace</td>
            <td style="color: #065F46;">${tenantName}</td>
          </tr>
          <tr>
            <td style="color: #047857;">Login Email</td>
            <td style="color: #065F46;">${email}</td>
          </tr>
          <tr>
            <td style="color: #047857;">Status</td>
            <td><span class="badge badge-success">ACTIVE</span></td>
          </tr>
        </table>
      </div>

      <h3>Get started in 3 steps:</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.8;">
        <li><strong>Connect WhatsApp:</strong> Link your WhatsApp Business number in Settings.</li>
        <li><strong>Import Contacts:</strong> Upload your customer list or sync from Shopify/WooCommerce.</li>
        <li><strong>Send a Broadcast:</strong> Create your first WhatsApp campaign in minutes.</li>
      </ul>

      ${renderButton({ href: loginUrl, text: "Log In to Your Workspace", color: "success" })}

      <p style="font-size: 13px; color: #94A3B8;">
        Need help getting started? Our support team is available at info@sudoreply.com.
      </p>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}