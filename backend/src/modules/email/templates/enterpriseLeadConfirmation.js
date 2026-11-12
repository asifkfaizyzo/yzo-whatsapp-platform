// backend/src/modules/email/templates/enterpriseLeadConfirmation.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Confirmation sent to the enterprise lead after form submission.
 *
 * @param {Object} context
 * @param {string} context.name
 * @param {string} context.email
 * @returns {{ subject: string, html: string }}
 */
export default function enterpriseLeadConfirmation({ name, email }) {
  const subject = "We received your Enterprise request";

  const html = wrapEmail({
    title: "Enterprise Request Received",
    header: renderHeader({
      title: "Thank you for your interest!",
      subtitle: "SudoReply Enterprise",
      icon: ICONS.ENTERPRISE,
    }),
    body: `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Thank you for submitting a request for our <strong>Enterprise Plan</strong>. We are thrilled that you are looking to scale your business on SudoReply.</p>
      <p>A member of our dedicated enterprise account management team will review your requirements and reach out to you within 24 hours to schedule a custom platform walkthrough and pricing discussion.</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Submitted By</td>
            <td>${name}</td>
          </tr>
          <tr>
            <td>Contact Email</td>
            <td><a href="mailto:${email}" style="color: #125EF2; text-decoration: none;">${email}</a></td>
          </tr>
          <tr>
            <td>Response Time</td>
            <td><span class="badge badge-info">Within 24 hours</span></td>
          </tr>
        </table>
      </div>

      <p>If you have any questions in the meantime, feel free to contact us at info@sudoreply.com.</p>
    `,
    footer: renderFooter({ extra: "SudoReply Enterprise Sales Team" }),
  });

  return { subject, html };
}