/**
 * Moderation Service Test Script
 * Run: node test-moderation.js (from backend directory)
 */
import {
    moderateMessage,
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

// ── BLOCK Tests — Phone Numbers ───────────────────────────────
console.log('\n📞 BLOCK Tests — Phone Numbers\n');
test('Basic phone',             '9876543210 par call karna',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('+91 phone',               '+91 9876543210',                  MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Dashed phone',            '+91-9876543210',                  MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Spaced phone',            '98765 43210 hai mera number',     MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Phone in sentence',       'call me on 9812345678',           MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Obfuscated letter O',     'call on 98765O43210',             MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Spelled out digits',      'call nine eight seven six five four three two one zero', MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);
test('Landline STD',            'call 011-23456789 office',        MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.PHONE_NUMBER);

// ── BLOCK Tests — UPI IDs ─────────────────────────────────────
console.log('\n💳 BLOCK Tests — UPI IDs\n');
test('Standard UPI ybl',        'meri UPI abc@ybl hai',            MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('UPI okaxis',              'name@okaxis send kar do',         MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('UPI paytm',               'payment@paytm par bhejo',         MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('UPI oksbi',               'user123@oksbi',                   MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('Spaced UPI',              'abc @ ybl',                       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);
test('UPI okhdfcbank',          'pay@okhdfcbank yahan',            MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.UPI_ID);

// ── BLOCK Tests — External Payment ───────────────────────────
console.log('\n💸 BLOCK Tests — External Payment Instructions\n');
test('Direct UPI instruction',  'direct UPI kar do',               MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('PhonePe instruction',     'PhonePe par payment kar do',      MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('Bank transfer',           'bank transfer kar dena',          MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('Mere account mein',       'mere account mein payment kar do',MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('Paise bhejo',             'paise bhej do mujhe',             MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);
test('Off-platform payment',    'platform ke bahar payment kar do',MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_PAYMENT);

// ── BLOCK Tests — External Contact ───────────────────────────
console.log('\n📱 BLOCK Tests — External Contact Platforms\n');
test('WhatsApp contact',        'WhatsApp par contact karo',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('Telegram contact',        'Telegram pe message karna',       MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('WhatsApp chat',           'whatsapp par baat karte hain',    MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);
test('Instagram DM',            'instagram pe dm karo',            MODERATION_ACTION.BLOCK, MODERATION_CATEGORY.EXTERNAL_CONTACT);

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

// ── Summary ───────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log(` RESULTS: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
