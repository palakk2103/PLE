/**
 * Moderation Service Test Script
 * Run: node test-moderation.js (from backend directory)
 */
import {
    moderateMessage,
    checkMultiMessageEvasion,
    validateMonetaryOffer,
    MODERATION_ACTION,
    MODERATION_CATEGORY,
} from './src/services/chatModeration.service.js';

let passed = 0;
let failed = 0;

function test(label, message, expectedAction, expectedCategory = null) {
    const result = moderateMessage(message);
    const actionOk = result.action === expectedAction;
    const categoryOk = !expectedCategory || result.category === expectedCategory;
    const ok = actionOk && categoryOk;

    if (ok) {
        console.log(`  ✅ PASS | ${label}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL | ${label}`);
        console.log(`         | Message: "${message}"`);
        console.log(`         | Expected action=${expectedAction}${expectedCategory ? ` category=${expectedCategory}` : ''}`);
        console.log(`         | Got     action=${result.action} category=${result.category}`);
        failed++;
    }
}

console.log('\n══════════════════════════════════════════════════════');
console.log(' CHAT MODERATION TEST SUITE');
console.log('══════════════════════════════════════════════════════\n');

// ── ALLOW Tests (must NOT be blocked) ─────────────────────────
console.log('📦 ALLOW Tests — Normal product/quantity/price messages\n');
test('Quantity in Hindi',       '2 packets chahiye',               MODERATION_ACTION.ALLOW);
test('Weight in kg',            '5 kg bhejna',                     MODERATION_ACTION.ALLOW);
test('Weight in grams',         '500 gram available hai?',         MODERATION_ACTION.ALLOW);
test('Price in rupees',         '₹500 ka hai?',                    MODERATION_ACTION.ALLOW);
test('Price with qty',          '2 packets ₹500 mein de do',       MODERATION_ACTION.ALLOW);
test('Product ID',              'Product 123 available hai?',      MODERATION_ACTION.ALLOW);
test('Order reference',         'Order #12345',                    MODERATION_ACTION.ALLOW);
test('Model year',              'Model 2025 available hai?',       MODERATION_ACTION.ALLOW);
test('Quantity request',        '2 quantity chahiye',              MODERATION_ACTION.ALLOW);
test('Mixed qty+price',         '₹200 ka product chahiye',        MODERATION_ACTION.ALLOW);
test('Simple price query',      'kya price hai?',                  MODERATION_ACTION.ALLOW);
test('Delivery query',          'delivery kitne din mein hogi?',   MODERATION_ACTION.ALLOW);
test('Innocent WhatsApp query', 'what is whatsapp',                MODERATION_ACTION.ALLOW);
test('Year in message',         'Model 2024 ya 2025 wala?',        MODERATION_ACTION.ALLOW);
test('6-digit PIN',             'pincode 400001',                  MODERATION_ACTION.ALLOW);
test('Short code',              'promo code 123456',               MODERATION_ACTION.ALLOW);
test('Whitelisted domain URL',  'https://ple.com/products/item-123', MODERATION_ACTION.ALLOW);
test('Whitelisted B2B URL',     'https://b2b.ple.com/rfq/456',     MODERATION_ACTION.ALLOW);

// ── BLOCK Tests — Phone Numbers ───────────────────────────────
console.log('\n📞 BLOCK Tests — Phone Numbers\n');
test('Basic phone',             '9876543210 par call karna',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('+91 phone',               '+91 9876543210',                  MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Dashed phone',            '+91-9876543210',                  MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Spaced phone',            '98765 43210 hai mera number',     MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Phone in sentence',       'call me on 9876543210 urgently',  MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Obfuscated letter O',     '98765o4321 call karo',            MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Spelled out digits',      'nau aath saat chhe paanch char teen do ek zero', MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Landline STD',            'call on 011-23456789 office',     MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);

// ── BLOCK Tests — UPI IDs ─────────────────────────────────────
console.log('\n💳 BLOCK Tests — UPI IDs\n');
test('Standard UPI ybl',        'send money to abc@ybl',           MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('UPI okaxis',              'pay on rahul@okaxis',             MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('UPI paytm',               'shopkeeper@paytm par karo',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('UPI oksbi',               'my id is john@oksbi',             MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('Spaced UPI',              'abc @ okaxis',                    MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('UPI okhdfcbank',          'vendor@okhdfcbank',               MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);

// ── BLOCK Tests — External Payment Instructions ───────────────
console.log('\n💸 BLOCK Tests — External Payment Instructions\n');
test('Direct UPI instruction',  'direct upi kar do please',        MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('PhonePe instruction',     'PhonePe se pay kar do',           MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('Bank transfer',           'bank transfer kar do direct',     MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('Mere account mein',       'mere account mein payment kar do',MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('Paise bhejo',             'paise bhej do mujhe',             MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('Off-platform payment',    'platform ke bahar payment kar do',MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);

// ── BLOCK Tests — External Contact ───────────────────────────
console.log('\n📱 BLOCK Tests — External Contact Platforms & Raw Links\n');
test('WhatsApp contact',        'WhatsApp par contact karo',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('Telegram contact',        'Telegram pe message karna',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('WhatsApp chat',           'whatsapp par baat karte hain',    MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('Instagram DM',            'instagram pe dm karo',            MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('Raw wa.me link',          'wa.me/919876543210',              MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('Raw t.me link',           't.me/ple_deal_direct',            MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('Raw instagram link',      'instagram.com/my_direct_store',   MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('Discord invite',          'discord.gg/abc1234',              MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);

// ── BLOCK Tests — External URLs ──────────────────────────────
console.log('\n🌐 BLOCK Tests — External URLs\n');
test('External website link',   'https://other-store.com/buy-cheaper', MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_URL);
test('URL shortener',           'http://bit.ly/deal123',           MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_URL);
test('WWW external link',       'www.myexternalshop.in',           MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_URL);

// ── BLOCK Tests — Payment Cards & CVV ────────────────────────
console.log('\n💳 BLOCK Tests — Payment Card Numbers & CVV\n');
test('16-digit card formatted', '4111 2222 3333 4444',             MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.CARD_DETAILS);
test('Card with keyword',       'my visa card 4532015689123456',   MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.CARD_DETAILS);
test('CVV query',               'CVV: 567 bhejo',                  MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.CARD_DETAILS);

// ── BLOCK Tests — Credential & OTP Phishing ───────────────────
console.log('\n🔒 BLOCK Tests — OTP & Credential Phishing\n');
test('English OTP request',     'send me your OTP quickly',        MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.CREDENTIAL_PHISHING);
test('Hinglish OTP request',    'bhai apna OTP bhejo',             MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.CREDENTIAL_PHISHING);
test('Password request',        'share your login password',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.CREDENTIAL_PHISHING);
test('Hinglish PIN request',    'apna secret PIN batao',           MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.CREDENTIAL_PHISHING);

// ── BLOCK Tests — Email ───────────────────────────────────────
console.log('\n📧 BLOCK Tests — Email Addresses\n');
test('Gmail address',           'email me at user@gmail.com',      MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EMAIL);
test('Custom domain email',     'contact@mystore.com',             MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EMAIL);

// ── BLOCK Tests — Payment Links ───────────────────────────────
console.log('\n🔗 BLOCK Tests — Payment Links\n');
test('UPI deep link',           'upi://pay?pa=xyz@ybl&pn=test',   MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PAYMENT_LINK);

// ── BLOCK Tests — Bank Details ────────────────────────────────
console.log('\n🏦 BLOCK Tests — Bank Details\n');
test('IFSC code',               'HDFC0001234 hai mera IFSC',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.IFSC);
test('Account + IFSC',         'account number 123456789012 aur IFSC SBIN0001234', MODERATION_ACTION.BLOCK);

// ── Obfuscation Tests ─────────────────────────────────────────
console.log('\n🔍 Obfuscation Tests\n');
test('Spaced UPI handle',       'abc  @  ybl bhejo paise',         MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('(at) email',              'send at user(at)gmail.com',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EMAIL);

// ── Multi-Message Evasion Tests ──────────────────────────────
console.log('\n🧩 Multi-Message Evasion Tests\n');
{
    const res1 = checkMultiMessageEvasion('43210', ['98765']);
    if (res1.action === MODERATION_ACTION.BLOCK && res1.category === MODERATION_CATEGORY.PHONE_NUMBER) {
        console.log('  ✅ PASS | Split phone number (98765 + 43210)');
        passed++;
    } else {
        console.log('  ❌ FAIL | Split phone number (98765 + 43210)');
        failed++;
    }
}
{
    const res2 = checkMultiMessageEvasion('world', ['hello']);
    if (res2.action === MODERATION_ACTION.ALLOW) {
        console.log('  ✅ PASS | Innocent multi-message conversation');
        passed++;
    } else {
        console.log('  ❌ FAIL | Innocent multi-message conversation');
        failed++;
    }
}

// ── Monetary Offer Validation Tests ──────────────────────────
console.log('\n💰 Monetary Offer Validation Tests\n');
{
    const valid500 = validateMonetaryOffer(500);
    if (valid500.isValid) {
        console.log('  ✅ PASS | Legitimate offer ₹500');
        passed++;
    } else {
        console.log('  ❌ FAIL | Legitimate offer ₹500');
        failed++;
    }

    const phoneInOffer = validateMonetaryOffer(9876543210);
    if (!phoneInOffer.isValid) {
        console.log('  ✅ PASS | Reject phone number disguised as offer (9876543210)');
        passed++;
    } else {
        console.log('  ❌ FAIL | Reject phone number disguised as offer (9876543210)');
        failed++;
    }

    const negOffer = validateMonetaryOffer(-100);
    if (!negOffer.isValid) {
        console.log('  ✅ PASS | Reject negative offer');
        passed++;
    } else {
        console.log('  ❌ FAIL | Reject negative offer');
        failed++;
    }

    const textOffer = validateMonetaryOffer('user@gmail.com');
    if (!textOffer.isValid) {
        console.log('  ✅ PASS | Reject email inside offer string');
        passed++;
    } else {
        console.log('  ❌ FAIL | Reject email inside offer string');
        failed++;
    }
}

// ── Summary ───────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log(` RESULTS: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
