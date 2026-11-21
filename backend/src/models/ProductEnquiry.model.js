import mongoose from 'mongoose';
import crypto from 'crypto';

const timelineSchema = new mongoose.Schema({
    status: { type: String, required: true },
    date: { type: Date, default: Date.now },
    note: { type: String }
}, { _id: false });

const productEnquirySchema = new mongoose.Schema({
    enquiryId: {
        type: String,
        unique: true,
        required: true,
        // 6 random hex chars = 16 million values per year (the old 4 digits collided after a few hundred enquiries)
        default: () => `PE-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        default: null // null indicates it belongs to the Admin
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    question: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    attachment: {
        type: String, // URL of the uploaded file
        default: null
    },
    status: {
        type: String,
        enum: ['Submitted', 'Under Review', 'Need More Information', 'Seller Responded', 'Resolved', 'Closed'],
        default: 'Submitted'
    },
    sellerResponse: {
        type: String,
        default: null
    },
    // The full conversation (question, answers, follow-ups). `sellerResponse` keeps the latest seller answer.
    messages: [{
        senderType: { type: String, enum: ['customer', 'vendor', 'admin'], required: true },
        senderId: { type: mongoose.Schema.Types.ObjectId },
        message: { type: String, required: true, maxlength: 5000 },
        createdAt: { type: Date, default: Date.now },
    }],
    timeline: [timelineSchema]
}, { timestamps: true });

// Pre-save hook to add the initial timeline entry if it's new
productEnquirySchema.pre('save', function(next) {
    if (this.isNew && this.timeline.length === 0) {
        this.timeline.push({
            status: 'Submitted',
            note: 'Enquiry submitted successfully.'
        });
    }
    next();
});

const ProductEnquiry = mongoose.models.ProductEnquiry || mongoose.model('ProductEnquiry', productEnquirySchema);

export { ProductEnquiry };
export default ProductEnquiry;
