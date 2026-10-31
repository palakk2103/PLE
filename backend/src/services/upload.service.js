import cloudinary from '../config/cloudinary.js';
import fs from 'fs/promises';
import ApiError from '../utils/ApiError.js';

const toUploadError = (error) => {
    const message = error?.message || error?.error?.message || 'Unknown Cloudinary error';
    console.error('Cloudinary upload failed:', message);
    return new ApiError(502, `File upload failed: ${message}`);
};

/**
 * Upload a local file to Cloudinary (images, PDFs, videos, documents).
 * resource_type 'auto' lets Cloudinary detect the type; forcing 'image' broke
 * every non-image upload. Failures are thrown, never masked with placeholders.
 * @param {string} localFilePath - Temporary local file path from multer disk storage
 * @param {string} folder - Cloudinary folder (e.g. 'products', 'vendors/logos')
 * @param {string} [publicId] - Optional custom public ID
 * @returns {Promise<{url: string, publicId: string}>}
 */
export const uploadToCloudinary = async (localFilePath, folder, publicId) => {
    const uploadOptions = { folder, resource_type: 'auto' };
    if (publicId) uploadOptions.public_id = publicId;

    try {
        const result = await cloudinary.uploader.upload(localFilePath, uploadOptions);
        return { url: result.secure_url, publicId: result.public_id };
    } catch (error) {
        throw toUploadError(error);
    }
};

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
) => {
    const isPdf = localFilePath && localFilePath.toLowerCase().endsWith('.pdf');
    const uploadOptions = {
        folder,
        resource_type: resourceType === 'raw' && !isPdf ? 'raw' : 'auto',
    };
    if (isPdf) uploadOptions.format = 'pdf';
    if (publicId) uploadOptions.public_id = publicId;

    try {
        const result = await cloudinary.uploader.upload(localFilePath, uploadOptions);
        return { url: result.secure_url, publicId: result.public_id };
    } catch (error) {
        throw toUploadError(error);
    }
};

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
export const deleteFromCloudinary = async (publicId) => {
    return cloudinary.uploader.destroy(publicId);
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
