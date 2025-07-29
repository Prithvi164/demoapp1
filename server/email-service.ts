import nodemailer from 'nodemailer';

// Email configuration
let transporter: nodemailer.Transporter;

// Initialize the email service with configuration
export async function initializeEmailService() {
  try {
    // Debug environment variables
    console.log('Email Environment Variables:');
    console.log('- EMAIL_HOST:', process.env.EMAIL_HOST || 'Not set');
    console.log('- EMAIL_PORT:', process.env.EMAIL_PORT || 'Not set');
    console.log('- EMAIL_USER:', process.env.EMAIL_USER ? '*** Set ***' : 'Not set');
    console.log('- EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '*** Set ***' : 'Not set');
    console.log('- EMAIL_SECURE:', process.env.EMAIL_SECURE || 'Not set');
    console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || 'Not set');
    
    // Check if we have environment variables for email configuration
    if (process.env.EMAIL_HOST && process.env.EMAIL_PORT) {
      console.log('Using configured email settings');
      // Use production configuration
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_PORT === '465', // Force secure=true for port 465, false otherwise
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
          // Do not fail on invalid certs
          rejectUnauthorized: false
        },
        debug: true, // Show debug output
        logger: true // Log information about the mail
      });
    } else {
      // For development/testing - create a test account using Ethereal
      const testAccount = await nodemailer.createTestAccount();
      
      console.log('Created test email account:');
      console.log(`- Username: ${testAccount.user}`);
      console.log(`- Password: ${testAccount.pass}`);
      console.log(`- SMTP Host: ${testAccount.smtp.host}`);
      console.log(`- SMTP Port: ${testAccount.smtp.port}`);
      
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
    
    console.log('Email service initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    return false;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, resetUrl: string, username: string) {
  try {
    if (!transporter) {
      throw new Error('Email service not initialized');
    }
    
    // Log email configuration
    console.log('Sending password reset email with config:');
    console.log('- From:', process.env.EMAIL_FROM || '"CloudLMS" <noreply@cloudlms.com>');
    console.log('- To:', email);
    console.log('- Using transport:', process.env.EMAIL_HOST || 'Unknown host');
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"CloudLMS" <noreply@cloudlms.com>',
      to: email,
      subject: 'Password Reset Instructions',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Password Reset Request</h2>
          <p>Hello ${username},</p>
          <p>We received a request to reset the password for your CloudLMS account. To reset your password, click on the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p>If you didn't request a password reset, you can safely ignore this email - your password will not be changed.</p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>Thank you,<br>The CloudLMS Team</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">If the button doesn't work, copy and paste this URL into your browser: ${resetUrl}</p>
        </div>
      `,
    };
    
    console.log('Attempting to send email...');
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Password reset email sent successfully');
    
    // Only get preview URL for Ethereal test accounts
    let previewUrl = null;
    if (process.env.EMAIL_HOST?.includes('ethereal.email')) {
      previewUrl = nodemailer.getTestMessageUrl(info);
    }
    
    if (previewUrl) {
      console.log('Preview URL:', previewUrl);
    } else {
      console.log('Email sent via production email service (no preview available)');
    }
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl,
    };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    // Output more detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}