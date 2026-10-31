import mongoose from 'mongoose';

const returnRequestSchema = new mongoose.Schema(
    {
        // Public, unique Return ID ("RET-..."). Legacy records without it get a derived ID at the API layer.
        returnId: { type: String, unique: true, sparse: true, index: true, trim: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
        // Snapshot of the original public Order ID (Order.orderId) for fast lookup/search.
        orderNumber: { type: String, index: true, trim: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true },
        items: [
            {
                // Exact Order.items[]._id this return line was raised against.
                orderItemId: { type: mongoose.Schema.Types.ObjectId },
                variantKey: String,
                productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
                name: String,
                price: Number,
                image: String,
                quantity: Number,
                reason: String,
            },
        ],
        reason: { type: String, required: true },
        status: {
            type: String,
            enum: ['pending', 'approved', 'processing', 'rejected', 'completed', 'return_initiated', 'in_transit', 'qc_center', 'refund_processed', 'claim_rejected'],
            default: 'pending',
            index: true,
        },
        trackingStep: { type: Number, default: 1 },
        isRefurbishedComplaint: { type: Boolean, default: false },
        hasDamageReport: { type: Boolean, default: false },
        damageNotes: { type: String, default: '' },
        photoUrl: { type: String, default: '' },
        refundAmount: Number,
        refundStatus: { type: String, enum: ['pending', 'processed', 'failed'] },
        refundDestination: { type: String, enum: ['Wallet', 'Original Payment Method'], default: 'Original Payment Method' },
        refundDetails: {
            gatewayRefundId: String,
            walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
            processedAt: Date,
            destination: String,
            amount: Number,
            failureReason: String,
        },
        adminNote: String,
        rejectionReason: String,
        images: [String],
    },
    { timestamps: true }
);

const ReturnRequest = mongoose.models.ReturnRequest || mongoose.model('ReturnRequest', returnRequestSchema);
export { ReturnRequest };
export default ReturnRequest;
