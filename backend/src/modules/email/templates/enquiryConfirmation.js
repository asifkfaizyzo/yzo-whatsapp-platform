// backend/src/modules/email/templates/enquiryConfirmation.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Enquiry auto-confirmation sent to the person who submitted the form.
 *
 * @param {Object} context
 * @param {string} context.name
 * @param {string} context.email - The enquirer's email (for confirmation)
 * @returns {{ subject: string, html: string }}
 */
export default function enquiryConfirmation({ name, email }) {
  const subject = "We received your message";

  const html = wrapEmail({
    title: "Enquiry Received",
    header: renderHeader({
      title: "We've received your enquiry!",
      subtitle: "Our team is on it",
      icon: ICONS.ENQUIRY,
    }),
    body: `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Thank you for reaching out to SudoReply. We have successfully received your enquiry and our team is already looking into it.</p>
      <p>We will respond to your message at <strong>${email}</strong> within 24 hours.</p>

      <div class="info-card">
        <p style="color: #64748B; font-size: 13px; margin: 0;">
          This is an automated confirmation of your request. No need to reply to this email.
        </p>
      </div>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}