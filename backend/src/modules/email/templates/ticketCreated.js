// backend/src/modules/email/templates/ticketCreated.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Support ticket creation notification.
 * Fixes the old bug where `info.messageId` was referenced
 * but the sendMail result was never assigned to a variable.
 *
 * @param {Object} context
 * @param {string} context.ticketNumber
 * @param {string} context.title
 * @param {string} context.description
 * @param {string} context.raisedBy
 * @param {string} [context.category]
 * @param {string} [context.priority] - URGENT | HIGH | MEDIUM | LOW
 * @returns {{ subject: string, html: string }}
 */
export default function ticketCreated({ ticketNumber, title, description, raisedBy, category, priority }) {
  const subject = `Support Ticket ${ticketNumber}: ${title}`;
  const ticketUrl = getFrontendUrl("/dashboard/tickets");

  const priorityColors = {
    URGENT: { bg: "#FEE2E2", color: "#DC2626", badge: "badge-danger" },
    HIGH: { bg: "#FFF7ED", color: "#EA580C", badge: "badge-warning" },
    MEDIUM: { bg: "#FEF3C7", color: "#CA8A04", badge: "badge-warning" },
    LOW: { bg: "#DCFCE7", color: "#16A34A", badge: "badge-success" },
  };
  const pc = priority ? priorityColors[priority] || priorityColors.MEDIUM : null;

  const html = wrapEmail({
    title: `Ticket ${ticketNumber}`,
    header: renderHeader({
      title: `Support Ticket ${ticketNumber}`,
      subtitle: title,
      icon: ICONS.TICKET,
    }),
    body: `
      <p>A new support ticket has been created. Here are the details:</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Ticket Number</td>
            <td>${ticketNumber}</td>
          </tr>
          <tr>
            <td>Raised By</td>
            <td>${raisedBy}</td>
          </tr>
          ${category ? `
          <tr>
            <td>Category</td>
            <td>${category}</td>
          </tr>` : ""}
          ${pc ? `
          <tr>
            <td>Priority</td>
            <td><span class="badge ${pc.badge}">${priority}</span></td>
          </tr>` : ""}
        </table>
      </div>

      <h3>Message</h3>
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
        <p style="margin: 0; color: #334155; white-space: pre-wrap;">${description}</p>
      </div>

      <p style="font-size: 13px; color: #94A3B8;">
        Log in to your dashboard to view and respond to this ticket.
      </p>

      ${renderButton({ href: ticketUrl, text: "View Ticket", color: "primary" })}
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}