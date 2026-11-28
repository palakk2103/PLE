import mongoose from 'mongoose';

const timelineSchema = new mongoose.Schema({
    senderType: { type: String, enum: ['buyer', 'seller', 'admin'], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    price: { type: Number },
    quantity: { type: Number },
    deliveryTimeline: { type: String }, // e.g. "5 days", "2026-06-20"
    notes: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const quotationMessageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderType: { type: String, enum: ['Vendor', 'SuperAdmin'], required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const quotationSchema = new mongoose.Schema({
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorName: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    deliveryTime: { type: String, required: true },
    warranty: { type: String },
    taxDetails: { type: String },
    additionalNotes: { type: String },
    attachments: [{ type: String }],
    status: { type: String, enum: ['Submitted', 'Negotiating', 'Selected', 'Rejected'], default: 'Submitted' },
    messages: [quotationMessageSchema],
    createdAt: { type: Date, default: Date.now }
});

const negotiationMessageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderType: { type: String, enum: ['B2BAdmin', 'Employee', 'b2bAdmin', 'b2bEmployee', 'SuperAdmin'], required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    attachments: [{ type: String }],
    isInternalNote: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const approvalHistorySchema = new mongoose.Schema({
    status: { type: String, required: true },
    action: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId },
    updaterType: { type: String, enum: ['SuperAdmin', 'B2BAdmin', 'Employee', 'b2bAdmin', 'b2bEmployee', 'System'], required: true },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Consumer (customer -> admin/vendor) RFQ negotiation entry. Append-only.
const consumerTimelineSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderType: { type: String, enum: ['customer', 'admin', 'seller', 'system'], required: true },
    senderName: { type: String },
    action: {
        type: String,
        enum: ['rfq_created', 'quotation', 'counter_offer', 'message', 'accepted', 'rejected', 'converted'],
        required: true
    },
    message: { type: String },
    priceOffer: { type: Number },
    quantity: { type: Number },
    offerVersion: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

const notConsumer = function () { return this.rfqType !== 'consumer'; };

const rfqSchema = new mongoose.Schema(
    {
        rfqId: { type: String, required: true, unique: true, index: true },
        // Discriminates Managed Sourcing / B2B RFQs (default, all legacy docs) from Consumer RFQs.
        rfqType: { type: String, enum: ['managed', 'consumer'], default: 'managed', index: true },
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2BCompany', required: notConsumer, index: true },
        companyName: { type: String, required: notConsumer },
        createdByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        createdByEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        assignedVendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true }],
        
        buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // For backwards compatibility
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true }, // For backwards compatibility
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
        customProductName: { type: String },
        title: { type: String, trim: true, maxlength: 200 },
        quantity: { type: Number, required: true },
        targetPrice: { type: Number, required: notConsumer },

        // ── Consumer RFQ fields (rfqType === 'consumer') ──
        targetType: { type: String, enum: ['admin', 'vendor'], index: true }, // who owns the product
        targetAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        expectedPrice: { type: Number, min: 0 },
        quotedPrice: { type: Number, min: 0 },
        finalAgreedPrice: { type: Number, min: 0 },
        finalAgreedQuantity: { type: Number, min: 1 },
        currentOffer: {
            by: { type: String, enum: ['customer', 'owner'] },
            price: { type: Number },
            quantity: { type: Number },
            version: { type: Number, default: 0 }
        },
        consumerTimeline: [consumerTimelineSchema],
        acceptedAt: { type: Date },
        convertedAt: { type: Date },
        convertedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        requirementDetails: { type: String },
        qualityStandards: { type: String },
        termsConditions: { type: String },
        expectedDeliveryDate: { type: Date },
        attachment: { type: String }, // optional general document URL
        priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
        category: { type: String }, // e.g. "Electronics"
        
        status: {
            type: String,
            enum: [
                'Draft',
                'Submitted',
                'Pending',
                'Under Review',
                'Approved',
                'Sent To Vendors',
                'Quotations Received',
                'Vendor Evaluation',
                'Vendor Negotiation',
                'Vendor Selected',
                'Awaiting B2B Approval',
                'Purchase Order Generated',
                'Completed',
                'Rejected',
                // Consumer RFQ statuses (additive)
                'Negotiating',
                'Quotation Sent',
                'Counter Offer',
                'Accepted',
                'Converted To Order'
            ],
            default: 'Draft',
            index: true
        },
        
        quotations: [quotationSchema],
        negotiationMessages: [negotiationMessageSchema],
        approvalHistory: [approvalHistorySchema],
        timeline: [timelineSchema] // For backwards compatibility
    },
    { timestamps: true }
);

rfqSchema.index({ rfqType: 1, targetType: 1, status: 1, createdAt: -1 });
rfqSchema.index({ rfqType: 1, buyerId: 1, createdAt: -1 });
rfqSchema.index({ rfqType: 1, sellerId: 1, createdAt: -1 });
// Guarantees one order per RFQ even under races.
rfqSchema.index({ convertedOrderId: 1 }, { unique: true, partialFilterExpression: { convertedOrderId: { $type: 'objectId' } } });

const RFQ = mongoose.models.RFQ || mongoose.model('RFQ', rfqSchema);
export default RFQ;
export { RFQ };
