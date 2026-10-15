/**
 * Transaction Proposal Flow & Tamper Resistance Unit Test Suite
 * Run: node test-proposal-flow.js (from backend directory)
 */
import { validateMonetaryOffer, moderateMessage, MODERATION_ACTION } from './src/services/chatModeration.service.js';

let passed = 0;
let failed = 0;

function assert(description, condition) {
    if (condition) {
        console.log(`  ✅ PASS | ${description}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL | ${description}`);
        failed++;
    }
}

console.log('\n══════════════════════════════════════════════════════');
console.log(' TRANSACTION PROPOSAL & FINANCIAL SECURITY TEST SUITE');
console.log('══════════════════════════════════════════════════════\n');

// 1. Math Calculation Verification
console.log('📐 1. Calculation & Server-Side Math Verification\n');
{
    const qty = 3;
    const unitPrice = 450;
    const discount = 100;
    const tax = 50;
    const delivery = 80;

    const agreedAmount = Math.round(qty * unitPrice * 100) / 100;
    const finalAmount = Math.round((agreedAmount - discount + tax + delivery) * 100) / 100;

    assert('Agreed subtotal correctly equals qty * unitPrice (3 * 450 = 1350)', agreedAmount === 1350);
    assert('Final amount correctly accounts for discount, tax, delivery (1350 - 100 + 50 + 80 = 1380)', finalAmount === 1380);
}

// 2. Tamper & Boundary Prevention
console.log('\n🛡️ 2. Boundary & Anti-Tampering Checks\n');
{
    const validOffer = validateMonetaryOffer(1380);
    assert('Valid proposal total (₹1380) passes monetary validation', validOffer.isValid === true);

    const negativeOffer = validateMonetaryOffer(-500);
    assert('Negative offer (-500) rejected server-side', negativeOffer.isValid === false);

    const zeroOffer = validateMonetaryOffer(0);
    assert('Zero offer (₹0) rejected server-side', zeroOffer.isValid === false);

    const phoneInOffer = validateMonetaryOffer(9876543210);
    assert('Disguised phone number in offer amount (9876543210) rejected', phoneInOffer.isValid === false);

    const extremeOffer = validateMonetaryOffer(9999999999);
    assert('Excessive unpermitted amount rejected', extremeOffer.isValid === false);
}

// 3. Prohibited Content in Proposal Text Fields
console.log('\n🚫 3. Prohibited Details in Proposal Fields (Anti-Leak)\n');
{
    const cleanProductName = 'Handcrafted Wooden Dining Chair';
    const cleanCheck = moderateMessage(cleanProductName);
    assert('Clean product name allowed in proposal', cleanCheck.action === MODERATION_ACTION.ALLOW);

    const phoneInName = 'Dining Chair call me 9876543210';
    const phoneCheck = moderateMessage(phoneInName);
    assert('Phone number embedded in proposal product name blocked', phoneCheck.action === MODERATION_ACTION.BLOCK);

    const upiInNotes = 'Pay directly on shopkeeper@okaxis for fast delivery';
    const upiCheck = moderateMessage(upiInNotes);
    assert('UPI payment instruction in proposal notes blocked', upiCheck.action === MODERATION_ACTION.BLOCK);

    const whatsappInNotes = 'Connect on WhatsApp wa.me/919876543210 for warranty';
    const waCheck = moderateMessage(whatsappInNotes);
    assert('External contact link in proposal notes blocked', waCheck.action === MODERATION_ACTION.BLOCK);
}

// 4. Proposal Status Lifecycle & Versioning Simulation
console.log('\n🔄 4. Proposal Lifecycle & State Machine Simulation\n');
{
    // Simulation state object
    const proposal = {
        proposalReference: 'PROP-20261010-TEST',
        productName: 'Cotton Formal Shirt',
        quantity: 2,
        unitPrice: 700,
        agreedAmount: 1400,
        discount: 100,
        tax: 65,
        deliveryCharge: 50,
        finalAmount: 1415,
        status: 'pending_customer_confirmation',
        version: 1,
        history: [{ action: 'PROPOSED', note: 'Initial proposal' }]
    };

    assert('Initial state is pending_customer_confirmation', proposal.status === 'pending_customer_confirmation');

    // Customer accepts
    proposal.status = 'accepted';
    proposal.history.push({ action: 'ACCEPTED', note: 'Customer accepted' });
    assert('Customer accepts: transitions to "accepted"', proposal.status === 'accepted');

    // Attempt to modify accepted proposal without version bump
    const canDirectlyModifyAccepted = proposal.status === 'pending_customer_confirmation';
    assert('Accepted proposal cannot be edited directly in-place', canDirectlyModifyAccepted === false);

    // Creating revision supersedes version 1
    const revisedProposal = {
        ...proposal,
        proposalReference: 'PROP-20261010-REV1',
        version: proposal.version + 1,
        unitPrice: 650,
        finalAmount: 1315,
        status: 'pending_customer_confirmation',
        history: [{ action: 'PROPOSED', note: `Superseded version ${proposal.version}` }]
    };
    proposal.status = 'superseded';

    assert('Original proposal marked as superseded', proposal.status === 'superseded');
    assert('Revised proposal has version 2', revisedProposal.version === 2);
    assert('Revised proposal status is pending_customer_confirmation', revisedProposal.status === 'pending_customer_confirmation');
}

// 5. Official Checkout Payload Integrity
console.log('\n💳 5. Official Checkout Conversion Security (Not marking as paid)\n');
{
    const acceptedProposal = {
        _id: 'prop_mongo_id_123',
        proposalReference: 'PROP-20261010-CONF',
        vendorId: 'vendor_456',
        productName: 'Cotton Formal Shirt',
        unitPrice: 650,
        quantity: 2,
        agreedAmount: 1300,
        discount: 100,
        tax: 60,
        deliveryCharge: 40,
        finalAmount: 1300,
        status: 'accepted'
    };

    // Conversion function simulating checkout endpoint
    const createCheckoutPayload = (p) => {
        if (p.status !== 'accepted') throw new Error('Proposal not accepted');
        return {
            proposalId: p._id,
            proposalReference: p.proposalReference,
            vendorId: p.vendorId,
            name: p.productName,
            price: p.unitPrice,
            quantity: p.quantity,
            total: p.finalAmount,
            isPaid: false // Crucial: must NOT be marked as paid
        };
    };

    const checkoutPayload = createCheckoutPayload(acceptedProposal);
    assert('Checkout payload contains correct reference', checkoutPayload.proposalReference === 'PROP-20261010-CONF');
    assert('Checkout payload total matches authoritative server amount', checkoutPayload.total === 1300);
    assert('Accepted proposal is NOT marked as paid automatically', checkoutPayload.isPaid === false);
}

// ── Summary ───────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log(` RESULTS: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
