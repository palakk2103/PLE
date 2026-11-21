import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const PREFIX = 'enc:v1:';

/**
 * Derives a consistent 32-byte key for AES-256.
 * Uses process.env.CHAT_ENCRYPTION_KEY if configured,
 * otherwise derives a deterministic key from process.env.JWT_SECRET.
 */
const DEFAULT_SECRET = 'ple_chat_default_secure_secret_key_2026';
const deriveKey = (raw) => crypto.createHash('sha256').update(raw + '_ple_chat_secure_salt_v1').digest();
let warnedAboutKey = false;

/**
 * Keys in order of preference. New messages are ALWAYS encrypted with the first key; decryption tries
 * every key, so setting a dedicated CHAT_ENCRYPTION_KEY later never makes old messages unreadable
 * (they were encrypted with a key derived from JWT_SECRET or the built-in default).
 */
function getEncryptionKeys() {
    if (!process.env.CHAT_ENCRYPTION_KEY && !warnedAboutKey && process.env.NODE_ENV === 'production') {
        warnedAboutKey = true;
        console.error('[ChatEncryption] CHAT_ENCRYPTION_KEY is not set: chats are encrypted with a key derived from JWT_SECRET. Set a dedicated random key.');
    }
    const secrets = [process.env.CHAT_ENCRYPTION_KEY, process.env.JWT_SECRET, DEFAULT_SECRET].filter(Boolean);
    const keys = [];
    for (const secret of secrets) {
        const key = deriveKey(secret);
        if (!keys.some((k) => k.equals(key))) keys.push(key);
    }
    return keys;
}

function getEncryptionKey() {
    return getEncryptionKeys()[0];
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
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        let lastErr = null;
        for (const key of getEncryptionKeys()) {
            try {
                const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
                decipher.setAuthTag(authTag);
                let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                return decrypted;
            } catch (err) {
                lastErr = err; // wrong key (or tampered data): try the next key
            }
        }
        throw lastErr || new Error('No key could decrypt this message');
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
