const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');

const sendEmail = async (options) => {
    try {
        // Fetch company name from Settings (dynamically)
        let companyName = process.env.COMPANY_NAME || 'DigiCoders CRM';
        try {
            const settings = await Settings.findOne();
            if (settings && settings.companyName) {
                companyName = settings.companyName;
            }
        } catch (err) {
            console.error("Error fetching settings for email:", err.message);
        }

        // You can configure your email provider here
        const transporter = nodemailer.createTransport({
            service: 'gmail', // or any other service like smtp.mailtrap.io
            auth: {
                user: process.env.EMAIL_USER || 'your-email@gmail.com', // Need to set in .env
                pass: process.env.EMAIL_PASS || 'your-app-password'
            }
        });

        console.log(`[Email Config] Using email account: ${process.env.EMAIL_USER}`);
        
        // Convert \n to <br> for HTML emails
        const formattedMessage = options.message.replace(/\n/g, '<br>');
        
        // Professional Email Template
        const defaultHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="background-color: #047857; color: #ffffff; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px; letter-spacing: 1px;">${companyName}</h2>
                </div>
                <div style="padding: 30px; background-color: #ffffff; color: #333333; line-height: 1.6; font-size: 15px;">
                    ${options.html || formattedMessage}
                </div>
                <div style="background-color: #f9fafb; padding: 15px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #eeeeee;">
                    <p style="margin: 0;">This is an automated message from your CRM system. Please do not reply directly to this email.</p>
                </div>
            </div>
        `;

        const mailOptions = {
            from: `${companyName} <no-reply@crm.com>`,
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: defaultHtml
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${options.email} - Message ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = sendEmail;
