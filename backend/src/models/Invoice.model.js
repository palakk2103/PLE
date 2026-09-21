import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema(
    {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true },
        name: { type: String, required: true },
        image: { type: String },
        variantKey: { type: String },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, default: 1 },
        taxableAmount: { type: Number, default: 0 },
        gstRate: { type: Number, default: 18 },
        gstAmount: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true },
    },
    { _id: false }
);

const sellerBreakdownSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true },
        storeName: { type: String, default: '' },
        sellerName: { type: String, default: '' },
        sellerEmail: { type: String, default: '' },
        sellerPhone: { type: String, default: '' },
        sellerAddress: {
            street: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            zipCode: { type: String, default: '' },
            country: { type: String, default: '' },
        },
        sellerGst: { type: String, default: '' },
        subtotal: { type: Number, default: 0 },
        shipping: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        // Internal seller/admin fields
        commissionRate: { type: Number, default: 0 },
        commissionAmount: { type: Number, default: 0 },
        sellerPayableAmount: { type: Number, default: 0 },
        settlementStatus: {
            type: String,
            enum: ['pending', 'settled', 'cancelled'],
            default: 'pending',
        },
        settledAt: { type: Date },
    },
    { _id: false }
);

const invoiceSchema = new mongoose.Schema(
    {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            unique: true,
            index: true,
        },
        orderNumber: {
            type: String,
            required: true,
            index: true,
            trim: true,
        },
        invoiceDate: {
            type: Date,
            default: Date.now,
            index: true,
        },
        customerType: {
            type: String,
            enum: ['b2c', 'b2b'],
            default: 'b2c',
            index: true,
        },
        orderType: {
            type: String,
            enum: ['b2c', 'b2b', 'product_request', 'rfq'],
            default: 'b2c',
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
            default: null,
        },
        customer: {
            name: { type: String, default: 'Customer' },
            email: { type: String, default: '' },
            phone: { type: String, default: '' },
        },
        b2bDetails: {
            companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2BCompany' },
            companyName: { type: String, default: '' },
            gstNumber: { type: String, default: '' },
            businessEmail: { type: String, default: '' },
            businessPhone: { type: String, default: '' },
            companyAddress: { type: String, default: '' },
            companyType: { type: String, default: '' },
        },
        b2bBulkDetails: {
            companyName: { type: String, default: '' },
            gstNumber: { type: String, default: '' },
            totalBulkQuantity: { type: Number, default: 0 },
            bulkPricingApplied: { type: Boolean, default: false },
            poNumber: { type: String, default: '' },
            orderTerms: { type: String, default: '' },
        },
        productRequestDetails: {
            requestId: { type: String, default: '' },
            requestDbId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductRequest' },
            productName: { type: String, default: '' },
            category: { type: String, default: '' },
            requestedQuantity: { type: Number, default: 0 },
            agreedQuantity: { type: Number, default: 0 },
            finalPrice: { type: Number, default: 0 },
            notes: { type: String, default: '' },
        },
        rfqDetails: {
            rfqId: { type: String, default: '' },
            rfqDbId: { type: mongoose.Schema.Types.ObjectId, ref: 'RFQ' },
            productName: { type: String, default: '' },
            quotedPrice: { type: Number, default: 0 },
            agreedQuantity: { type: Number, default: 0 },
            terms: { type: String, default: '' },
            notes: { type: String, default: '' },
        },
        billingAddress: {
            name: { type: String, default: '' },
            email: { type: String, default: '' },
            phone: { type: String, default: '' },
            address: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            zipCode: { type: String, default: '' },
            country: { type: String, default: 'India' },
        },
        shippingAddress: {
            name: { type: String, default: '' },
            email: { type: String, default: '' },
            phone: { type: String, default: '' },
            address: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            zipCode: { type: String, default: '' },
            country: { type: String, default: 'India' },
        },
        items: [invoiceItemSchema],
        sellerBreakdown: [sellerBreakdownSchema],
        financialSummary: {
            subtotal: { type: Number, default: 0 },
            shipping: { type: Number, default: 0 },
            tax: { type: Number, default: 0 },
            discount: { type: Number, default: 0 },
            couponCode: { type: String, default: '' },
            couponDiscount: { type: Number, default: 0 },
            loyaltyDiscount: { type: Number, default: 0 },
            grandTotal: { type: Number, default: 0 },
            walletAmountUsed: { type: Number, default: 0 },
            amountPaid: { type: Number, default: 0 },
            totalPlatformCommission: { type: Number, default: 0 },
            totalSellerEarnings: { type: Number, default: 0 },
        },
        payment: {
            method: { type: String, default: 'cod' },
            status: {
                type: String,
                enum: ['pending', 'paid', 'failed', 'refunded', 'authorized', 'captured', 'success', 'cancelled'],
                default: 'pending',
            },
            gateway: { type: String, default: 'Razorpay' },
            transactionId: { type: String, default: '' },
            transactionTime: { type: Date },
            cardLast4: { type: String },
            cardNetwork: { type: String },
            bankName: { type: String },
        },
        status: {
            type: String,
            enum: ['issued', 'paid', 'cancelled', 'refunded'],
            default: 'issued',
            index: true,
        },
        notes: { type: String, default: '' },
    },
    { timestamps: true }
);

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
export { Invoice };
export default Invoice;
