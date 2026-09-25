/**
 * Chat Moderation Service
 * ─────────────────────────────────────────────────────────────
 * Context-aware moderation for User ↔ Vendor store chat.
 * Prevents sharing of phone numbers, UPI IDs, bank details,
 * payment links, emails, and external contact platform info.
 *
 * Designed with false-positive prevention as a top priority:
 *   "2 packets", "₹500", "500 gram", "Order #123" → ALLOW
 *   "9876543210 call karo", "abc@ybl"              → BLOCK
 */

// ── Moderation Actions ────────────────────────────────────────
export const MODERATION_ACTION = Object.freeze({
    ALLOW: 'ALLOW',
    BLOCK: 'BLOCK',
    FLAG:  'FLAG',
});

// ── Moderation Categories ─────────────────────────────────────
export const MODERATION_CATEGORY = Object.freeze({
    PHONE_NUMBER:        'PHONE_NUMBER',
    UPI_ID:              'UPI_ID',
    BANK_DETAILS:        'BANK_DETAILS',
    IFSC:                'IFSC',
    PAYMENT_LINK:        'PAYMENT_LINK',
    EMAIL:               'EMAIL',
    EXTERNAL_CONTACT:    'EXTERNAL_CONTACT',
    EXTERNAL_PAYMENT:    'EXTERNAL_PAYMENT',
    EXTERNAL_URL:        'EXTERNAL_URL',
    CARD_DETAILS:        'CARD_DETAILS',
    CREDENTIAL_PHISHING: 'CREDENTIAL_PHISHING',
    SUSPICIOUS:          'SUSPICIOUS',
});

// ── User-safe messages keyed by category ─────────────────────
const USER_MESSAGES = {
    [MODERATION_CATEGORY.PHONE_NUMBER]:        'Message not sent. Sharing phone numbers or personal contact details is strictly prohibited to ensure buyer-seller protection. Please continue all discussions through the platform.',
    [MODERATION_CATEGORY.EMAIL]:               'Message not sent. Contact information cannot be shared in chat. Please continue communication through the platform.',
    [MODERATION_CATEGORY.EXTERNAL_CONTACT]:    'Message not sent. External contact platforms or links cannot be shared in chat. Please continue communication through the platform.',
    [MODERATION_CATEGORY.UPI_ID]:              'Message not sent. External payment details cannot be shared in chat. Please use the platform\'s payment system.',
    [MODERATION_CATEGORY.BANK_DETAILS]:        'Message not sent. External payment details cannot be shared in chat. Please use the platform\'s payment system.',
    [MODERATION_CATEGORY.IFSC]:                'Message not sent. External payment details cannot be shared in chat. Please use the platform\'s payment system.',
    [MODERATION_CATEGORY.PAYMENT_LINK]:        'Message not sent. External payment links cannot be shared in chat. Please use the platform\'s payment system.',
    [MODERATION_CATEGORY.EXTERNAL_PAYMENT]:    'Message not sent. External payment details cannot be shared in chat. Please use the platform\'s payment system.',
    [MODERATION_CATEGORY.EXTERNAL_URL]:        'Message not sent. External links cannot be shared in chat. Please keep all discussions on the platform.',
    [MODERATION_CATEGORY.CARD_DETAILS]:        'Message not sent. Payment card numbers or CVV cannot be shared in chat for your security.',
    [MODERATION_CATEGORY.CREDENTIAL_PHISHING]: 'Message not sent. Requesting or sharing OTPs, passwords, or security codes is strictly prohibited.',
    [MODERATION_CATEGORY.SUSPICIOUS]:          'Message not sent. This content cannot be shared in chat.',
};

// ─────────────────────────────────────────────────────────────
// NORMALIZATION
// ─────────────────────────────────────────────────────────────

// Mapping for English and Hindi spoken digit words to prevent spelled-out bypasses
const WORD_DIGIT_MAP = {
    'zero': '0', 'shunya': '0', 'sunya': '0',
    'one': '1', 'ek': '1',
    'two': '2', 'do': '2',
    'three': '3', 'teen': '3',
    'four': '4', 'char': '4', 'chaar': '4',
    'five': '5', 'panch': '5', 'paanch': '5',
    'six': '6', 'chhe': '6', 'che': '6', 'chhah': '6',
    'seven': '7', 'saat': '7', 'sat': '7',
    'eight': '8', 'aath': '8', 'ath': '8',
    'nine': '9', 'nau': '9',
};

function convertSpelledOutDigits(text) {
    const tokens = text.split(/[\s,._\-]+/);
    let digitWordCount = 0;
    for (const t of tokens) {
        if (WORD_DIGIT_MAP[t.toLowerCase()] || /^\d+$/.test(t)) {
            digitWordCount++;
        }
    }
    // If user has spelled out 7 or more digits, convert to numeric string for evaluation
    if (digitWordCount >= 7) {
        return tokens.map(t => WORD_DIGIT_MAP[t.toLowerCase()] || t).join(' ');
    }
    return text;
}

/**
 * Normalize text for detection:
 * - Lowercase
 * - Normalize unicode (NFKC)
 * - Convert (at) / [at] obfuscation
 * - Convert 'o'/'O' surrounded by digits to '0'
 * - Collapse zero-width chars
 */
export function normalizeText(text) {
    if (typeof text !== 'string') return '';
    let norm = text
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\u200b|\u200c|\u200d|\ufeff/g, '') // zero-width chars
        .replace(/\(at\)|\[at\]|\bat\b(?=\s*\w+\s*\.\s*\w)/gi, '@') // (at) → @
        .replace(/\(dot\)|\[dot\]/gi, '.'); // (dot) → .

    // Replace letter 'o' between digits (e.g. "98765o4321" -> "9876504321")
    norm = norm.replace(/(\d)[oO](\d)/g, '$10$2');
    return norm;
}

/**
 * Strip separators (spaces, dashes, dots, commas, slashes) between digits.
 * Used specifically for phone-number detection.
 * Example: "98765 43210" → "9876543210"
 * Example: "9 8 7 6 5 4 3 2 1 0" → "9876543210"
 */
function collapseDigitSeparators(text) {
    const chars = new Set([' ', '\t', '\n', '\r', '-', '_', '.', ',', '/', '\\', '|', '*', '~', '(', ')', '+', '=', ':', ';', '!', '#']);
    let res = '';
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (chars.has(c)) {
            let prevIsDigit = false;
            for (let j = res.length - 1; j >= 0; j--) {
                if (/\d/.test(res[j])) { prevIsDigit = true; break; }
                if (!chars.has(res[j])) break;
            }
            let nextIsDigit = false;
            for (let k = i + 1; k < text.length; k++) {
                if (/\d/.test(text[k])) { nextIsDigit = true; break; }
                if (!chars.has(text[k])) break;
            }
            if (prevIsDigit && nextIsDigit) {
                continue; // strip separator between adjacent digits
            }
        }
        res += c;
    }
    return res;
}

// ─────────────────────────────────────────────────────────────
// PHONE NUMBER DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Context indicators that a number is a genuine product attribute (price, quantity, weight, dimensions).
 * Note: 'no.' or 'number' is strictly excluded from whitelist to prevent bypasses like 'my no 9876543210'.
 */
const PRODUCT_CONTEXT_BEFORE = /(?:₹|rs\.?|inr|usd|\$|qty|quantity|kg|gram|gm|litre|ltr|ml|piece|pcs|pack|packet|set|box|boxes|unit|units|pincode|pin\s*code|discount)\s*$/i;
const PRODUCT_CONTEXT_AFTER  = /^\s*(?:kg|gram|gm|litre|ltr|ml|piece|pcs|pack|packet|set|box|boxes|unit|units|%|rs\.?|₹|inr|days|day|hours|hrs)/i;
const CONTACT_CONTEXT_BEFORE = /(?:phone|ph|mob|mobile|contact|call|whatsapp|wa|cell|telephone|msg|sms|dm|dial|number|mera\s*no|apna\s*no|no\.?|num\.?)\s*:?\s*$/i;

/**
 * Detects Indian mobile numbers, landline numbers & formatted contact numbers:
 * - 10 digits starting with 6-9
 * - Optional +91 / 91 / 0 prefix
 * - Spelled out numbers (nine eight seven six five four three two one zero)
 * - Handles spaces, dashes, commas, slashes between digits
 * - Distinguishes between contact numbers and product quantities/prices
 */
export function detectPhoneNumber(text) {
    let norm = normalizeText(text);
    // Also test spelled-out digits if present
    norm = convertSpelledOutDigits(norm);
    const collapsed = collapseDigitSeparators(norm);

    // Pattern: optional (+91 or 91 or 0) + 10 digits starting with [6-9]
    const phonePattern = /(?:(?:\+91|91|0))?([6-9]\d{9})(?!\d)/g;

    let match;
    while ((match = phonePattern.exec(collapsed)) !== null) {
        const fullMatch = match[0];
        const digitSeq = match[1];
        const matchStart = match.index;
        const matchEnd   = match.index + fullMatch.length;

        const before = collapsed.slice(0, matchStart).trim();
        const after  = collapsed.slice(matchEnd).trim();

        // 1. If preceded by an explicit contact keyword (e.g., 'call', 'ph no:', 'whatsapp'), always block
        if (CONTACT_CONTEXT_BEFORE.test(before)) {
            return true;
        }

        // 2. Skip if surrounded by genuine product-context tokens (e.g. ₹9876543210 or 9876543210 pcs)
        if (PRODUCT_CONTEXT_BEFORE.test(before)) continue;
        if (PRODUCT_CONTEXT_AFTER.test(after))  continue;

        // 3. Skip if this is inside an order/hash identifier context
        if (/[#\/]/.test(before.slice(-2))) continue;

        // 4. Valid standalone 10-digit mobile number
        if (digitSeq.length === 10) {
            return true;
        }
    }

    // 5. Landline / STD code pattern: 0 + 2-4 digit STD code + 6-8 digit number (e.g. 011-23456789)
    const landlinePattern = /\b(0[1-9]\d{1,3}\d{6,8})\b/g;
    let landlineMatch;
    while ((landlineMatch = landlinePattern.exec(collapsed)) !== null) {
        const matchStart = landlineMatch.index;
        const before = collapsed.slice(0, matchStart).trim();
        if (PRODUCT_CONTEXT_BEFORE.test(before)) continue;
        return true;
    }

    return false;
}

// ─────────────────────────────────────────────────────────────
// UPI ID DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Known UPI handle suffixes used by major providers.
 * This list is the authoritative set — detect only these to avoid
 * false positives from arbitrary @ usage.
 */
const UPI_HANDLES = [
    'ybl', 'paytm', 'ptyes', 'okaxis', 'oksbi', 'okhdfcbank', 'okicici',
    'ibl', 'upi', 'apl', 'waaxis', 'fbl', 'axl', 'hdfcbank', 'sbi',
    'icici', 'barodampay', 'axisbank', 'kotak', 'indus', 'rbl',
    'pnb', 'centralbank', 'cbi', 'ubi', 'unionbank', 'idbi', 'federal',
    'mahb', 'jkb', 'aubank', 'abfspay', 'tapicici', 'jupiteraxis',
    'sliceaxis', 'icicibank', 'hsbc', 'sc', 'yesbank',
];

const UPI_HANDLE_REGEX = new RegExp(
    `[a-z0-9._\\-]{1,50}@(?:${UPI_HANDLES.join('|')})\\b`,
    'i'
);

/**
 * Detects UPI IDs (e.g., "abc@ybl", "name@okaxis").
 * Handles obfuscation: "abc @ ybl", "abc(at)ybl"
 */
export function detectUPI(text) {
    const norm = normalizeText(text);
    // Also check collapsed form (e.g., "abc @ ybl" → "abc@ybl")
    const noSpaceAroundAt = norm.replace(/\s*@\s*/g, '@');
    return UPI_HANDLE_REGEX.test(noSpaceAroundAt);
}

// ─────────────────────────────────────────────────────────────
// BANK DETAILS DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * IFSC code pattern: 4 alpha + 0 + 6 alphanumeric
 * Example: HDFC0001234, SBIN0000001
 */
const IFSC_PATTERN = /\b[A-Z]{4}0[A-Z0-9]{6}\b/i;

/**
 * Bank account number: 9-18 digit standalone number
 * Only flagged when combined with banking keywords nearby.
 */
const BANK_ACCOUNT_PATTERN = /\b\d{9,18}\b/;

const BANK_KEYWORDS = /\b(?:account|acc|bank\s*account|a\/c|ifsc|neft|rtgs|imps|beneficiary|routing|sort\s*code)\b/i;

/**
 * Detects high-confidence bank details:
 * - IFSC code alone → BLOCK
 * - Long number + banking keyword nearby → BLOCK
 */
export function detectBankDetails(text) {
    const norm = normalizeText(text);
    if (IFSC_PATTERN.test(norm)) return { found: true, category: MODERATION_CATEGORY.IFSC };
    if (BANK_ACCOUNT_PATTERN.test(norm) && BANK_KEYWORDS.test(norm)) {
        return { found: true, category: MODERATION_CATEGORY.BANK_DETAILS };
    }
    return { found: false };
}

// ─────────────────────────────────────────────────────────────
// PAYMENT LINK DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Detects external payment links.
 * - upi:// deep links
 * - Known payment gateway URLs
 * - Generic payment/checkout URLs from non-platform domains
 */
const PAYMENT_LINK_PATTERNS = [
    /upi:\/\//i,
    /pay\.google\.com/i,
    /paytm\.com\/pay/i,
    /phonepay\.com|phonepe\.com/i,
    /bhimupi\.org\.in/i,
    /rzp\.io\//i,         // Razorpay short links
    /instamojo\.com/i,
    /easebuzz\.in/i,
    /cashfree\.com/i,
    /payumoney\.com/i,
    /\/payment\?|\/pay\?|\/checkout\?/i,
];

export function detectPaymentLink(text) {
    const norm = normalizeText(text);
    return PAYMENT_LINK_PATTERNS.some(p => p.test(norm));
}

// ─────────────────────────────────────────────────────────────
// EMAIL DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Standard email pattern.
 * Handles obfuscated "abc (at) gmail.com" form via normalizeText.
 */
const EMAIL_PATTERN = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;

export function detectEmail(text) {
    const norm = normalizeText(text);
    const noSpaceAroundAt = norm.replace(/\s*@\s*/g, '@');
    return EMAIL_PATTERN.test(noSpaceAroundAt);
}

// ─────────────────────────────────────────────────────────────
// EXTERNAL CONTACT PLATFORM DETECTION (Context-Aware)
// ─────────────────────────────────────────────────────────────

/**
 * Contact platform keywords.
 * We require BOTH a platform keyword AND an action/contact phrase
 * to avoid blocking innocent mentions like "what is WhatsApp?"
 */
const CONTACT_PLATFORM_KEYWORDS = [
    'whatsapp', 'whats app', 'w h a t s a p p', 'watsapp',
    'telegram', 't e l e g r a m',
    'signal',
    'instagram', 'insta',
    'facebook', 'fb',
    'snapchat',
    'skype',
    'viber',
];

/**
 * Action phrases indicating intent to move off-platform.
 * Bilingual (Hindi / English) patterns.
 */
const CONTACT_ACTION_PHRASES = [
    /\bpar\s+(?:baat|contact|message|msg|chat|call|text|ping|dm)\b/i,
    /\bpe\s+(?:baat|contact|message|msg|chat|call|text|ping|dm)\b/i,
    /\bpar\s+(?:aao|aana|aajao|milte\s+hain)\b/i,
    /\bcontact\s+(?:karo|karna|kijiye|kare)\b/i,
    /\bmessage\s+(?:karo|karna|kijiye)\b/i,
    /\bcall\s+(?:karo|karna|kijiye|me|kar)\b/i,
    /\bme\s+(?:add|dm|message|call)\b/i,
    /\b(?:add|dm|message|contact|reach|text)\s+me\b/i,
    /\bmujhe\s+(?:call|message|contact)\b/i,
    /\bnumber\s+(?:do|dena|dijiye|bhejo|send)\b/i,
    /\bpe\s+milte\b/i,
    /\bpar\s+aao\b/i,
    /\bchat\s+(?:karte|karo|karna)\b/i,
    /\bconnect\s+(?:on|karo|karna)\b/i,
    /\b(?:shift|move|continue)\s+(?:to|on|par)\b/i,
    /\bbahar\s+(?:baat|contact)\b/i,
];

const RAW_CONTACT_LINK_PATTERNS = [
    /wa\.me\//i,
    /api\.whatsapp\.com/i,
    /chat\.whatsapp\.com/i,
    /t\.me\//i,
    /telegram\.me\//i,
    /telegram\.dog\//i,
    /(?:instagram\.com|instagr\.am)\//i,
    /ig\.me\//i,
    /(?:facebook\.com|fb\.me|m\.me)\//i,
    /(?:discord\.gg|discord\.com\/invite)\//i,
    /signal\.me\//i,
    /snapchat\.com\/add\//i,
];

export function detectExternalContact(text) {
    const norm = normalizeText(text);

    // 1. Direct raw contact platform URLs (e.g. wa.me/91..., t.me/...) — always block
    if (RAW_CONTACT_LINK_PATTERNS.some(p => p.test(norm))) {
        return true;
    }

    const hasPlatformKeyword = CONTACT_PLATFORM_KEYWORDS.some(kw => norm.includes(kw));
    if (!hasPlatformKeyword) return false;

    // Require an action phrase too (context-aware)
    const hasActionPhrase = CONTACT_ACTION_PHRASES.some(p => p.test(norm));
    return hasActionPhrase;
}

// ─────────────────────────────────────────────────────────────
// EXTERNAL PAYMENT METHOD DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Payment app keywords.
 */
const PAYMENT_APP_KEYWORDS = [
    'phonepay', 'phonepe', 'phone pe',
    'google pay', 'gpay', 'googlepay',
    'paytm',
    'bhim', 'bhim upi',
    'amazon pay', 'amazonpay',
];

/**
 * Direct payment action phrases (bilingual).
 */
const PAYMENT_ACTION_PHRASES = [
    /\b(?:direct\s+)?upi\s+(?:kar\s*do|karo|karna|bhej|send|pay|payment)\b/i,
    /\b(?:kar\s+do|karo|karna|bhej\s*do|bhejna|send|transfer|pay)\b.{0,30}\b(?:account|upi|bank|neft|rtgs|imps)\b/i,
    /\bbank\s+transfer\s+(?:kar|karo|karna|kijiye|do)\b/i,
    /\bdirect\s+payment\b/i,
    /\bplatform\s+ke\s+bahar\b/i,
    /\bbahar\s+(?:payment|pay)\b/i,
    /\bcash\s+(?:de\s*do|dena|dijiye|bhejo)\b/i,
    /\bpayment\s+(?:kar\s*do|karo|karna|bhej|bhejo)\b/i,
    /\bpaise\s+(?:bhej\s*do|bhejna|bhejo|transfer|de\s*do)\b/i,
    /\bmere\s+(?:account|upi)\s+mein\b/i,
    /\bqr\s+(?:scan|code)\s+(?:kar|karke)\b/i,
    /\bscan\s+(?:and|&|karke)\s+pay\b/i,
];

export function detectExternalPayment(text) {
    const norm = normalizeText(text);

    const hasPaymentApp = PAYMENT_APP_KEYWORDS.some(kw => norm.includes(kw));
    const hasPaymentAction = PAYMENT_ACTION_PHRASES.some(p => p.test(norm));

    // Either: payment app + action, or standalone off-platform payment action
    if (hasPaymentApp && hasPaymentAction) return true;
    if (!hasPaymentApp && hasPaymentAction) return true; // e.g. "direct UPI kar do"
    if (hasPaymentApp) {
        // Payment app mentioned alone — FLAG (lower confidence), not BLOCK
        // e.g., "PhonePe kya hai?" should not necessarily block
        // But "PhonePe par payment" → combined intent
        if (/\bpar\s+payment\b|\bse\s+pay\b|\bwala\s+payment\b|\bpe\s+(?:pay|payment|bhej)\b/i.test(norm)) return true;
    }

    return false;
}

// ─────────────────────────────────────────────────────────────
// EXTERNAL URL DETECTION (With Platform Allowlist)
// ─────────────────────────────────────────────────────────────

// Platform allowed domains/hosts (case-insensitive)
const ALLOWED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    'ple.com',
    'b2b.ple.com',
    'admin.ple.com',
    'shop.ple.com',
    'api.ple.com',
];

const GENERIC_URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*/gi;
const URL_SHORTENERS = /\b(?:bit\.ly|tinyurl\.com|cutt\.ly|goo\.gl|t\.co|ow\.ly|is\.gd|buff\.ly|rebrand\.ly)\b/i;

export function detectExternalURL(text) {
    const norm = normalizeText(text);

    if (URL_SHORTENERS.test(norm)) {
        return true;
    }

    const matches = norm.match(GENERIC_URL_PATTERN);
    if (!matches || matches.length === 0) return false;

    for (const rawUrl of matches) {
        let domain = '';
        try {
            const urlToParse = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
                ? rawUrl
                : `http://${rawUrl}`;
            const parsed = new URL(urlToParse);
            domain = parsed.hostname.toLowerCase();
        } catch {
            // If it couldn't parse cleanly, extract host manually
            const hostMatch = rawUrl.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].toLowerCase();
            domain = hostMatch;
        }

        // Check against allowlist
        const isAllowed = ALLOWED_DOMAINS.some(allowed => 
            domain === allowed || domain.endsWith(`.${allowed}`)
        );

        if (!isAllowed) {
            return true;
        }
    }

    return false;
}

// ─────────────────────────────────────────────────────────────
// PAYMENT CARD & CVV DETECTION
// ─────────────────────────────────────────────────────────────

// 16-digit card sequences (Visa, Mastercard, RuPay, etc.) or 15-digit Amex
const CARD_16_DIGIT = /\b(?:\d{4}[ -]?){3}\d{4}\b/;
const CARD_15_DIGIT = /\b3[47]\d{2}[ -]?\d{6}[ -]?\d{5}\b/;
const CVV_PATTERN = /\b(?:cvv|cvv2|cvc|security\s*code|card\s*pin|security\s*pin)\s*[:=]?\s*\d{3,4}\b/i;
const CARD_CONTEXT_KEYWORDS = /\b(?:card|debit|credit|visa|mastercard|rupay|amex|expiry|exp|valid\s*thru)\b/i;

export function detectCardDetails(text) {
    const norm = normalizeText(text);

    // CVV query or statement
    if (CVV_PATTERN.test(norm)) {
        return true;
    }

    // Explicit card format with spaces or hyphens: "1234 5678 9012 3456"
    if (/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/.test(text)) {
        return true;
    }

    // Check 16 or 15 digit sequences
    if (CARD_16_DIGIT.test(norm) || CARD_15_DIGIT.test(norm)) {
        // If accompanied by card keywords or not an innocent order/tracking context
        if (CARD_CONTEXT_KEYWORDS.test(norm)) {
            return true;
        }
        // If standalone long digit sequence without product unit context
        if (!/(?:order|tracking|awb|id|item|sku|#)\s*[:=]?\s*\d{15,16}/i.test(norm)) {
            // Check card BIN prefixes (Visa: 4, MC: 51-55 or 22-27, RuPay: 60, 65, 81, 82)
            const cleanDigits = norm.replace(/\D/g, '');
            if (/^(?:4\d{15}|5[1-5]\d{14}|2(?:2[2-9]\d{13}|[3-6]\d{14}|7[0-1]\d{13}|720\d{12})|60\d{14}|65\d{14}|81\d{14}|82\d{14}|3[47]\d{13})$/.test(cleanDigits)) {
                return true;
            }
        }
    }

    return false;
}

// ─────────────────────────────────────────────────────────────
// OTP & CREDENTIAL PHISHING DETECTION
// ─────────────────────────────────────────────────────────────

const OTP_PHISHING_PATTERNS = [
    // English
    /\b(?:send|share|tell|give|forward|provide|enter|drop|type)\b.{0,25}\b(?:otp|one\s*time\s*password|verification\s*code|auth\s*code|secret\s*code)\b/i,
    /\b(?:otp|verification\s*code)\b.{0,25}\b(?:send|share|tell|give|forward|please|fast|now)\b/i,
    // Hinglish
    /\b(?:otp|code)\b.{0,25}\b(?:bhejo|bhejna|batao|batana|bhej\s*do|de\s*do|share\s*karo|send\s*karo|do)\b/i,
    /\b(?:batao|batana|bhejo|bhejna|de\s*do)\b.{0,25}\b(?:otp|code)\b/i,
    // Password, PIN & Login credentials
    /\b(?:send|share|tell|give|provide)\b.{0,25}\b(?:password|passwd|login\s*details|account\s*credentials|credentials|atm\s*pin|upi\s*pin|pin)\b/i,
    /\b(?:password|credentials|login\s*id|atm\s*pin|upi\s*pin|secret\s*pin|pin)\b.{0,25}\b(?:bhejo|bhejna|batao|batana|de\s*do|share\s*karo|send\s*karo|do)\b/i,
    /\b(?:apna\s*(?:secret\s*)?(?:password|pin)|login\s*password|account\s*ka\s*password)\b/i,
];

export function detectCredentialPhishing(text) {
    const norm = normalizeText(text);
    return OTP_PHISHING_PATTERNS.some(p => p.test(norm));
}

// ─────────────────────────────────────────────────────────────
// MULTI-MESSAGE EVASION CHECK
// ─────────────────────────────────────────────────────────────

/**
 * Checks if combining the current message with recent messages from the
 * same sender exposes split contact details (e.g. "98765" + "43210").
 *
 * @param {string} currentText — latest message
 * @param {Array<string>} recentMessages — recent messages sent by this user within last 90s
 * @returns {{ action: string, category: string|null, reason: string, userMessage: string }}
 */
export function checkMultiMessageEvasion(currentText, recentMessages = []) {
    if (!recentMessages || recentMessages.length === 0) {
        return { action: MODERATION_ACTION.ALLOW, category: null, reason: 'none', userMessage: '' };
    }

    const messages = recentMessages.filter(m => typeof m === 'string' && m.trim().length > 0);
    if (messages.length === 0) {
        return { action: MODERATION_ACTION.ALLOW, category: null, reason: 'none', userMessage: '' };
    }

    // Evaluate combination of recent messages + current message
    const combined = messages.slice(-2).concat(currentText).join(' ');
    const combinedTight = messages.slice(-2).concat(currentText).join('');

    // Check phone number on combined
    if (detectPhoneNumber(combined) || detectPhoneNumber(combinedTight)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.PHONE_NUMBER,
            reason:      'Split phone number detected across messages',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.PHONE_NUMBER],
        };
    }

    // Check email on combined
    if (detectEmail(combined) || detectEmail(combinedTight)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.EMAIL,
            reason:      'Split email address detected across messages',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.EMAIL],
        };
    }

    // Check UPI on combined
    if (detectUPI(combined) || detectUPI(combinedTight)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.UPI_ID,
            reason:      'Split UPI handle detected across messages',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.UPI_ID],
        };
    }

    return { action: MODERATION_ACTION.ALLOW, category: null, reason: 'ok', userMessage: '' };
}

// ─────────────────────────────────────────────────────────────
// MONETARY PROPOSAL VALIDATION
// ─────────────────────────────────────────────────────────────

/**
 * Validates RFQ and chat monetary proposals.
 * Ensures the value is a genuine finite currency amount within bounds
 * and rejects disguised phone numbers (e.g., 9876543210).
 *
 * @param {number|string} offer — proposed amount
 * @returns {{ isValid: boolean, reason?: string }}
 */
export function validateMonetaryOffer(offer) {
    if (offer === undefined || offer === null || offer === '') {
        return { isValid: false, reason: 'Offer price is required.' };
    }

    const num = Number(offer);
    if (!Number.isFinite(num) || isNaN(num)) {
        return { isValid: false, reason: 'Offer price must be a valid number.' };
    }

    if (num <= 0) {
        return { isValid: false, reason: 'Offer price must be greater than zero.' };
    }

    if (num > 100000000) { // Max ₹10 Crore
        return { isValid: false, reason: 'Offer price exceeds maximum permitted limit (₹10 Crore).' };
    }

    // Check if integer representation matches an Indian 10-digit mobile number
    const intStr = String(Math.floor(num));
    if (intStr.length === 10 && /^[6-9]\d{9}$/.test(intStr)) {
        return {
            isValid: false,
            reason: 'Offer amount appears to be a telephone number or invalid value.',
        };
    }

    // If submitted as string, check for suspicious embedded text
    if (typeof offer === 'string') {
        const norm = normalizeText(offer);
        if (detectEmail(norm) || detectUPI(norm) || detectPaymentLink(norm) || detectExternalContact(norm)) {
            return {
                isValid: false,
                reason: 'Offer contains prohibited contact or payment details.',
            };
        }
    }

    return { isValid: true };
}

// ─────────────────────────────────────────────────────────────
// MAIN MODERATION FUNCTION
// ─────────────────────────────────────────────────────────────

/**
 * Runs all detectors in priority order.
 * Returns a moderation result object.
 *
 * @param {string} text — raw message text
 * @returns {{ action: string, category: string|null, reason: string, userMessage: string }}
 */
export function moderateMessage(text) {
    if (!text || typeof text !== 'string') {
        return { action: MODERATION_ACTION.ALLOW, category: null, reason: 'empty', userMessage: '' };
    }

    // 1. Payment Link — always BLOCK
    if (detectPaymentLink(text)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.PAYMENT_LINK,
            reason:      'External payment link detected',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.PAYMENT_LINK],
        };
    }

    // 2. UPI ID — high confidence, always BLOCK
    if (detectUPI(text)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.UPI_ID,
            reason:      'UPI ID detected in message',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.UPI_ID],
        };
    }

    // 3. Email — BLOCK
    if (detectEmail(text)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.EMAIL,
            reason:      'Email address detected in message',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.EMAIL],
        };
    }

    // 4. Bank Details — BLOCK
    const bankResult = detectBankDetails(text);
    if (bankResult.found) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    bankResult.category,
            reason:      'Bank/payment details detected in message',
            userMessage: USER_MESSAGES[bankResult.category],
        };
    }

    // 5. Payment Card & CVV Details — BLOCK
    if (detectCardDetails(text)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.CARD_DETAILS,
            reason:      'Payment card details or CVV detected in message',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.CARD_DETAILS],
        };
    }

    // 6. OTP & Credential Phishing — BLOCK
    if (detectCredentialPhishing(text)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.CREDENTIAL_PHISHING,
            reason:      'OTP or credential phishing detected in message',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.CREDENTIAL_PHISHING],
        };
    }

    // 7. Phone Number — BLOCK (context-aware)
    if (detectPhoneNumber(text)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.PHONE_NUMBER,
            reason:      'Phone number detected in message',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.PHONE_NUMBER],
        };
    }

    // 8. External Payment Methods — BLOCK
    if (detectExternalPayment(text)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.EXTERNAL_PAYMENT,
            reason:      'External payment instruction detected',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.EXTERNAL_PAYMENT],
        };
    }

    // 9. External Contact Platforms & Raw Contact Links — BLOCK
    if (detectExternalContact(text)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.EXTERNAL_CONTACT,
            reason:      'External contact platform or link detected',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.EXTERNAL_CONTACT],
        };
    }

    // 10. Generic External URLs — BLOCK (whitelisting internal platform domains)
    if (detectExternalURL(text)) {
        return {
            action:      MODERATION_ACTION.BLOCK,
            category:    MODERATION_CATEGORY.EXTERNAL_URL,
            reason:      'External URL detected in message',
            userMessage: USER_MESSAGES[MODERATION_CATEGORY.EXTERNAL_URL],
        };
    }

    // All clear
    return {
        action:      MODERATION_ACTION.ALLOW,
        category:    null,
        reason:      'No prohibited content detected',
        userMessage: '',
    };
}
