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
export const sendPasswordResetEmail = async (email, resetToken) => {

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

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