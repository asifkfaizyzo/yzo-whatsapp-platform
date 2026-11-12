// backend/src/modules/email/templates/pauseAdminAlert.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Internal alert to superadmin when a tenant pauses their subscription.
 *
 * @param {Object} context
 * @param {string} context.companyName
 * @param {string} context.tenantEmail
 * @param {string} [context.planName]
 * @param {string} [context.pauseDuration] - e.g., "1 month", "Indefinite"
 * @param {string} [context.reason]
 * @returns {{ subject: string, html: string }}
 */
export default function pauseAdminAlert({ companyName, tenantEmail, planName, pauseDuration, reason }) {
  const subject = `Tenant Paused: ${companyName}`;

  const html = wrapEmail({
    title: "Pause Alert",
    header: renderHeader({
      title: "Subscription Paused",
      subtitle: companyName,
      bgColor: "#7C3AED",
      icon: ICONS.PAUSE,
    }),
    body: `
      <p>A tenant has temporarily paused their subscription mandate. Details below:</p>

      <div class="info-card" style="border-color: #DDD6FE; background: #F5F3FF;">
        <table>
          <tr>
            <td style="color: #6D28D9;">Company</td>
            <td style="color: #1E1B4B;">${companyName}</td>
          </tr>
          <tr>
            <td style="color: #6D28D9;">Email</td>
            <td style="color: #1E1B4B;"><a href="mailto:${tenantEmail}" style="color: #7C3AED;">${tenantEmail}</a></td>
          </tr>
          <tr>
            <td style="color: #6D28D9;">Plan</td>
            <td style="color: #1E1B4B;">${planName || "Active Plan"}</td>
          </tr>
          <tr>
            <td style="color: #6D28D9;">Duration</td>
            <td style="color: #1E1B4B;">${pauseDuration || "Indefinite"}</td>
          </tr>
          <tr>
            <td style="color: #6D28D9;">Reason</td>
            <td style="color: #1E1B4B;">${reason || "Not specified"}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; color: #94A3B8;">
        The recurring mandate has been paused on Razorpay. Outbound messaging is paused for this tenant.
      </p>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}