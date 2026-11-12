// backend/src/modules/email/templates/invoiceReceipt.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Invoice receipt email (post-payment confirmation with details).
 *
 * @param {Object} context
 * @param {string} context.invoiceNumber
 * @param {string} context.amount
 * @param {string} context.planName
 * @param {string} context.paymentDate
 * @param {string} [context.paymentMethod] - e.g., "Razorpay UPI"
 * @returns {{ subject: string, html: string }}
 */
export default function invoiceReceipt({ invoiceNumber, amount, planName, paymentDate, paymentMethod }) {
  const subject = `Payment Receipt: Invoice ${invoiceNumber}`;

  const html = wrapEmail({
    title: "Payment Receipt",
    header: renderHeader({
      title: "Payment Receipt",
      subtitle: `Invoice ${invoiceNumber}`,
      icon: ICONS.CHECK,
    }),
    body: `
      <p>Hi,</p>
      <p>This is your official payment receipt from SudoReply. Thank you for your continued subscription.</p>

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
            <td>Amount</td>
            <td>${amount}</td>
          </tr>
          <tr>
            <td>Payment Date</td>
            <td>${paymentDate}</td>
          </tr>
          ${paymentMethod ? `
          <tr>
            <td>Payment Method</td>
            <td>${paymentMethod}</td>
          </tr>` : ""}
          <tr>
            <td>Status</td>
            <td><span class="badge badge-success">PAID</span></td>
          </tr>
        </table>
      </div>

      <p>If you have any questions about this receipt, please contact us at info@sudoreply.com.</p>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}