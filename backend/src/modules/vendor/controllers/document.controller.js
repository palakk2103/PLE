import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import VendorDocument from '../../../models/VendorDocument.model.js';
import {
    uploadLocalFileToCloudinaryAndCleanupWithType,
    deleteFromCloudinary,
    cleanupLocalFiles,
} from '../../../services/upload.service.js';
import Vendor from '../../../models/Vendor.model.js';
import { createNotification } from '../../../services/notification.service.js';
import path from 'path';

const ALLOWED_CATEGORIES = new Set([
    'License',
    'Certificate',
    'Tax Document',
    'LOA',
    'Other',
]);

export const LOA_CATEGORY = 'LOA';
export const LOA_DEFAULT_NAME = 'Letter of Authorization (LOA)';
// An LOA is a signed letter: a PDF or a clear photo / scan of it
const LOA_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const LOA_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png']);
const assertLoaFile = (file) => {
    const ext = path.extname(file?.originalname || '').slice(1).toLowerCase();
    if (!LOA_MIME.has(file?.mimetype) && !LOA_EXT.has(ext)) {
        throw new ApiError(400, 'The LOA must be a PDF, JPG or PNG file.');
    }
    if (file?.mimetype && !LOA_MIME.has(file.mimetype) && !(file.mimetype === 'application/octet-stream' && LOA_EXT.has(ext))) {
        throw new ApiError(400, 'The LOA must be a PDF, JPG or PNG file.');
    }
};

const parseExpiry = (raw) => {
    if (raw === undefined) return undefined; // not provided: leave as is
    if (raw === null || raw === '' || raw === 'null') return null; // cleared
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) throw new ApiError(400, 'Invalid expiry date.');
    return parsed;
};

// Tell PLE admins that an LOA needs (re)review. Never blocks the vendor's request.
const notifyAdminsLoa = async (vendorId, verb) => {
    try {
        const vendor = await Vendor.findById(vendorId).select('storeName name').lean();
        await createNotification({
            recipientType: 'admin',
            title: `LOA ${verb}`,
            message: `${vendor?.storeName || vendor?.name || 'A vendor'} ${verb} their Letter of Authorization. It is waiting for review.`,
            type: 'system',
            data: { vendorId: String(vendorId), category: LOA_CATEGORY },
        });
    } catch (err) {
        console.warn('LOA admin notification failed:', err.message);
    }
};

export const getVendorDocuments = asyncHandler(async (req, res) => {
    const documents = await VendorDocument.find({ vendorId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, documents, 'Documents fetched.'));
});

export const createVendorDocument = asyncHandler(async (req, res) => {
    const category = String(req.body?.category || 'Other').trim();
    const name = String(req.body?.name || '').trim() || (category === LOA_CATEGORY ? LOA_DEFAULT_NAME : '');
    const expiryDateRaw = req.body?.expiryDate;

    if (!name) {
        await cleanupLocalFiles([req.file?.path]);
        throw new ApiError(400, 'Document name is required.');
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
        await cleanupLocalFiles([req.file?.path]);
        throw new ApiError(400, 'Invalid document category.');
    }
    if (!req.file?.path) throw new ApiError(400, 'Document file is required.');
    if (category === LOA_CATEGORY) {
        try { assertLoaFile(req.file); } catch (err) { await cleanupLocalFiles([req.file.path]); throw err; }
        if (await VendorDocument.exists({ vendorId: req.user.id, category: LOA_CATEGORY })) {
            await cleanupLocalFiles([req.file.path]);
            throw new ApiError(409, 'You already have an LOA on file. Replace it instead of uploading another.');
        }
    }

    let expiryDate = null;
    if (expiryDateRaw) {
        const parsed = new Date(expiryDateRaw);
        if (Number.isNaN(parsed.getTime())) throw new ApiError(400, 'Invalid expiry date.');
        expiryDate = parsed;
    }

    let uploaded = null;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(
            req.file.path,
            'vendors/documents',
            'auto'
        );

        const document = await VendorDocument.create({
            vendorId: req.user.id,
            name,
            category,
            expiryDate,
            status: 'pending',
            fileUrl: uploaded.url,
            filePublicId: uploaded.publicId,
            fileName: req.file.originalname || name,
            fileType: req.file.mimetype || 'application/octet-stream',
            fileSize: req.file.size || 0,
            uploadedAt: new Date(),
        });

        await createNotification({
            recipientId: req.user.id,
            recipientType: 'vendor',
            title: 'Document uploaded',
            message: `${name} uploaded successfully and is pending review.`,
            type: 'system',
            data: {
                documentId: String(document._id),
                category: String(category),
                status: 'pending',
            },
        });

        if (category === LOA_CATEGORY) notifyAdminsLoa(req.user.id, 'uploaded');
        res.status(201).json(new ApiResponse(201, document, 'Document uploaded.'));
    } catch (error) {
        if (!uploaded) {
            await cleanupLocalFiles([req.file?.path]);
        }
        if (uploaded?.publicId) {
            await deleteFromCloudinary(uploaded.publicId).catch(() => null);
        }
        if (error?.code === 11000 && category === LOA_CATEGORY) {
            throw new ApiError(409, 'You already have an LOA on file. Replace it instead of uploading another.');
        }
        throw error;
    }
});

export const deleteVendorDocument = asyncHandler(async (req, res) => {
    const document = await VendorDocument.findOneAndDelete({
        _id: req.params.id,
        vendorId: req.user.id,
    });
    if (!document) throw new ApiError(404, 'Document not found.');

    if (document.filePublicId) {
        await deleteFromCloudinary(document.filePublicId).catch(() => null);
    }

    res.status(200).json(new ApiResponse(200, null, 'Document deleted.'));
});

// PUT /api/vendor/documents/:id  (multipart: file [+ name, expiryDate])
// Replaces the file of an existing document. It goes back to "pending" so PLE reviews the new file.
export const replaceVendorDocument = asyncHandler(async (req, res) => {
    const tmp = req.file?.path;
    const document = await VendorDocument.findOne({ _id: req.params.id, vendorId: req.user.id });
    if (!document) {
        await cleanupLocalFiles([tmp]);
        throw new ApiError(404, 'Document not found.');
    }
    if (!tmp) throw new ApiError(400, 'Choose the new file to upload.');
    let name = document.name;
    if (req.body?.name !== undefined) {
        name = String(req.body.name).trim();
        if (!name) { await cleanupLocalFiles([tmp]); throw new ApiError(400, 'Document name cannot be empty.'); }
    }
    let expiryDate;
    try {
        expiryDate = parseExpiry(req.body?.expiryDate);
        if (document.category === LOA_CATEGORY) assertLoaFile(req.file);
    } catch (err) {
        await cleanupLocalFiles([tmp]);
        throw err;
    }

    let uploaded = null;
    const oldPublicId = document.filePublicId;
    try {
        uploaded = await uploadLocalFileToCloudinaryAndCleanupWithType(tmp, 'vendors/documents', 'auto');
        document.name = name;
        if (expiryDate !== undefined) document.expiryDate = expiryDate;
        document.fileUrl = uploaded.url;
        document.filePublicId = uploaded.publicId;
        document.fileName = req.file.originalname || name;
        document.fileType = req.file.mimetype || 'application/octet-stream';
        document.fileSize = req.file.size || 0;
        document.uploadedAt = new Date();
        document.replacedAt = new Date();
        document.version = (document.version || 1) + 1;
        document.status = 'pending';
        await document.save();
    } catch (error) {
        if (!uploaded) await cleanupLocalFiles([tmp]);
        if (uploaded?.publicId) await deleteFromCloudinary(uploaded.publicId).catch(() => null);
        throw error;
    }

    // The old file is only removed once the new one is safely saved
    if (oldPublicId && oldPublicId !== uploaded.publicId) await deleteFromCloudinary(oldPublicId).catch(() => null);

    await createNotification({
        recipientId: req.user.id,
        recipientType: 'vendor',
        title: 'Document replaced',
        message: `${document.name} was replaced and is pending review.`,
        type: 'system',
        data: { documentId: String(document._id), category: String(document.category), status: 'pending' },
    }).catch(() => null);
    if (document.category === LOA_CATEGORY) notifyAdminsLoa(req.user.id, 'replaced');

    res.status(200).json(new ApiResponse(200, document, 'Document replaced. It will be reviewed again.'));
});
