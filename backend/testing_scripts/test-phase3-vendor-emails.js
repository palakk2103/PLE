/**
 * Phase 3 Automated Test Suite: Vendor / Seller Email Notifications (Items 62-129)
 * Peoples League of Electronics (PLE)
 * 
 * Verifies:
 * 1. Vendor branded responsive HTML templates
 * 2. Strict Multi-Vendor Item Isolation (merchants only receive their own items and earnings)
 * 3. Onboarding, KYC, Account security, and Bank detail notifications
 * 4. Catalog review and inventory/stock alerts
 * 5. Order fulfillment lifecycle and cancellation alerts
 * 6. Reverse logistics / returns notifications
 * 7. Payout and settlement financial notifications
 * 8. Idempotency and native MongoDB audit logging
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
    getVendorOnboardingTemplate,
    getVendorProductTemplate,
    getVendorOrderTemplate,
    getVendorReturnTemplate,
    getVendorPayoutTemplate,
} from '../src/utils/vendorEmailTemplates.js';

import {
    sendVendorRegistrationReceivedEmail,
    sendVendorApplicationStatusEmail,
    sendVendorKycStatusEmail,
    sendVendorBankDetailsEmail,
    sendVendorProductReviewEmail,
    sendVendorStockAlertEmail,
    sendVendorNewOrderNotification,
    sendVendorOrderCancelledNotification,
    sendVendorOrderProgressEmail,
    sendVendorReturnNotification,
    sendVendorSettlementNotification,
} from '../src/services/vendorNotification.service.js';

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

async function runPhase3Tests() {
    console.log('================================================================');
    console.log('🧪 Starting Phase 3 Test Suite: Vendor / Seller Notifications');
    console.log('================================================================\n');

    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/appzeto';
    await mongoose.connect(mongoUri);
    console.log(' Connected to MongoDB for Phase 3 Verification\n');

    const testPrefix = `vtest_${Date.now()}`;
    const vendorAEmail = `vendor_a_${testPrefix}@pletest.com`;
    const vendorBEmail = `vendor_b_${testPrefix}@pletest.com`;
    const mockVendorAId = new mongoose.Types.ObjectId();
    const mockVendorBId = new mongoose.Types.ObjectId();
    const mockOrderId = `ORD-V-${Date.now()}`;
    const mockProductId = new mongoose.Types.ObjectId();

    try {
        // ─── SUITE 1: Vendor Branded Templates ──────────────────────────────────
        console.log('--- 1. Vendor Branded Template Rendering ---');

        const onboardingHtml = getVendorOnboardingTemplate({
            vendorName: 'Apex Electronics',
            storeName: 'Apex Tech Hub',
            title: 'Welcome to PLE Seller Network',
            message: 'Your merchant account is ready for product setup.',
            details: [{ label: 'Store Name', value: 'Apex Tech Hub' }],
        });
        assert(onboardingHtml.includes('Apex Electronics'), 'Onboarding template includes vendor name');
        assert(onboardingHtml.includes('Apex Tech Hub'), 'Onboarding template includes store name');
        assert(onboardingHtml.includes('PLE Merchant Portal'), 'Onboarding template includes merchant portal branding');

        const productHtml = getVendorProductTemplate({
            vendorName: 'Apex Electronics',
            productName: 'NVMe Gen4 SSD 2TB',
            sku: 'NVME-2TB-001',
            title: 'Product Listing Approved',
            message: 'Your product is now live on the marketplace.',
        });
        assert(productHtml.includes('NVMe Gen4 SSD 2TB'), 'Product template includes product title');
        assert(productHtml.includes('NVME-2TB-001'), 'Product template includes SKU');

        const orderHtml = getVendorOrderTemplate({
            vendorName: 'Apex Electronics',
            orderId: mockOrderId,
            title: 'New Order Received',
            message: 'Prepare your items for dispatch.',
            vendorItems: [{ name: 'NVMe Gen4 SSD 2TB', quantity: 2, price: 12500 }],
            vendorSubtotal: 25000,
            shippingDeadline: 'Within 24 Hours',
        });
        assert(orderHtml.includes(mockOrderId), 'Order template includes order ID');
        assert(orderHtml.includes('NVMe Gen4 SSD 2TB'), 'Order template lists vendor items');
        assert(orderHtml.includes('25,000') || orderHtml.includes('25000'), 'Order template shows vendor subtotal');

        const returnHtml = getVendorReturnTemplate({
            vendorName: 'Apex Electronics',
            orderId: mockOrderId,
            returnId: 'RET-001',
            title: 'Customer Return Requested',
            message: 'A return was requested for your item.',
        });
        assert(returnHtml.includes('RET-001'), 'Return template includes return ID');

        const payoutHtml = getVendorPayoutTemplate({
            vendorName: 'Apex Electronics',
            payoutId: 'PAY-001',
            title: 'Payout Credited',
            amount: 45000,
            message: 'Your payout has been transferred to your bank account.',
        });
        assert(payoutHtml.includes('45,000') || payoutHtml.includes('45000'), 'Payout template formats payout amount');

        // ─── SUITE 2: Strict Multi-Vendor Item Isolation ────────────────────────
        console.log('\n--- 2. Multi-Vendor Order Isolation (Items 84, 90) ---');

        const mockMultiVendorOrder = {
            orderId: mockOrderId,
            createdAt: new Date(),
            paymentMethod: 'ONLINE',
            vendorItems: [
                {
                    vendorId: mockVendorAId,
                    items: [
                        { name: '4K Gaming Monitor', quantity: 1, price: 28000 },
                    ],
                    subtotal: 28000,
                },
                {
                    vendorId: mockVendorBId,
                    items: [
                        { name: 'Studio Condenser Microphone', quantity: 2, price: 6500 },
                        { name: 'Pop Filter & Boom Arm', quantity: 2, price: 1500 },
                    ],
                    subtotal: 16000,
                },
            ],
        };

        // Vendor A receives notification: Must contain 4K Gaming Monitor (₹28,000) and NOT Microphone
        await sendVendorNewOrderNotification({
            vendorId: {
                _id: mockVendorAId,
                email: vendorAEmail,
                name: 'Vendor A Electronics',
            },
            order: mockMultiVendorOrder,
        });

        const vendorALog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_order_received',
        });
        assert(vendorALog !== null, 'Item 90: Vendor A received new order notification');
        assert(vendorALog?.metadata?.subtotal === 28000, 'Vendor A notification isolated to Vendor A subtotal (₹28,000)');

        // Vendor B receives notification: Must contain Microphone (₹16,000) and NOT Gaming Monitor
        await sendVendorNewOrderNotification({
            vendorId: {
                _id: mockVendorBId,
                email: vendorBEmail,
                name: 'Vendor B Audio',
            },
            order: mockMultiVendorOrder,
        });

        const vendorBLog = await EmailLog.findOne({
            recipient: vendorBEmail,
            template: 'vendor_order_received',
        });
        assert(vendorBLog !== null, 'Item 90: Vendor B received new order notification');
        assert(vendorBLog?.metadata?.subtotal === 16000, 'Vendor B notification isolated to Vendor B subtotal (₹16,000)');

        // Idempotency check: Repeated call for Vendor A must be skipped
        const initialCountA = await EmailLog.countDocuments({
            recipient: vendorAEmail,
            template: 'vendor_order_received',
        });
        await sendVendorNewOrderNotification({
            vendorId: {
                _id: mockVendorAId,
                email: vendorAEmail,
                name: 'Vendor A Electronics',
            },
            order: mockMultiVendorOrder,
        });
        const postCountA = await EmailLog.countDocuments({
            recipient: vendorAEmail,
            template: 'vendor_order_received',
        });
        assert(initialCountA === postCountA, 'Item 90 Idempotency: Duplicate vendor order email skipped');

        // ─── SUITE 3: Onboarding, KYC, Account & Security ───────────────────────
        console.log('\n--- 3. Onboarding, KYC & Account Lifecycle (Items 62-75) ---');

        // Item 62: Vendor Registration Received
        await sendVendorRegistrationReceivedEmail({
            vendor: {
                _id: mockVendorAId,
                email: vendorAEmail,
                name: 'Vendor A Electronics',
                storeName: 'Vendor A Tech Store',
            },
        });
        const regLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_application_received',
        });
        assert(regLog !== null, 'Item 62: Vendor application received email dispatched');

        // Item 68: Vendor Approved
        await sendVendorApplicationStatusEmail({
            vendor: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            status: 'approved',
        });
        const appLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_status_approved',
        });
        assert(appLog !== null, 'Item 68: Vendor approved notification dispatched');

        // Item 71: Vendor Suspended
        await sendVendorApplicationStatusEmail({
            vendor: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            status: 'suspended',
            reason: 'SLA breach in dispatch turnaround',
        });
        const suspLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_status_suspended',
        });
        assert(suspLog !== null, 'Item 71: Vendor suspended notification dispatched');

        // Items 65 & 66: KYC Approved & Rejected
        await sendVendorKycStatusEmail({
            vendor: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            documentName: 'GST Registration Certificate',
            status: 'approved',
        });
        const kycAppLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_kyc_approved',
        });
        assert(kycAppLog !== null, 'Item 66: KYC document approved notification dispatched');

        await sendVendorKycStatusEmail({
            vendor: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            documentName: 'Bank Cancelled Cheque',
            status: 'rejected',
            reason: 'Name on cheque does not match legal entity',
        });
        const kycRejLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_kyc_rejected',
        });
        assert(kycRejLog !== null, 'Item 65: KYC document rejected notification dispatched');

        // Items 70-72: Bank details updated
        await sendVendorBankDetailsEmail({
            vendor: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            status: 'updated',
            bankName: 'HDFC Bank',
            accountNumberLast4: '4321',
        });
        const bankLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_bank_updated',
        });
        assert(bankLog !== null, 'Item 70: Bank details updated notification dispatched');

        // ─── SUITE 4: Products & Stock Alerts ───────────────────────────────────
        console.log('\n--- 4. Catalog & Stock Alerts (Items 76-89) ---');

        // Items 77 & 78: Product Review (Approved & Rejected)
        await sendVendorProductReviewEmail({
            vendor: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            product: { _id: mockProductId, name: 'Mechanical Keyboard Blue Switch', price: 3499 },
            status: 'approved',
        });
        const prodAppLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_product_approved',
        });
        assert(prodAppLog !== null, 'Item 77: Product approved notification dispatched');

        await sendVendorProductReviewEmail({
            vendor: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            product: { _id: mockProductId, name: 'Mechanical Keyboard Blue Switch', price: 3499 },
            status: 'rejected',
            reason: 'Images are watermarked with competitor logo',
        });
        const prodRejLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_product_rejected',
        });
        assert(prodRejLog !== null, 'Item 78: Product rejected notification dispatched');

        // Items 85 & 86: Low Stock & Out of Stock Alerts
        await sendVendorStockAlertEmail({
            vendor: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            product: { _id: mockProductId, name: 'Mechanical Keyboard Blue Switch' },
            type: 'low_stock',
            currentStock: 4,
            threshold: 10,
        });
        const lowStockLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_stock_low',
        });
        assert(lowStockLog !== null, 'Item 85: Low-stock alert dispatched to vendor');

        await sendVendorStockAlertEmail({
            vendor: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            product: { _id: mockProductId, name: 'Mechanical Keyboard Blue Switch' },
            type: 'out_of_stock',
            currentStock: 0,
            threshold: 10,
        });
        const outStockLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_stock_out',
        });
        assert(outStockLog !== null, 'Item 86: Out-of-stock alert dispatched to vendor');

        // ─── SUITE 5: Order Lifecycle, Fulfillment & Returns ────────────────────
        console.log('\n--- 5. Order Fulfillment & Returns (Items 85, 94-119) ---');

        // Items 85 & 86: Order Cancelled
        await sendVendorOrderCancelledNotification({
            vendorId: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            order: { orderId: mockOrderId },
            reason: 'Customer ordered wrong size',
        });
        const ordCancelLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_order_cancelled',
        });
        assert(ordCancelLog !== null, 'Items 85 & 86: Order cancelled alert dispatched to vendor');

        // Items 99 & 102: Order Packed & Handed Over
        await sendVendorOrderProgressEmail({
            vendorId: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            order: { orderId: mockOrderId },
            stage: 'packed',
        });
        const packLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_fulfillment_packed',
        });
        assert(packLog !== null, 'Item 99: Order packed confirmation dispatched');

        await sendVendorOrderProgressEmail({
            vendorId: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            order: { orderId: mockOrderId },
            stage: 'picked_up',
        });
        const pickupLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_fulfillment_picked_up',
        });
        assert(pickupLog !== null, 'Item 102: Package handed over to courier dispatched');

        // Items 109 & 110: Return Notifications
        await sendVendorReturnNotification({
            vendorId: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            order: { orderId: mockOrderId },
            returnRequest: { returnId: 'RET-901' },
            status: 'requested',
            reason: 'Defective audio channel',
        });
        const retReqLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_return_requested',
        });
        assert(retReqLog !== null, 'Item 109: Return requested notification dispatched to vendor');

        // ─── SUITE 6: Settlements & Payouts ─────────────────────────────────────
        console.log('\n--- 6. Settlements & Payouts (Items 120-129) ---');

        // Item 124: Settlement Completed / Payout Credited
        await sendVendorSettlementNotification({
            vendorId: { _id: mockVendorAId, email: vendorAEmail, name: 'Vendor A' },
            settlement: {
                settlementId: 'SET-2026-0042',
                utrNumber: 'HDFCR52026101500012',
            },
            status: 'completed',
            amount: 72450.50,
        });
        const payoutLog = await EmailLog.findOne({
            recipient: vendorAEmail,
            template: 'vendor_payout_completed',
        });
        assert(payoutLog !== null, 'Item 124: Settlement payout credited notification dispatched');
        assert(payoutLog?.metadata?.amount === 72450.5, 'Payout notification recorded correct net amount');

    } catch (err) {
        console.error('❌ Unexpected Phase 3 test failure:', err);
        failed++;
    } finally {
        // Clean up test audit logs
        await EmailLog.deleteMany({
            $or: [
                { recipient: vendorAEmail },
                { recipient: vendorBEmail },
            ],
        });
        console.log('\n🧹 Cleaned up mock vendor test records from EmailLog collection.');
        await mongoose.disconnect();
    }

    console.log('\n================================================================');
    console.log(`Phase 3 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runPhase3Tests();
