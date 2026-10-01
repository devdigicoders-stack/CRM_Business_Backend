const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    try {
        // You can configure your email provider here
        const transporter = nodemailer.createTransport({
            service: 'gmail', // or any other service like smtp.mailtrap.io
            auth: {
                user: process.env.EMAIL_USER || 'your-email@gmail.com', // Need to set in .env
                pass: process.env.EMAIL_PASS || 'your-app-password'
            }
        });

        console.log(`[Email Config] Using email account: ${process.env.EMAIL_USER}`);
        
        const mailOptions = {
            from: 'CRM Task Automation <no-reply@crm.com>',
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html || `<p>${options.message}</p>`
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
