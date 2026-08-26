import "../loadEnv.js";
import nodemailer from 'nodemailer';

const getTransporter = () => {
    const cleanPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    const isGmail = process.env.SMTP_HOST === 'smtp.gmail.com';
    
    return nodemailer.createTransport(
        isGmail
            ? {
                service: 'gmail',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: cleanPass,
                },
                tls: {
                    rejectUnauthorized: false
                }
            }
            : {
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: Number(process.env.SMTP_PORT) === 465,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: cleanPass,
                },
                tls: {
                    rejectUnauthorized: false
                }
            }
    );
};

/**
 * Send an email
 * @param {Object} options - { to, subject, html, text }
 */
export const sendEmail = async ({ to, subject, html, text }) => {
    const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Appzeto Store'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text,
    };

    try {
        const transporter = getTransporter();
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('Email sending failed details:', error);
        throw error;
    }
};

export const sendOrderConfirmationEmail = async (order, userEmail) => {
    await sendEmail({
        to: userEmail,
        subject: `Order Confirmed — ${order.orderId}`,
        html: `<h2>Thank you for your order!</h2><p>Order ID: <strong>${order.orderId}</strong></p><p>Total: ₹${order.total}</p><p>Tracking: ${order.trackingNumber}</p>`,
    });
};
