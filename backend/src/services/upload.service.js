import cloudinary from '../config/cloudinary.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import ApiError from '../utils/ApiError.js';

const toUploadError = (error) => {
    const message = error?.message || error?.error?.message || 'Unknown Cloudinary error';
    console.error('Cloudinary upload failed:', message);
    return new ApiError(502, `File upload failed: ${message}`);
};

// Document types are stored as Cloudinary "raw" files. Uploading a PDF as an
// "image" makes Cloudinary run it through its image pipeline, which rejects
// large/encrypted/unusual PDFs and can block delivery of the file later.
const RAW_DOCUMENT_EXTENSIONS = new Set([
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'txt', 'csv',
]);

const getExtension = (filePath) => path.extname(filePath || '').slice(1).toLowerCase();

const isRawDocument = (filePath) => RAW_DOCUMENT_EXTENSIONS.has(getExtension(filePath));

// Raw files have no format conversion, so the extension must live in the public id
// for the delivered URL to end in ".pdf" (needed for correct content-type + previews).
const buildRawPublicId = (localFilePath, publicId) => {
    const ext = getExtension(localFilePath);
    if (publicId) {
        const id = String(publicId);
        return !ext || id.toLowerCase().endsWith(`.${ext}`) ? id : `${id}.${ext}`;
    }
    const base = path
        .basename(localFilePath || 'file', path.extname(localFilePath || ''))
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 80) || 'file';
    const suffix = crypto.randomBytes(4).toString('hex');
    return ext ? `${base}-${suffix}.${ext}` : `${base}-${suffix}`;
};

const buildUploadOptions = (localFilePath, folder, resourceType, publicId) => {
    const useRaw = resourceType === 'raw' || isRawDocument(localFilePath);
    if (useRaw) {
        return {
            folder,
            resource_type: 'raw',
            public_id: buildRawPublicId(localFilePath, publicId),
        };
    }
    const options = { folder, resource_type: 'auto' };
    if (publicId) options.public_id = publicId;
    return options;
};

const performUpload = async (localFilePath, folder, resourceType, publicId) => {
    const options = buildUploadOptions(localFilePath, folder, resourceType, publicId);
    try {
        const result = await cloudinary.uploader.upload(localFilePath, options);
        return {
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
        };
    } catch (error) {
        throw toUploadError(error);
    }
};

/**
 * Upload a local file to Cloudinary (images, PDFs, videos, documents).
 * Documents (PDF, Word, Excel, ZIP, TXT) are stored as raw files; everything
 * else uses resource_type 'auto'. Failures are thrown, never masked with placeholders.
 * @param {string} localFilePath - Temporary local file path from multer disk storage
 * @param {string} folder - Cloudinary folder (e.g. 'products', 'vendors/logos')
 * @param {string} [publicId] - Optional custom public ID
 * @returns {Promise<{url: string, publicId: string, resourceType: string}>}
 */
export const uploadToCloudinary = async (localFilePath, folder, publicId) =>
    performUpload(localFilePath, folder, 'auto', publicId);

/**
 * Upload a local file to Cloudinary with configurable resource type.
 * @param {string} localFilePath
 * @param {string} folder
 * @param {'image'|'raw'|'auto'} [resourceType='auto']
 * @param {string} [publicId]
 */
export const uploadFileToCloudinary = async (
    localFilePath,
    folder,
    resourceType = 'auto',
    publicId
) => performUpload(localFilePath, folder, resourceType, publicId);

/**
 * Upload local file to Cloudinary and remove the local temp file.
 * Local file deletion happens only after successful Cloudinary upload.
 */
export const uploadLocalFileToCloudinaryAndCleanup = async (localFilePath, folder, publicId) => {
    try {
        return await uploadToCloudinary(localFilePath, folder, publicId);
    } finally {
        await cleanupLocalFile(localFilePath);
    }
};

/**
 * Upload local file to Cloudinary with configurable resource type and cleanup temp file.
 */
export const uploadLocalFileToCloudinaryAndCleanupWithType = async (
    localFilePath,
    folder,
    resourceType = 'auto',
    publicId
) => {
    try {
        return await uploadFileToCloudinary(localFilePath, folder, resourceType, publicId);
    } finally {
        await cleanupLocalFile(localFilePath);
    }
};

/**
 * Delete a file from Cloudinary by public ID
 */
export const deleteFromCloudinary = async (publicId, resourceType) => {
    if (resourceType) return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    const result = await cloudinary.uploader.destroy(publicId);
    // Documents are stored as raw files; fall back so they are removed too.
    if (result?.result === 'not found') {
        return cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    }
    return result;
};

/**
 * Best-effort local file cleanup helper.
 */
export const cleanupLocalFile = async (localFilePath) => {
    if (!localFilePath) return false;
    try {
        await fs.unlink(localFilePath);
        return true;
    } catch {
        return false;
    }
};

/**
 * Best-effort cleanup for multiple local files.
 */
export const cleanupLocalFiles = async (paths = []) => {
    const uniquePaths = [...new Set((paths || []).filter(Boolean))];
    await Promise.allSettled(uniquePaths.map((filePath) => cleanupLocalFile(filePath)));
};
