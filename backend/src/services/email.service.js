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
 * @param {Object} options - { to, subject, html, text, attachments }
 */
export const sendEmail = async ({ to, subject, html, text, attachments = [] }) => {
    const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Appzeto Store'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text,
        ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
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

import { getOrderStatusEmailTemplate } from '../utils/orderEmailTemplate.js';
import { getInvoiceEmailTemplate } from '../utils/invoiceEmailTemplate.js';
import { ORDER_STATUS_CONFIG } from '../constants/orderStatus.constants.js';

/**
 * Send order status update email to customer
 * @param {Object} params
 * @param {Object} params.order - The order document
 * @param {string} params.status - The new status
 * @param {string} params.recipientEmail - The customer email
 * @param {string} [params.customerName] - Optional customer name
 */
export const sendOrderStatusEmail = async ({ order, status, recipientEmail, customerName }) => {
    if (!recipientEmail) {
        throw new Error('Recipient email is required to send order status notification.');
    }

    const orderId = order.orderId || order.id || order._id;
    const config = ORDER_STATUS_CONFIG[status];
    const subject = config?.emailSubject ? config.emailSubject(orderId) : `Update on your Order #${orderId}`;

    const html = getOrderStatusEmailTemplate({
        order,
        status,
        customerName: customerName || order.shippingAddress?.name || order.guestInfo?.name || 'Valued Customer',
        storeName: process.env.FROM_NAME || 'Peoples League of Electronics',
    });

    const text = `${config?.label || status}: ${config?.customerMessage || 'Your order status has changed'}. Order #${orderId}`;

    return await sendEmail({
        to: recipientEmail,
        subject,
        html,
        text,
    });
};

export const sendOrderConfirmationEmail = async (order, userEmail) => {
    return await sendOrderStatusEmail({
        order,
        status: 'pending',
        recipientEmail: userEmail,
        customerName: order.shippingAddress?.name || order.guestInfo?.name,
    });
};

/**
 * Send customer order bill / tax invoice email with PDF attachment
 * @param {Object} params
 * @param {Object} params.order - The order document
 * @param {Object} params.invoice - The invoice document
 * @param {string} params.recipientEmail - The customer email
 * @param {string} [params.customerName] - Optional customer name
 * @param {Buffer} params.pdfBuffer - The binary PDF buffer of the invoice
 */
export const sendInvoiceEmail = async ({ order, invoice, recipientEmail, customerName, pdfBuffer }) => {
    if (!recipientEmail) {
        throw new Error('Recipient email is required to send invoice email.');
    }

    const orderId = order.orderId || order.id || order._id;
    const invoiceNumber = invoice?.invoiceNumber || `INV-${orderId}`;
    const subject = `Invoice for Your Order #${orderId} [${invoiceNumber}]`;

    const html = getInvoiceEmailTemplate({
        order,
        invoice,
        customerName: customerName || order.shippingAddress?.name || order.guestInfo?.name || 'Valued Customer',
        storeName: process.env.FROM_NAME || 'Peoples League of Electronics',
    });

    const text = `Thank you for your order #${orderId}. Your official tax invoice [${invoiceNumber}] for ₹${order.total || invoice?.financialSummary?.grandTotal || 0} is attached to this email as a PDF.`;

    const attachments = [];
    if (pdfBuffer && Buffer.isBuffer(pdfBuffer)) {
        attachments.push({
            filename: `Invoice-${invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
        });
    }

    return await sendEmail({
        to: recipientEmail,
        subject,
        html,
        text,
        attachments,
    });
};


