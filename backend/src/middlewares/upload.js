import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOCUMENT_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'text/plain',
];
const ALLOWED_DOCUMENT_EXTENSIONS = [
    'pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt',
];
// Browsers/OSes often report PDFs as x-pdf, octet-stream, etc., so also trust the extension.
const isAllowedDocument = (file) => {
    const ext = path.extname(file.originalname || '').slice(1).toLowerCase();
    return ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype) || ALLOWED_DOCUMENT_EXTENSIONS.includes(ext);
};
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMP_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/tmp');
const DELIVERY_DOCS_DIR = path.resolve(__dirname, '../../uploads/delivery-docs');
fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DELIVERY_DOCS_DIR, { recursive: true });

const imageDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TMP_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const safeBaseName = (file.originalname || 'file')
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9-_]/g, '_')
            .slice(0, 60);
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeBaseName}${ext}`);
    }
});

const csvMemoryStorage = multer.memoryStorage();

const deliveryDocumentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, DELIVERY_DOCS_DIR);
    },
    filename: (req, file, cb) => {
        const safeBaseName = (file.originalname || 'document')
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9-_]/g, '_')
            .slice(0, 60);
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeBaseName}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new ApiError(400, 'Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.'), false);
    }
};

// Single image upload
export const uploadSingle = (fieldName) =>
    multer({ storage: imageDiskStorage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } }).single(fieldName);

// Multiple images upload (max 5)
export const uploadMultiple = (fieldName, maxCount = 5) =>
    multer({ storage: imageDiskStorage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } }).array(fieldName, maxCount);

// Single document upload (pdf or image)
export const uploadDocumentSingle = (fieldName) =>
    multer({
        storage: imageDiskStorage,
        fileFilter: (req, file, cb) => {
            if (isAllowedDocument(file)) {
                cb(null, true);
            } else {
                cb(
                    new ApiError(
                        400,
                        'Invalid file type. Only PDF, Word (DOC/DOCX), Excel (XLS/XLSX), ZIP, TXT, and common images are allowed.'
                    ),
                    false
                );
            }
        },
        limits: { fileSize: MAX_DOCUMENT_FILE_SIZE },
    }).single(fieldName);

// Same as uploadDocumentSingle, plus iPhone HEIC/HEIF photos. Only for routes that convert them
// for display (Cloudinary does this when the delivery URL ends in .jpg).
export const uploadDocumentOrPhotoSingle = (fieldName) =>
    multer({
        storage: imageDiskStorage,
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname || '').slice(1).toLowerCase();
            if (isAllowedDocument(file) || ['heic', 'heif'].includes(ext)) return cb(null, true);
            cb(new ApiError(400, 'Invalid file type. Only documents and common images (including HEIC) are allowed.'), false);
        },
        limits: { fileSize: MAX_DOCUMENT_FILE_SIZE },
    }).single(fieldName);

// Multiple named document uploads (used for delivery registration docs)
export const uploadDeliveryDocuments = (fields) =>
    multer({
        storage: deliveryDocumentStorage,
        fileFilter: (req, file, cb) => {
            if (isAllowedDocument(file)) {
                cb(null, true);
            } else {
                cb(
                    new ApiError(
                        400,
                        'Invalid file type. Only PDF, Word (DOC/DOCX), Excel (XLS/XLSX), ZIP, TXT, and common images are allowed.'
                    ),
                    false
                );
            }
        },
        limits: { fileSize: MAX_DOCUMENT_FILE_SIZE },
    }).fields(fields);

export const uploadVendorRegistrationDocs = () =>
    multer({
        storage: imageDiskStorage,
        fileFilter: (req, file, cb) => {
            const allowed = [
                'application/pdf',
                'application/x-pdf',
                'application/acrobat',
                'applications/vnd.pdf',
                'text/pdf',
                'image/jpeg',
                'image/png',
                'image/jpg'
            ];
            const extension = file.originalname.split('.').pop().toLowerCase();
            const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
            if (allowed.includes(file.mimetype) || allowedExtensions.includes(extension)) {
                cb(null, true);
            } else {
                cb(new ApiError(400, 'Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.'), false);
            }
        },
        limits: { fileSize: MAX_DOCUMENT_FILE_SIZE },
    }).fields([
        { name: 'gstCertificate', maxCount: 1 },
        { name: 'msmeCertificate', maxCount: 1 },
        { name: 'identityProof', maxCount: 1 },
        { name: 'registrationProof', maxCount: 1 },
        { name: 'businessLetter', maxCount: 1 },
        { name: 'partnershipAgreement', maxCount: 1 },
        { name: 'bankProof', maxCount: 1 }
    ]);

// CSV upload for bulk operations
export const uploadCSV = multer({
    storage: csvMemoryStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new ApiError(400, 'Only CSV files are allowed for bulk upload.'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for CSV
}).single('file');

// Media upload supporting image, video, and documents
export const uploadMediaSingle = (fieldName) =>
    multer({
        storage: imageDiskStorage,
        fileFilter: (req, file, cb) => {
            const allowedMimes = [
                'image/jpeg',
                'image/png',
                'image/webp',
                'image/gif',
                'video/mp4',
                'video/webm',
                'video/ogg',
                'video/quicktime',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            const extension = file.originalname.split('.').pop().toLowerCase();
            const allowedExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'ogg', 'mov'];
            if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
                cb(null, true);
            } else {
                cb(
                    new ApiError(
                        400,
                        'Invalid file type. Only images, videos, and documents (PDF/DOC/DOCX) are allowed.'
                    ),
                    false
                );
            }
        },
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }).single(fieldName);

export const uploadPDFSingle = (fieldName) =>
    multer({
        storage: imageDiskStorage,
        fileFilter: (req, file, cb) => {
            const allowedMimes = [
                'application/pdf',
                'application/x-pdf',
                'application/acrobat',
                'applications/vnd.pdf',
                'text/pdf',
                'application/octet-stream'
            ];
            const extension = file.originalname?.split('.').pop()?.toLowerCase();
            if (allowedMimes.includes(file.mimetype) || extension === 'pdf') {
                cb(null, true);
            } else {
                cb(new ApiError(400, 'Invalid file type. Only PDF files are allowed.'), false);
            }
        },
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }).single(fieldName);


// Strict registration-document upload (PDF / JPG / PNG only, 5MB). Used by B2B registration.
const REGISTRATION_DOC_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
const REGISTRATION_DOC_EXTS = ['pdf', 'jpg', 'jpeg', 'png'];
export const REGISTRATION_DOC_MAX_SIZE = 5 * 1024 * 1024;
export const uploadRegistrationDocSingle = (fieldName) =>
    multer({
        storage: imageDiskStorage,
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname || '').slice(1).toLowerCase();
            // Browsers/OSes often report PDFs as x-pdf or octet-stream; the extension must be valid
            // and the controller verifies the real content via magic bytes.
            const mimeOk = REGISTRATION_DOC_MIMES.includes(file.mimetype) ||
                ['application/x-pdf', 'application/acrobat', 'text/pdf', 'application/octet-stream', 'image/jpg', 'image/pjpeg'].includes(file.mimetype);
            if (mimeOk && REGISTRATION_DOC_EXTS.includes(ext)) {
                cb(null, true);
            } else {
                cb(new ApiError(400, 'Invalid file type. Only PDF, JPG and PNG files are allowed.'), false);
            }
        },
        limits: { fileSize: REGISTRATION_DOC_MAX_SIZE },
    }).single(fieldName);
