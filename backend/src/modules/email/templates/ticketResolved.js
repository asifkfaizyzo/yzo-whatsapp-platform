// backend/src/modules/email/templates/ticketResolved.js (do not remove this comment)
import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";

export default function ticketResolved({ ticketNumber, title, description, raisedBy }) {
  const subject = `Ticket ${ticketNumber} Resolved`;

  const html = wrapEmail(`
    ${renderHeader("Ticket Resolved")}

    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      Your support ticket has been
      <strong style="color:#059669;">marked as resolved</strong>
      by ${raisedBy || "the support team"}.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#ecfdf5;border-radius:8px;border:1px solid #a7f3d0;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#065f46;width:100px;">Ticket #</td>
              <td style="padding:6px 0;font-size:14px;color:#064e3b;font-weight:600;">${ticketNumber}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#065f46;">Subject</td>
              <td style="padding:6px 0;font-size:14px;color:#064e3b;">${title}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#065f46;">Resolved By</td>
              <td style="padding:6px 0;font-size:14px;color:#064e3b;">${raisedBy || "Support Team"}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${description ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#ffffff;border-radius:8px;border-left:4px solid #059669;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Resolution Details</p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap;">${description}</p>
        </td>
      </tr>
    </table>
    ` : ""}

    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#6b7280;">
      If you are still experiencing issues, please reply to this ticket or open a new one from your dashboard.
    </p>

    ${renderButton("View Ticket", `${getFrontendUrl()}/dashboard/tickets`)}

    ${renderFooter()}
  `);

  return { subject, html };
}