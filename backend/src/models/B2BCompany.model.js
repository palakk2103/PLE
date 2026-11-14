import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const docSchema = {
    url: { type: String },
    fileName: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    uploadedAt: { type: Date }
};

const b2bCompanySchema = new mongoose.Schema(
    {
        companyName: { 
            type: String, 
            required: true, 
            trim: true 
        },
        // gstNumber is mandatory unless the registrant explicitly declared "no GST" (gstRegistered === false).
        // Legacy records (gstRegistered undefined) keep the original mandatory behaviour.
        gstNumber: { 
            type: String, 
            required: function () { return this.gstRegistered !== false; },
            default: '',
            trim: true 
        },
        gstRegistered: { type: Boolean },
        gstDetails: {
            legalName: { type: String, trim: true },
            registrationType: { type: String, trim: true },
            state: { type: String, trim: true }
        },
        companyRegistrationNumber: { type: String, trim: true },
        addressDetails: {
            line1: { type: String, trim: true },
            line2: { type: String, trim: true },
            country: { type: String, trim: true },
            state: { type: String, trim: true },
            city: { type: String, trim: true },
            pincode: { type: String, trim: true }
        },
        addressProof: docSchema,
        bankStatement: docSchema,
        bankDocumentType: { type: String, enum: ['bank_statement', 'cancelled_cheque', ''], default: '' },
        authorisedSignatory: {
            fullName: { type: String, trim: true },
            designation: { type: String, trim: true },
            email: { type: String, trim: true, lowercase: true },
            mobile: { type: String, trim: true },
            identityDocument: docSchema,
            authorisationDocument: docSchema,
            declaration: {
                accepted: { type: Boolean, default: false },
                acceptedAt: { type: Date }
            }
        },
        adminInfo: {
            sameAsSignatory: { type: Boolean, default: false },
            name: { type: String, trim: true },
            email: { type: String, trim: true, lowercase: true },
            phone: { type: String, trim: true },
            designation: { type: String, trim: true }
        },
        registrationInfo: {
            version: { type: Number },
            submittedAt: { type: Date },
            draftId: { type: mongoose.Schema.Types.ObjectId }
        },
        businessEmail: { 
            type: String, 
            required: true, 
            trim: true, 
            lowercase: true 
        },
        businessPhone: { 
            type: String, 
            required: true, 
            trim: true 
        },
        companyAddress: { 
            type: String, 
            required: true, 
            trim: true 
        },
        companyType: { 
            type: String, 
            required: true,
            enum: [
                'Proprietorship',
                'Partnership Firm',
                'LLP (Limited Liability Partnership)',
                'Private Limited Company',
                'Public Limited Company',
                'One Person Company (OPC)',
                'Other'
            ]
        },
        website: { 
            type: String, 
            trim: true 
        },
        ownerSecretKey: {
            type: String,
            required: true,
            select: false
        },
        verificationStatus: { 
            type: String, 
            enum: ['Pending Verification', 'Approved', 'Rejected', 'Suspended', 'Resubmission Required'], 
            default: 'Pending Verification' 
        },
        documentResubmitNotes: {
            type: String,
            default: ''
        },
        documentResubmitRequestedAt: {
            type: Date
        },
        resubmitRequestedDocs: [{
            type: String
        }],
        resubmittedAt: {
            type: Date
        },
        status: { 
            type: String, 
            enum: ['Active', 'Inactive'], 
            default: 'Active' 
        },
        acceptanceExecutionDocument: {
            url: { type: String },
            fileName: { type: String },
            mimeType: { type: String },
            size: { type: Number },
            uploadedAt: { type: Date }
        },
        gstCertificate: {
            url: { type: String },
            fileName: { type: String },
            mimeType: { type: String },
            size: { type: Number },
            uploadedAt: { type: Date }
        },
        companyRegistrationProof: {
            url: { type: String },
            fileName: { type: String },
            mimeType: { type: String },
            size: { type: Number },
            uploadedAt: { type: Date }
        },
        cancelledCheque: {
            url: { type: String },
            fileName: { type: String },
            mimeType: { type: String },
            size: { type: Number },
            uploadedAt: { type: Date }
        },
        bankDetails: {
            accountHolderName: { type: String, default: '', trim: true },
            bankName: { type: String, default: '', trim: true },
            accountNumber: { type: String, default: '', trim: true },
            ifscCode: { type: String, default: '', trim: true, uppercase: true },
            accountType: { type: String, enum: ['Current', 'Savings', 'Other', ''], default: 'Current' },
            branchName: { type: String, default: '', trim: true },
            upiId: { type: String, default: '', trim: true },
            isVerified: { type: Boolean, default: false }
        },
        settings: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    { timestamps: true }
);

// Hash ownerSecretKey before saving
b2bCompanySchema.pre('save', async function (next) {
    if (!this.isModified('ownerSecretKey')) return next();
    this.ownerSecretKey = await bcrypt.hash(this.ownerSecretKey, 12);
    next();
});

// Compare secret key method
b2bCompanySchema.methods.compareSecretKey = async function (candidateKey) {
    return bcrypt.compare(candidateKey, this.ownerSecretKey);
};

const B2BCompany = mongoose.models.B2BCompany || mongoose.model('B2BCompany', b2bCompanySchema);
export default B2BCompany;

