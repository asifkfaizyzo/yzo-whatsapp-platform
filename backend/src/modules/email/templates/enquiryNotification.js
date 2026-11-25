// backend/src/modules/email/templates/enquiryNotification.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Internal notification to admin about a new contact enquiry.
 *
 * @param {Object} context
 * @param {string} context.name
 * @param {string} context.email
 * @param {string} [context.subject]
 * @param {string} context.message
 * @returns {{ subject: string, html: string }}
 */
export default function enquiryNotification({ name, email, subject: enquirySubject, message }) {
  const subject = "New Enquiry Received";

  const html = wrapEmail({
    title: "New Enquiry",
    header: renderHeader({
      title: "New Contact Enquiry",
      subtitle: "From your website contact form",
      icon: ICONS.ENQUIRY,
    }),
    body: `
      <p>A new enquiry has been submitted through the SudoReply contact form.</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Name</td>
            <td>${name}</td>
          </tr>
          <tr>
            <td>Email</td>
            <td><a href="mailto:${email}" style="color: #125EF2; text-decoration: none;">${email}</a></td>
          </tr>
          ${enquirySubject ? `
          <tr>
            <td>Subject</td>
            <td>${enquirySubject}</td>
          </tr>` : ""}
        </table>
      </div>

      <h3>Message</h3>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
        <p style="margin: 0; color: #334155; white-space: pre-wrap;">${message}</p>
      </div>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}