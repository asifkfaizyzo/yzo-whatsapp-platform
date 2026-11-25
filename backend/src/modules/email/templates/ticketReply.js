// backend/src/modules/email/templates/ticketReply.js (do not remove this comment)
import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";

export default function ticketReply({ ticketNumber, title, description, raisedBy }) {
  const subject = `Reply on Ticket ${ticketNumber}`;

  const html = wrapEmail(`
    ${renderHeader("Ticket Reply")}

    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      A new reply has been posted on your support ticket by
      <strong style="color:#111827;">${raisedBy || "Support Team"}</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;width:100px;">Ticket #</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${ticketNumber}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;">Subject</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;">${title}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;">Replied By</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;">${raisedBy || "Support Team"}</td>
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
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Reply Message</p>
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