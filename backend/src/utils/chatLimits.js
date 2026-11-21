import ApiError from './ApiError.js';

/** One limit for every chat-like text field, so a single request can't store megabytes of text. */
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_LONG_TEXT_LENGTH = 5000; // ticket descriptions, enquiry questions…

export const assertTextLength = (text, label = 'Message', max = MAX_MESSAGE_LENGTH) => {
    if (typeof text === 'string' && text.length > max) {
        throw new ApiError(400, `${label} is too long (maximum ${max} characters).`);
    }
};

/**
 * Attachments must be files uploaded through the platform (Cloudinary or our own /uploads folder).
 * Arbitrary URLs could point to phishing pages or tracking pixels shown inside a trusted chat window.
 */
const ALLOWED_ATTACHMENT = [/^https:\/\/res\.cloudinary\.com\//i, /^\/uploads\//];
const MAX_ATTACHMENTS = 5;

// Support tickets send screenshots inline as small base64 images (no upload step). Images only, size-capped.
const INLINE_IMAGE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_INLINE_IMAGE_CHARS = 2_800_000; // ~2 MB of image data

export const sanitizeAttachments = (list, { allowInlineImages = false } = {}) => {
    if (list === undefined || list === null || list === '') return [];
    const arr = Array.isArray(list) ? list : [list];
    if (arr.length > MAX_ATTACHMENTS) {
        throw new ApiError(400, `You can attach at most ${MAX_ATTACHMENTS} files.`);
    }
    for (const url of arr) {
        const isPlatformFile = typeof url === 'string' && url.length <= 600 && ALLOWED_ATTACHMENT.some((rx) => rx.test(url));
        const isInlineImage = allowInlineImages && typeof url === 'string'
            && url.length <= MAX_INLINE_IMAGE_CHARS && INLINE_IMAGE.test(url);
        if (!isPlatformFile && !isInlineImage) {
            throw new ApiError(400, allowInlineImages
                ? 'Attachments must be an image under 2 MB or a file uploaded through the platform.'
                : 'Attachments must be files uploaded through the platform.');
        }
    }
    return arr;
};
