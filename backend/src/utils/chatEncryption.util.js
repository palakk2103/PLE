import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const PREFIX = 'enc:v1:';

/**
 * Derives a consistent 32-byte key for AES-256.
 * Uses process.env.CHAT_ENCRYPTION_KEY if configured,
 * otherwise derives a deterministic key from process.env.JWT_SECRET.
 */
function getEncryptionKey() {
    const rawSecret =
        process.env.CHAT_ENCRYPTION_KEY ||
        process.env.JWT_SECRET ||
        'ple_chat_default_secure_secret_key_2026';

    return crypto
        .createHash('sha256')
        .update(rawSecret + '_ple_chat_secure_salt_v1')
        .digest();
}

/**
 * Encrypts plain text message using AES-256-GCM.
 * Stored format: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *
 * @param {string} text - Plain text message
 * @returns {string} - Encrypted string with enc:v1: prefix
 */
export function encryptMessage(text) {
    if (typeof text !== 'string' || !text) {
        return text;
    }

    // Prevent double encryption if already encrypted
    if (text.startsWith(PREFIX)) {
        return text;
    }

    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err) {
        console.error('[ChatEncryption] Encryption error:', err.message);
        // Fallback to original text rather than breaking message sending
        return text;
    }
}

/**
 * Decrypts an encrypted message.
 * Backward compatible: If text does not start with "enc:v1:", returns text as-is.
 *
 * @param {string} cipherText - Encrypted or legacy plain text string
 * @returns {string} - Decrypted plain text message
 */
export function decryptMessage(cipherText) {
    if (typeof cipherText !== 'string' || !cipherText) {
        return cipherText;
    }

    // Gracefully handle legacy plain text messages
    if (!cipherText.startsWith(PREFIX)) {
        return cipherText;
    }

    try {
        const payload = cipherText.slice(PREFIX.length);
        const parts = payload.split(':');
        if (parts.length !== 3) {
            return cipherText;
        }

        const [ivHex, authTagHex, encryptedData] = parts;
        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err) {
        console.warn('[ChatEncryption] Decryption failed or tampered data:', err.message);
        // Fallback safely so the app never crashes
        return cipherText;
    }
}

/**
 * Helper to check if a message is encrypted.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isEncrypted(text) {
    return typeof text === 'string' && text.startsWith(PREFIX);
}

export default {
    encryptMessage,
    decryptMessage,
    isEncrypted,
};
