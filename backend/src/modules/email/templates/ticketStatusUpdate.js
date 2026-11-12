// backend/src/modules/email/templates/ticketStatusUpdate.js (do not remove this comment)
import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";

const STATUS_COLORS = {
  OPEN:        { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", label: "Open" },
  IN_PROGRESS: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", label: "In Progress" },
  RESOLVED:    { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", label: "Resolved" },
  CLOSED:      { bg: "#f3f4f6", border: "#d1d5db", text: "#374151", label: "Closed" },
};

export default function ticketStatusUpdate({ ticketNumber, title, description, raisedBy, status }) {
  const normalizedStatus = (status || "OPEN").toUpperCase().replace(/ /g, "_");
  const color = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.OPEN;
  const displayStatus = color.label;
  const subject = `Ticket ${ticketNumber} — ${displayStatus}`;

  const html = wrapEmail(`
    ${renderHeader("Ticket Status Update")}

    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      The status of your support ticket has been updated to
      <strong style="color:${color.text};">${displayStatus}</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:${color.bg};border-radius:8px;border:1px solid ${color.border};margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:${color.text};width:100px;">Ticket #</td>
              <td style="padding:6px 0;font-size:14px;color:${color.text};font-weight:600;">${ticketNumber}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:${color.text};">Subject</td>
              <td style="padding:6px 0;font-size:14px;color:${color.text};">${title}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:${color.text};">New Status</td>
              <td style="padding:6px 0;">
                <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;background:${color.border};color:${color.text};">
                  ${displayStatus}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:${color.text};">Updated By</td>
              <td style="padding:6px 0;font-size:14px;color:${color.text};">${raisedBy || "Support Team"}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${description ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#ffffff;border-radius:8px;border-left:4px solid #125EF2;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Additional Details</p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap;">${description}</p>
        </td>
      </tr>
    </table>
    ` : ""}

    ${renderButton("View Ticket", `${getFrontendUrl()}/dashboard/tickets`)}

    ${renderFooter()}
  `);

  return { subject, html };
}