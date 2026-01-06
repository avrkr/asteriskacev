const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendEmail = async ({ to, subject, html }) => {
    const mailOptions = {
        from: `"Asterisk Ace" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.messageId);
        return info;
    } catch (error) {
        console.error('Email error: ', error);
        throw error;
    }
};

const getWelcomeTemplate = (email, password, loginUrl) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0c0c0c; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #4ade80;">Asterisk Ace</h1>
      </div>
      <div style="padding: 24px; color: #333;">
        <h2>Welcome to the Platform!</h2>
        <p>Your account has been created by the administrator.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> <code style="background: #eee; padding: 2px 5px; border-radius: 3px;">${password}</code></p>
        </div>
        <p style="color: #d97706; font-weight: bold;">Important: Please change your password immediately after your first login for security reasons.</p>
        <p>If you didn't expect this email, please contact support.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777; text-align: center;">&copy; 2026 Asterisk Ace. All rights reserved.</p>
      </div>
    </div>
  `;
};

const getOTPTemplate = (otp) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0c0c0c; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #4ade80;">Asterisk Ace</h1>
      </div>
      <div style="padding: 24px; color: #333;">
        <h2>Password Reset OTP</h2>
        <p>You requested a password reset. Use the following code to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4ade80; background: #f0fdf4; padding: 10px 20px; border-radius: 8px; border: 1px dashed #4ade80;">${otp}</span>
        </div>
        <p>This code is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777; text-align: center;">&copy; 2026 Asterisk Ace. All rights reserved.</p>
      </div>
    </div>
  `;
};

const getNotificationTemplate = (title, message) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0c0c0c; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; color: #4ade80;">Asterisk Ace</h1>
      </div>
      <div style="padding: 24px; color: #333;">
        <h2>${title}</h2>
        <p>${message}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #777; text-align: center;">&copy; 2026 Asterisk Ace. All rights reserved.</p>
      </div>
    </div>
  `;
};

module.exports = {
    sendEmail,
    getWelcomeTemplate,
    getOTPTemplate,
    getNotificationTemplate
};
