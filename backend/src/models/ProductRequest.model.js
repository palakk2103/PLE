import mongoose from 'mongoose';

const timelineSchema = new mongoose.Schema({
    status: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    comment: {
        type: String
    }
}, { _id: false });

const sellerResponseSchema = new mongoose.Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'sellerResponses.sellerType'
    },
    sellerType: {
        type: String,
        enum: ['Vendor', 'ManagedVendorUser', 'Admin'],
        required: true,
        default: 'Vendor'
    },
    responseType: {
        type: String,
        enum: ['Can Supply', 'Need Info'],
        default: 'Can Supply'
    },
    offeredPrice: {
        type: Number
    },
    deliveryTimeline: {
        type: Number // in days
    },
    message: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'auditLog.performerType'
    },
    performerType: {
        type: String,
        enum: ['User', 'Vendor', 'ManagedVendorUser', 'Admin'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    reason: {
        type: String
    }
}, { _id: false });

const productRequestSchema = new mongoose.Schema({
    requestId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requestType: {
        type: String,
        enum: ['GENERAL', 'SHOP_SPECIFIC'],
        default: 'GENERAL',
        index: true
    },
    targetEntityType: {
        type: String,
        enum: ['Vendor', 'ManagedShop'],
        required: function() { return this.requestType === 'SHOP_SPECIFIC'; }
    },
    targetEntityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: function() { return this.requestType === 'SHOP_SPECIFIC'; },
        refPath: 'targetEntityType',
        index: true
    },
    productMasterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        index: true
    },
    fulfillmentType: {
        type: String,
        enum: ['PLE_SHOP', 'VENDOR', 'SPLIT', 'NONE'],
        default: 'NONE'
    },
    pleFulfillment: {
        availableQuantity: { type: Number, default: 0 },
        status: { type: String, enum: ['AVAILABLE', 'PARTIAL', 'NOT_AVAILABLE'], default: 'NOT_AVAILABLE' }
    },
    assignedVendors: [{
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
        status: { type: String, enum: ['ASSIGNED', 'RESPONDED', 'REJECTED', 'UNAVAILABLE'], default: 'ASSIGNED' },
        offeredPrice: { type: Number },
        availableQuantity: { type: Number },
        deliveryTimeline: { type: Number }, // in days
        message: { type: String },
        assignedAt: { type: Date, default: Date.now },
        respondedAt: { type: Date }
    }],
    selectedFulfillment: {
        pleQuantity: { type: Number, default: 0 },
        vendors: [{
            vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
            quantity: { type: Number },
            price: { type: Number }
        }],
        finalPrice: { type: Number },
        estimatedDelivery: { type: Date },
        notes: { type: String }
    },
    associatedOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        index: true
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    expectedBudget: {
        type: Number,
        required: true,
        min: 1
    },
    description: {
        type: String,
        trim: true
    },
    image: {
        type: String
    },
    status: {
        type: String,
        enum: [
            'Submitted', 
            'Under Review', 
            'PLE Sourcing',
            'Vendor Sourcing', 
            'Seller Responded', 
            'Admin Review', 
            'Final Proposal',
            'Accepted', 
            'Confirmed',
            'Completed',
            'Rejected', 
            'Product Added', 
            'Cancelled',
            // --- Vendor Window statuses (new) ---
            'Vendor Window Open',
            'Vendor Accepted',
            'Vendor Fulfillment',
            'Vendor Released',
            'Quotation Submitted',
            'Negotiation',
            'Customer Approved',
            'Expired'
        ],
        default: 'Submitted',
        index: true
    },
    // ─── Vendor Window Fields ──────────────────────────────────────────────────
    windowStatus: {
        type: String,
        enum: ['NONE', 'OPEN', 'VENDOR_LOCKED', 'REOPENED', 'EXPIRED', 'CLOSED'],
        default: 'NONE',
        index: true
    },
    windowOpenedAt: { type: Date, default: null },
    windowExpiresAt: { type: Date, default: null, index: true },
    // ─── Vendor Lock Fields ────────────────────────────────────────────────────
    acceptedVendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        default: null,
        index: true
    },
    vendorAcceptedAt: { type: Date, default: null },
    vendorFulfillmentExpiresAt: { type: Date, default: null, index: true },
    vendorFulfillmentStatus: {
        type: String,
        enum: ['NONE', 'IN_PROGRESS', 'RELEASED', 'FULFILLED'],
        default: 'NONE'
    },
    releasedVendors: [{
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
        releasedAt: { type: Date, default: Date.now },
        reason: { type: String }
    }],
    // ─── Chat & Quotation Fields ───────────────────────────────────────────────
    chatThreadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VendorChatThread',
        default: null
    },
    vendorQuotations: [{
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
        unitPrice: { type: Number, required: true },
        totalPrice: { type: Number, required: true },
        deliveryEstimate: { type: String },
        additionalTerms: { type: String },
        notes: { type: String },
        status: {
            type: String,
            enum: ['Pending', 'Accepted', 'Rejected', 'NegotiationRequested'],
            default: 'Pending'
        },
        submittedAt: { type: Date, default: Date.now },
        respondedAt: { type: Date }
    }],
    timeline: [timelineSchema],
    sellerResponses: [sellerResponseSchema],
    auditLog: [auditLogSchema],
    // ─── Vendor Extension Request Fields ──────────────────────────────────────
    extensionRequest: {
        status: {
            type: String,
            enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
            default: 'NONE'
        },
        requestedDays: { type: Number },
        currentDeadline: { type: Date },
        proposedDeadline: { type: Date },
        reason: { type: String, trim: true },
        requestedAt: { type: Date },
        respondedAt: { type: Date },
        respondedBy: { type: mongoose.Schema.Types.ObjectId }
    },
    extensionHistory: [{
        requestedDays: { type: Number },
        previousDeadline: { type: Date },
        proposedDeadline: { type: Date },
        approvedDeadline: { type: Date },
        reason: { type: String },
        status: { type: String, enum: ['APPROVED', 'REJECTED'] },
        requestedAt: { type: Date },
        respondedAt: { type: Date },
        respondedBy: { type: mongoose.Schema.Types.ObjectId }
    }]
}, { timestamps: true });

// Compounding index for user and dates
productRequestSchema.index({ userId: 1, createdAt: -1 });

// Ensure timeline and auditLog has the initial state upon creation
productRequestSchema.pre('save', function (next) {
    if (this.isNew) {
        if (this.timeline.length === 0) {
            this.timeline.push({
                status: 'Submitted',
                comment: 'Your product request has been successfully submitted.'
            });
        }
        if (this.auditLog.length === 0) {
            this.auditLog.push({
                action: 'Created',
                performedBy: this.userId,
                performerType: 'User',
                reason: 'Initial submission of product request.'
            });
        }
    }
    next();
});

const ProductRequest = mongoose.models.ProductRequest || mongoose.model('ProductRequest', productRequestSchema);

export default ProductRequest;
