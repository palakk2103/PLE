import mongoose from 'mongoose';

const withdrawalRequestSchema = new mongoose.Schema(
    {
        withdrawalId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        }, // e.g., WR-20261007-1234
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true,
            index: true,
        },
        requestedAmount: {
            type: Number,
            required: true,
            min: 1,
        },
        eligibleAmountAtRequest: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'processing', 'paid', 'rejected', 'cancelled'],
            default: 'pending',
            index: true,
        },
        bankDetailsSnapshot: {
            accountName: { type: String, default: '' },
            accountNumber: { type: String, default: '' },
            maskedAccountNumber: { type: String, default: '' },
            bankName: { type: String, default: '' },
            ifscCode: { type: String, default: '' },
            upiId: { type: String, default: '' },
        },
        paymentMethod: {
            type: String,
            enum: ['neft', 'imps', 'rtgs', 'upi', 'bank_transfer', 'other'],
            default: 'bank_transfer',
        },
        settlementId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Settlement',
        },
        utr: {
            type: String,
            sparse: true,
            index: true,
        }, // Bank UTR or Transaction Reference Number
        paidAmount: {
            type: Number,
        },
        adminNotes: {
            type: String,
            default: '',
        },
        vendorNotes: {
            type: String,
            default: '',
        },
        rejectionReason: {
            type: String,
            default: '',
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
        },
        reviewedAt: {
            type: Date,
        },
        paidBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
        },
        paidAt: {
            type: Date,
        },
    },
    { timestamps: true }
);

withdrawalRequestSchema.index({ vendorId: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });

const WithdrawalRequest = mongoose.models.WithdrawalRequest || mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
export { WithdrawalRequest };
export default WithdrawalRequest;
