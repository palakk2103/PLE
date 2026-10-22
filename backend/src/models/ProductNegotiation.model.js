import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
    round: { type: Number, required: true },
    price: { type: Number, required: true, min: 0.01 },
    notes: { type: String, trim: true, default: '' },
    offeredByRole: { type: String, enum: ['admin', 'managed_vendor'], required: true },
    offeredById: { type: mongoose.Schema.Types.ObjectId, required: true },
    offeredByName: { type: String, trim: true, default: '' },
    offeredAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'superseded'],
        default: 'pending'
    },
    respondedAt: { type: Date },
    respondedById: { type: mongoose.Schema.Types.ObjectId },
    responseNotes: { type: String, trim: true, default: '' }
}, { _id: true });

const productNegotiationSchema = new mongoose.Schema(
    {
        sourceProductId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
            index: true
        },
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ManagedShop',
            required: true,
            index: true
        },
        vendorUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ManagedVendorUser',
            required: true,
            index: true
        },
        initialSupplyPrice: {
            type: Number,
            required: true,
            min: 0.01
        },
        status: {
            type: String,
            enum: ['pending_review', 'in_negotiation', 'agreed_locked', 'rejected', 'cancelled'],
            default: 'pending_review',
            index: true
        },
        currentOffer: offerSchema,
        offers: [offerSchema],
        finalAgreedPrice: {
            type: Number,
            min: 0.01
        },
        isLocked: {
            type: Boolean,
            default: false,
            index: true
        },
        lockedAt: { type: Date },
        lockedByAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin'
        },
        lockedByVendor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ManagedVendorUser'
        },
        listingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            index: true
        },
        auditLog: [
            {
                action: { type: String, required: true },
                performedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
                performerRole: { type: String, enum: ['admin', 'managed_vendor', 'system'], required: true },
                performerName: { type: String, default: '' },
                timestamp: { type: Date, default: Date.now },
                details: { type: mongoose.Schema.Types.Mixed }
            }
        ]
    },
    { timestamps: true }
);

productNegotiationSchema.index({ sourceProductId: 1, isLocked: 1 });
productNegotiationSchema.index({ shopId: 1, status: 1 });
productNegotiationSchema.index({ vendorUserId: 1, status: 1 });

const ProductNegotiation = mongoose.models.ProductNegotiation || mongoose.model('ProductNegotiation', productNegotiationSchema);

export { ProductNegotiation };
export default ProductNegotiation;
