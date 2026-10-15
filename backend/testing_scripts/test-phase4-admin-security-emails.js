/**
 * Phase 4 Automated Test Suite: Admin, System, Security & Audit Alerts (Items 130–195)
 * Peoples League of Electronics (PLE)
 * 
 * Verifies:
 * 1. Admin & Security Branded HTML Template Rendering
 * 2. Admin recipient email resolution from env / Settings / Admin collection
 * 3. Order Operational Alerts (Items 130-137: High-value, Suspicious, Stuck, SLA, RTO)
 * 4. Vendor Management & Compliance Alerts (Items 138-146: KYC, Suspension, Disputes)
 * 5. Finance & Settlement Alerts (Items 147-155: PG failure, Payout failure, Large refund)
 * 6. Speedzeel Logistics Escalations (Items 156-165: Pickup, Delay, RTO, Agent issue)
 * 7. Authentication & Security Notifications (Items 166-178: Login, Lockout, 2FA, Password)
 * 8. Vendor & Staff Security Lifecycle (Items 179-195: API Keys, Staff RBAC, Incidents)
 * 9. Idempotency & Native MongoDB EmailLog Verification
 */

import dns from 'dns';
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
    // Non-blocking
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
    getAdminAlertTemplate,
    getSecurityAlertTemplate,
} from '../src/utils/adminEmailTemplates.js';

import {
    resolveAdminRecipients,
    sendAdminOrderAlert,
    sendAdminVendorAlert,
    sendAdminFinanceAlert,
    sendAdminLogisticsAlert,
    sendSecurityAlert,
} from '../src/services/adminNotification.service.js';

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

async function runPhase4Tests() {
    console.log('================================================================');
    console.log('🧪 Starting Phase 4 Test Suite: Admin, System & Security Alerts');
    console.log('================================================================\n');

    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/appzeto';
    await mongoose.connect(mongoUri);
    console.log(' Connected to MongoDB for Phase 4 Verification\n');

    const testPrefix = `admtest_${Date.now()}`;
    const testAdminEmail = `admin_ops_${testPrefix}@pletest.com`;
    process.env.ADMIN_NOTIFICATION_EMAIL = testAdminEmail;

    const mockOrderId = `ORD-ADM-${Date.now()}`;
    const mockVendorId = new mongoose.Types.ObjectId();
    const mockUserId = new mongoose.Types.ObjectId();
    const mockUserEmail = `user_sec_${testPrefix}@pletest.com`;

    try {
        // ─── SUITE 1: Template Rendering ────────────────────────────────────────
        console.log('--- 1. Admin & Security Template Rendering ---');

        const adminAlertHtml = getAdminAlertTemplate({
            title: 'Critical Gateway Discrepancy',
            badgeText: 'FINANCIAL ALERT',
            badgeColor: 'red',
            severity: 'critical',
            message: 'A critical discrepancy was detected in payment ledger.',
            details: [
                { label: 'Gateway Ref', value: 'RZP_TEST_999' },
                { label: 'Amount', value: '₹55,000' }
            ],
            actionUrl: 'https://peoplesleague.com/admin/finance'
        });
        assert(adminAlertHtml.includes('Critical Gateway Discrepancy'), 'Admin alert template contains title');
        assert(adminAlertHtml.includes('FINANCIAL ALERT'), 'Admin alert template contains badge');
        assert(adminAlertHtml.includes('RZP_TEST_999'), 'Admin alert template contains detail key-value');
        assert(adminAlertHtml.includes('CRITICAL'), 'Admin alert template contains severity tag');

        const securityHtml = getSecurityAlertTemplate({
            recipientName: 'Vikram Sharma',
            title: 'Account Locked Due to Repeated Failures',
            badgeText: 'ACCOUNT LOCKED',
            badgeColor: 'red',
            message: 'Your account has been locked for 15 minutes.',
            ipAddress: '103.24.55.8',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
            details: [{ label: 'Lockout Reason', value: '5 failed password attempts' }]
        });
        assert(securityHtml.includes('Vikram Sharma'), 'Security template contains recipient name');
        assert(securityHtml.includes('103.24.55.8'), 'Security template records source IP');
        assert(securityHtml.includes('Security Advisory'), 'Security template includes security advisory notice');

        // ─── SUITE 2: Admin Recipient Resolution ────────────────────────────────
        console.log('\n--- 2. Admin Recipient Resolution ---');
        const recipients = await resolveAdminRecipients();
        assert(Array.isArray(recipients) && recipients.length > 0, 'Admin recipients list resolved');
        assert(recipients.includes(testAdminEmail), 'Admin recipients includes configured ADMIN_NOTIFICATION_EMAIL');

        // ─── SUITE 3: Admin Order Alerts (Items 130–137) ─────────────────────────
        console.log('\n--- 3. Admin Order Alerts (Items 130-137) ---');

        // Item 130: High-value order
        await sendAdminOrderAlert({
            order: { orderId: mockOrderId, totalAmount: 75000, paymentMethod: 'prepaid', orderStatus: 'confirmed' },
            alertType: 'high_value',
            reason: 'Order value exceeds high-value threshold (₹50,000)'
        });
        const hvLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_order_high_value' });
        assert(hvLog !== null, 'Item 130: High-value order alert dispatched to admin');
        assert(hvLog?.metadata?.totalAmount === 75000, 'High-value alert metadata recorded correct amount');

        // Item 131: Suspicious order
        await sendAdminOrderAlert({
            order: { orderId: mockOrderId, totalAmount: 12000, paymentMethod: 'cod', orderStatus: 'pending' },
            alertType: 'suspicious',
            reason: 'Velocity filter: 4 rapid orders from identical IP address'
        });
        const suspLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_order_suspicious' });
        assert(suspLog !== null, 'Item 131: Suspicious order alert dispatched to admin');

        // Item 132: Stuck in processing
        await sendAdminOrderAlert({
            order: { orderId: mockOrderId, totalAmount: 8500, paymentMethod: 'prepaid', orderStatus: 'processing' },
            alertType: 'stuck',
            reason: 'Processing time exceeded 48h SLA'
        });
        const stuckLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_order_stuck' });
        assert(stuckLog !== null, 'Item 132: Order stuck in processing alert dispatched');

        // Item 134: Vendor fulfillment SLA breach
        await sendAdminOrderAlert({
            order: { orderId: mockOrderId, totalAmount: 4500, paymentMethod: 'prepaid', orderStatus: 'confirmed' },
            alertType: 'vendor_sla_breach',
            reason: 'Merchant failed to pack and manifest within 24h SLA'
        });
        const slaLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_order_vendor_sla_breach' });
        assert(slaLog !== null, 'Item 134: Vendor SLA breach alert dispatched');

        // Item 136: RTO alert
        await sendAdminOrderAlert({
            order: { orderId: mockOrderId, totalAmount: 6200, paymentMethod: 'cod', orderStatus: 'rto_initiated' },
            alertType: 'rto_alert',
            reason: 'Courier marked 3 failed delivery attempts - heading back to hub'
        });
        const rtoLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_order_rto_alert' });
        assert(rtoLog !== null, 'Item 136: RTO order alert dispatched to admin');

        // ─── SUITE 4: Admin Vendor Compliance Alerts (Items 138–146) ─────────────
        console.log('\n--- 4. Admin Vendor Management Alerts (Items 138-146) ---');

        // Item 138: New vendor application
        await sendAdminVendorAlert({
            vendor: { _id: mockVendorId, storeName: 'Zenith Audio Hub', email: 'zenith@vendor.com' },
            alertType: 'new_application',
            reason: 'New merchant application submitted'
        });
        const newAppLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_vendor_new_application' });
        assert(newAppLog !== null, 'Item 138: New vendor application alert dispatched to admin');

        // Item 141: Compliance issue
        await sendAdminVendorAlert({
            vendor: { _id: mockVendorId, storeName: 'Zenith Audio Hub', email: 'zenith@vendor.com' },
            alertType: 'compliance_issue',
            reason: 'Customer reported counterfeit product description'
        });
        const compLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_vendor_compliance_issue' });
        assert(compLog !== null, 'Item 141: Vendor compliance issue alert dispatched');

        // Item 142: Suspension recommended
        await sendAdminVendorAlert({
            vendor: { _id: mockVendorId, storeName: 'Zenith Audio Hub', email: 'zenith@vendor.com' },
            alertType: 'suspension_recommended',
            reason: 'Exceeded 3 compliance strikes'
        });
        const suspRecLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_vendor_suspension_recommended' });
        assert(suspRecLog !== null, 'Item 142: Vendor suspension recommendation dispatched');

        // Item 144: Vendor dispute
        await sendAdminVendorAlert({
            vendor: { _id: mockVendorId, storeName: 'Zenith Audio Hub', email: 'zenith@vendor.com' },
            alertType: 'dispute',
            reason: 'Customer initiated return dispute on damaged item'
        });
        const dispLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_vendor_dispute' });
        assert(dispLog !== null, 'Item 144: Vendor dispute alert dispatched');

        // ─── SUITE 5: Finance & Settlement Alerts (Items 147–155) ────────────────
        console.log('\n--- 5. Admin Finance Alerts (Items 147-155) ---');

        // Item 147: Payment gateway failure
        await sendAdminFinanceAlert({
            alertType: 'pg_failure',
            amount: 18500,
            transactionId: 'pay_rzp_fail_998',
            reason: 'Webhook signature verification rejected by gateway'
        });
        const pgFailLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_finance_pg_failure' });
        assert(pgFailLog !== null, 'Item 147: Payment gateway failure alert dispatched');

        // Item 148: Settlement disbursement failure
        await sendAdminFinanceAlert({
            alertType: 'settlement_failure',
            amount: 45000,
            transactionId: 'SET-9921',
            reason: 'Bank NEFT network rejected beneficiary IFSC'
        });
        const setFailLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_finance_settlement_failure' });
        assert(setFailLog !== null, 'Item 148: Settlement disbursement failure alert dispatched');

        // Item 149: Refund failure
        await sendAdminFinanceAlert({
            alertType: 'refund_failure',
            amount: 9800,
            transactionId: 'rfnd_fail_002',
            reason: 'PG returned insufficient merchant escrow balance'
        });
        const rfndFailLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_finance_refund_failure' });
        assert(rfndFailLog !== null, 'Item 149: Refund failure alert dispatched');

        // Item 152: Large refund alert
        await sendAdminFinanceAlert({
            alertType: 'large_refund',
            amount: 32000,
            transactionId: 'rfnd_large_001',
            reason: 'Order cancellation refund exceeded ₹20,000 threshold'
        });
        const lrgRfndLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_finance_large_refund' });
        assert(lrgRfndLog !== null, 'Item 152: Large refund alert dispatched to admin');

        // ─── SUITE 6: Speedzeel Logistics Escalations (Items 156–165) ─────────────
        console.log('\n--- 6. Speedzeel Logistics Alerts (Items 156-165) ---');

        // Item 158: Pickup failed
        await sendAdminLogisticsAlert({
            order: { orderId: mockOrderId },
            alertType: 'pickup_failed',
            courier: 'Speedzeel Logistics',
            reason: 'Merchant premises closed during assigned pickup window'
        });
        const pkuFailLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_logistics_pickup_failed' });
        assert(pkuFailLog !== null, 'Item 158: Pickup failed alert dispatched to logistics admin');

        // Item 160: Shipment delayed
        await sendAdminLogisticsAlert({
            order: { orderId: mockOrderId },
            alertType: 'shipment_delayed',
            courier: 'Speedzeel Logistics',
            trackingNumber: 'SZ-TRK-88192',
            reason: 'Highway transit delay due to severe weather conditions'
        });
        const dlyLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_logistics_shipment_delayed' });
        assert(dlyLog !== null, 'Item 160: Shipment delayed alert dispatched');

        // Item 161: Delivery failed
        await sendAdminLogisticsAlert({
            order: { orderId: mockOrderId },
            alertType: 'delivery_failed',
            courier: 'Speedzeel Logistics',
            trackingNumber: 'SZ-TRK-88192',
            reason: 'Recipient phone unreachable at destination address'
        });
        const dlvFailLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_logistics_delivery_failed' });
        assert(dlvFailLog !== null, 'Item 161: Delivery failed alert dispatched');

        // Item 165: Logistics SLA breach
        await sendAdminLogisticsAlert({
            order: { orderId: mockOrderId },
            alertType: 'logistics_sla_breach',
            courier: 'Speedzeel Logistics',
            trackingNumber: 'SZ-TRK-88192',
            reason: 'Consignment transit exceeded 72h SLA'
        });
        const logSlaLog = await EmailLog.findOne({ recipient: testAdminEmail, template: 'admin_logistics_logistics_sla_breach' });
        assert(logSlaLog !== null, 'Item 165: Logistics SLA breach alert dispatched');

        // ─── SUITE 7: Authentication & Account Security (Items 166–178) ───────────
        console.log('\n--- 7. User & Vendor Security Alerts (Items 166-178) ---');

        // Item 169: Password changed
        await sendSecurityAlert({
            user: { _id: mockUserId, name: 'Ananya Roy', email: mockUserEmail },
            eventType: 'password_changed',
            ipAddress: '49.36.128.4',
            userAgent: 'Chrome on macOS'
        });
        const pwdLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_password_changed' });
        assert(pwdLog !== null, 'Item 169: Password changed security alert dispatched');

        // Item 171: New device login
        await sendSecurityAlert({
            user: { _id: mockUserId, name: 'Ananya Roy', email: mockUserEmail },
            eventType: 'new_device',
            ipAddress: '152.57.48.91',
            userAgent: 'Firefox on Linux'
        });
        const devLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_new_device' });
        assert(devLog !== null, 'Item 171: New device login alert dispatched');

        // Item 173: Login threshold reached
        await sendSecurityAlert({
            user: { _id: mockUserId, name: 'Ananya Roy', email: mockUserEmail },
            eventType: 'login_threshold',
            ipAddress: '103.21.244.2',
            userAgent: 'Safari on iPhone'
        });
        const threshLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_login_threshold' });
        assert(threshLog !== null, 'Item 173: Failed login threshold alert dispatched');

        // Item 174: Account locked
        await sendSecurityAlert({
            user: { _id: mockUserId, name: 'Ananya Roy', email: mockUserEmail },
            eventType: 'account_locked',
            ipAddress: '103.21.244.2',
            userAgent: 'Safari on iPhone'
        });
        const lockLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_account_locked' });
        assert(lockLog !== null, 'Item 174: Account locked security alert dispatched');

        // Item 175: Account unlocked
        await sendSecurityAlert({
            user: { _id: mockUserId, name: 'Ananya Roy', email: mockUserEmail },
            eventType: 'account_unlocked',
            ipAddress: '103.21.244.2',
            userAgent: 'Safari on iPhone'
        });
        const unlockLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_account_unlocked' });
        assert(unlockLog !== null, 'Item 175: Account unlocked security alert dispatched');

        // Item 176: 2FA enabled
        await sendSecurityAlert({
            user: { _id: mockUserId, name: 'Ananya Roy', email: mockUserEmail },
            eventType: '2fa_enabled',
            ipAddress: '49.36.128.4',
            userAgent: 'Chrome on macOS'
        });
        const tfaEnLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_2fa_enabled' });
        assert(tfaEnLog !== null, 'Item 176: 2FA enabled alert dispatched');

        // Item 177: 2FA disabled
        await sendSecurityAlert({
            user: { _id: mockUserId, name: 'Ananya Roy', email: mockUserEmail },
            eventType: '2fa_disabled',
            ipAddress: '49.36.128.4',
            userAgent: 'Chrome on macOS'
        });
        const tfaDisLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_2fa_disabled' });
        assert(tfaDisLog !== null, 'Item 177: 2FA disabled critical alert dispatched');

        // ─── SUITE 8: Staff & Vendor Security Lifecycle (Items 179–195) ────────────
        console.log('\n--- 8. Admin Staff & Vendor Security Lifecycle (Items 179-195) ---');

        // Item 182: API key created
        await sendSecurityAlert({
            user: { _id: mockVendorId, name: 'Zenith Audio', email: mockUserEmail },
            eventType: 'api_key_created',
            details: [{ label: 'Key Identifier', value: 'pk_live_***8921' }]
        });
        const apiKeyLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_api_key_created' });
        assert(apiKeyLog !== null, 'Item 182: API key created alert dispatched');

        // Item 188: Employee account created
        await sendSecurityAlert({
            user: { _id: new mongoose.Types.ObjectId(), name: 'Kavita Menon', email: mockUserEmail },
            eventType: 'employee_created',
            details: [
                { label: 'Identity ID', value: 'PLE-EMP-000105' },
                { label: 'Department', value: 'Customer Operations' }
            ]
        });
        const empLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_employee_created' });
        assert(empLog !== null, 'Item 188: Internal employee created alert dispatched');

        // Item 189: Employee account disabled
        await sendSecurityAlert({
            user: { _id: new mongoose.Types.ObjectId(), name: 'Kavita Menon', email: mockUserEmail },
            eventType: 'employee_disabled',
            details: [{ label: 'Deactivated By', value: 'Super Admin' }]
        });
        const empDisLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_employee_disabled' });
        assert(empDisLog !== null, 'Item 189: Employee account disabled alert dispatched');

        // Item 192: Privileged permission granted
        await sendSecurityAlert({
            user: { _id: new mongoose.Types.ObjectId(), name: 'Kavita Menon', email: mockUserEmail },
            eventType: 'privileged_granted',
            details: [{ label: 'Granted Privilege', value: 'FINANCE_DISBURSEMENT_APPROVE' }]
        });
        const privLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_privileged_granted' });
        assert(privLog !== null, 'Item 192: Privileged permission granted alert dispatched');

        // Item 195: Security incident detected
        await sendSecurityAlert({
            user: { _id: new mongoose.Types.ObjectId(), name: 'System Security', email: mockUserEmail },
            eventType: 'security_incident',
            details: [
                { label: 'Threat Type', value: 'Distributed Brute Force on Admin Terminal' },
                { label: 'Attacking IPs', value: '14 blocked' }
            ]
        });
        const incLog = await EmailLog.findOne({ recipient: mockUserEmail, template: 'security_security_incident' });
        assert(incLog !== null, 'Item 195: Security incident threat alert dispatched');

        // ─── SUITE 9: Cleanup ───────────────────────────────────────────────────
        await EmailLog.deleteMany({
            recipient: { $in: [testAdminEmail, mockUserEmail] }
        });
        console.log('\n🧹 Cleaned up mock test records from EmailLog collection.');

    } catch (err) {
        console.error('❌ Exception during Phase 4 tests:', err);
        failed++;
    } finally {
        await mongoose.disconnect();
    }

    console.log('\n================================================================');
    console.log(`Phase 4 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runPhase4Tests();
