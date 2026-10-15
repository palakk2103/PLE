import "../loadEnv.js";
import nodemailer from 'nodemailer';
import Settings from '../models/Settings.model.js';
import EmailLog from '../models/EmailLog.model.js';
import { getOrderStatusEmailTemplate } from '../utils/orderEmailTemplate.js';
import { getInvoiceEmailTemplate } from '../utils/invoiceEmailTemplate.js';
import { ORDER_STATUS_CONFIG } from '../constants/orderStatus.constants.js';

let cachedTransporter = null;
let cachedConfigKey = null;

/**
 * Clear the cached transporter (call whenever admin email settings are modified)
 */
export const clearTransporterCache = () => {
    cachedTransporter = null;
    cachedConfigKey = null;
    console.log('[EmailService] Transporter cache cleared.');
};

/**
 * Resolve effective SMTP configuration from DB Settings with environment variable fallbacks
 */
export const getEffectiveEmailConfig = async () => {
    let dbConfig = null;
    try {
        const setting = await Settings.findOne({ key: 'email' }).lean();
        if (setting && setting.value && typeof setting.value === 'object') {
            dbConfig = setting.value;
        }
    } catch (err) {
        console.warn('[EmailService] Could not load email settings from DB, falling back to env:', err.message);
    }

    const cleanDbPass = dbConfig?.smtpPassword ? String(dbConfig.smtpPassword).replace(/\s+/g, '') : null;
    const cleanEnvPass = process.env.SMTP_PASS ? String(process.env.SMTP_PASS).replace(/\s+/g, '') : '';

    const host = dbConfig?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(dbConfig?.smtpPort) || Number(process.env.SMTP_PORT) || (host === 'smtp.gmail.com' ? 465 : 587);
    const user = dbConfig?.smtpUser || process.env.SMTP_USER || '';
    const pass = (cleanDbPass && cleanDbPass !== '••••••••') ? cleanDbPass : cleanEnvPass;
    const fromName = dbConfig?.fromName || process.env.FROM_NAME || 'Peoples League of Electronics';
    const fromEmail = dbConfig?.fromEmail || process.env.FROM_EMAIL || user;
    const replyToEmail = dbConfig?.replyToEmail || process.env.REPLY_TO_EMAIL || fromEmail;
    const testMode = dbConfig?.testMode ?? (process.env.EMAIL_TEST_MODE === 'true' || process.env.NODE_ENV === 'test');
    const testRecipient = dbConfig?.testRecipient || process.env.EMAIL_TEST_RECIPIENT || null;

    return {
        host,
        port,
        user,
        pass,
        fromName,
        fromEmail,
        replyToEmail,
        testMode,
        testRecipient,
        isGmail: host === 'smtp.gmail.com' || host?.includes('gmail'),
    };
};

/**
 * Get or initialize cached nodemailer transporter
 */
export const getTransporter = async (forceRefresh = false) => {
    if (cachedTransporter && !forceRefresh) {
        return cachedTransporter;
    }

    const config = await getEffectiveEmailConfig();
    const configFingerprint = `${config.host}:${config.port}:${config.user}:${config.pass?.length}`;

    if (cachedTransporter && cachedConfigKey === configFingerprint && !forceRefresh) {
        return cachedTransporter;
    }

    const transportOpts = config.isGmail
        ? {
            service: 'gmail',
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            auth: {
                user: config.user,
                pass: config.pass,
            },
            tls: {
                rejectUnauthorized: false,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
        }
        : {
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            auth: {
                user: config.user,
                pass: config.pass,
            },
            tls: {
                rejectUnauthorized: false,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
        };

    cachedTransporter = nodemailer.createTransport(transportOpts);
    cachedConfigKey = configFingerprint;
    return cachedTransporter;
};

/**
 * Check if a specific notification type is enabled in Admin settings
 * @param {string} notificationType - e.g. 'orderConfirmation', 'shippingUpdate', 'deliveryUpdate'
 * @returns {Promise<boolean>}
 */
export const isNotificationEnabled = async (notificationType) => {
    try {
        const setting = await Settings.findOne({ key: 'notifications' }).lean();
        if (!setting || !setting.value) return true; // Default to enabled if not configured
        const emailNotifications = setting.value.email || {};
        if (notificationType in emailNotifications) {
            return emailNotifications[notificationType] !== false;
        }
        return true;
    } catch (err) {
        console.warn(`[EmailService] Failed to check notification toggle '${notificationType}':`, err.message);
        return true;
    }
};

/**
 * Test SMTP connection with provided or saved credentials
 * @param {Object} options - { smtpHost, smtpPort, smtpUser, smtpPassword, recipientEmail, fromName, fromEmail }
 */
export const testSmtpConnection = async ({ smtpHost, smtpPort, smtpUser, smtpPassword, recipientEmail, fromName, fromEmail }) => {
    const isGmail = (smtpHost === 'smtp.gmail.com' || smtpHost?.includes('gmail'));
    const cleanPass = (smtpPassword || '').replace(/\s+/g, '');

    const transportOpts = isGmail
        ? {
            service: 'gmail',
            auth: { user: smtpUser, pass: cleanPass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
        }
        : {
            host: smtpHost,
            port: Number(smtpPort) || 587,
            secure: Number(smtpPort) === 465,
            auth: { user: smtpUser, pass: cleanPass },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000,
        };

    const tempTransporter = nodemailer.createTransport(transportOpts);

    // Verify SMTP handshake
    await tempTransporter.verify();

    let sendResult = null;
    if (recipientEmail) {
        const testFromName = fromName || 'Peoples League of Electronics (Test)';
        const testFromEmail = fromEmail || smtpUser;
        sendResult = await tempTransporter.sendMail({
            from: `"${testFromName}" <${testFromEmail}>`,
            to: recipientEmail,
            subject: '[PLE Store] SMTP Configuration Test Verification',
            text: `This is a test notification verifying that the PLE Store SMTP connection to ${smtpHost}:${smtpPort} is functioning correctly.`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 500px;">
                    <h2 style="color: #16a34a; margin-top: 0;">✓ SMTP Connected Successfully</h2>
                    <p>Your email service configuration on <strong>Peoples League of Electronics</strong> is operational.</p>
                    <ul style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                        <li><strong>Host:</strong> ${smtpHost}</li>
                        <li><strong>Port:</strong> ${smtpPort}</li>
                        <li><strong>User:</strong> ${smtpUser}</li>
                        <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
                    </ul>
                </div>
            `,
        });
    }

    return {
        verified: true,
        message: 'SMTP credentials verified successfully.',
        messageId: sendResult?.messageId || null,
    };
};

/**
 * Send an email with delivery logging, idempotency, and non-blocking safety
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} [options.html] - HTML content
 * @param {string} [options.text] - Plain text content
 * @param {Array} [options.attachments] - Array of attachments
 * @param {string} [options.recipientType] - 'customer' | 'vendor' | 'admin' | 'internal' | 'other'
 * @param {string} [options.template] - Template identifier
 * @param {string} [options.idempotencyKey] - Optional unique key to prevent duplicate sends
 * @param {Object} [options.metadata] - Optional business references (orderId, invoiceId, etc.)
 * @param {boolean} [options.throwOnError] - Whether to rethrow error or handle safely (default: false)
 */
export const sendEmail = async ({
    to,
    subject,
    html,
    text,
    attachments = [],
    recipientType = 'customer',
    template = 'generic',
    idempotencyKey = null,
    metadata = {},
    throwOnError = false,
}) => {
    if (!to) {
        console.warn('[EmailService] sendEmail called without recipient email.');
        return { success: false, error: 'Recipient email is required.' };
    }

    // 1. Idempotency Check
    if (idempotencyKey) {
        try {
            const existingLog = await EmailLog.findOne({ idempotencyKey, status: 'sent' }).lean();
            if (existingLog) {
                console.log(`[EmailService] Idempotency match for key '${idempotencyKey}'. Email already sent. Skipping.`);
                return {
                    success: true,
                    alreadySent: true,
                    messageId: existingLog.messageId,
                    emailLogId: existingLog._id,
                };
            }
        } catch (dbErr) {
            console.warn('[EmailService] Idempotency lookup error:', dbErr.message);
        }
    }

    // 2. Resolve Config
    const config = await getEffectiveEmailConfig();
    let targetRecipient = to;

    // Test mode redirection
    if (config.testMode && config.testRecipient) {
        console.log(`[EmailService] Test mode active. Redirecting email from ${to} to test recipient: ${config.testRecipient}`);
        targetRecipient = config.testRecipient;
    }

    // 3. Create or Prepare EmailLog entry
    let emailLog = null;
    try {
        emailLog = await EmailLog.create({
            recipient: targetRecipient,
            recipientType,
            subject,
            template,
            status: 'pending',
            idempotencyKey: idempotencyKey || undefined,
            metadata: {
                ...metadata,
                originalRecipient: targetRecipient !== to ? to : undefined,
            },
        });
    } catch (logErr) {
        // If unique index collision on pending/failed with same idempotencyKey, retrieve it
        if (idempotencyKey && logErr.code === 11000) {
            emailLog = await EmailLog.findOne({ idempotencyKey });
        } else {
            console.warn('[EmailService] Failed to create EmailLog record:', logErr.message);
        }
    }

    // Mock dispatch if running in test environment with no credentials
    if ((process.env.NODE_ENV === 'test' || config.testMode) && (!config.user || !config.pass)) {
        console.log(`[EmailService] [MOCK SEND] Email mock-delivered to ${targetRecipient}: ${subject}`);
        const mockMessageId = `<mock-${Date.now()}@ple-store.local>`;
        if (emailLog) {
            emailLog.status = 'sent';
            emailLog.messageId = mockMessageId;
            emailLog.sentAt = new Date();
            await emailLog.save().catch(() => {});
        }
        return {
            success: true,
            messageId: mockMessageId,
            mock: true,
            emailLogId: emailLog?._id,
        };
    }

    // 4. Dispatch Email
    const fromName = config.fromName;
    const fromEmail = config.fromEmail;
    const replyToEmail = config.replyToEmail;

    const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        sender: fromEmail,
        replyTo: replyToEmail,
        to: targetRecipient,
        subject: config.testMode ? `[TEST] ${subject}` : subject,
        html,
        text,
        ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
    };

    try {
        const transporter = await getTransporter();
        const info = await transporter.sendMail(mailOptions);
        console.log(`[EmailService] Email sent successfully to ${targetRecipient}: ${info.messageId}`);

        if (emailLog) {
            emailLog.status = 'sent';
            emailLog.messageId = info.messageId;
            emailLog.sentAt = new Date();
            await emailLog.save().catch(() => {});
        }

        return {
            success: true,
            messageId: info.messageId,
            emailLogId: emailLog?._id,
        };
    } catch (error) {
        console.error(`[EmailService] Delivery failed for ${targetRecipient}:`, error.message);

        if (emailLog) {
            emailLog.status = 'failed';
            emailLog.errorMessage = error.message;
            await emailLog.save().catch(() => {});
        }

        if (throwOnError) {
            throw error;
        }

        return {
            success: false,
            error: error.message,
            emailLogId: emailLog?._id,
        };
    }
};

/**
 * Retry a previously failed email log entry
 * @param {string} emailLogId
 */
export const retryFailedEmail = async (emailLogId) => {
    const log = await EmailLog.findById(emailLogId);
    if (!log) {
        throw new Error('Email log not found');
    }

    log.attempts += 1;
    log.status = 'pending';
    await log.save();

    try {
        const transporter = await getTransporter(true);
        const config = await getEffectiveEmailConfig();
        const info = await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: log.recipient,
            subject: log.subject,
            html: log.metadata?.html || `<p>${log.subject}</p>`,
            text: log.metadata?.text || log.subject,
        });

        log.status = 'sent';
        log.messageId = info.messageId;
        log.sentAt = new Date();
        log.errorMessage = null;
        await log.save();

        return { success: true, messageId: info.messageId };
    } catch (err) {
        log.status = 'failed';
        log.errorMessage = err.message;
        await log.save();
        throw err;
    }
};

/**
 * Send order status update email to customer with notification toggle checks and idempotency
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

    // Check notification toggle in admin settings
    const toggleMapping = {
        pending: 'orderConfirmation',
        processing: 'orderConfirmation',
        shipped: 'shippingUpdate',
        delivered: 'deliveryUpdate',
    };

    const toggleKey = toggleMapping[status];
    if (toggleKey) {
        const enabled = await isNotificationEnabled(toggleKey);
        if (!enabled) {
            console.log(`[EmailService] Notification toggle '${toggleKey}' is disabled in Admin settings. Skipping email for order ${order.orderId || order._id}.`);
            // Record skipped state in EmailLog
            await EmailLog.create({
                recipient: recipientEmail,
                recipientType: 'customer',
                subject: `Order #${order.orderId || order._id} Status Update [Skipped]`,
                template: 'order_status',
                status: 'skipped',
                errorMessage: `Notification type '${toggleKey}' disabled in admin settings`,
                metadata: { orderId: order.orderId || order._id, status },
            }).catch(() => {});

            return { skipped: true, reason: `Notification toggle '${toggleKey}' is disabled` };
        }
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
        recipientType: 'customer',
        template: 'order_status',
        idempotencyKey: `order_status_${orderId}_${status}`,
        metadata: { orderId, status },
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
        recipientType: 'customer',
        template: 'tax_invoice',
        idempotencyKey: `invoice_${orderId}_${invoiceNumber}`,
        metadata: { orderId, invoiceNumber },
    });
};
