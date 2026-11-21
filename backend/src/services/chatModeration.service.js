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

// ── Spoken digit words (English, Hinglish, Devanagari) ─────────
// Longest words first so greedy segmentation of run-together words ("nineeight") works.
const DIGIT_WORDS = [
    ['shunya', '0'], ['sunya', '0'], ['sifar', '0'], ['zero', '0'], ['शून्य', '0'], ['जीरो', '0'],
    ['three', '3'], ['seven', '7'], ['eight', '8'], ['paanch', '5'], ['chaar', '4'], ['chhah', '6'],
    ['four', '4'], ['five', '5'], ['nine', '9'], ['panch', '5'], ['teen', '3'], ['saat', '7'], ['aath', '8'],
    ['chhe', '6'], ['one', '1'], ['two', '2'], ['six', '6'], ['char', '4'], ['nau', '9'], ['che', '6'],
    ['sat', '7'], ['ath', '8'], ['ek', '1'], ['do', '2'], ['oh', '0'],
    ['पाँच', '5'], ['पांच', '5'], ['तीन', '3'], ['चार', '4'], ['सात', '7'], ['आठ', '8'], ['छह', '6'], ['छः', '6'], ['छे', '6'],
    ['एक', '1'], ['दो', '2'], ['नौ', '9'],
].sort((a, b) => b[0].length - a[0].length);

const TEEN_WORDS = { ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19' };
const TENS_WORDS = { twenty: '2', thirty: '3', forty: '4', fourty: '4', fifty: '5', sixty: '6', seventy: '7', eighty: '8', ninety: '9' };

const DOUBLE_WORDS = new Set(['double', 'dubble', 'dabal', 'डबल']);
const TRIPLE_WORDS = new Set(['triple', 'tripple', 'ट्रिपल']);

function segmentDigitWords(token) {
    const memo = new Map();
    const go = (i) => {
        if (i === token.length) return '';
        if (memo.has(i)) return memo.get(i);
        let res = null;
        for (const [word, digit] of DIGIT_WORDS) {
            if (token.startsWith(word, i)) {
                const rest = go(i + word.length);
                if (rest !== null) { res = digit + rest; break; }
            }
        }
        memo.set(i, res);
        return res;
    };
    return go(0);
}

/**
 * Detection-only view: turns spoken digits into numerals.
 *   "nine eight seven…" / "nau aath saat…" / "नौ आठ सात…" / "nineeightseven…" / "double nine eight…"
 * The converted text is never stored or shown, only inspected.
 */
function spelledToDigits(text) {
    const converted = text.replace(/[\p{L}\p{M}]+/gu, (tok) => {
        if (tok.length > 60) return tok;
        if (DOUBLE_WORDS.has(tok)) return '\u0001';
        if (TRIPLE_WORDS.has(tok)) return '\u0002';
        if (TEEN_WORDS[tok]) return TEEN_WORDS[tok];
        if (TENS_WORDS[tok]) return '\u0003' + TENS_WORDS[tok];
        const digits = segmentDigitWords(tok);
        return digits === null ? tok : digits;
    });
    return converted
        .replace(/\u0001\s*(\d)/g, '$1$1')
        .replace(/\u0002\s*(\d)/g, '$1$1$1')
        .replace(/\u0003(\d)\s*([1-9])(?!\d)/g, '$1$2') // "ninety eight" -> 98
        .replace(/\u0003(\d)/g, '$10')                    // "ninety" -> 90
        .replace(/[\u0001\u0002\u0003]/g, '');
}

// Letters people use in place of digits: 98765432l0, 987654321o
function leetDigits(text) {
    return text
        .replace(/(?<=\d)o|o(?=\d)/g, '0')
        .replace(/(?<=\d)[li|]|[li|](?=\d)/g, '1');
}

// Unicode and special digit mappings (Hindi numerals, circled numbers, etc.)
const UNICODE_DIGIT_MAP = {
    // Hindi / Devanagari numerals
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
    // Circled numbers
    '⓪': '0', '①': '1', '②': '2', '③': '3', '④': '4',
    '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9',
    '⑴': '1', '⑵': '2', '⑶': '3', '⑷': '4', '⑸': '5',
    '⑹': '6', '⑺': '7', '⑻': '8', '⑼': '9',
    '⒈': '1', '⒉': '2', '⒊': '3', '⒋': '4', '⒌': '5',
    '⒍': '6', '⒎': '7', '⒏': '8', '⒐': '9',
    // Fullwidth digits (also handled by NFKC)
    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
};

// Every Unicode "decimal digit" (Arabic-Indic, Bengali, Gujarati, Tamil, Thai, bold/double-struck math digits…)
// → ASCII 0-9. Digit sets are contiguous runs of 10 starting at zero.
const ND_DIGITS = (() => {
    const map = new Map();
    let prev = -2, idx = 0;
    for (let cp = 0x30; cp <= 0x1FBFF; cp++) {
        if (!/\p{Nd}/u.test(String.fromCodePoint(cp))) continue;
        idx = cp === prev + 1 ? (idx + 1) % 10 : 0;
        map.set(cp, String(idx));
        prev = cp;
    }
    return map;
})();

// Invisible / formatting characters that attackers hide inside numbers
// (zero-width, soft hyphen, word joiner, variation selectors, keycap enclosing mark, filler chars)
const INVISIBLE_RE = /[\p{Cf}\u00ad\u034f\u115f\u1160\u17b4\u17b5\u180b-\u180e\ufe00-\ufe0f\u20e3\u3164\uffa0]/gu;

/**
 * Normalize text for detection:
 * - Lowercase, NFKC (fullwidth, bold, superscript, circled → plain)
 * - Strip invisible characters
 * - Map digits of every script to ASCII
 * - Convert (at) / [at] / " at " / "at the rate" and (dot) obfuscation
 * - Convert 'o'/'O' surrounded by digits to '0'
 */
export function normalizeText(text) {
    if (typeof text !== 'string') return '';
    let norm = text
        .normalize('NFKC')
        .toLowerCase()
        .replace(INVISIBLE_RE, '');

    norm = norm.replace(/\p{Nd}/gu, (ch) => ND_DIGITS.get(ch.codePointAt(0)) ?? ch);
    norm = norm.replace(/[\u0966-\u096F\u2460-\u2468\u24EA\u2474-\u247C\uFF10-\uFF19]/g, (ch) => UNICODE_DIGIT_MAP[ch] || ch);

    // "at the rate" / "attherate" are spoken forms of '@'
    norm = norm.replace(/\bat\s*the\s*rate(?:\s*of)?\b|\battherate\b|\bat\s*rate\b/gi, '@');

    norm = norm
        .replace(/\(at\)|\[at\]|\{at\}|\bat\b(?=\s*\w+[\s.]+\w+)/gi, '@')
        .replace(/\(dot\)|\[dot\]|\{dot\}|\bdot\b(?=\s*\w+)/gi, '.');

    norm = norm.replace(/(\d)[oO](\d)/g, '$10$2');
    return norm;
}

// ─────────────────────────────────────────────────────────────
// PHONE NUMBER DETECTION
// ─────────────────────────────────────────────────────────────

// Platform order ids look like ORD-1763312345678-AB12 – long, but never a phone number.
const ORDER_ID_RE = /\bord-\d{13}-[a-z0-9]{4}\b/gi;
// Plain calendar dates / clock times are not phone numbers either.
const DATE_RE = /\b(?:0?[1-9]|[12]\d|3[01])[\/\-.](?:0?[1-9]|1[0-2])[\/\-.](?:20\d{2}|\d{2})\b/g;
const TIME_RE = /\b(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/g;

// Context hints used only by the fragmented-digit-stream check across messages.
const PRODUCT_CONTEXT_BEFORE = /(?:₹|rs\.?|inr|usd|\$|qty|quantity|kg|gram|gm|litre|ltr|ml|piece|pcs|pack|packet|set|box|boxes|unit|units|pincode|pin\s*code|discount)\s*$/i;
const PRODUCT_CONTEXT_AFTER  = /^\s*(?:kg|gram|gm|litre|ltr|ml|piece|pcs|pack|packet|set|box|boxes|unit|units|%|rs\.?|₹|inr|days|day|hours|hrs)/i;
const CONTACT_CONTEXT_BEFORE = /(?:phone|ph|mob|mobile|contact|call|whatsapp|wa|cell|telephone|msg|sms|dm|dial|number|mera\s*no|apna\s*no|no\.?|num\.?)\s*:?\s*$/i;

// Words people put between digit groups to dodge filters: "98 and 76 and 54…", "first part 98765 / second part 43210"
const FILLER_WORDS = new Set([
    'and', 'aur', 'then', 'phir', 'plus', 'dash', 'space', 'hyphen', 'comma', 'dot', 'point', 'next',
    'part', 'first', 'second', 'last', 'rest', 'baaki', 'pehle', 'remaining', 'digits', 'digit',
    'number', 'ok', 'okay', 'the', 'are', 'is', 'my', 'of', 'hai', 'hain', 'ya', 'or', 'followed', 'by',
]);

function isLinkingGap(gap) {
    if (gap.length > 40) return false;
    if (!/[\p{L}\p{M}]/u.test(gap)) return true; // only spaces / punctuation / symbols / emoji / currency signs
    const words = gap.split(/[^\p{L}\p{M}]+/u).filter(Boolean);
    return words.length <= 5 && words.every((w) => FILLER_WORDS.has(w));
}

/**
 * Detection view of a message: all digit scripts → ASCII, spoken digits → numerals,
 * letter-for-digit tricks resolved, known-harmless ids/dates/times removed.
 */
function buildDigitView(text) {
    let v = normalizeText(text);
    v = v.replace(ORDER_ID_RE, ' ').replace(DATE_RE, ' ').replace(TIME_RE, ' ');
    return leetDigits(spelledToDigits(v));
}

/** Runs of digits joined across separators/filler words: "98 and 76-54 • 32 10" → "9876543210". */
function digitChains(view) {
    const groups = [...view.matchAll(/\d+/g)];
    const chains = [];
    let cur = null;
    for (const g of groups) {
        if (cur && isLinkingGap(view.slice(cur.end, g.index))) {
            cur.digits += g[0];
            cur.end = g.index + g[0].length;
            continue;
        }
        if (cur) chains.push(cur.digits);
        cur = { digits: g[0], end: g.index + g[0].length };
    }
    if (cur) chains.push(cur.digits);
    return chains;
}

/**
 * Detects Indian mobile numbers & landlines however they are written:
 * - any separators / emoji / invisible characters / filler words between digits
 * - digits of any script, spoken digits (English / Hindi / Devanagari), "double nine"
 * - written as a price, quantity, pincode, "order #…" – a 10-digit mobile is NEVER a legitimate
 *   amount (it would be >= Rs 600 crore), so context no longer exempts it.
 * Normal prices (Rs 200, Rs 1,49,999), quantities, dates and platform order ids are not affected.
 */
export function detectPhoneNumber(text) {
    const view = buildDigitView(text);

    for (const chain of digitChains(view)) {
        // 10-digit mobile (optionally prefixed by 91 / 0 / +91)
        if (chain.length >= 10 && /[6-9]\d{9}$/.test(chain)) return true;
        // Landline: 0 + STD code + number
        if (/^0[1-9]\d{8,11}$/.test(chain)) return true;
    }

    // Digits mixed with letters (e.g. "98abc76543210" or "98xx76543210")
    const norm = normalizeText(text);
    const mixedPattern = /\b([a-z0-9_-]{10,25})\b/gi;
    let mixedMatch;
    while ((mixedMatch = mixedPattern.exec(norm)) !== null) {
        const rawToken = mixedMatch[1];
        if (/^(?:ord|sku|inv|po|pr|item|ref|req|tr|order|rfq)[-_0-9]/i.test(rawToken)) continue;
        const digitsOnly = rawToken.replace(/\D/g, '');
        if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
            const letterCount = rawToken.replace(/[^a-z]/gi, '').length;
            if (letterCount > 0 && letterCount <= 6) return true;
        }
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
    'pthdfc', 'ptsbi', 'ptaxis', 'pty', 'airtel', 'airtelpaymentsbank', 'jio', 'kmbl', 'kotakbank', 'idfcbank', 'idfcfirst',
    'naviaxis', 'navi', 'freecharge', 'boi', 'cnrb', 'canarabank', 'ikwik', 'postbank', 'ippb', 'dbs', 'equitas',
    'ezeepay', 'fam', 'yapl', 'tmb', 'uboi', 'allbank', 'okbizaxis', 'lime', 'rajgovhdfcbank', 'dlb', 'kvb', 'kbl',
    'sib', 'csb', 'cub', 'karb', 'tjsb', 'nsdl', 'bandhan', 'au', 'ucobank', 'psb', 'mahabank', 'indianbank',
    'iob', 'obc', 'uco', 'vijb', 'rbl', 'sbin', 'yespay', 'pingpay', 'axisb', 'axisgo', 'timecosmos', 'cosmos',
    'apay', 'amazonpay', 'gpay', 'phonepe', 'bhim', 'wahdfcbank', 'waicici', 'wasbi', 'ibl', 'okpay',
];

const UPI_HANDLE_REGEX = new RegExp(
    `[a-z0-9._\\-]{1,50}@(?:${UPI_HANDLES.join('|')})\\b`,
    'i'
);

/**
 * Detects UPI IDs (e.g., "abc@ybl", "name@okaxis").
 * Handles obfuscation: "abc @ ybl", "abc(at)ybl", "abc at ybl", "abc dot bank at ybl"
 */
// "UPI ID: x", "my gpay id is x", "paytm number" – someone is sharing/asking for a payment id
const PAYMENT_ID_INTENT = /\b(?:upi|gpay|google\s*pay|googlepay|phone\s*pe|phonepe|phonepay|paytm|bhim|amazon\s*pay)\s*(?:id|number|no\.?|handle|address|qr(?:\s*code)?|link|scanner)\b/i;
const GENERIC_UPI_HANDLE = /[a-z0-9._\-]{2,}@[a-z][a-z0-9]{1,24}(?![a-z0-9]*\.[a-z])/i;
const UPI_HASH_HANDLE = new RegExp(`[a-z0-9._\\-]{2,}[#$&*+=](?:${UPI_HANDLES.join('|')})\\b`, 'i');

/**
 * Detects UPI IDs (e.g., "abc@ybl", "name@okaxis") however they are written:
 * - any "name@handle" that is not an e-mail address (no .com) – so new/unknown PSP handles are caught too
 * - obfuscation: "abc @ ybl", "abc(at)ybl", "abc at the rate ybl", "abc @ y b l", "abc#ybl"
 * - "UPI ID: …", "gpay number …" style phrases
 */
export function detectUPI(text) {
    let norm = normalizeText(text);

    // Generic "name@word" typed without spaces (and not an e-mail): block regardless of the handle.
    if (GENERIC_UPI_HANDLE.test(norm)) return true;
    if (UPI_HASH_HANDLE.test(norm)) return true;
    if (PAYMENT_ID_INTENT.test(norm)) return true;

    // Convert "user at ybl" -> "user@ybl"
    norm = norm.replace(/([a-z0-9._-]+)\s*(?:\(at\)|\[at\]|\{at\}|\bat\b)\s*([a-z0-9._-]+)/gi, '$1@$2');
    norm = norm.replace(/([a-z0-9._-]+)\s*(?:\(dot\)|\[dot\]|\{dot\}|\bdot\b)\s*([a-z0-9._-]+)/gi, '$1.$2');

    // "abc @ ybl" -> "abc@ybl", and "abc @ y b l" -> "abc@ybl"
    let collapsed = norm.replace(/\s*@\s*/g, '@');
    collapsed = collapsed.replace(/@((?:[a-z]\s){1,8}[a-z])(?![a-z0-9])/g, (m, g) => '@' + g.replace(/\s/g, ''));
    return UPI_HANDLE_REGEX.test(collapsed);
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
    const tight = norm
        .replace(/\s*@\s*/g, '@')
        .replace(/\s*\.\s*(com|in|net|org|co|io|me|biz|info|xyz|app|shop|store|online|email)\b/g, '.$1');
    return EMAIL_PATTERN.test(tight);
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
    /\bdm\s*(?:karo|kar|me|mein)\b/i,
    /\bfollow\s*(?:kar|karo|karke|karna)\b/i,
    /\binbox\s*(?:me|mein|karo|kar)\b/i,
];

const PLATFORM_WORD = /\b(?:telegram|whatsapp|watsapp|whats\s*app|instagram|insta|facebook|fb|snapchat|skype|viber|signal|discord)\b/i;
const PLATFORM_HANDLE_HINT = /(?:@[a-z0-9._]{3,}|\b(?:id|handle|username|user\s*name|profile|page|channel|group|link)\b)/i;

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

    // 2. A platform named together with a handle / id / profile ("telegram @shop", "insta id ramesh.store")
    if (PLATFORM_WORD.test(norm) && PLATFORM_HANDLE_HINT.test(norm)) return true;

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
    // Taking the deal off-platform: "order cancel karo, COD pe bhej dunga"
    /\bcancel\b.{0,40}\b(?:cash|cod|direct|offline|bahar|outside)\b/i,
    /\b(?:cash|cod|direct|offline)\b.{0,40}\bcancel\b/i,
    /\bcash\s*(?:de\s*dena|de\s*do|dena|dijiye)\b/i,
];

// A payment app named together with an instruction to pay/send ("gpay kar do 500", "phonepe pe bhej do")
const PAYMENT_APP_RE = /\b(?:gpay|google\s*pay|googlepay|phone\s*pe|phonepe|phonepay|paytm|bhim(?:\s*upi)?|amazon\s*pay|amazonpay)\b/i;
const PAYMENT_SEND_RE = /\b(?:kar\s*do|karo|karna|kar\s*dena|bhej(?:o|na|\s*do|\s*dena)?|send|transfer|pay|payment|de\s*do|dena)\b/i;

export function detectExternalPayment(text) {
    const norm = normalizeText(text);

    if (PAYMENT_APP_RE.test(norm) && PAYMENT_SEND_RE.test(norm)) return true;

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

    // Use up to the last 9 recent messages plus currentText (analysis window of up to 10 messages)
    const windowSlice = messages.slice(-9);
    const allMessages = [...windowSlice, currentText];

    // 1. Sliding sub-window check (evaluating windows of 2, 3, 4, ... up to 10 messages)
    for (let w = 2; w <= allMessages.length; w++) {
        const sub = allMessages.slice(-w);
        const subJoined = sub.join(' ');
        const subTight = sub.join('');

        // Check phone number on combined subwindow
        if (detectPhoneNumber(subJoined) || detectPhoneNumber(subTight)) {
            return {
                action:      MODERATION_ACTION.BLOCK,
                category:    MODERATION_CATEGORY.PHONE_NUMBER,
                reason:      `Split phone number detected across ${w} messages`,
                userMessage: USER_MESSAGES[MODERATION_CATEGORY.PHONE_NUMBER],
            };
        }

        // Check email on combined subwindow
        if (detectEmail(subJoined) || detectEmail(subTight)) {
            return {
                action:      MODERATION_ACTION.BLOCK,
                category:    MODERATION_CATEGORY.EMAIL,
                reason:      `Split email address detected across ${w} messages`,
                userMessage: USER_MESSAGES[MODERATION_CATEGORY.EMAIL],
            };
        }

        // Check UPI on combined subwindow
        if (detectUPI(subJoined) || detectUPI(subTight)) {
            return {
                action:      MODERATION_ACTION.BLOCK,
                category:    MODERATION_CATEGORY.UPI_ID,
                reason:      `Split UPI handle detected across ${w} messages`,
                userMessage: USER_MESSAGES[MODERATION_CATEGORY.UPI_ID],
            };
        }

        // Check bank details on combined subwindow
        const bankCheck = detectBankDetails(subJoined);
        if (bankCheck.found) {
            return {
                action:      MODERATION_ACTION.BLOCK,
                category:    bankCheck.category,
                reason:      `Split bank details detected across ${w} messages`,
                userMessage: USER_MESSAGES[bankCheck.category],
            };
        }
    }

    // 2. Fragmented single/double digit stream detection (e.g., '9', '8', '7', '6', '5', '4', '3', '2', '1', '0' or '98','76','54','32','10')
    const digitExtracts = allMessages.map(m => {
        const norm = normalizeText(m);
        // Exclude messages that have explicit unit tags like "2 kg", "500 gram", "₹50"
        if (PRODUCT_CONTEXT_BEFORE.test(norm) || PRODUCT_CONTEXT_AFTER.test(norm)) {
            return '';
        }
        return norm.replace(/\D/g, '');
    });

    const concatenatedDigits = digitExtracts.join('');
    const phoneInDigits = /(?:(?:\+91|91|0))?([6-9]\d{9})/.exec(concatenatedDigits);
    if (phoneInDigits) {
        // Confirm this was built from short fragmented messages (average length <= 6)
        // to avoid false positives on large independent product queries
        const activeMessages = allMessages.filter(m => m.trim().length > 0);
        const shortCount = activeMessages.filter(m => m.trim().length <= 6).length;
        const hasContactIntent = allMessages.some(m => CONTACT_CONTEXT_BEFORE.test(normalizeText(m)) || /\b(?:call|ph|mob|contact|whatsapp|number)\b/i.test(m));

        if (shortCount >= 3 || hasContactIntent) {
            return {
                action:      MODERATION_ACTION.BLOCK,
                category:    MODERATION_CATEGORY.PHONE_NUMBER,
                reason:      'Fragmented phone number stream detected across messages',
                userMessage: USER_MESSAGES[MODERATION_CATEGORY.PHONE_NUMBER],
            };
        }
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
