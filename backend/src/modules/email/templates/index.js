// backend/src/modules/email/templates/index.js (do not remove this comment)

/**
 * Email Template Registry
 *
 * Barrel file that re-exports all 25 email template functions.
 * Each template is a pure function: (context) => { subject, html }
 *
 * Usage:
 *   import { passwordReset, invoice } from "../templates/index.js";
 *   const { subject, html } = passwordReset({ resetLink: "..." });
 *
 * Or use the EMAIL_TEMPLATES map for dynamic dispatch:
 *   import { EMAIL_TEMPLATES } from "../templates/index.js";
 *   const template = EMAIL_TEMPLATES["PASSWORD_RESET"];
 *   const { subject, html } = template(context);
 */

// ── AUTH ──
export { default as passwordReset } from "./passwordReset.js";
export { default as otpVerification } from "./otpVerification.js";

// ── BILLING ──
export { default as invoice } from "./invoice.js";
export { default as invoiceReceipt } from "./invoiceReceipt.js";
export { default as subscriptionExpired } from "./subscriptionExpired.js";
export { default as reactivationConfirmed } from "./reactivationConfirmed.js";
export { default as dataDeletionWarning } from "./dataDeletionWarning.js";
export { default as cancellationConfirmed } from "./cancellationConfirmed.js";
export { default as expiryReminder } from "./expiryReminder.js";
export { default as statusUpdate } from "./statusUpdate.js";

// ── NOTIFICATION ──
export { default as ticketCreated } from "./ticketCreated.js";
export { default as ticketReply } from "./ticketReply.js";
export { default as ticketEscalated } from "./ticketEscalated.js";
export { default as ticketResolved } from "./ticketResolved.js";
export { default as ticketStatusUpdate } from "./ticketStatusUpdate.js";
export { default as enquiryConfirmation } from "./enquiryConfirmation.js";
export { default as enquiryNotification } from "./enquiryNotification.js";
export { default as enterpriseLeadConfirmation } from "./enterpriseLeadConfirmation.js";
export { default as enterpriseLeadNotification } from "./enterpriseLeadNotification.js";
export { default as enterpriseActivation } from "./enterpriseActivation.js";

// ── SYSTEM ──
export { default as tenantWelcome } from "./tenantWelcome.js";
export { default as whatsappStatus } from "./whatsappStatus.js";
export { default as templateStatus } from "./templateStatus.js";
export { default as cancellationAdminAlert } from "./cancellationAdminAlert.js";
export { default as pauseAdminAlert } from "./pauseAdminAlert.js";
export { default as resumeAdminAlert } from "./resumeAdminAlert.js";
export { default as subscriptionPaused } from "./subscriptionPaused.js";
export { default as subscriptionResumed } from "./subscriptionResumed.js";
export { default as systemDeletionConfirmation } from "./systemDeletionConfirmation.js";

// ── Dynamic Dispatch Map ──
// Keys match the EmailCategory enum + action name for programmatic lookup.
import passwordReset from "./passwordReset.js";
import otpVerification from "./otpVerification.js";
import invoice from "./invoice.js";
import invoiceReceipt from "./invoiceReceipt.js";
import subscriptionExpired from "./subscriptionExpired.js";
import reactivationConfirmed from "./reactivationConfirmed.js";
import dataDeletionWarning from "./dataDeletionWarning.js";
import cancellationConfirmed from "./cancellationConfirmed.js";
import expiryReminder from "./expiryReminder.js";
import statusUpdate from "./statusUpdate.js";
import ticketCreated from "./ticketCreated.js";
import ticketReply from "./ticketReply.js";
import ticketEscalated from "./ticketEscalated.js";
import ticketResolved from "./ticketResolved.js";
import ticketStatusUpdate from "./ticketStatusUpdate.js";
import enquiryConfirmation from "./enquiryConfirmation.js";
import enquiryNotification from "./enquiryNotification.js";
import enterpriseLeadConfirmation from "./enterpriseLeadConfirmation.js";
import enterpriseLeadNotification from "./enterpriseLeadNotification.js";
import enterpriseActivation from "./enterpriseActivation.js";
import tenantWelcome from "./tenantWelcome.js";
import whatsappStatus from "./whatsappStatus.js";
import templateStatus from "./templateStatus.js";
import cancellationAdminAlert from "./cancellationAdminAlert.js";
import pauseAdminAlert from "./pauseAdminAlert.js";
import resumeAdminAlert from "./resumeAdminAlert.js";
import subscriptionPaused from "./subscriptionPaused.js";
import subscriptionResumed from "./subscriptionResumed.js";
import systemDeletionConfirmation from "./systemDeletionConfirmation.js";

export const EMAIL_TEMPLATES = {
  // Auth
  PASSWORD_RESET: passwordReset,
  OTP_VERIFICATION: otpVerification,

  // Billing
  INVOICE: invoice,
  INVOICE_RECEIPT: invoiceReceipt,
  SUBSCRIPTION_EXPIRED: subscriptionExpired,
  REACTIVATION_CONFIRMED: reactivationConfirmed,
  DATA_DELETION_WARNING: dataDeletionWarning,
  CANCELLATION_CONFIRMED: cancellationConfirmed,
  EXPIRY_REMINDER: expiryReminder,
  STATUS_UPDATE: statusUpdate,

  // Notification
  TICKET_CREATED: ticketCreated,
  TICKET_REPLY: ticketReply,
  TICKET_ESCALATED: ticketEscalated,
  TICKET_RESOLVED: ticketResolved,
  TICKET_STATUS_UPDATE: ticketStatusUpdate,
  ENQUIRY_CONFIRMATION: enquiryConfirmation,
  ENQUIRY_NOTIFICATION: enquiryNotification,
  ENTERPRISE_LEAD_CONFIRMATION: enterpriseLeadConfirmation,
  ENTERPRISE_LEAD_NOTIFICATION: enterpriseLeadNotification,
  ENTERPRISE_ACTIVATION: enterpriseActivation,

  // System
  TENANT_WELCOME: tenantWelcome,
  WHATSAPP_STATUS: whatsappStatus,
  TEMPLATE_STATUS: templateStatus,
  CANCELLATION_ADMIN_ALERT: cancellationAdminAlert,
  PAUSE_ADMIN_ALERT: pauseAdminAlert,
  RESUME_ADMIN_ALERT: resumeAdminAlert,
  SUBSCRIPTION_PAUSED: subscriptionPaused,
  SUBSCRIPTION_RESUMED: subscriptionResumed,
  SYSTEM_DELETION_CONFIRMATION: systemDeletionConfirmation,
};

/**
 * Look up a template function by its registry key.
 *
 * @param {string} templateKey - e.g., "PASSWORD_RESET"
 * @returns {Function|null} Template function or null if not found
 */
export const getEmailTemplate = (templateKey) => {
  return EMAIL_TEMPLATES[templateKey] || null;
};