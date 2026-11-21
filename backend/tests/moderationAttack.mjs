// Red-team test for chat moderation (customer <-> vendor).
// Usage (from /backend): node tests/moderationAttack.mjs
// Every "attack" must be BLOCKED; every "legit" message must be ALLOWED.
import { moderateMessage, checkMultiMessageEvasion } from '../src/services/chatModeration.service.js';

const PHONE = '9876543210';

const attacks = [
    // ── phone: plain & spacing ──────────────────────────────
    ['phone plain', `${PHONE}`],
    ['phone 5-5', '98765 43210'],
    ['phone 1-1', '9 8 7 6 5 4 3 2 1 0'],
    ['phone +91', '+91-98765-43210'],
    ['phone dots', '98.765.432.10'],
    ['phone brackets', '(98765) [43210]'],
    ['phone en-dash', '98765–43210'],
    ['phone bullets', '98765•43210'],
    ['phone middot', '9·8·7·6·5·4·3·2·1·0'],
    ['phone underscore+letters', '98x76x54x32x10'],
    ['phone with words between', '98 and 76 and 54 and 32 and 10'],
    ['phone "o" for zero', '98765432l0 (l=1) 987654321o'],
    // ── phone: disguised as price / quantity / id ───────────
    ['phone as rupees', `rs ${PHONE}`],
    ['phone as ₹', `₹${PHONE}`],
    ['phone as pcs', `${PHONE} pcs`],
    ['phone as days', `${PHONE} days`],
    ['phone as order #', `order #${PHONE}`],
    ['phone after slash', `ref/${PHONE}`],
    ['phone as pincode', `pincode ${PHONE}`],
    ['phone as discount', `discount ${PHONE}`],
    // ── phone: unicode / emoji ───────────────────────────────
    ['phone hindi digits', '९८७६५४३२१०'],
    ['phone bold math digits', '𝟗𝟖𝟕𝟔𝟓𝟒𝟑𝟐𝟏𝟎'],
    ['phone keycap emoji', '9️⃣8️⃣7️⃣6️⃣5️⃣4️⃣3️⃣2️⃣1️⃣0️⃣'],
    ['phone arabic-indic', '٩٨٧٦٥٤٣٢١٠'],
    ['phone bengali digits', '৯৮৭৬৫৪৩২১০'],
    ['phone gujarati digits', '૯૮૭૬૫૪૩૨૧૦'],
    ['phone superscript', '⁹⁸⁷⁶⁵⁴³²¹⁰'],
    ['phone zero-width', '98765​43210'],
    ['phone word joiner', '98765⁠43210'],
    ['phone soft hyphen', '98765­43210'],
    // ── phone: words ────────────────────────────────────────
    ['phone english words', 'nine eight seven six five four three two one zero'],
    ['phone hindi words', 'nau aath saat chhe paanch char teen do ek shunya'],
    ['phone mixed words', 'nine 8 seven 6 five 4 three 2 one 0'],
    ['phone words no spaces', 'nineeightsevensixfivefourthreetwoonezero'],
    ['phone "double"', 'double nine eight seven six five four three two one'],
    ['phone reversed hint', '0123456789 ulta padho'],
    ['phone devanagari words', 'नौ आठ सात छह पांच चार तीन दो एक शून्य'],
    ['phone tens words', 'ninety eight seven six five four three two one zero'],
    ['phone tens words 2', 'ninety eight seventy six fifty four thirty two ten'],
    ['phone digits+words glued', 'nine8seven6five4three2one0'],
    ['phone devanagari digits spaced', '९८ ७६५ ४३२१०'],
    ['phone pipes', '98|76|54|32|10'],
    ['phone emoji between', '98765😀43210'],
    ['phone with 91 words', 'plus nine one nine eight seven six five four three two one zero'],
    ['phone as price range', '₹98765–₹43210'],
    ['phone leet zero', '987654321o'],
    ['phone inside sentence', 'sure, ring me at 9 8 7 6 5 4 3 2 1 0 after 6'],
    ['phone dotted letters', 'W.h.a.t.s.a.p.p 9876543210'],
    ['phone landline', '011-23456789'],
    ['upi uppercase', 'RAMESH@OKAXIS'],
    ['upi unknown handle', 'ramesh@newbankxyz'],
    ['upi phone@handle spaced', '9876543210 @ ybl'],
    ['email plain', 'ramesh@gmail.com'],
    // ── UPI ─────────────────────────────────────────────────
    ['upi ybl', 'pay to ramesh@ybl'],
    ['upi okaxis spaced', 'ramesh @ okaxis'],
    ['upi (at)', 'ramesh(at)paytm'],
    ['upi "at the rate"', 'ramesh at the rate ybl'],
    ['upi paytm new handle', 'ramesh@pthdfc'],
    ['upi paytm ptsbi', 'ramesh@ptsbi'],
    ['upi axl', 'ramesh@axl'],
    ['upi airtel', 'ramesh@airtel'],
    ['upi jio', 'ramesh@jio'],
    ['upi kotak kmbl', 'ramesh@kmbl'],
    ['upi idfc', 'ramesh@idfcbank'],
    ['upi navi', 'ramesh@naviaxis'],
    ['upi freecharge', 'ramesh@freecharge'],
    ['upi boi', 'ramesh@boi'],
    ['upi canara', 'ramesh@cnrb'],
    ['upi phone-based', `${PHONE}@ybl`],
    ['upi spaced handle', 'ramesh @ y b l'],
    ['upi fullwidth @', 'ramesh＠ybl'],
    ['upi hashtag', 'ramesh#ybl'],
    ['upi words', 'my gpay id is ramesh dot shop'],
    ['upi "upi id" phrase', 'UPI ID: ramesh.store'],
    // ── payment instructions ────────────────────────────────
    ['gpay instruction', 'gpay kar do 500'],
    ['phonepe instruction', 'phonepe pe bhej do'],
    ['pay outside', 'direct payment karo, platform ke bahar sasta'],
    ['scan qr', 'QR scan karke pay karo'],
    ['cod outside', 'order cancel karo, main COD pe bhej dunga cash de dena'],
    ['bank account', 'account no 123456789012 ifsc SBIN0001234'],
    ['payment link', 'https://rzp.io/l/abc'],
    ['wa.me link', 'wa.me/919876543210'],
    ['whatsapp ask', 'whatsapp pe message karo'],
    ['telegram handle', 'telegram @ramesh_store pe aao'],
    ['insta handle', 'insta id ramesh.store follow karke dm karo'],
    ['email', 'ramesh.store@gmail.com'],
    ['email spaced', 'ramesh store at gmail dot com'],
];

const legit = [
    'Price is ₹200', 'It costs 200 rs', 'Rs. 9,999 only', '₹1,49,999 for the full set', '₹20000',
    'Total 12,499 including GST 18%', 'I want 3 pieces', 'Pack of 6', '500 gram pack', '2 kg',
    'Delivery in 7 days', 'Order #ORD-2026-4821', 'Order ID ORD123456789', 'Pincode 400001',
    'Size 42, colour blue', 'Dimensions 120x60x75 cm', 'Can you give 10% discount?', 'Model 2024',
    'I will order 25 units at 450 each', 'Warranty 1 year', 'Batch 2026-11-16', 'Thanks!',
    'Price ₹1,299.50 per piece', 'Total ₹12,50,000 for the bulk order', 'Delivery by 25/11/2026 10:30 AM',
    'Delivered on 9/11/2026 at 4:30 pm', 'Order ORD-1763312345678-AB12 has shipped', 'Ticket TKT-123456 raised',
    'RFQ-20261116-4821 is approved', 'GSTIN 27AAPCG9838F1Z1 on invoice', 'Need 2 and 3 pieces', 'Size 8 and 9 available',
    'Qty 10 and 20 and 30', 'Can we meet at noon?', 'Available at 5pm today', 'Look at this model', 'Discount 15% on 2000',
    '3 pcs x 450 = 1350', 'Model number 4521 in stock', 'I need one pack, two kg and three boxes', 'Price is two hundred rupees',
    'Ek packet aur do kg chahiye', 'Phone cover for iPhone 15 Pro Max 256GB', 'Cable length 1.5 m, 3 amp, 65W',
    'Weight 2.5 kg, 120 cm x 60 cm x 75 cm', 'Pay on platform checkout please',
    'Deliver to 221B Baker Street, 400001', 'Invoice no 202611161234 attached', 'Is the red one in stock?',
    'Is this available in size 8 or 9?', 'Qty 100, price 85 per unit = 8500', 'Ship by 25th Nov',
];

// split across messages (same sender, within the 2-minute window)
const splits = [
    ['split 5+5', ['98765', '43210']],
    ['split 1-digit stream', ['9', '8', '7', '6', '5', '4', '3', '2', '1', '0']],
    ['split with words', ['first part 98765', 'second part 43210']],
    ['split as prices', ['price ₹98765', 'and ₹43210']],
    ['split upi', ['ramesh', '@ybl']],
    ['split upi words', ['my id ramesh', 'at ybl']],
    ['split 3 parts', ['987', '654', '3210']],
    ['split long msgs', ['the first five are 98765 ok', 'and the last five are 43210 ok']],
];
const legitSplits = [
    ['price chat', ['₹200', 'qty 5', 'total 1000']],
    ['sizes', ['size 8', 'size 9', 'colour 7']],
    ['short numbers', ['200', '300', '500', '750']],
];

const knownLimits = [
    ['arithmetic: customer must add two numbers', '9876500000 + 43210 add karo'],
];
let pass = 0, fail = 0;
const out = [];
const show = (ok, label, msg, res) => {
    ok ? pass++ : fail++;
    out.push({ ok, label, msg, res });
};
for (const [label, msg] of attacks) {
    const r = moderateMessage(msg);
    show(r.action === 'BLOCK', `ATTACK ${label}`, msg, r.action + (r.category ? `/${r.category}` : ''));
}
for (const msg of legit) {
    const r = moderateMessage(msg);
    show(r.action === 'ALLOW', 'LEGIT', msg, r.action + (r.category ? `/${r.category}` : ''));
}
for (const [label, parts] of splits) {
    const last = parts[parts.length - 1];
    const single = moderateMessage(last).action;
    const r = single === 'BLOCK' ? { action: 'BLOCK' } : checkMultiMessageEvasion(last, parts.slice(0, -1));
    show(r.action === 'BLOCK', `SPLIT ${label}`, parts.join(' | '), r.action);
}
for (const [label, parts] of legitSplits) {
    const last = parts[parts.length - 1];
    const r = checkMultiMessageEvasion(last, parts.slice(0, -1));
    show(r.action === 'ALLOW', `LEGIT-SPLIT ${label}`, parts.join(' | '), r.action);
}

for (const o of out) console.log(`${o.ok ? '✅' : '❌'} ${o.label.padEnd(34)} ${JSON.stringify(o.msg).slice(0, 60).padEnd(62)} → ${o.res}`);
console.log(`\n${pass} correct, ${fail} wrong (of ${pass + fail})`);
process.exitCode = fail ? 1 : 0;
