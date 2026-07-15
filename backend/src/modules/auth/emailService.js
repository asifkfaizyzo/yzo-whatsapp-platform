import nodemailer from 'nodemailer';
import crypto from 'crypto';

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
      from: `"YZO Platform" <${process.env.EMAIL_USER}>`,
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
                      background: ${
                        priority === "URGENT" ? "#fef2f2" :
                        priority === "HIGH"   ? "#fff7ed" :
                        priority === "MEDIUM" ? "#fefce8" :
                                                "#f0fdf4"
                      };
                      color: ${
                        priority === "URGENT" ? "#dc2626" :
                        priority === "HIGH"   ? "#ea580c" :
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

    console.log(`✅ Ticket email sent to: ${to}`);
  } catch (error) {
    console.error("❌ Ticket email error:", error);
    // Non-blocking — don't throw
  }
};