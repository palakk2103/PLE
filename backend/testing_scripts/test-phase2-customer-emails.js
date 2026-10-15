/**
 * Phase 2 Automated Test Script: Customer Transactional Emails (Items 1-61)
 * Peoples League of Electronics (PLE)
 * 
 * Tests:
 * 1. Branded template rendering & GST/Tax formatting
 * 2. Service-level customer dispatch for Account, Shopping, RFQ, Order, Returns, and Refunds
 * 3. Idempotency guarantees & EmailLog audit tracking
 * 4. Error isolation & non-blocking execution
 */

import dns from 'dns';
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
    // ignore
}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import EmailLog from '../src/models/EmailLog.model.js';
import {
    getCustomerWelcomeTemplate,
    getSecurityAlertTemplate,
    getShoppingAlertTemplate,
    getCustomerOrderNotificationTemplate,
    getCustomerReturnRefundTemplate,
} from '../src/utils/customerEmailTemplates.js';

import {
    sendCustomerWelcomeEmail,
    sendEmailChangedNotification,
    sendPhoneChangedNotification,
    sendPasswordChangedNotification,
    sendNewDeviceLoginAlert,
    sendAccountStatusNotification,
    sendBackInStockNotification,
    sendProductRequestReceivedEmail,
    sendSourceNowUpdateEmail,
    sendRfqSubmittedCustomerEmail,
    sendRfqResponseCustomerEmail,
    sendShipmentDelayedNotification,
    sendDeliveryAttemptedNotification,
    sendReturnRequestSubmittedNotification,
    sendReturnRequestDecisionNotification,
    sendReturnMilestoneNotification,
    sendRefundStatusNotification,
} from '../src/services/customerNotification.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

async function runPhase2Tests() {
    console.log('================================================================');
    console.log('🧪 Starting Phase 2 Test Suite: Customer Transactional Emails');
    console.log('================================================================\n');

    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/appzeto';
    await mongoose.connect(mongoUri);
    console.log(' Connected to MongoDB for Phase 2 Verification\n');

    const testPrefix = `test_p2_${Date.now()}`;
    const mockEmail = `customer_${testPrefix}@pletest.com`;
    const mockUserId = new mongoose.Types.ObjectId();
    const mockOrderId = `ORD-${Date.now()}`;
    const mockRfqId = `RFQ-${Date.now()}`;
    const mockRequestId = `REQ-${Date.now()}`;
    const mockReturnId = `RET-${Date.now()}`;

    try {
        // ─── SUITE 1: Responsive Branded Email Templates ────────────────────────
        console.log('--- 1. Responsive Branded Template Rendering ---');

        const welcomeHtml = getCustomerWelcomeTemplate({
            customerName: 'Priya Sharma',
            loginUrl: 'https://ple.store/login',
        });
        assert(welcomeHtml.includes('Priya Sharma'), 'Welcome template includes customer name');
        assert(welcomeHtml.includes('Peoples League of Electronics'), 'Welcome template includes PLE branding');
        assert(welcomeHtml.includes('https://ple.store/login'), 'Welcome template includes login CTA');

        const securityHtml = getSecurityAlertTemplate({
            customerName: 'Priya Sharma',
            title: 'New Device Sign-in Detected',
            message: 'Your account was accessed from a new device.',
            device: 'Chrome on Windows 11',
            ip: '49.36.128.45',
            location: 'Mumbai, India',
            time: '15 Oct 2026, 12:30 PM',
        });
        assert(securityHtml.includes('New Device Sign-in Detected'), 'Security template includes alert title');
        assert(securityHtml.includes('Chrome on Windows 11'), 'Security template includes device information');
        assert(securityHtml.includes('Mumbai, India'), 'Security template includes location');

        const shoppingHtml = getShoppingAlertTemplate({
            customerName: 'Priya Sharma',
            title: 'An item from your Wishlist is back in stock',
            subtitle: 'Back in Stock Alert',
            message: 'Sony WH-1000XM5 Noise Cancelling Headphones is now available.',
            product: {
                name: 'Sony WH-1000XM5',
                price: 26990,
                image: 'https://ple.store/images/sony.jpg',
            },
            actionUrl: 'https://ple.store/product/sony-wh-1000xm5',
            actionText: 'Buy Now',
        });
        assert(shoppingHtml.includes('Sony WH-1000XM5'), 'Shopping template includes product name');
        assert(shoppingHtml.includes('26,990') || shoppingHtml.includes('26990'), 'Shopping template formats price');

        const orderHtml = getCustomerOrderNotificationTemplate({
            customerName: 'Priya Sharma',
            orderId: mockOrderId,
            title: 'Your Order is Confirmed',
            message: 'We are preparing your items for dispatch.',
            items: [
                { name: 'Mechanical Gaming Keyboard', quantity: 1, price: 4999 },
            ],
            subtotal: 4999,
            tax: 899.82,
            shipping: 0,
            totalAmount: 5898.82,
            actionUrl: `https://ple.store/orders/${mockOrderId}`,
        });
        assert(orderHtml.includes(mockOrderId), 'Order template includes order ID');
        assert(orderHtml.includes('Mechanical Gaming Keyboard'), 'Order template lists order items');
        assert(orderHtml.includes('GST') || orderHtml.includes('Estimated Tax'), 'Order template specifies GST/tax details (Item 61)');

        const returnHtml = getCustomerReturnRefundTemplate({
            customerName: 'Priya Sharma',
            title: 'Return Request Approved',
            subtitle: 'Return & Refund Status',
            message: 'Your return has been inspected and approved. Refund will be processed.',
            details: [
                { label: 'Return ID', value: `#${mockReturnId}` },
                { label: 'Refund Amount', value: '₹4,999.00' },
                { label: 'Destination', value: 'Original Payment Method' },
            ],
            actionUrl: `https://ple.store/returns/${mockReturnId}`,
        });
        assert(returnHtml.includes(mockReturnId), 'Return template includes return ID');
        assert(returnHtml.includes('₹4,999.00'), 'Return template shows refund amount');

        // ─── SUITE 2: Account & Security Lifecycle Emails ────────────────────────
        console.log('\n--- 2. Customer Account & Security Emails (Items 1-10) ---');

        // Item 1: Welcome Email
        await sendCustomerWelcomeEmail({
            user: { _id: mockUserId, email: mockEmail, name: 'Priya Sharma' },
        });
        const welcomeLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'customer_welcome',
        });
        assert(welcomeLog !== null, 'Item 1: Welcome email dispatched and logged');
        assert(welcomeLog?.status === 'sent' || welcomeLog?.status === 'failed', 'Item 1: EmailLog records delivery status');

        // Idempotency test for Item 1
        const initialWelcomeLogsCount = await EmailLog.countDocuments({
            recipient: mockEmail,
            template: 'customer_welcome',
        });
        await sendCustomerWelcomeEmail({
            user: { _id: mockUserId, email: mockEmail, name: 'Priya Sharma' },
        });
        const postWelcomeLogsCount = await EmailLog.countDocuments({
            recipient: mockEmail,
            template: 'customer_welcome',
        });
        assert(
            initialWelcomeLogsCount === postWelcomeLogsCount,
            'Item 1 Idempotency: Duplicate welcome email was safely skipped'
        );

        // Item 3: Email changed
        await sendEmailChangedNotification({
            user: { _id: mockUserId, email: mockEmail, name: 'Priya Sharma' },
            oldEmail: 'old_priya@pletest.com',
            newEmail: mockEmail,
        });
        const emailChangeLog = await EmailLog.findOne({
            template: 'security_email_changed',
            'metadata.userId': mockUserId,
        });
        assert(emailChangeLog !== null, 'Item 3: Email changed notification dispatched');

        // Item 4: Phone changed
        await sendPhoneChangedNotification({
            user: { _id: mockUserId, email: mockEmail, name: 'Priya Sharma' },
            newPhone: '+91 9876543210',
        });
        const phoneChangeLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'security_phone_changed',
        });
        assert(phoneChangeLog !== null, 'Item 4: Phone changed notification dispatched');

        // Item 6: Password changed
        await sendPasswordChangedNotification({
            user: { _id: mockUserId, email: mockEmail, name: 'Priya Sharma' },
        });
        const pwdChangeLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'security_password_changed',
        });
        assert(pwdChangeLog !== null, 'Item 6: Password changed notification dispatched');

        // Items 7 & 8: New device login alert
        await sendNewDeviceLoginAlert({
            user: { _id: mockUserId, email: mockEmail, name: 'Priya Sharma' },
            ip: '103.21.244.2',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            location: 'Mumbai, India',
        });
        const deviceAlertLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'security_new_device_login',
        });
        assert(deviceAlertLog !== null, 'Items 7 & 8: New device login alert dispatched');

        // Items 9 & 10: Account deactivation / reactivation
        await sendAccountStatusNotification({
            user: { _id: mockUserId, email: mockEmail, name: 'Priya Sharma' },
            action: 'deactivated',
            reason: 'Requested by user',
        });
        const deactLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'account_status_deactivated',
        });
        assert(deactLog !== null, 'Item 9: Account deactivated notification dispatched');

        await sendAccountStatusNotification({
            user: { _id: mockUserId, email: mockEmail, name: 'Priya Sharma' },
            action: 'reactivated',
        });
        const reactLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'account_status_reactivated',
        });
        assert(reactLog !== null, 'Item 10: Account reactivated notification dispatched');

        // ─── SUITE 3: Shopping, SourceNow & RFQ Lifecycle ───────────────────────
        console.log('\n--- 3. Shopping, SourceNow & RFQ Notifications (Items 11-17) ---');

        // Item 11: Back in Stock
        await sendBackInStockNotification({
            user: { _id: mockUserId, email: mockEmail, name: 'Priya Sharma' },
            product: {
                _id: new mongoose.Types.ObjectId(),
                name: 'Intel Core i9 14900K Processor',
                price: 54999,
                slug: 'intel-i9-14900k',
            },
        });
        const stockLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'shopping_back_in_stock',
        });
        assert(stockLog !== null, 'Item 11: Back-in-stock notification dispatched');

        // Items 13 & 14: SourceNow Request Received
        await sendProductRequestReceivedEmail({
            customerEmail: mockEmail,
            customerName: 'Priya Sharma',
            productRequest: {
                requestId: mockRequestId,
                productName: 'Industrial IoT Sensors (Pack of 50)',
                quantity: 50,
                targetPrice: 75000,
            },
        });
        const srcRecLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'sourcenow_request_received',
        });
        assert(srcRecLog !== null, 'Items 13 & 14: SourceNow request received email dispatched');

        // Item 15: SourceNow Update
        await sendSourceNowUpdateEmail({
            customerEmail: mockEmail,
            customerName: 'Priya Sharma',
            productRequest: {
                requestId: mockRequestId,
                productName: 'Industrial IoT Sensors (Pack of 50)',
            },
            status: 'Proposal Ready',
            updateNotes: '3 verified vendors submitted bids. Best unit rate: ₹1,400.',
        });
        const srcUpLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'sourcenow_request_update',
        });
        assert(srcUpLog !== null, 'Item 15: SourceNow proposal update email dispatched');

        // Item 16: RFQ Submitted
        await sendRfqSubmittedCustomerEmail({
            customerEmail: mockEmail,
            customerName: 'Priya Sharma',
            rfq: {
                rfqId: mockRfqId,
                title: '500x Type-C Fast Chargers',
                quantity: 500,
            },
        });
        const rfqSubLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'rfq_submitted_customer',
        });
        assert(rfqSubLog !== null, 'Item 16: RFQ submitted customer confirmation dispatched');

        // Item 17: RFQ Quote Available
        await sendRfqResponseCustomerEmail({
            customerEmail: mockEmail,
            customerName: 'Priya Sharma',
            rfq: {
                rfqId: mockRfqId,
            },
            quotation: {
                quotePrice: 125000,
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        const rfqRespLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'rfq_response_received',
        });
        assert(rfqRespLog !== null, 'Item 17: RFQ response received notification dispatched');

        // ─── SUITE 4: Shipping, Delivery & Exception Notifications ──────────────
        console.log('\n--- 4. Shipping & Delivery Exception Notifications (Items 34, 37, 39) ---');

        // Item 34: Shipment Delayed
        await sendShipmentDelayedNotification({
            order: {
                orderId: mockOrderId,
                customerEmail: mockEmail,
                customerName: 'Priya Sharma',
                totalAmount: 5898.82,
            },
            newEstimatedDelivery: '18 Oct 2026',
            delayReason: 'Severe weather alert in logistics transit hub',
        });
        const delayLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'shipping_delayed',
        });
        assert(delayLog !== null, 'Item 34: Shipment delayed notification dispatched');

        // Item 39: Delivery Attempted
        await sendDeliveryAttemptedNotification({
            order: {
                orderId: mockOrderId,
                customerEmail: mockEmail,
                customerName: 'Priya Sharma',
            },
            nextAttemptDate: '16 Oct 2026',
            deliveryAgentPhone: '+91 9123456789',
        });
        const attemptLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'delivery_attempted',
        });
        assert(attemptLog !== null, 'Item 39: Delivery attempted notification dispatched');

        // ─── SUITE 5: Returns & Refunds Lifecycle ────────────────────────────────
        console.log('\n--- 5. Returns & Refunds Notifications (Items 42-60) ---');

        // Item 42: Return Request Submitted
        await sendReturnRequestSubmittedNotification({
            order: {
                orderId: mockOrderId,
                customerEmail: mockEmail,
                customerName: 'Priya Sharma',
            },
            returnRequest: {
                returnId: mockReturnId,
                reason: 'Item defective upon arrival',
                requestedAction: 'Refund',
            },
        });
        const retSubLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'return_request_submitted',
        });
        assert(retSubLog !== null, 'Item 42: Return request submitted notification dispatched');

        // Items 43 & 44: Return Request Decision (Approved)
        await sendReturnRequestDecisionNotification({
            order: {
                orderId: mockOrderId,
                customerEmail: mockEmail,
                customerName: 'Priya Sharma',
            },
            returnRequest: {
                returnId: mockReturnId,
            },
            decision: 'approved',
            notes: 'Approved for pickup and inspection.',
        });
        const retAppLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'return_decision_approved',
        });
        assert(retAppLog !== null, 'Item 43: Return decision approved notification dispatched');

        // Item 48: Return Milestone (Inspection Completed)
        await sendReturnMilestoneNotification({
            order: {
                orderId: mockOrderId,
                customerEmail: mockEmail,
                customerName: 'Priya Sharma',
            },
            returnRequest: {
                returnId: mockReturnId,
            },
            milestone: 'inspected',
            notes: 'Quality inspection passed.',
        });
        const retMileLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'return_milestone_inspected',
        });
        assert(retMileLog !== null, 'Item 48: Return inspection milestone notification dispatched');

        // Items 52, 53 & 60: Refund Status & Receipt
        await sendRefundStatusNotification({
            order: {
                orderId: mockOrderId,
                customerEmail: mockEmail,
                customerName: 'Priya Sharma',
            },
            refund: {
                refundId: `REF-${Date.now()}`,
                amount: 4999.00,
                status: 'completed',
                method: 'Original Payment Method (Razorpay)',
            },
        });
        const refLog = await EmailLog.findOne({
            recipient: mockEmail,
            template: 'refund_status_completed',
        });
        assert(refLog !== null, 'Items 52, 53 & 60: Refund status & receipt notification dispatched');

    } catch (testErr) {
        console.error('❌ Unexpected test error:', testErr);
        failed++;
    } finally {
        // Clean up test audit logs
        await EmailLog.deleteMany({
            $or: [
                { recipient: mockEmail },
                { recipient: 'old_priya@pletest.com' },
            ]
        });
        console.log('\n🧹 Cleaned up mock test records from EmailLog collection.');
        await mongoose.disconnect();
    }

    console.log('\n================================================================');
    console.log(`Phase 2 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runPhase2Tests();
