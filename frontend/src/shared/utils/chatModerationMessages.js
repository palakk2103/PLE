/**
 * Chat Moderation — Frontend Message Mapping
 * ──────────────────────────────────────────────────────────────
 * Maps backend moderation categories to user-safe, friendly messages.
 * Never exposes internal implementation details (regex, confidence scores, etc.)
 */

/**
 * Returns a user-facing toast message based on the blocked category.
 * @param {string} category — from backend response.category
 * @returns {string}
 */
export function getChatBlockMessage(category) {
    switch (category) {
        case 'PHONE_NUMBER':
            return '⚠️ Warning: Phone numbers or direct contact details cannot be shared in chat. All discussions and transactions must remain on the platform for your security.';

        case 'EMAIL':
            return '⚠️ Warning: Email addresses cannot be shared in chat. Please continue communication through the platform.';

        case 'EXTERNAL_CONTACT':
            return '⚠️ Warning: External contact platforms, social links, and WhatsApp cannot be shared in chat. Please continue communication through the platform.';

        case 'EXTERNAL_URL':
            return '⚠️ Warning: External links cannot be shared in chat. Please keep all communication on the platform.';

        case 'UPI_ID':
        case 'BANK_DETAILS':
        case 'IFSC':
        case 'PAYMENT_LINK':
        case 'EXTERNAL_PAYMENT':
            return "⚠️ Warning: Direct payments and UPI IDs outside the platform are strictly prohibited. Please use the platform's secure checkout.";

        case 'CARD_DETAILS':
            return '⚠️ Warning: Credit/debit card numbers and CVVs cannot be shared in chat for your financial protection.';

        case 'CREDENTIAL_PHISHING':
            return '⚠️ Warning: Requesting or sharing OTPs, passwords, or security codes is strictly prohibited.';

        case 'PAYMENT_QR':
            return '⚠️ Warning: Payment QR codes cannot be shared in chat.';

        case 'SUSPICIOUS':
        default:
            return '⚠️ Warning: This message contains restricted contact or payment details that cannot be shared in chat.';
    }
}

/**
 * Lightweight client-side preflight check for instant typing feedback.
 * Backend remains strictly authoritative.
 * @param {string} text
 * @returns {string|null} Warning message or null
 */
export function preflightCheckMessage(text) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();

    // 10-digit phone
    if (/(?:(?:\+91|91|0))?[6-9]\d{9}\b/.test(lower.replace(/[\s\-_.]/g, ''))) {
        return 'Phone numbers cannot be shared. Conversations must stay on PLE.';
    }

    // Email
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(lower)) {
        return 'Email addresses cannot be shared. Please chat directly on PLE.';
    }

    // WhatsApp / Telegram links
    if (/wa\.me\/|t\.me\/|instagram\.com\/|chat\.whatsapp\.com/i.test(lower)) {
        return 'External contact links are not permitted.';
    }

    // OTP Phishing
    if (/\b(?:otp|password|pin)\b.{0,20}\b(?:bhejo|batao|share|send)\b|\b(?:send|share)\b.{0,20}\b(?:otp|password)\b/i.test(lower)) {
        return 'Sharing or asking for OTPs and passwords is strictly prohibited.';
    }

    return null;
}
