// backend/src/modules/email/templates/invoice.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Invoice / payment confirmation email.
 * Fixes the old bug where sendInvoiceEmail received an object
 * but the signature expected positional args, rendering [object Object].
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.invoiceNumber
 * @param {string} context.amount       - Formatted amount (e.g., "₹1,499")
 * @param {string} context.planName
 * @param {string} context.periodEnd    - Billing period end date
 * @returns {{ subject: string, html: string }}
 */
export default function invoice({ tenantName, invoiceNumber, amount, planName, periodEnd }) {
  const subject = `Invoice ${invoiceNumber} - Payment Confirmation`;
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Payment Confirmation",
    header: renderHeader({
      title: "Payment Received",
      subtitle: `Invoice ${invoiceNumber}`,
      icon: ICONS.INVOICE,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Thank you for your payment. Your subscription has been activated successfully.</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Invoice Number</td>
            <td>${invoiceNumber}</td>
          </tr>
          <tr>
            <td>Plan</td>
            <td>${planName}</td>
          </tr>
          <tr>
            <td>Amount Paid</td>
            <td>${amount}</td>
          </tr>
          <tr>
            <td>Billing Period</td>
            <td>Until ${periodEnd}</td>
          </tr>
          <tr>
            <td>Status</td>
            <td><span class="badge badge-success">PAID</span></td>
          </tr>
        </table>
      </div>

      <p>Your invoice PDF is attached to this email. You can also download it anytime from your billing dashboard.</p>

      ${renderButton({ href: billingUrl, text: "View Billing Dashboard", color: "primary" })}
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}