import mongoose from 'mongoose';

const accountDeletionRequestSchema = new mongoose.Schema(
    {
        requesterId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'requesterModel',
            index: true
        },
        requesterModel: {
            type: String,
            required: true,
            enum: ['User', 'Vendor'],
            index: true
        },
        role: {
            type: String,
            required: true,
            enum: ['customer', 'vendor'],
            index: true
        },
        requesterInfo: {
            name: { type: String, trim: true },
            email: { type: String, trim: true, lowercase: true },
            phone: { type: String, trim: true },
            storeName: { type: String, trim: true } // For vendors
        },
        reason: {
            type: String,
            required: true,
            trim: true
        },
        additionalFeedback: {
            type: String,
            trim: true,
            default: ''
        },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
            default: 'PENDING',
            index: true
        },
        adminRemarks: {
            type: String,
            trim: true,
            default: ''
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

// Helpful compound indexes
accountDeletionRequestSchema.index({ requesterId: 1, status: 1 });
accountDeletionRequestSchema.index({ createdAt: -1 });

const AccountDeletionRequest = mongoose.models.AccountDeletionRequest || mongoose.model('AccountDeletionRequest', accountDeletionRequestSchema);

export { AccountDeletionRequest };
export default AccountDeletionRequest;
