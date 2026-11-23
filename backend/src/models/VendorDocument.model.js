import mongoose from 'mongoose';

const vendorDocumentSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true,
            index: true,
        },
        name: { type: String, required: true, trim: true },
        category: {
            type: String,
            enum: ['License', 'Certificate', 'Tax Document', 'LOA', 'Other'],
            default: 'Other',
        },
        expiryDate: { type: Date, default: null },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true,
        },
        fileUrl: { type: String, required: true },
        filePublicId: { type: String, required: true },
        fileName: { type: String, required: true },
        fileType: { type: String, required: true },
        fileSize: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
        // Bumped every time the file is replaced; a replaced document is reviewed again
        version: { type: Number, default: 1 },
        replacedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

vendorDocumentSchema.index({ vendorId: 1, createdAt: -1 });
// One Letter of Authorization per vendor (replace it instead of adding another)
vendorDocumentSchema.index({ vendorId: 1, category: 1 }, { unique: true, partialFilterExpression: { category: 'LOA' } });

const VendorDocument = mongoose.models.VendorDocument || mongoose.model('VendorDocument', vendorDocumentSchema);
export { VendorDocument };
export default VendorDocument;
