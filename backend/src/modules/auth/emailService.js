import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ===================== SETUP NODEMAILER =====================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ===================== GENERATE RESET TOKEN =====================
export const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// ===================== TOKEN EXPIRY (1 hour) =====================
export const getResetTokenExpiry = () => {
  return new Date(Date.now() + 60 * 60 * 1000);
};

// ===================== SEND RESET EMAIL =====================
export const sendPasswordResetEmail = async (email, resetToken, userType) => {

  const frontendUrls = (process.env.FRONTEND_URLS || '').split(',');
  // Default to tenant-web (localhost:5174) unless it's SUPERADMIN (localhost:5173)
  const frontendUrl = userType === 'SUPERADMIN'
    ? (frontendUrls[0] || 'http://localhost:5173')
    : (frontendUrls[1] || 'http://localhost:5174');

  const resetLink = `${frontendUrl.trim()}/reset-password?token=${resetToken}`;

  try {
    await transporter.sendMail({
      from: `"Sudoreply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <h2 style="color: #333;">Password Reset Request</h2>
          
          <p>Hi,</p>
          
          <p>We received a request to reset your password.</p>
          
          <p>Click the button below to reset your password:</p>
          
          <a href="${resetLink}"
             style="
               background-color: #4F46E5;
               color: white;
               padding: 12px 24px;
               text-decoration: none;
               border-radius: 6px;
               display: inline-block;
               margin: 20px 0;
             ">
            Reset Password
          </a>
          
          <p>This link expires in <strong>1 hour</strong>.</p>
          
          <p>If you did not request this, please ignore this email.</p>
          
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          
          <p style="color: #999; font-size: 12px;">
            If the button does not work, copy and paste this link in your browser:
          </p>
          
          <p style="color: #999; font-size: 12px;">
            ${resetLink}
          </p>
          
        </div>
      `,
    });

    console.log('Reset email sent to:', email);

  } catch (error) {
    console.error('Email error:', error);
    throw new Error('Failed to send reset email');
  }
};



// ===================== SEND INVOICE EMAIL =====================
export const sendInvoiceEmail = async (email, tenantName, invoiceNumber, filePath) => {
  try {
    await transporter.sendMail({
      from: `"SudoReply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Invoice ${invoiceNumber} - Payment Confirmation`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="background: #125EF2; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SudoReply</h1>
            <p style="color: #CFE0FD; margin: 8px 0 0 0; font-size: 14px;">Payment Confirmation</p>
          </div>

          <div style="background: #f8faff; padding: 30px; border: 1px solid #e2e8f0;">
            
            <h2 style="color: #1a1a1a; margin: 0 0 10px 0;">
              Payment Received! 🎉
            </h2>
            
            <p style="color: #666; font-size: 14px;">
              Hi <strong>${tenantName}</strong>,
            </p>
            
            <p style="color: #666; font-size: 14px;">
              Thank you for your payment. Your subscription has been activated successfully.
              Please find your invoice attached to this email.
            </p>

            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">Invoice Number</td>
                  <td style="color: #1a1a1a; font-size: 13px; font-weight: bold; text-align: right;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">Status</td>
                  <td style="text-align: right;">
                    <span style="background: #dcfce7; color: #16a34a; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                      PAID
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <p style="color: #666; font-size: 13px;">
              Your invoice is attached as a PDF to this email.
              You can also download it anytime from your 
              <strong>Dashboard → Billing</strong> section.
            </p>

          </div>

          <div style="background: #125EF2; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #CFE0FD; font-size: 12px; margin: 0;">
              SudoReply | support@sudoreply.com | www.sudoreply.com
            </p>
          </div>

        </div>
      `,
      attachments: [
        {
          filename: `${invoiceNumber}.pdf`,
          path: filePath,
        },
      ],
    });

    console.log(`Invoice email sent to: ${email}`);
  } catch (error) {
    console.error("Invoice email error:", error);
    // Non-critical — don't throw
  }
};




// ===================== SEND TICKET EMAIL =====================
export const sendTicketEmail = async ({
  to,
  subject,
  ticketNumber,
  title,
  description,
  raisedBy,
  category,
  priority,
}) => {

  // ✅ Guard — if no recipient, log and skip silently
  if (!to) {
    console.warn(`⚠️ sendTicketEmail skipped — no recipient for ticket ${ticketNumber}`);
    return;
  }

  // ✅ Guard — if email config missing, warn clearly
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ EMAIL_USER or EMAIL_PASS is not set in environment variables");
    return;
  }

try {
    await transporter.sendMail({
      from: `"SudoReply Support" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          
          <div style="background: #125EF2; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SudoReply</h1>
            <p style="color: #CFE0FD; margin: 8px 0 0 0; font-size: 14px;">
              Support Ticket ${ticketNumber}
            </p>
          </div>

          <div style="background: #f8faff; padding: 30px; border: 1px solid #e2e8f0;">
            
            <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">
              🎫 ${title}
            </h2>

            <div style="background: white; border: 1px solid #e2e8f0;
                        border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <p style="color: #888; font-size: 12px; margin: 0 0 8px 0;
                         font-weight: bold; text-transform: uppercase;">
                Message
              </p>
              <p style="color: #1a1a1a; font-size: 14px; margin: 0;">
                ${description}
              </p>
            </div>

            <div style="background: white; border: 1px solid #e2e8f0;
                        border-radius: 8px; padding: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">
                    Ticket Number
                  </td>
                  <td style="color: #1a1a1a; font-size: 13px;
                              font-weight: bold; text-align: right;">
                    ${ticketNumber}
                  </td>
                </tr>
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">
                    Raised By
                  </td>
                  <td style="color: #1a1a1a; font-size: 13px;
                              font-weight: bold; text-align: right;">
                    ${raisedBy}
                  </td>
                </tr>
                ${category ? `
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">
                    Category
                  </td>
                  <td style="color: #1a1a1a; font-size: 13px;
                              font-weight: bold; text-align: right;">
                    ${category}
                  </td>
                </tr>` : ""}
                ${priority ? `
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">
                    Priority
                  </td>
                  <td style="text-align: right;">
                    <span style="
                      background: ${priority === "URGENT" ? "#fef2f2" :
            priority === "HIGH" ? "#fff7ed" :
              priority === "MEDIUM" ? "#fefce8" :
                "#f0fdf4"
          };
                      color: ${priority === "URGENT" ? "#dc2626" :
            priority === "HIGH" ? "#ea580c" :
              priority === "MEDIUM" ? "#ca8a04" :
                "#16a34a"
          };
                      padding: 2px 10px;
                      border-radius: 20px;
                      font-size: 12px;
                      font-weight: bold;
                    ">
                      ${priority}
                    </span>
                  </td>
                </tr>` : ""}
              </table>
            </div>

            <p style="color: #999; font-size: 12px; margin-top: 24px;">
              Please log in to your dashboard to view and respond to this ticket.
            </p>

          </div>

          <div style="background: #125EF2; padding: 20px;
                      border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #CFE0FD; font-size: 12px; margin: 0;">
              SudoReply | support@sudoreply.com | www.sudoreply.com
            </p>
          </div>

        </div>
      `,
    });

     // ✅ Log success with messageId for debugging
    console.log(`✅ Ticket email sent to: ${to} | messageId: ${info.messageId}`);

  } catch (error) {
    // ✅ Log the FULL error — not just a generic message
    console.error(`❌ Ticket email FAILED to: ${to}`);
    console.error(`❌ Subject: ${subject}`);
    console.error(`❌ Error code: ${error.code}`);
    console.error(`❌ Error message: ${error.message}`);
    console.error(`❌ Full error:`, error);
    // Non-blocking — don't throw, ticket still saves
  }
};
// ===================== SEND VERIFICATION OTP EMAIL =====================
export const sendVerificationOtpEmail = async (email, otpCode) => {
  try {
    await transporter.sendMail({
      from: `"Sudoreply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <h2>Email Verification</h2>
          <p>Hi there,</p>
          <p>Thank you for signing up. Please use the following One-Time Password (OTP) to verify your email address:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5;">${otpCode}</span>
          </div>
          <p>This code is valid for <strong>10 minutes</strong>. If you did not request this, you can ignore this email.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Sudoreply Team</p>
        </div>
      `,
    });
    console.log('Verification OTP sent to:', email);
  } catch (error) {
    console.error('Email verification error:', error);
    throw new Error('Failed to send verification email');
  }
};

// ===================== SEND ENQUIRY CONFIRMATION EMAIL =====================
export const sendEnquiryConfirmationEmail = async (email, name) => {
  try {
    await transporter.sendMail({
      from: `"SudoReply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'We received your message',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: #125EF2; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">SudoReply</h1>
          </div>
          <div style="padding: 30px; background: #ffffff; color: #334155; line-height: 1.6;">
            <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">We've received your enquiry!</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Thank you for reaching out to SudoReply. We have successfully received your enquiry and our team is already looking into it.</p>
            <p>We will respond to your message at <strong>${email}</strong> within 24 hours.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 13px; color: #64748b; margin: 0;">This is an automated confirmation of your request. No need to reply to this email.</p>
          </div>
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">SudoReply | support@sudoreply.com | www.sudoreply.com</p>
          </div>
        </div>
      `,
    });
    console.log('Enquiry confirmation email sent to:', email);
  } catch (error) {
    console.error('Enquiry confirmation email error:', error);
  }
};

// ===================== SEND ENQUIRY NOTIFICATION EMAIL =====================
export const sendEnquiryNotificationEmail = async (adminEmail, details) => {
  const { name, email, subject, message } = details;
  try {
    await transporter.sendMail({
      from: `"SudoReply Notifications" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: 'New Enquiry Received',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #125EF2; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: bold;">New Contact Enquiry Submission</h1>
          </div>
          <div style="padding: 30px; color: #334155; line-height: 1.6;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; width: 120px;">Name</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Email</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${email}">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Subject</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${subject || 'N/A'}</td>
              </tr>
            </table>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
              <p style="margin: 0 0 8px 0; font-weight: bold; color: #475569;">Message:</p>
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
        </div>
      `,
    });
    console.log('Enquiry notification email sent to admin:', adminEmail);
  } catch (error) {
    console.error('Enquiry notification email error:', error);
  }
};

// ===================== SEND ENTERPRISE LEAD CONFIRMATION =====================
export const sendEnterpriseLeadConfirmationEmail = async (email, name) => {
  try {
    await transporter.sendMail({
      from: `"SudoReply Sales" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'We received your Enterprise request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: #125EF2; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">SudoReply Enterprise</h1>
          </div>
          <div style="padding: 30px; color: #334155; line-height: 1.6;">
            <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">Thank you for your interest!</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Thank you for submitting a request for our <strong>Enterprise Plan</strong>. We are thrilled that you are looking to scale your business on SudoReply.</p>
            <p>A member of our dedicated enterprise account management team will review your requirements and reach out to you within 24 hours to schedule a custom platform walkthrough and pricing discussion.</p>
            <p>If you have any questions in the meantime, feel free to contact us at support@sudoreply.com.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 13px; color: #64748b; margin: 0;">SudoReply Enterprise Sales Team</p>
          </div>
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">SudoReply | support@sudoreply.com | www.sudoreply.com</p>
          </div>
        </div>
      `,
    });
    console.log('Enterprise lead confirmation email sent to:', email);
  } catch (error) {
    console.error('Enterprise lead confirmation email error:', error);
  }
};

// ===================== SEND ENTERPRISE LEAD NOTIFICATION =====================
export const sendEnterpriseLeadNotificationEmail = async (adminEmail, leadDetails) => {
  const { companyName, contactName, email, phone, role, companySize, estimatedUsers, requirements, timeline, preferredContact } = leadDetails;
  try {
    await transporter.sendMail({
      from: `"SudoReply Alerts" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `New Enterprise Lead: ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #125EF2; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: bold;">New Enterprise Lead Received 🚀</h1>
          </div>
          <div style="padding: 30px; color: #334155; line-height: 1.6;">
            <h3 style="color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 0;">Lead Details</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold; width: 180px;">Company Name</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${companyName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Contact Name</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${contactName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Email</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${email}">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Phone</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${phone || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Role</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${role || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Company Size</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${companySize}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Est. Number of Users</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${estimatedUsers || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Timeline</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${timeline}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Preferred Contact</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-transform: capitalize;">${preferredContact}</td>
              </tr>
            </table>
            
            <h3 style="color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 24px;">Features & Requirements</h3>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; white-space: pre-wrap;">${requirements || 'No custom requirements specified.'}</p>
            </div>
          </div>
        </div>
      `,
    });
    console.log('Enterprise lead notification email sent to admin:', adminEmail);
  } catch (error) {
    console.error('Enterprise lead notification email error:', error);
  }
};

// ===================== SEND ENTERPRISE ACCOUNT ACTIVATION =====================
export const sendEnterpriseAccountActivationEmail = async (email, name) => {
  try {
    await transporter.sendMail({
      from: `"SudoReply Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Enterprise Account is Ready',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: #10B981; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">Account Activated 🎉</h1>
          </div>
          <div style="padding: 30px; color: #334155; line-height: 1.6;">
            <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">Welcome to SudoReply Enterprise!</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>We are excited to inform you that your custom <strong>Enterprise Account</strong> has been successfully set up and activated by our team.</p>
            <p>You now have full access to all enterprise platform features, custom APIs, and high volume messaging queues.</p>
            <p>Please click the button below to log in and access your workspace dashboard:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',')[1] : 'http://localhost:5174'}/login"
                 style="
                   background-color: #10B981;
                   color: white;
                   padding: 12px 32px;
                   text-decoration: none;
                   border-radius: 8px;
                   display: inline-block;
                   font-weight: bold;
                   font-size: 15px;
                   box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                 ">
                Go to Dashboard
              </a>
            </div>
            <p>If you encounter any issues logging in, please contact your account manager directly or email support@sudoreply.com.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 13px; color: #64748b; margin: 0;">SudoReply Enterprise Success Team</p>
          </div>
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">SudoReply | support@sudoreply.com | www.sudoreply.com</p>
          </div>
        </div>
      `,
    });
    console.log('Enterprise account activation email sent to:', email);
  } catch (error) {
    console.error('Enterprise account activation email error:', error);
  }
};

// ── SUBSCRIPTION SYSTEM EMAIL HANDLERS ──
const getTemplateHTML = (templateName, variables) => {
  const templatePath = path.join(process.cwd(), 'src', 'emails', 'templates', `${templateName}.html`);
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const [key, value] of Object.entries(variables)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return html;
};

export const sendCancellationConfirmedEmail = async (email, data) => {
  try {
    const htmlContent = getTemplateHTML('cancellation_confirmed', data);
    await transporter.sendMail({
      from: `"SudoReply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your subscription has been cancelled',
      html: htmlContent,
    });
    console.log('Cancellation confirmation email sent to:', email);
  } catch (err) {
    console.error('Error sending cancellation confirmed email:', err);
  }
};

export const sendCancellationAdminAlertEmail = async (email, data) => {
  try {
    const htmlContent = getTemplateHTML('cancellation_admin_alert', data);
    await transporter.sendMail({
      from: `"SudoReply System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Tenant Cancelled: ${data.companyName}`,
      html: htmlContent,
    });
    console.log('Cancellation admin alert sent.');
  } catch (err) {
    console.error('Error sending admin alert cancellation email:', err);
  }
};

export const sendSubscriptionExpiredEmail = async (email, data) => {
  try {
    const htmlContent = getTemplateHTML('subscription_expired', data);
    await transporter.sendMail({
      from: `"SudoReply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your subscription has expired',
      html: htmlContent,
    });
    console.log('Subscription expired email sent to:', email);
  } catch (err) {
    console.error('Error sending subscription expired email:', err);
  }
};

export const sendReactivationConfirmedEmail = async (email, data) => {
  try {
    const htmlContent = getTemplateHTML('reactivation_confirmed', data);
    await transporter.sendMail({
      from: `"SudoReply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome back! Reactivation Confirmed',
      html: htmlContent,
    });
    console.log('Reactivation email sent to:', email);
  } catch (err) {
    console.error('Error sending reactivation email:', err);
  }
};

export const sendDataDeletionWarningEmail = async (email, data) => {
  try {
    const htmlContent = getTemplateHTML('data_deletion_warning', data);
    await transporter.sendMail({
      from: `"SudoReply Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'URGENT: SudoReply Data Deletion Warning',
      html: htmlContent,
    });
    console.log('Data deletion warning sent to:', email);
  } catch (err) {
    console.error('Error sending deletion warning email:', err);
  }
};

export const sendInvoiceReceiptEmail = async (email, data) => {
  try {
    const htmlContent = getTemplateHTML('invoice_receipt', data);
    await transporter.sendMail({
      from: `"SudoReply Billing" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Payment Receipt: Invoice ${data.invoiceNumber}`,
      html: htmlContent,
    });
    console.log('Invoice receipt email sent to:', email);
  } catch (err) {
    console.error('Error sending invoice receipt email:', err);
  }
};

export const sendExpiryReminderEmail = async (email, templateName, subject, data) => {
  try {
    const htmlContent = getTemplateHTML(templateName, data);
    await transporter.sendMail({
      from: `"SudoReply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    });
    console.log(`Reminder email (${templateName}) sent to:`, email);
  } catch (err) {
    console.error(`Error sending reminder email (${templateName}):`, err);
  }
};



// ===================== SEND TENANT WELCOME EMAIL =====================
export const sendTenantWelcomeEmail = async ({ 
  email, 
  firstName, 
  lastName,
  tenantName 
}) => {
  try {
   const loginUrl = process.env.FRONTEND_URLS
      ? `${process.env.FRONTEND_URLS.split(',')[1].trim()}/login`
      : 'http://localhost:5174/login';

    const htmlContent = getTemplateHTML('tenant_onboarded', {
      firstName:  firstName  || 'there',
      lastName:   lastName   || '',
      tenantName: tenantName || 'Your Workspace',
      email,
      loginUrl,
    });

    await transporter.sendMail({
      from:    `"SudoReply" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: '🎉 Welcome to SudoReply — Your account is ready!',
      html:    htmlContent,
    });

    console.log(`✅ Welcome email sent to: ${email}`);
  } catch (error) {
    // ⚠️ Non-blocking — onboarding still completes even if email fails
    console.error(`❌ Welcome email FAILED to: ${email}`);
    console.error(`❌ Error: ${error.message}`);
  }
};



// ===================== SEND WHATSAPP CONNECT/DISCONNECT ALERT TO SUPERADMIN =====================
export const sendWhatsAppStatusAlertEmail = async ({
  superAdminEmail,
  tenantName,
  tenantEmail,
  phoneNumber,
  wabaId,
  action, // 'CONNECTED' | 'DISCONNECTED'
}) => {
  try {
    const isConnected = action === 'CONNECTED';

    await transporter.sendMail({
      from:    `"SudoReply Alerts" <${process.env.EMAIL_USER}>`,
      to:      superAdminEmail,
      subject: `⚡ WhatsApp ${isConnected ? 'Connected' : 'Disconnected'} — ${tenantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; 
                    margin: 0 auto; border: 1px solid #e2e8f0; 
                    border-radius: 12px; overflow: hidden;">

          <!-- Header -->
          <div style="background: ${isConnected ? '#125EF2' : '#ef4444'}; 
                      padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: bold;">
              ${isConnected ? '✅ WhatsApp Connected' : '🔴 WhatsApp Disconnected'}
            </h1>
          </div>

          <!-- Body -->
          <div style="padding: 30px; color: #334155; line-height: 1.6;">
            <p style="margin: 0 0 20px 0;">
              A tenant has <strong>${isConnected ? 'connected' : 'disconnected'}</strong> 
              their WhatsApp account on the platform.
            </p>

            <!-- Details Box -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; 
                        border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #888; font-size: 13px; 
                             padding: 6px 0; width: 160px;">
                    Tenant Name
                  </td>
                  <td style="color: #1a1a1a; font-size: 13px; font-weight: bold;">
                    ${tenantName}
                  </td>
                </tr>
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">
                    Tenant Email
                  </td>
                  <td style="color: #1a1a1a; font-size: 13px; font-weight: bold;">
                    ${tenantEmail}
                  </td>
                </tr>
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">
                    Phone Number ID
                  </td>
                  <td style="color: #1a1a1a; font-size: 13px; font-weight: bold;">
                    ${phoneNumber || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">
                    WABA ID
                  </td>
                  <td style="color: #1a1a1a; font-size: 13px; font-weight: bold;">
                    ${wabaId || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">
                    Action
                  </td>
                  <td style="font-size: 13px;">
                    <span style="
                      background: ${isConnected ? '#dcfce7' : '#fee2e2'};
                      color: ${isConnected ? '#16a34a' : '#dc2626'};
                      padding: 2px 10px;
                      border-radius: 20px;
                      font-size: 12px;
                      font-weight: bold;
                    ">
                      ${action}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="color: #888; font-size: 13px; padding: 6px 0;">
                    Time
                  </td>
                  <td style="color: #1a1a1a; font-size: 13px; font-weight: bold;">
                    ${new Date().toLocaleString('en-IN', { 
                      timeZone: 'Asia/Kolkata',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })} IST
                  </td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: #64748b; margin: 0;">
              Log in to the admin dashboard to view more details.
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; 
                      padding: 16px; text-align: center;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              SudoReply | info@sudoreply.com | www.sudoreply.com
            </p>
          </div>

        </div>
      `,
    });

    console.log(`✅ WhatsApp ${action} alert email sent to superadmin: ${superAdminEmail}`);
  } catch (error) {
    // Non-blocking
    console.error(`❌ WhatsApp alert email FAILED: ${error.message}`);
  }
};