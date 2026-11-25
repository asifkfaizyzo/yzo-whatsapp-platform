// backend/src/modules/email/templates/resumeAdminAlert.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Internal alert to superadmin when a tenant resumes their subscription.
 *
 * @param {Object} context
 * @param {string} context.companyName
 * @param {string} context.tenantEmail
 * @param {string} [context.planName]
 * @returns {{ subject: string, html: string }}
 */
export default function resumeAdminAlert({ companyName, tenantEmail, planName }) {
  const subject = `Tenant Resumed: ${companyName}`;

  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const html = wrapEmail({
    title: "Resume Alert",
    header: renderHeader({
      title: "Subscription Resumed",
      subtitle: companyName,
      bgColor: "#10B981",
      icon: ICONS.PLAY,
    }),
    body: `
      <p>A tenant has resumed their subscription and restored full access. Details below:</p>

      <div class="info-card" style="border-color: #A7F3D0; background: #ECFDF5;">
        <table>
          <tr>
            <td style="color: #047857;">Company</td>
            <td style="color: #065F46;">${companyName}</td>
          </tr>
          <tr>
            <td style="color: #047857;">Email</td>
            <td style="color: #065F46;"><a href="mailto:${tenantEmail}" style="color: #059669;">${tenantEmail}</a></td>
          </tr>
          <tr>
            <td style="color: #047857;">Plan</td>
            <td style="color: #065F46;">${planName || "Active Plan"}</td>
          </tr>
          <tr>
            <td style="color: #047857;">Resumed At</td>
            <td style="color: #065F46;">${timestamp} IST</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; color: #94A3B8;">
        The recurring mandate has been re-enabled on Razorpay. Platform messaging is active for this tenant.
      </p>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}