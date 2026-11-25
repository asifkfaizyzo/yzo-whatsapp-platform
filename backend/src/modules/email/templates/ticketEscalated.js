// backend/src/modules/email/templates/ticketEscalated.js (do not remove this comment)
import { wrapEmail, renderHeader, renderButton, renderFooter, getFrontendUrl } from "./_helpers.js";

export default function ticketEscalated({ ticketNumber, title, description, raisedBy }) {
  const subject = `Ticket ${ticketNumber} Escalated`;

  const html = wrapEmail(`
    ${renderHeader("Ticket Escalated")}

    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
      A support ticket has been <strong style="color:#d97706;">escalated to senior support</strong>
      by ${raisedBy || "a team member"}.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#fffbeb;border-radius:8px;border:1px solid #fde68a;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#92400e;width:100px;">Ticket #</td>
              <td style="padding:6px 0;font-size:14px;color:#78350f;font-weight:600;">${ticketNumber}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#92400e;">Subject</td>
              <td style="padding:6px 0;font-size:14px;color:#78350f;">${title}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#92400e;">Escalated By</td>
              <td style="padding:6px 0;font-size:14px;color:#78350f;">${raisedBy || "Team Member"}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${description ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:#ffffff;border-radius:8px;border-left:4px solid #d97706;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Details</p>
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