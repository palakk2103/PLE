import mongoose from 'mongoose';

const vendorTransactionSchema = new mongoose.Schema(
    {
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: [
                'EARNING_ON_HOLD',      // Order delivered, seller share placed on hold
                'EARNING_CLEARED',      // Clearance window elapsed, moved to available
                'WITHDRAWAL_REQUEST',   // Reserved for withdrawal
                'WITHDRAWAL_PAID',      // Paid out to vendor bank
                'WITHDRAWAL_REJECTED',  // Rejected, returned from reserved to available
                'RETURN_DEDUCTION',     // Return/refund deducted
                'COMMISSION_DEDUCTION', // Platform fee record
                'MANUAL_ADJUSTMENT',    // Admin adjustment if needed
            ],
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        balanceSnapshot: {
            onHold: { type: Number, default: 0 },
            available: { type: Number, default: 0 },
            reserved: { type: Number, default: 0 },
            withdrawn: { type: Number, default: 0 },
        },
        referenceType: {
            type: String,
            enum: ['order', 'commission', 'withdrawal', 'settlement', 'return_request', 'admin_adjustment'],
        },
        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        referenceNumber: {
            type: String, // e.g. orderId, withdrawalId, UTR
        },
        description: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['completed', 'pending', 'cancelled'],
            default: 'completed',
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
        },
    },
    { timestamps: true }
);

vendorTransactionSchema.index({ vendorId: 1, createdAt: -1 });

const VendorTransaction = mongoose.models.VendorTransaction || mongoose.model('VendorTransaction', vendorTransactionSchema);
export { VendorTransaction };
export default VendorTransaction;
