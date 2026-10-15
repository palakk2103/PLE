import '../src/loadEnv.js';
import dns from 'dns';
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}
import mongoose from 'mongoose';
import Settings from '../src/models/Settings.model.js';
import EmailLog from '../src/models/EmailLog.model.js';
import {
    getEffectiveEmailConfig,
    clearTransporterCache,
    isNotificationEnabled,
    sendEmail,
    sendOrderStatusEmail,
    sendInvoiceEmail,
} from '../src/services/email.service.js';
import { getOtpEmailTemplate } from '../src/utils/emailTemplates.js';
import { getOrderStatusEmailTemplate } from '../src/utils/orderEmailTemplate.js';
import { getInvoiceEmailTemplate } from '../src/utils/invoiceEmailTemplate.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        failed++;
    }
}

async function runPhase1Tests() {
    console.log('===========================================================');
    console.log('   PLE STORE — PHASE 1 EMAIL INFRASTRUCTURE TEST SUITE     ');
    console.log('===========================================================\n');

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/appzeto';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    try {
        // --- TEST 1: Fallback & Dynamic DB Email Config Resolution ---
        console.log('--- TEST 1: Email Config Resolution (DB & Env Fallback) ---');
        clearTransporterCache();
        const initialConfig = await getEffectiveEmailConfig();
        assert(initialConfig.host && typeof initialConfig.host === 'string', 'Resolved valid SMTP host');
        assert(typeof initialConfig.port === 'number', 'Resolved valid SMTP port as number');
        assert(initialConfig.fromName && initialConfig.fromEmail, 'Resolved fromName and fromEmail');

        // Test DB override
        await Settings.findOneAndUpdate(
            { key: 'email' },
            {
                value: {
                    smtpHost: 'smtp.customtest.org',
                    smtpPort: 2525,
                    smtpUser: 'test@customtest.org',
                    fromName: 'PLE Test Store Custom',
                    fromEmail: 'custom@customtest.org',
                    testMode: true,
                },
            },
            { upsert: true, new: true }
        );
        clearTransporterCache();
        const customConfig = await getEffectiveEmailConfig();
        assert(customConfig.host === 'smtp.customtest.org', 'Successfully applied DB override for smtpHost');
        assert(customConfig.port === 2525, 'Successfully applied DB override for smtpPort');
        assert(customConfig.fromName === 'PLE Test Store Custom', 'Successfully applied DB override for fromName');
        assert(customConfig.testMode === true, 'Successfully applied DB override for testMode');

        // Cleanup DB email test setting
        await Settings.deleteOne({ key: 'email' });
        clearTransporterCache();
        const restoredConfig = await getEffectiveEmailConfig();
        assert(restoredConfig.host === (process.env.SMTP_HOST || 'smtp.gmail.com'), 'Restored default config after cleanup');

        // --- TEST 2: Notification Toggle Respect ---
        console.log('\n--- TEST 2: Notification Toggle Respect (Settings.model.js) ---');
        // Set orderConfirmation to true
        await Settings.findOneAndUpdate(
            { key: 'notifications' },
            { value: { email: { orderConfirmation: true, shippingUpdate: false } } },
            { upsert: true }
        );

        const isOrderConfEnabled = await isNotificationEnabled('orderConfirmation');
        assert(isOrderConfEnabled === true, 'orderConfirmation correctly evaluated as enabled');

        const isShippingEnabled = await isNotificationEnabled('shippingUpdate');
        assert(isShippingEnabled === false, 'shippingUpdate correctly evaluated as disabled');

        // Test sending an order status email when the notification is toggled OFF
        const mockOrder = {
            _id: new mongoose.Types.ObjectId(),
            orderId: 'TEST-ORD-DIS-999',
            total: 1500,
            shippingAddress: { name: 'Test Customer' },
        };

        const skippedResult = await sendOrderStatusEmail({
            order: mockOrder,
            status: 'shipped', // mapped to shippingUpdate (which is disabled)
            recipientEmail: 'customer@example.com',
            customerName: 'Test Customer',
        });
        assert(skippedResult.skipped === true, 'sendOrderStatusEmail gracefully skipped disabled notification');

        // Verify skipped entry recorded in EmailLog
        const skippedLog = await EmailLog.findOne({
            recipient: 'customer@example.com',
            status: 'skipped',
        }).sort({ createdAt: -1 });
        assert(skippedLog !== null, 'Skipped notification recorded in EmailLog audit trail');

        // Cleanup notification test setting
        await Settings.deleteOne({ key: 'notifications' });

        // --- TEST 3: Idempotency & Duplicate Prevention ---
        console.log('\n--- TEST 3: Idempotency & Duplicate Prevention ---');
        const testIdempotencyKey = `test_idem_${Date.now()}`;

        // First send
        const firstSend = await sendEmail({
            to: 'idem.test@example.com',
            subject: 'Test Idempotent Subject',
            html: '<p>Testing Idempotency</p>',
            idempotencyKey: testIdempotencyKey,
            throwOnError: false,
        });
        assert(firstSend.success === true, 'First send completed');

        // Second send with same idempotency key
        const secondSend = await sendEmail({
            to: 'idem.test@example.com',
            subject: 'Test Idempotent Subject Duplicate',
            html: '<p>Testing Idempotency Duplicate</p>',
            idempotencyKey: testIdempotencyKey,
            throwOnError: false,
        });
        assert(secondSend.alreadySent === true, 'Duplicate send detected and prevented via idempotencyKey');
        assert(secondSend.messageId === firstSend.messageId, 'Returned existing messageId without duplicate SMTP call');

        // --- TEST 4: Safe Non-blocking Error Handling ---
        console.log('\n--- TEST 4: Non-blocking Error Handling ---');
        // Calling sendEmail with throwOnError: false on an invalid host
        await Settings.findOneAndUpdate(
            { key: 'email' },
            {
                value: {
                    smtpHost: 'invalid-nonexistent-smtp.ple-domain.invalid',
                    smtpPort: 25,
                    smtpUser: 'baduser',
                    smtpPassword: 'badpassword',
                    testMode: false,
                },
            },
            { upsert: true }
        );
        clearTransporterCache();

        let didThrow = false;
        let safeResult = null;
        try {
            safeResult = await sendEmail({
                to: 'error.test@example.com',
                subject: 'Failure Test',
                html: '<p>Testing safe failure</p>',
                throwOnError: false,
            });
        } catch (e) {
            didThrow = true;
        }

        assert(didThrow === false, 'sendEmail did NOT throw uncaught error on SMTP failure');
        assert(safeResult && safeResult.success === false, 'sendEmail safely returned error object');

        // Verify failure logged to EmailLog
        const failedLog = await EmailLog.findOne({
            recipient: 'error.test@example.com',
            status: 'failed',
        }).sort({ createdAt: -1 });
        assert(failedLog !== null, 'SMTP failure logged to EmailLog with error details');
        assert(failedLog.errorMessage && typeof failedLog.errorMessage === 'string', 'Error message recorded in log');

        // Restore Settings
        await Settings.deleteOne({ key: 'email' });
        clearTransporterCache();

        // --- TEST 5: Template Regression Tests ---
        console.log('\n--- TEST 5: Template Regression Tests ---');
        const otpHtml = getOtpEmailTemplate({ otp: '123456', purpose: 'Login Verification' });
        assert(otpHtml.includes('123456'), 'OTP template renders 6-digit OTP code');

        const statusHtml = getOrderStatusEmailTemplate({
            order: {
                orderId: 'ORD-9876',
                total: 2499,
                createdAt: new Date(),
                items: [{ name: 'Wireless Earbuds', quantity: 1, price: 2499 }],
                shippingAddress: { name: 'John Doe', address: 'MG Road', city: 'Bengaluru' },
            },
            status: 'pending',
            customerName: 'John Doe',
        });
        assert(statusHtml.includes('ORD-9876') && statusHtml.includes('Wireless Earbuds'), 'Order status template renders order ID and items');

        const invoiceHtml = getInvoiceEmailTemplate({
            order: {
                orderId: 'ORD-9876',
                total: 2499,
                shippingAddress: { name: 'John Doe' },
            },
            invoice: {
                invoiceNumber: 'INV-ORD-9876',
                financialSummary: { grandTotal: 2499 },
            },
            customerName: 'John Doe',
        });
        assert(invoiceHtml.includes('INV-ORD-9876'), 'Invoice template renders official invoice number');

        // --- CLEANUP TEST LOGS ---
        await EmailLog.deleteMany({
            recipient: { $in: ['customer@example.com', 'idem.test@example.com', 'error.test@example.com'] },
        });

        console.log('\n===========================================================');
        console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log('===========================================================');

        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (err) {
        console.error('Test execution error:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

runPhase1Tests();
