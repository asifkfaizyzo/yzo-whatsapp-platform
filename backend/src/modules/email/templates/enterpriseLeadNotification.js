// backend/src/modules/email/templates/enterpriseLeadNotification.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Internal notification to admin about a new enterprise lead.
 *
 * @param {Object} context
 * @param {string} context.companyName
 * @param {string} context.contactName
 * @param {string} context.email
 * @param {string} [context.phone]
 * @param {string} [context.role]
 * @param {string} context.companySize
 * @param {string} [context.estimatedUsers]
 * @param {string} [context.requirements]
 * @param {string} context.timeline
 * @param {string} context.preferredContact
 * @returns {{ subject: string, html: string }}
 */
export default function enterpriseLeadNotification({
  companyName,
  contactName,
  email,
  phone,
  role,
  companySize,
  estimatedUsers,
  requirements,
  timeline,
  preferredContact,
}) {
  const subject = `New Enterprise Lead: ${companyName}`;

  const html = wrapEmail({
    title: "New Enterprise Lead",
    header: renderHeader({
      title: "New Enterprise Lead Received",
      subtitle: companyName,
      bgColor: "#7C3AED",
      icon: ICONS.ENTERPRISE,
    }),
    body: `
      <p>A new enterprise lead has been submitted. Full details below:</p>

      <h3>Lead Details</h3>
      <div class="info-card">
        <table>
          <tr>
            <td>Company</td>
            <td>${companyName}</td>
          </tr>
          <tr>
            <td>Contact Name</td>
            <td>${contactName}</td>
          </tr>
          <tr>
            <td>Email</td>
            <td><a href="mailto:${email}" style="color: #125EF2; text-decoration: none;">${email}</a></td>
          </tr>
          ${phone ? `
          <tr>
            <td>Phone</td>
            <td>${phone}</td>
          </tr>` : ""}
          ${role ? `
          <tr>
            <td>Role</td>
            <td>${role}</td>
          </tr>` : ""}
          <tr>
            <td>Company Size</td>
            <td>${companySize}</td>
          </tr>
          ${estimatedUsers ? `
          <tr>
            <td>Est. Users</td>
            <td>${estimatedUsers}</td>
          </tr>` : ""}
          <tr>
            <td>Timeline</td>
            <td>${timeline}</td>
          </tr>
          <tr>
            <td>Preferred Contact</td>
            <td style="text-transform: capitalize;">${preferredContact}</td>
          </tr>
        </table>
      </div>

      <h3>Requirements</h3>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
        <p style="margin: 0; color: #334155; white-space: pre-wrap;">${requirements || "No custom requirements specified."}</p>
      </div>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}