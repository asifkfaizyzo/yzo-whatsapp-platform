// backend/src/modules/email/templates/subscriptionPaused.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Confirmation email to tenant when their subscription is paused.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.planName
 * @param {string} [context.pauseDuration] - e.g., "1 month", "Indefinite"
 * @returns {{ subject: string, html: string }}
 */
export default function subscriptionPaused({ tenantName, planName, pauseDuration }) {
  const subject = "Your SudoReply subscription has been paused";
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Subscription Paused",
    header: renderHeader({
      title: "Subscription Paused",
      subtitle: "Your plan is temporarily on hold",
      bgColor: "#7C3AED",
      icon: ICONS.PAUSE,
    }),
    body: `
      <p>Hi <strong>${tenantName || "there"}</strong>,</p>
      <p>As requested, your subscription for <strong>${planName || "your current plan"}</strong> has been paused.</p>

      <div class="info-card" style="border-color: #DDD6FE; background: #F5F3FF;">
        <table>
          <tr>
            <td style="color: #6D28D9;">Pause Duration</td>
            <td style="color: #1E1B4B; text-transform: capitalize;">${pauseDuration || "Indefinite"}</td>
          </tr>
          <tr>
            <td style="color: #6D28D9;">Renewal Billing</td>
            <td style="color: #059669;">&#8377;0 (No charges during pause)</td>
          </tr>
          <tr>
            <td style="color: #6D28D9;">Data Status</td>
            <td style="color: #1E1B4B;">100% Safe &amp; Preserved</td>
          </tr>
        </table>
      </div>

      <h3>What happens next?</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
        <li><strong>Zero debits:</strong> Your recurring bank/card mandate is paused on Razorpay.</li>
        <li><strong>Your assets are saved:</strong> WhatsApp numbers, approved templates, contacts, chats, and automated bot flows remain intact.</li>
        <li><strong>Resume anytime:</strong> You can reactivate your account with a single click whenever you are ready.</li>
      </ul>

      ${renderButton({ href: billingUrl, text: "Go to Billing & Resume Plan", color: "purple" })}
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}