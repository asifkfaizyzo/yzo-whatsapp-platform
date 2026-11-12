// backend/src/modules/email/templates/templateStatus.js (do not remove this comment)

import { wrapEmail, renderHeader, renderButton, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * WhatsApp template approval/rejection notification to tenant.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.templateName
 * @param {string} [context.language]    - e.g., "en_US"
 * @param {string} [context.category]    - e.g., "MARKETING"
 * @param {string} [context.headerType]  - e.g., "IMAGE", "NONE"
 * @param {string} context.status        - "APPROVED" | "REJECTED" | "PAUSED"
 * @param {string} [context.reason]      - Rejection reason
 * @returns {{ subject: string, html: string }}
 */
export default function templateStatus({ tenantName, templateName, language, category, headerType, status, reason }) {
  const isApproved = status === "APPROVED";
  const isRejected = status === "REJECTED";

  const subject = isApproved
    ? `Your WhatsApp Template "${templateName}" is Approved!`
    : isRejected
      ? `WhatsApp Template "${templateName}" was Rejected`
      : `WhatsApp Template "${templateName}" Status: ${status}`;

  const headerBg = isApproved ? "#10B981" : isRejected ? "#EF4444" : "#F59E0B";
  const headerTitle = isApproved
    ? "Template Approved"
    : isRejected
      ? "Template Rejected"
      : "Template Status Update";
  const headerIcon = isApproved ? ICONS.CHECK : isRejected ? ICONS.DISCONNECT : ICONS.TEMPLATE;

  const statusBadge = isApproved
    ? "badge-success"
    : isRejected
      ? "badge-danger"
      : "badge-warning";

  const bodyMessage = isApproved
    ? `Great news! Meta has reviewed and <strong>approved</strong> your WhatsApp message template. You can now use it in broadcasts and customer conversations.`
    : isRejected
      ? `Meta has reviewed your WhatsApp template and marked it as <strong>Rejected</strong>. Please review the reason below and resubmit.`
      : `Your WhatsApp message template status has been updated to <strong>${status}</strong> by Meta.`;

  const dashboardUrl = "https://sudoreply.com/dashboard/broadcasts";

  const html = wrapEmail({
    title: headerTitle,
    header: renderHeader({
      title: headerTitle,
      subtitle: "Meta Business Review Notification",
      bgColor: headerBg,
      icon: headerIcon,
    }),
    body: `
      <p>Hi <strong>${tenantName || "there"}</strong>,</p>
      <p>${bodyMessage}</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Template Name</td>
            <td><code style="background: #F1F5F9; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${templateName}</code></td>
          </tr>
          <tr>
            <td>Category</td>
            <td>${category || "MARKETING"}</td>
          </tr>
          <tr>
            <td>Language</td>
            <td>${language || "en_US"}</td>
          </tr>
          <tr>
            <td>Header Type</td>
            <td>${headerType || "NONE"}</td>
          </tr>
          <tr>
            <td>Status</td>
            <td><span class="badge ${statusBadge}">${status}</span></td>
          </tr>
          ${reason && reason !== "NONE" ? `
          <tr>
            <td style="color: #DC2626;">Rejection Reason</td>
            <td style="color: #DC2626; font-weight: 500;">${reason}</td>
          </tr>` : ""}
        </table>
      </div>

      ${renderButton({
        href: dashboardUrl,
        text: isApproved ? "Launch a Broadcast Now" : "View Templates in Dashboard",
        color: isApproved ? "success" : "primary",
      })}
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}