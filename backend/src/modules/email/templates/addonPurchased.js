// backend/src/modules/email/templates/addonPurchased.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";

/**
 * Add-on or credit top-up purchase confirmation.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.addonName
 * @param {number} [context.quantity=1]
 * @param {number|string} [context.amount=0]
 * @param {string} [context.invoiceNumber]
 * @returns {{ subject: string, html: string }}
 */
export default function addonPurchased({
  tenantName = "Customer",
  addonName = "Add-On",
  quantity = 1,
  amount = 0,
  invoiceNumber,
}) {
  const subject = `Add-On Activated: ${addonName} (x${quantity})`;
  const billingUrl = getFrontendUrl("/dashboard/billing");

  const html = wrapEmail({
    title: "Add-On Activated",
    header: renderHeader({
      title: "Add-On Activated",
      subtitle: addonName,
      bgColor: "#10B981",
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Your purchase of <strong>${addonName}</strong> has been confirmed and applied to your workspace immediately.</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Add-On</td>
            <td><strong>${addonName}</strong></td>
          </tr>
          <tr>
            <td>Quantity</td>
            <td>${quantity}</td>
          </tr>
          <tr>
            <td>Amount Paid</td>
            <td>₹${amount}</td>
          </tr>
          ${
            invoiceNumber
              ? `<tr>
                  <td>Invoice #</td>
                  <td>${invoiceNumber}</td>
                </tr>`
              : ""
          }
        </table>
      </div>

      ${renderButton({ href: billingUrl, text: "View Billing & Add-Ons", color: "success" })}
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}