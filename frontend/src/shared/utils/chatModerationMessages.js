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
        case 'EXTERNAL_CONTACT':
            return '⚠️ Warning: External contact information cannot be shared in chat. Please continue communication through the platform.';

        case 'UPI_ID':
        case 'BANK_DETAILS':
        case 'IFSC':
        case 'PAYMENT_LINK':
        case 'EXTERNAL_PAYMENT':
            return "⚠️ Warning: Direct payments and UPI IDs outside the platform are strictly prohibited. Please use the platform's secure checkout.";

        case 'PAYMENT_QR':
            return '⚠️ Warning: Payment QR codes cannot be shared in chat.';

        case 'SUSPICIOUS':
        default:
            return '⚠️ Warning: This message contains restricted contact or payment details that cannot be shared in chat.';
    }
}
