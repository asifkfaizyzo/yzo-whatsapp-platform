// backend/src/modules/email/templates/expiryReminder.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Subscription expiry reminder.
 *
 * Replaces the old 5 separate HTML files (expiry_reminder_1, _3, _7, _15, _expired)
 * with a single template that adapts messaging based on daysLeft.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.planName
 * @param {number} context.daysLeft     - Days until expiry (1, 3, 7, 15, or 0 for expired)
 * @param {string} context.expiryDate   - Exact expiry date
 * @param {string} context.amount       - Renewal amount (e.g., "₹1,499")
 * @returns {{ subject: string, html: string }}
 */
export default function expiryReminder({ tenantName, planName, daysLeft, expiryDate, amount }) {
  const isExpired = daysLeft <= 0;
  const isUrgent = daysLeft <= 3 && !isExpired;
  const billingUrl = getFrontendUrl("/dashboard/billing");

  // Dynamic subject line
  const subject = isExpired
    ? "Your SudoReply subscription has expired"
    : isUrgent
      ? `URGENT: Your subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
      : `Your subscription renews in ${daysLeft} days`;

  // Dynamic header
  const headerBg = isExpired ? "#EF4444" : isUrgent ? "#F59E0B" : "#125EF2";
  const headerTitle = isExpired
    ? "Subscription Expired"
    : isUrgent
      ? "Subscription Expiring Soon"
      : "Subscription Renewal Reminder";
  const headerIcon = isExpired ? ICONS.ALERT : ICONS.CALENDAR;

  // Dynamic urgency message
  let urgencyBlock = "";
  if (isExpired) {
    urgencyBlock = `
      <div class="info-card" style="border-color: #FECACA; background: #FEF2F2;">
        <p style="color: #991B1B; font-weight: 700; margin: 0; font-size: 14px;">
          Your subscription has expired. Outbound messaging is paused.
          Reactivate now to restore full access.
        </p>
      </div>
    `;
  } else if (isUrgent) {
    urgencyBlock = `
      <div class="info-card" style="border-color: #FDE68A; background: #FFFBEB;">
        <p style="color: #92400E; font-weight: 700; margin: 0; font-size: 14px;">
          Your subscription expires in just ${daysLeft} day${daysLeft === 1 ? "" : "s"}.
          Ensure your payment method is up to date to avoid service interruption.
        </p>
      </div>
    `;
  }

  const html = wrapEmail({
    title: headerTitle,
    header: renderHeader({
      title: headerTitle,
      subtitle: isExpired ? "Action required" : `Renewal on ${expiryDate}`,
      bgColor: headerBg,
      icon: headerIcon,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>

      ${isExpired
        ? `<p>Your <strong>${planName}</strong> subscription expired on <strong>${expiryDate}</strong>.</p>`
        : `<p>This is a reminder that your <strong>${planName}</strong> subscription will renew on <strong>${expiryDate}</strong> (${daysLeft} day${daysLeft === 1 ? "" : "s"} from now).</p>`
      }

      ${urgencyBlock}

      <div class="info-card">
        <table>
          <tr>
            <td>Plan</td>
            <td>${planName}</td>
          </tr>
          <tr>
            <td>Renewal Amount</td>
            <td>${amount}</td>
          </tr>
          <tr>
            <td>${isExpired ? "Expired On" : "Renewal Date"}</td>
            <td>${expiryDate}</td>
          </tr>
          <tr>
            <td>Status</td>
            <td>
              <span class="badge ${isExpired ? "badge-danger" : isUrgent ? "badge-warning" : "badge-info"}">
                ${isExpired ? "EXPIRED" : isUrgent ? "EXPIRING SOON" : "ACTIVE"}
              </span>
            </td>
          </tr>
        </table>
      </div>

      ${!isExpired ? `
      <h3>What happens on renewal?</h3>
      <ul style="padding-left: 20px; margin: 0 0 20px 0; font-size: 13px; color: #475569; line-height: 1.7;">
        <li>Your autopay mandate on Razorpay will be charged <strong>${amount}</strong>.</li>
        <li>Your subscription will extend for the next billing cycle.</li>
        <li>No action is needed if your payment method is current.</li>
      </ul>` : ""}

      ${renderButton({
        href: billingUrl,
        text: isExpired ? "Reactivate Now" : "Manage Billing",
        color: isExpired ? "danger" : "primary",
      })}
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}