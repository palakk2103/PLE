import mongoose from 'mongoose';

const purchaseOrderSchema = new mongoose.Schema(
    {
        poNumber: { type: String, required: true, unique: true, index: true },
        rfqId: { type: mongoose.Schema.Types.ObjectId, ref: 'RFQ', required: false, index: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false, index: true },
        orderNumber: { type: String, required: false },
        sourceType: { type: String, enum: ['RFQ', 'DirectPurchase'], default: 'RFQ' },
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'B2BCompany', required: true, index: true },
        companyDetails: {
            name: { type: String, required: true },
            email: { type: String, required: true },
            phone: { type: String, required: true },
            address: { type: String, required: true },
            gstin: { type: String }
        },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
        vendorDetails: {
            storeName: { type: String, required: true },
            name: { type: String, required: true },
            email: { type: String, required: true },
            phone: { type: String, required: true }
        },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productDetails: {
            name: { type: String, required: true },
            qty: { type: Number, required: true },
            unitPrice: { type: Number, required: true },
            totalPrice: { type: Number, required: true }
        },
        terms: {
            warranty: { type: String },
            paymentTerms: { type: String }, // e.g. "NET 30 Days"
            deliveryTerms: { type: String }, // e.g. "FOB Destination"
            termsConditions: { type: String }
        },
        pricing: {
            subtotal: { type: Number, required: true },
            tax: { type: Number, default: 0 },
            total: { type: Number, required: true }
        },
        deliveryInformation: {
            expectedDeliveryDate: { type: Date },
            shippingAddress: { type: String, required: true }
        },
        status: {
            type: String,
            enum: ['Sent', 'Approved', 'Completed', 'Cancelled'],
            default: 'Sent',
            index: true
        },
        paymentStatus: {
            type: String,
            enum: ['Unpaid', 'Paid', 'Pending'],
            default: 'Unpaid',
            index: true
        },
        paymentMethod: {
            type: String,
            enum: ['Card', 'UPI', 'NetBanking', 'None'],
            default: 'None'
        },
        paymentDetails: {
            transactionId: { type: String },
            paidAt: { type: Date },
            cardLast4: { type: String }
        }
    },
    { timestamps: true }
);

const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
export { PurchaseOrder };
