// backend/src/modules/email/index.js (do not remove this comment)

/**
 * SudoReply Email Module — Public API
 *
 * 25 convenience functions that bridge existing call signatures
 * to the new template → sendEmail() pipeline.
 *
 * Each function:
 *   1. Calls a pure template function to get { subject, html }
 *   2. Calls sendEmail() which sends via SES + logs to EmailLog
 *   3. Matches the OLD call signature so Phase 4 is just import path changes
 *
 * Error handling:
 *   - AUTH emails THROW on failure (signup/reset flows depend on them)
 *   - All others CATCH and log (non-critical, don't break the caller)
 */

import { sendEmail } from "./email.service.js";
import { emailQueue } from "../../cron/queues/email.queue.js";


// ── Template imports ──
import {
  passwordReset,
  otpVerification,
  invoice,
  invoiceReceipt,
  subscriptionExpired,
  reactivationConfirmed,
  dataDeletionWarning,
  cancellationConfirmed,
  expiryReminder,
  statusUpdate,
  ticketCreated,
  ticketReply,
  ticketEscalated,
  ticketResolved,
  ticketStatusUpdate,
  enquiryConfirmation,
  enquiryNotification,
  enterpriseLeadConfirmation,
  enterpriseLeadNotification,
  enterpriseActivation,
  tenantWelcome,
  whatsappStatus,
  templateStatus,
  cancellationAdminAlert,
  pauseAdminAlert,
  resumeAdminAlert,
  subscriptionPaused,
  subscriptionResumed,
  systemDeletionConfirmation,
} from "./templates/index.js";


// ── Queue helper ──
const queueEmail = async (jobData) => {
  await emailQueue.add("send-email", jobData);
};

// ═══════════════════════════════════════════════════════════
// AUTH — Throws on failure
// ═══════════════════════════════════════════════════════════

/**
 * Send password reset link.
 * Signature matches old: (email, resetToken, userType)
 */
export const sendPasswordResetEmail = async (email, resetToken, userType) => {
  // Build reset link using the same logic as the old monolith
  const frontendUrls = (process.env.FRONTEND_URLS || "").split(",");
  const frontendUrl =
    userType === "SUPERADMIN"
      ? frontendUrls[0] || "http://localhost:5173"
      : frontendUrls[1] || "http://localhost:5174";
  const resetLink = `${frontendUrl.trim()}/reset-password?token=${resetToken}`;

  const { subject, html } = passwordReset({ resetLink });

  await sendEmail({
    to: email,
    subject,
    html,
    category: "AUTH",
    fromName: "SudoReply",
    metadata: { userType, template: "password_reset" },
  });

  console.log("Reset email sent to:", email);
};

/**
 * Send OTP verification code.
 * Signature matches old: (email, otpCode)
 */
export const sendVerificationOtpEmail = async (email, otpCode) => {
  const { subject, html } = otpVerification({ otpCode });

  await sendEmail({
    to: email,
    subject,
    html,
    category: "AUTH",
    fromName: "SudoReply",
    metadata: { template: "otp_verification" },
  });

  console.log("Verification OTP sent to:", email);
};

// ═══════════════════════════════════════════════════════════
// BILLING — Non-critical, catches errors
// ═══════════════════════════════════════════════════════════

/**
 * Send invoice with PDF attachment.
 *
 * OLD signature was (email, tenantName, invoiceNumber, filePath)
 * but callers actually passed (email, { invoiceNumber, amount, planName, periodEnd, pdfPath }).
 * NEW signature accepts the object form to fix the [object Object] bug.
 */
export const sendInvoiceEmail = async (email, data) => {
  try {
    const { subject, html } = invoice({
      tenantName: data.tenantName || data.name || "Customer",
      invoiceNumber: data.invoiceNumber,
      amount: data.amount,
      planName: data.planName,
      periodEnd: data.periodEnd,
    });

    const attachments = data.pdfPath
      ? [{ filename: `${data.invoiceNumber}.pdf`, path: data.pdfPath }]
      : [];

    await queueEmail({
      to: email,
      subject,
      html,
      category: "BILLING",
      fromName: "SudoReply Billing",
      attachments,
      metadata: { template: "invoice", invoiceNumber: data.invoiceNumber },
    });

    console.log(`Invoice email sent to: ${email}`);
  } catch (error) {
    console.error("Invoice email error:", error.message);
  }
};

/**
 * Send invoice receipt.
 * Signature matches old: (email, data)
 */
export const sendInvoiceReceiptEmail = async (email, data) => {
  try {
    const { subject, html } = invoiceReceipt(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "BILLING",
      fromName: "SudoReply Billing",
      metadata: { template: "invoice_receipt", invoiceNumber: data.invoiceNumber },
    });

    console.log("Invoice receipt email sent to:", email);
  } catch (err) {
    console.error("Error sending invoice receipt email:", err.message);
  }
};

/**
 * Send subscription expired notification.
 * Signature matches old: (email, data)
 */
export const sendSubscriptionExpiredEmail = async (email, data) => {
  try {
    const { subject, html } = subscriptionExpired(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "BILLING",
      fromName: "SudoReply",
      metadata: { template: "subscription_expired" },
    });

    console.log("Subscription expired email sent to:", email);
  } catch (err) {
    console.error("Error sending subscription expired email:", err.message);
  }
};

/**
 * Send reactivation confirmation.
 * Signature matches old: (email, data)
 */
export const sendReactivationConfirmedEmail = async (email, data) => {
  try {
    const { subject, html } = reactivationConfirmed(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "BILLING",
      fromName: "SudoReply",
      metadata: { template: "reactivation_confirmed" },
    });

    console.log("Reactivation email sent to:", email);
  } catch (err) {
    console.error("Error sending reactivation email:", err.message);
  }
};

/**
 * Send data deletion warning.
 * Signature matches old: (email, data)
 */
export const sendDataDeletionWarningEmail = async (email, data) => {
  try {
    const { subject, html } = dataDeletionWarning(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "BILLING",
      fromName: "SudoReply Support",
      metadata: { template: "data_deletion_warning" },
    });

    console.log("Data deletion warning sent to:", email);
  } catch (err) {
    console.error("Error sending deletion warning email:", err.message);
  }
};

/**
 * Send cancellation confirmation to tenant.
 * Signature matches old: (email, data)
 */
export const sendCancellationConfirmedEmail = async (email, data) => {
  try {
    const { subject, html } = cancellationConfirmed(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "BILLING",
      fromName: "SudoReply",
      metadata: { template: "cancellation_confirmed" },
    });

    console.log("Cancellation confirmation email sent to:", email);
  } catch (err) {
    console.error("Error sending cancellation confirmed email:", err.message);
  }
};

/**
 * Send expiry reminder.
 *
 * OLD signature: (email, templateName, subject, data)
 * where templateName was "expiry_reminder_1", "expiry_reminder_7", etc.
 *
 * NEW: Maps templateName to daysLeft and uses the unified expiryReminder template.
 * The old `subject` param is ignored — the template generates its own.
 */
export const sendExpiryReminderEmail = async (email, templateName, _subject, data) => {
  try {
    // Map old template filename to daysLeft
    const TEMPLATE_TO_DAYS = {
      expiry_reminder_1: 1,
      expiry_reminder_3: 3,
      expiry_reminder_7: 7,
      expiry_reminder_15: 15,
      expiry_reminder_expired: 0,
    };
    const daysLeft = TEMPLATE_TO_DAYS[templateName] ?? 7;

    const { subject, html } = expiryReminder({ ...data, daysLeft });

    await queueEmail({
      to: email,
      subject,
      html,
      category: "BILLING",
      fromName: "SudoReply",
      metadata: { template: "expiry_reminder", daysLeft },
    });

    console.log(`Reminder email (${templateName}) sent to:`, email);
  } catch (err) {
    console.error(`Error sending reminder email (${templateName}):`, err.message);
  }
};

/**
 * Send subscription status update (admin-triggered plan change).
 * Signature: (email, data)
 */
export const sendStatusUpdateEmail = async (email, data) => {
  try {
    const { subject, html } = statusUpdate(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "BILLING",
      fromName: "SudoReply",
      metadata: { template: "status_update" },
    });

    console.log("Status update email sent to:", email);
  } catch (err) {
    console.error("Error sending status update email:", err.message);
  }
};

// ═══════════════════════════════════════════════════════════
// NOTIFICATION — Non-critical, catches errors
// ═══════════════════════════════════════════════════════════

/**
 * Send support ticket notification.
 * Signature matches old: ({ to, subject, ticketNumber, title, description, raisedBy, category, priority })
 *
 * Note: The old `subject` param is ignored — the template generates its own.
 * This also fixes the old bug where `info.messageId` was referenced
 * but the sendMail result was never assigned.
 */
export const sendTicketEmail = async (email, data) => {
  if (!email) {
    console.warn(`sendTicketEmail skipped — no recipient for ticket ${data?.ticketNumber}`);
    return;
  }

  try {
    const { subject, html } = ticketCreated(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply Support",
      metadata: { template: "ticket_created", ticketNumber: data.ticketNumber },
    });

    console.log(`Ticket email sent to: ${email}`);
  } catch (error) {
    console.error(`Ticket email FAILED to: ${email}`, error.message);
  }
};

/**
 * Send ticket reply notification.
 * Signature: (email, data) where data = { ticketNumber, title, description, raisedBy }
 */
export const sendTicketReplyEmail = async (email, data) => {
  if (!email) {
    console.warn(`sendTicketReplyEmail skipped — no recipient for ticket ${data?.ticketNumber}`);
    return;
  }

  try {
    const { subject, html } = ticketReply(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply Support",
      metadata: { template: "ticket_reply", ticketNumber: data.ticketNumber },
    });

    console.log(`Ticket reply email sent to: ${email}`);
  } catch (err) {
    console.error(`Ticket reply email FAILED to: ${email}`, err.message);
  }
};

/**
 * Send ticket escalation alert.
 * Signature: (email, data) where data = { ticketNumber, title, description, raisedBy }
 */
export const sendTicketEscalatedEmail = async (email, data) => {
  if (!email) {
    console.warn(`sendTicketEscalatedEmail skipped — no recipient for ticket ${data?.ticketNumber}`);
    return;
  }

  try {
    const { subject, html } = ticketEscalated(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply Support",
      metadata: { template: "ticket_escalated", ticketNumber: data.ticketNumber },
    });

    console.log(`Ticket escalated email sent to: ${email}`);
  } catch (err) {
    console.error(`Ticket escalated email FAILED to: ${email}`, err.message);
  }
};

/**
 * Send ticket resolved notification.
 * Signature: (email, data) where data = { ticketNumber, title, description, raisedBy }
 */
export const sendTicketResolvedEmail = async (email, data) => {
  if (!email) {
    console.warn(`sendTicketResolvedEmail skipped — no recipient for ticket ${data?.ticketNumber}`);
    return;
  }

  try {
    const { subject, html } = ticketResolved(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply Support",
      metadata: { template: "ticket_resolved", ticketNumber: data.ticketNumber },
    });

    console.log(`Ticket resolved email sent to: ${email}`);
  } catch (err) {
    console.error(`Ticket resolved email FAILED to: ${email}`, err.message);
  }
};

/**
 * Send ticket status update notification.
 * Signature: (email, data) where data = { ticketNumber, title, description, raisedBy, status }
 */
export const sendTicketStatusUpdateEmail = async (email, data) => {
  if (!email) {
    console.warn(`sendTicketStatusUpdateEmail skipped — no recipient for ticket ${data?.ticketNumber}`);
    return;
  }

  try {
    const { subject, html } = ticketStatusUpdate(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply Support",
      metadata: { template: "ticket_status_update", ticketNumber: data.ticketNumber, status: data.status },
    });

    console.log(`Ticket status update email sent to: ${email}`);
  } catch (err) {
    console.error(`Ticket status update email FAILED to: ${email}`, err.message);
  }
};

/**
 * Send enquiry confirmation to the person who submitted the form.
 * Signature matches old: (email, name)
 */
export const sendEnquiryConfirmationEmail = async (email, name) => {
  try {
    const { subject, html } = enquiryConfirmation({ name, email });

    await queueEmail({
      to: email,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply",
      metadata: { template: "enquiry_confirmation" },
    });

    console.log("Enquiry confirmation email sent to:", email);
  } catch (error) {
    console.error("Enquiry confirmation email error:", error.message);
  }
};

/**
 * Send enquiry notification to admin.
 * Signature matches old: (adminEmail, details)
 * where details = { name, email, subject, message }
 */
export const sendEnquiryNotificationEmail = async (adminEmail, details) => {
  try {
    const { subject, html } = enquiryNotification(details);

    await queueEmail({
      to: adminEmail,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply Notifications",
      metadata: { template: "enquiry_notification" },
    });

    console.log("Enquiry notification email sent to admin:", adminEmail);
  } catch (error) {
    console.error("Enquiry notification email error:", error.message);
  }
};

/**
 * Send enterprise lead confirmation to the lead.
 * Signature matches old: (email, name)
 */
export const sendEnterpriseLeadConfirmationEmail = async (email, name) => {
  try {
    const { subject, html } = enterpriseLeadConfirmation({ name, email });

    await queueEmail({
      to: email,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply Sales",
      metadata: { template: "enterprise_lead_confirmation" },
    });

    console.log("Enterprise lead confirmation email sent to:", email);
  } catch (error) {
    console.error("Enterprise lead confirmation email error:", error.message);
  }
};

/**
 * Send enterprise lead notification to admin.
 * Signature matches old: (adminEmail, leadDetails)
 */
export const sendEnterpriseLeadNotificationEmail = async (adminEmail, leadDetails) => {
  try {
    const { subject, html } = enterpriseLeadNotification(leadDetails);

    await queueEmail({
      to: adminEmail,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply Alerts",
      metadata: { template: "enterprise_lead_notification", company: leadDetails.companyName },
    });

    console.log("Enterprise lead notification email sent to admin:", adminEmail);
  } catch (error) {
    console.error("Enterprise lead notification email error:", error.message);
  }
};

/**
 * Send enterprise account activation email.
 * Signature matches old: (email, name)
 */
export const sendEnterpriseAccountActivationEmail = async (email, name) => {
  try {
    const { subject, html } = enterpriseActivation({ name, email });

    await queueEmail({
      to: email,
      subject,
      html,
      category: "NOTIFICATION",
      fromName: "SudoReply Admin",
      metadata: { template: "enterprise_activation" },
    });

    console.log("Enterprise account activation email sent to:", email);
  } catch (error) {
    console.error("Enterprise account activation email error:", error.message);
  }
};

// ═══════════════════════════════════════════════════════════
// SYSTEM — Non-critical, catches errors
// ═══════════════════════════════════════════════════════════

/**
 * Send tenant welcome email after onboarding.
 * Signature matches old: ({ email, firstName, lastName, tenantName })
 */
export const sendTenantWelcomeEmail = async ({ email, firstName, lastName, tenantName }) => {
  try {
    const { subject, html } = tenantWelcome({ firstName, lastName, tenantName, email });

    await queueEmail({
      to: email,
      subject,
      html,
      category: "SYSTEM",
      fromName: "SudoReply",
      metadata: { template: "tenant_welcome" },
    });

    console.log(`Welcome email sent to: ${email}`);
  } catch (error) {
    console.error(`Welcome email FAILED to: ${email}`);
    console.error(`Error: ${error.message}`);
  }
};

/**
 * Send WhatsApp connection status alert to superadmin.
 * Signature matches old: ({ superAdminEmail, tenantName, tenantEmail, phoneNumber, wabaId, action })
 */
export const sendWhatsappStatusEmail = async ({ superAdminEmail, tenantName, tenantEmail, phoneNumber, wabaId, action }) => {
  try {
    const { subject, html } = whatsappStatus({ tenantName, tenantEmail, phoneNumber, wabaId, action });

    await queueEmail({
      to: superAdminEmail,
      subject,
      html,
      category: "SYSTEM",
      fromName: "SudoReply Alerts",
      metadata: { template: "whatsapp_status", action },
    });

    console.log(`WhatsApp ${action} alert email sent to superadmin: ${superAdminEmail}`);
  } catch (error) {
    console.error(`WhatsApp alert email FAILED: ${error.message}`);
  }
};

/**
 * Send WhatsApp template status notification to tenant.
 * Signature matches old: ({ toEmail, tenantName, templateName, language, category, headerType, status, reason })
 */
export const sendTemplateStatusEmail = async ({ toEmail, tenantName, templateName, language, category, headerType, status, reason }) => {
  if (!toEmail) return;

  try {
    const { subject, html } = templateStatus({ tenantName, templateName, language, category, headerType, status, reason });

    await queueEmail({
      to: toEmail,
      subject,
      html,
      category: "SYSTEM",
      fromName: "SudoReply Notifications",
      metadata: { template: "template_status", templateName, status },
    });

    console.log(`Template ${status} notification email sent to ${toEmail}`);
  } catch (err) {
    console.error(`Failed to send template status email to ${toEmail}:`, err.message);
  }
};

/**
 * Send cancellation alert to superadmin.
 * Signature matches old: (email, data)
 */
export const sendCancellationAdminAlertEmail = async (email, data) => {
  try {
    const { subject, html } = cancellationAdminAlert(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "SYSTEM",
      fromName: "SudoReply System",
      metadata: { template: "cancellation_admin_alert", company: data.companyName },
    });

    console.log("Cancellation admin alert sent to:", email);
  } catch (err) {
    console.error("Error sending admin alert cancellation email:", err.message);
  }
};

/**
 * Send pause alert to superadmin.
 * Signature matches old: (email, data)
 */
export const sendPauseAdminAlertEmail = async (email, data) => {
  try {
    const { subject, html } = pauseAdminAlert(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "SYSTEM",
      fromName: "SudoReply System",
      metadata: { template: "pause_admin_alert", company: data.companyName },
    });

    console.log("Pause admin alert email sent to:", email);
  } catch (err) {
    console.error("Error sending admin alert pause email:", err.message);
  }
};

/**
 * Send resume alert to superadmin.
 * Signature matches old: (email, data)
 */
export const sendResumeAdminAlertEmail = async (email, data) => {
  try {
    const { subject, html } = resumeAdminAlert(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "SYSTEM",
      fromName: "SudoReply System",
      metadata: { template: "resume_admin_alert", company: data.companyName },
    });

    console.log("Resume admin alert email sent to:", email);
  } catch (err) {
    console.error("Error sending admin alert resume email:", err.message);
  }
};

/**
 * Send subscription paused confirmation to tenant.
 * Signature matches old: (email, data)
 */
export const sendSubscriptionPausedEmail = async (email, data) => {
  try {
    const { subject, html } = subscriptionPaused(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "SYSTEM",
      fromName: "SudoReply Billing",
      metadata: { template: "subscription_paused" },
    });

    console.log("Subscription paused confirmation email sent to tenant:", email);
  } catch (err) {
    console.error("Error sending tenant pause email:", err.message);
  }
};

/**
 * Send subscription resumed confirmation to tenant.
 * Signature matches old: (email, data)
 */
export const sendSubscriptionResumedEmail = async (email, data) => {
  try {
    const { subject, html } = subscriptionResumed(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "SYSTEM",
      fromName: "SudoReply",
      metadata: { template: "subscription_resumed" },
    });

    console.log("Subscription resumed confirmation email sent to tenant:", email);
  } catch (err) {
    console.error("Error sending tenant resume email:", err.message);
  }
};

/**
 * Send system deletion confirmation after account purge.
 * Signature: (email, data) where data = { tenantName, tenantEmail, deletionDate }
 */
export const sendSystemDeletionConfirmation = async (email, data) => {
  try {
    const { subject, html } = systemDeletionConfirmation(data);

    await queueEmail({
      to: email,
      subject,
      html,
      category: "SYSTEM",
      fromName: "SudoReply System",
      metadata: { template: "system_deletion_confirmation" },
    });

    console.log("System deletion confirmation sent to:", email);
  } catch (err) {
    console.error("Error sending system deletion confirmation:", err.message);
  }
};