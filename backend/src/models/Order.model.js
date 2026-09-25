import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true },
    name: String,
    image: String,
    price: Number,
    quantity: Number,
    variant: { type: mongoose.Schema.Types.Mixed, default: {} },
    variantKey: String,
    gstMode: { type: String, default: 'category' },
    gstRate: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    taxIncluded: { type: Boolean, default: false },
});

const vendorItemGroupSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: String,
    items: [orderItemSchema],
    subtotal: Number,
    shipping: Number,
    tax: Number,
    discount: Number,
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending',
    },
});

const orderSchema = new mongoose.Schema(
    {
        orderId: { type: String, required: true, unique: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
        guestInfo: { name: String, email: String, phone: String },
        items: [orderItemSchema],
        vendorItems: [vendorItemGroupSchema],
        shippingAddress: {
            name: String,
            email: String,
            phone: String,
            address: String,
            city: String,
            state: String,
            zipCode: String,
            country: String,
        },
        paymentMethod: { type: String, enum: ['card', 'cash', 'bank', 'wallet', 'upi', 'cod'] },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded', 'authorized', 'captured', 'success', 'cancelled'],
            default: 'pending',
        },
        paymentDetails: {
            razorpayPaymentId: String,
            razorpayOrderId: String,
            razorpaySignature: String,
            cardNetwork: String,
            cardLast4: String,
            bankName: String,
            transactionTime: Date,
            gatewayName: { type: String, default: 'Razorpay' },
            paymentMethod: String,
            status: String,
            amount: Number,
        },
        status: {
            type: String,
            enum: ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
            default: 'pending',
            index: true,
        },
        subtotal: { type: Number, default: 0 },
        shipping: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        couponCode: { type: String },
        couponDiscount: { type: Number, default: 0 },
        loyaltyPointsEarned: { type: Number, default: 0 },
        loyaltyPointsRedeemed: { type: Number, default: 0 },
        loyaltyDiscount: { type: Number, default: 0 },
        walletAmountUsed: { type: Number, default: 0 },
        walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
        idempotencyKey: { type: String, sparse: true },
        idempotencyScope: { type: String, sparse: true },
        trackingNumber: { type: String, unique: true, sparse: true },
        deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryBoy', index: true },
        deliveryOtpHash: { type: String, select: false },
        deliveryOtpExpiry: { type: Date, select: false },
        deliveryOtpSentAt: { type: Date, select: false },
        deliveryOtpDebug: { type: String, select: false },
        deliveryOtpVerifiedAt: Date,
        deliveryOtpAttempts: { type: Number, default: 0, select: false },
        estimatedDelivery: Date,
        processingAt: Date,
        shippedAt: Date,
        outForDeliveryAt: Date,
        deliveredAt: Date,
        isCashSettled: { type: Boolean, default: false },
        settledAt: Date,
        cancelledAt: Date,
        cancellationReason: String,
        statusHistory: [
            {
                status: { type: String, required: true },
                timestamp: { type: Date, default: Date.now },
                note: { type: String },
                updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                updatedByRole: { type: String, enum: ['admin', 'vendor', 'delivery', 'user', 'system'] },
            }
        ],
        emailNotifications: [
            {
                status: { type: String, required: true },
                recipientEmail: { type: String, required: true },
                sentAt: { type: Date, default: Date.now },
                success: { type: Boolean, default: true },
                messageId: { type: String },
                error: { type: String },
            }
        ],
        invoiceEmailSent: { type: Boolean, default: false, index: true },
        invoiceEmailSentAt: { type: Date },
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: Date,
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        requestProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductRequest', index: true },
        rfqId: { type: mongoose.Schema.Types.ObjectId, ref: 'RFQ', index: true },
        orderType: {
            type: String,
            enum: ['b2c', 'b2b', 'product_request', 'rfq'],
            default: 'b2c',
            index: true
        }
    },
    { timestamps: true }
);

// Prevent duplicate order creation for the same retry key per actor (user/guest).
orderSchema.index(
    { idempotencyScope: 1, idempotencyKey: 1 },
    {
        unique: true,
        sparse: true,
        partialFilterExpression: {
            idempotencyScope: { $exists: true, $type: 'string' },
            idempotencyKey: { $exists: true, $type: 'string' },
        },
    }
);

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export { Order };
export default Order;
