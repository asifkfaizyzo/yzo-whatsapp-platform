// backend/src/modules/email/templates/trialDeleted.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * Expired trial / workspace permanently purged notification.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} [context.deletionDate]
 * @returns {{ subject: string, html: string }}
 */
export default function trialDeleted({
  tenantName = "Customer",
  deletionDate,
}) {
  const dateFormatted = deletionDate
    ? new Date(deletionDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

  const subject = "Your expired SudoReply workspace has been deleted";

  const html = wrapEmail({
    title: "Workspace Deleted",
    header: renderHeader({
      title: "Workspace Data Purged",
      subtitle: "Data retention period ended",
      bgColor: "#64748B",
      icon: ICONS.ALERT,
    }),
    body: `
      <p>Hi <strong>${tenantName}</strong>,</p>
      <p>Because your subscription was not reactivated before the end of the post-expiry retention window, your workspace data was permanently deleted on <strong>${dateFormatted}</strong> in accordance with our data retention policy.</p>
      <p>Thank you for trying SudoReply. You are welcome to create a new paid workspace anytime in the future.</p>
    `,
    footer: renderFooter({ extra: "Questions? Contact info@sudoreply.com" }),
  });

  return { subject, html };
}