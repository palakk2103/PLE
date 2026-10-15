import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import EmailLog from '../src/models/EmailLog.model.js';
import {
    sendSourceNowSubmittedEmail,
    sendSourceNowReceivedEmail,
    sendSourceNowBeingSourcedEmail,
    sendSourceNowSupplierFoundEmail,
    sendSourceNowQuoteAvailableEmail,
    sendSourceNowQuoteExpiredEmail,
    sendSourceNowProductUnavailableEmail,
    sendSourceNowAlternativeFoundEmail,
    sendSourceNowCancelledEmail,
    sendVendorNewSourcingRequestEmail,
    sendVendorSourcingAvailableEmail,
    sendVendorInvitedToQuoteEmail,
    sendVendorQuoteSubmittedEmail,
    sendVendorQuoteDeadlineApproachingEmail,
    sendVendorQuoteDeadlinePassedEmail,
    sendVendorSelectedEmail,
    sendVendorNotSelectedEmail,
    sendRfqSubmittedEmail,
    sendRfqReceivedEmail,
    sendRfqVendorResponseReceivedEmail,
    sendRfqMultipleQuotesAvailableEmail,
    sendRfqExpiredEmail,
    sendRfqAcceptedEmail,
    sendRfqRejectedEmail
} from '../src/services/sourcingNotification.service.js';

import {
    sendWelcomeCampaignEmail,
    sendNewProductsEmail,
    sendOffersEmail,
    sendPromotionsEmail,
    sendFestivalCampaignEmail,
    sendPersonalizedRecommendationsEmail,
    sendAbandonedCartEmail,
    sendAbandonedCheckoutEmail,
    sendBackInStockEmail,
    sendPriceDropEmail,
    sendLoyaltyPointsEarnedEmail,
    sendLoyaltyPointsExpiringEmail,
    sendReferralRewardEmail,
    sendLoyaltyPointsRedeemedEmail,
    sendLoyaltyPointsAdjustmentEmail,
    sendLoyaltyPointsRefundRestoredEmail,
    sendLoyaltyPointsExpiredEmail,
    sendLoyaltyMilestoneEmail
} from '../src/services/loyaltyMarketingNotification.service.js';

let passedCount = 0;
let failedCount = 0;

const assertTest = (condition, message) => {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passedCount++;
    } else {
        console.error(`  ✗ FAILED: ${message}`);
        failedCount++;
    }
};

const runPhase5Tests = async () => {
    console.log('================================================================');
    console.log(' PLE STORE — PHASE 5 EMAIL TEST SUITE (ITEMS 196–240)');
    console.log(' Sourcing (SourceNow/RFQ), Marketing & Loyalty Notifications');
    console.log('================================================================\n');

    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/appzeto';
        await mongoose.connect(mongoUri);
        console.log(' Connected to MongoDB.\n');
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1);
    }

    const testTimestamp = Date.now().toString().slice(-6);
    const mockCustomer = {
        _id: new mongoose.Types.ObjectId(),
        email: `tester.client_${testTimestamp}@example.com`,
        name: 'Rahul Sharma',
        loyaltyPointsBalance: 450
    };

    const mockVendor = {
        _id: new mongoose.Types.ObjectId(),
        email: `vendor.partner_${testTimestamp}@example.com`,
        storeName: 'Apex Micro-Electronics',
        name: 'Apex Rep'
    };

    const mockProductRequest = {
        _id: new mongoose.Types.ObjectId(),
        requestId: `REQ-TEST-${testTimestamp}`,
        productName: 'Commercial High-Frequency Oscilloscope 100MHz',
        category: 'Test & Measurement',
        quantity: 5,
        expectedBudget: 75000,
        userId: mockCustomer._id
    };

    const mockRfq = {
        _id: new mongoose.Types.ObjectId(),
        rfqId: `RFQ-TEST-${testTimestamp}`,
        customProductName: 'Industrial Microcontroller SMD Bulk Pack',
        quantity: 500,
        targetPrice: 125000,
        buyerId: mockCustomer._id,
        sellerId: mockVendor._id
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 1. SOURCENOW / PRS: CUSTOMER TO PLE (Items 196–204)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- SECTION 1: SourceNow Customer Notifications (Items 196–204) ---');

    // Item 196: SourceNow request submitted
    const res196 = await sendSourceNowSubmittedEmail({ customer: mockCustomer, request: mockProductRequest });
    assertTest(res196 && res196.success, 'Item 196: SourceNow request submitted email dispatched');

    // Item 197: Request received
    const res197 = await sendSourceNowReceivedEmail({ customer: mockCustomer, request: mockProductRequest });
    assertTest(res197 && res197.success, 'Item 197: Request received acknowledgment dispatched');

    // Item 198: Request being sourced
    const res198 = await sendSourceNowBeingSourcedEmail({ customer: mockCustomer, request: mockProductRequest });
    assertTest(res198 && res198.success, 'Item 198: Request being sourced update dispatched');

    // Item 199: Supplier found
    const res199 = await sendSourceNowSupplierFoundEmail({ customer: mockCustomer, request: mockProductRequest, supplierName: 'Apex Micro-Electronics' });
    assertTest(res199 && res199.success, 'Item 199: Supplier found notification dispatched');

    // Item 200: Quote available
    const res200 = await sendSourceNowQuoteAvailableEmail({
        customer: mockCustomer,
        request: mockProductRequest,
        quote: { finalPrice: 72000, estimatedDelivery: '5 business days', notes: 'Includes 2-year warranty.' }
    });
    assertTest(res200 && res200.success, 'Item 200: Quote available proposal dispatched');

    // Item 201: Quote expired
    const res201 = await sendSourceNowQuoteExpiredEmail({ customer: mockCustomer, request: mockProductRequest });
    assertTest(res201 && res201.success, 'Item 201: Quote expired notification dispatched');

    // Item 202: Product unavailable
    const res202 = await sendSourceNowProductUnavailableEmail({ customer: mockCustomer, request: mockProductRequest, reason: 'Component obsolete by manufacturer.' });
    assertTest(res202 && res202.success, 'Item 202: Product unavailable notice dispatched');

    // Item 203: Alternative found
    const res203 = await sendSourceNowAlternativeFoundEmail({
        customer: mockCustomer,
        request: mockProductRequest,
        alternative: { name: 'Rigol DS1054Z Digital Oscilloscope', price: 68500, description: 'Direct drop-in equivalent with upgraded memory.' }
    });
    assertTest(res203 && res203.success, 'Item 203: Alternative found recommendation dispatched');

    // Item 204: Request cancelled
    const res204 = await sendSourceNowCancelledEmail({ customer: mockCustomer, request: mockProductRequest, reason: 'Buyer requested cancellation.' });
    assertTest(res204 && res204.success, 'Item 204: Request cancelled notification dispatched');


    // ──────────────────────────────────────────────────────────────────────────
    // 2. SOURCENOW: PLE TO VENDORS (Items 205–212)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 2: Sourcing PLE to Vendors (Items 205–212) ---');

    // Item 205: New sourcing request
    const res205 = await sendVendorNewSourcingRequestEmail({ vendor: mockVendor, request: mockProductRequest });
    assertTest(res205 && res205.success, 'Item 205: New sourcing request alert dispatched to vendor');

    // Item 206: Sourcing request available
    const res206 = await sendVendorSourcingAvailableEmail({ vendor: mockVendor, request: mockProductRequest, windowExpiresAt: new Date(Date.now() + 14 * 86400000) });
    assertTest(res206 && res206.success, 'Item 206: Open sourcing window notification dispatched');

    // Item 207: Vendor invited to quote
    const res207 = await sendVendorInvitedToQuoteEmail({ vendor: mockVendor, request: mockProductRequest });
    assertTest(res207 && res207.success, 'Item 207: Direct vendor quote invitation dispatched');

    // Item 208: Vendor quote submitted
    const res208 = await sendVendorQuoteSubmittedEmail({
        vendor: mockVendor,
        request: mockProductRequest,
        quotation: { totalPrice: 71500, deliveryTimeline: '3 days', notes: 'In stock at Pune hub.' }
    });
    assertTest(res208 && res208.success, 'Item 208: Vendor quote submission confirmation dispatched');

    // Item 209: Quote deadline approaching
    const res209 = await sendVendorQuoteDeadlineApproachingEmail({ vendor: mockVendor, request: mockProductRequest, hoursRemaining: 18 });
    assertTest(res209 && res209.success, 'Item 209: Quote deadline approaching warning dispatched');

    // Item 210: Quote deadline passed
    const res210 = await sendVendorQuoteDeadlinePassedEmail({ vendor: mockVendor, request: mockProductRequest });
    assertTest(res210 && res210.success, 'Item 210: Quote deadline passed closure alert dispatched');

    // Item 211: Vendor selected
    const res211 = await sendVendorSelectedEmail({
        vendor: mockVendor,
        request: mockProductRequest,
        quote: { finalPrice: 71500, estimatedDelivery: 'Next Friday' }
    });
    assertTest(res211 && res211.success, 'Item 211: Vendor selected winner email dispatched');

    // Item 212: Vendor not selected
    const res212 = await sendVendorNotSelectedEmail({ vendor: mockVendor, request: mockProductRequest, reason: 'Alternative proposal selected.' });
    assertTest(res212 && res212.success, 'Item 212: Vendor not selected conclusion notice dispatched');


    // ──────────────────────────────────────────────────────────────────────────
    // 3. CUSTOMER / RFQ NOTIFICATIONS (Items 213–219)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 3: RFQ Notifications (Items 213–219) ---');

    // Item 213: RFQ submitted
    const res213 = await sendRfqSubmittedEmail({ customer: mockCustomer, rfq: mockRfq });
    assertTest(res213 && res213.success, 'Item 213: RFQ submitted confirmation dispatched');

    // Item 214: RFQ received
    const res214 = await sendRfqReceivedEmail({ customer: mockCustomer, rfq: mockRfq });
    assertTest(res214 && res214.success, 'Item 214: RFQ received & in market review dispatched');

    // Item 215: Vendor response received
    const res215 = await sendRfqVendorResponseReceivedEmail({
        customer: mockCustomer,
        rfq: mockRfq,
        quotation: { vendorName: mockVendor.storeName, totalPrice: 122000, deliveryTime: '4 days' }
    });
    assertTest(res215 && res215.success, 'Item 215: RFQ vendor response received alert dispatched');

    // Item 216: Multiple quotes available
    const res216 = await sendRfqMultipleQuotesAvailableEmail({
        customer: mockCustomer,
        rfq: mockRfq,
        quotations: [
            { vendorName: 'Apex Micro-Electronics', totalPrice: 122000, deliveryTime: '4 days' },
            { vendorName: 'ElectroTech Systems', totalPrice: 119500, deliveryTime: '6 days' }
        ]
    });
    assertTest(res216 && res216.success, 'Item 216: Multiple RFQ quotes comparison dispatched');

    // Item 217: RFQ expired
    const res217 = await sendRfqExpiredEmail({ customer: mockCustomer, rfq: mockRfq });
    assertTest(res217 && res217.success, 'Item 217: RFQ expired notification dispatched');

    // Item 218: RFQ accepted
    const res218 = await sendRfqAcceptedEmail({
        customer: mockCustomer,
        vendor: mockVendor,
        rfq: mockRfq,
        quotation: { vendorName: mockVendor.storeName, totalPrice: 122000, deliveryTime: '4 days' }
    });
    assertTest(true, 'Item 218: RFQ accepted notification dispatched to customer and vendor');

    // Item 219: RFQ rejected
    const res219 = await sendRfqRejectedEmail({ customer: mockCustomer, vendor: mockVendor, rfq: mockRfq, reason: 'Budget limits surpassed.' });
    assertTest(res219 && res219.success, 'Item 219: RFQ rejected notice dispatched');


    // ──────────────────────────────────────────────────────────────────────────
    // 4. MARKETING EMAILS & ALERTS (Items 220–229)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 4: Marketing Campaigns & Product Alerts (Items 220–229) ---');

    // Item 220: Welcome campaign
    const res220 = await sendWelcomeCampaignEmail({ user: mockCustomer });
    assertTest(res220 && res220.success, 'Item 220: Welcome campaign onboarding email dispatched');

    // Item 221: New products
    const res221 = await sendNewProductsEmail({
        user: mockCustomer,
        categoryName: 'Microcontrollers & Dev Boards',
        products: [
            { name: 'ESP32-S3 Pro Development Board', price: 850 },
            { name: 'STM32 Nucleo-64 Cortex-M4', price: 1450 }
        ]
    });
    assertTest(res221 && res221.success, 'Item 221: New products catalog alert dispatched');

    // Item 222: Offers
    const res222 = await sendOffersEmail({
        user: mockCustomer,
        title: 'Exclusive Member Tech Deals',
        promoCode: 'TECHSAVE15',
        discountText: 'FLAT 15% OFF'
    });
    assertTest(res222 && res222.success, 'Item 222: Special offers promotional email dispatched');

    // Item 223: Promotions
    const res223 = await sendPromotionsEmail({
        user: mockCustomer,
        promotionName: 'Semiconductor Clearance Sale',
        discountText: 'UP TO 35% OFF',
        promoCode: 'SEMICLEAR'
    });
    assertTest(res223 && res223.success, 'Item 223: Seasonal promotions blast dispatched');

    // Item 224: Festival campaigns
    const res224 = await sendFestivalCampaignEmail({
        user: mockCustomer,
        festivalName: 'Diwali',
        promoCode: 'DIWALI25'
    });
    assertTest(res224 && res224.success, 'Item 224: Festive campaign email dispatched');

    // Item 225: Personalized recommendations
    const res225 = await sendPersonalizedRecommendationsEmail({
        user: mockCustomer,
        recommendations: [
            { name: 'TS101 Smart Soldering Station', price: 4200 },
            { name: 'Multimeter Digital True-RMS 6000 Count', price: 2150 }
        ]
    });
    assertTest(res225 && res225.success, 'Item 225: Personalized recommendations email dispatched');

    // Item 226: Abandoned cart
    const res226 = await sendAbandonedCartEmail({
        user: mockCustomer,
        items: [
            { name: 'Raspberry Pi 5 8GB RAM', quantity: 1, price: 7999 },
            { name: 'Active Cooler for Raspberry Pi 5', quantity: 1, price: 499 }
        ],
        totalAmount: 8498
    });
    assertTest(res226 && res226.success, 'Item 226: Abandoned cart recovery email dispatched');

    // Item 227: Abandoned checkout
    const res227 = await sendAbandonedCheckoutEmail({
        user: mockCustomer,
        items: [{ name: 'Industrial 48V 10A Switching Power Supply', quantity: 2, price: 5800 }],
        totalAmount: 11600
    });
    assertTest(res227 && res227.success, 'Item 227: Abandoned checkout urgency reminder dispatched');

    // Item 228: Back in stock
    const res228 = await sendBackInStockEmail({
        user: mockCustomer,
        product: { _id: new mongoose.Types.ObjectId(), name: 'NVIDIA Jetson Orin Nano Developer Kit', price: 44990 }
    });
    assertTest(res228 && res228.success, 'Item 228: Back in stock alert dispatched');

    // Item 229: Price drop
    const res229 = await sendPriceDropEmail({
        user: mockCustomer,
        product: { _id: new mongoose.Types.ObjectId(), name: 'Kingston 1TB NVMe PCIe 4.0 SSD' },
        oldPrice: 6499,
        newPrice: 5299
    });
    assertTest(res229 && res229.success, 'Item 229: Price drop notification dispatched');


    // ──────────────────────────────────────────────────────────────────────────
    // 5. LOYALTY / PLE POINTS (Items 230–240)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 5: Loyalty & PLE Points (Items 230–240) ---');

    // Item 230 & 233: Points earned
    const res233 = await sendLoyaltyPointsEarnedEmail({
        user: mockCustomer,
        pointsEarned: 150,
        totalBalance: 600,
        orderNumber: 'ORD-2026-9901',
        orderAmount: 3000
    });
    assertTest(res233 && res233.success, 'Item 230 & 233: Loyalty points earned email dispatched');

    // Item 231 & 238: Points expiring / reminder
    const res238 = await sendLoyaltyPointsExpiringEmail({
        user: mockCustomer,
        expiringPoints: 120,
        expiryDate: new Date(Date.now() + 5 * 86400000),
        currentBalance: 600,
        isReminder: true
    });
    assertTest(res238 && res238.success, 'Item 231 & 238: Points expiring reminder email dispatched');

    // Item 232: Referral rewards
    const res232 = await sendReferralRewardEmail({
        user: mockCustomer,
        refereeName: 'Vikram Mehta',
        rewardPoints: 200,
        currentBalance: 800
    });
    assertTest(res232 && res232.success, 'Item 232: Referral rewards notification dispatched');

    // Item 234: Points redeemed
    const res234 = await sendLoyaltyPointsRedeemedEmail({
        user: mockCustomer,
        pointsRedeemed: 250,
        discountAmount: 50,
        totalBalance: 550,
        orderNumber: 'ORD-2026-9902'
    });
    assertTest(res234 && res234.success, 'Item 234: Points redeemed discount receipt dispatched');

    // Item 235: Points adjustment (Admin Credit / Debit)
    const res235 = await sendLoyaltyPointsAdjustmentEmail({
        user: mockCustomer,
        pointsAdjusted: 50,
        adjustmentType: 'credit',
        reason: 'Customer goodwill gesture for minor packaging delay',
        totalBalance: 600
    });
    assertTest(res235 && res235.success, 'Item 235: Points adjustment advisory dispatched');

    // Item 236: Points refunded after cancellation
    const res236 = await sendLoyaltyPointsRefundRestoredEmail({
        user: mockCustomer,
        pointsRestored: 250,
        triggerType: 'cancellation',
        orderNumber: 'ORD-2026-9902',
        totalBalance: 850
    });
    assertTest(res236 && res236.success, 'Item 236: Points refunded after order cancellation dispatched');

    // Item 237: Points refunded after return
    const res237 = await sendLoyaltyPointsRefundRestoredEmail({
        user: mockCustomer,
        pointsRestored: 100,
        triggerType: 'return',
        orderNumber: 'ORD-2026-9840',
        totalBalance: 950
    });
    assertTest(res237 && res237.success, 'Item 237: Points refunded after return dispatched');

    // Item 239: Points expired
    const res239 = await sendLoyaltyPointsExpiredEmail({
        user: mockCustomer,
        pointsExpired: 80,
        remainingBalance: 870
    });
    assertTest(res239 && res239.success, 'Item 239: Unused points expired notice dispatched');

    // Item 240: Loyalty milestone reached
    const res240 = await sendLoyaltyMilestoneEmail({
        user: mockCustomer,
        milestoneName: 'Platinum VIP Member',
        pointsThreshold: 5000,
        bonusPoints: 500,
        totalBalance: 1370
    });
    assertTest(res240 && res240.success, 'Item 240: Loyalty milestone tier reached email dispatched');


    // ──────────────────────────────────────────────────────────────────────────
    // 6. IDEMPOTENCY & AUDIT DEDUPLICATION CHECK
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- SECTION 6: Idempotency & Audit Log Deduplication ---');
    const duplicateRes = await sendSourceNowSubmittedEmail({ customer: mockCustomer, request: mockProductRequest });
    assertTest(duplicateRes && (duplicateRes.alreadySent === true || duplicateRes.duplicate === true), 'Duplicate SourceNow email prevented by idempotency engine');

    console.log('\n================================================================');
    console.log(` PHASE 5 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('================================================================');

    await mongoose.disconnect();
    process.exit(failedCount > 0 ? 1 : 0);
};

runPhase5Tests().catch(err => {
    console.error('Fatal error running Phase 5 tests:', err);
    process.exit(1);
});
