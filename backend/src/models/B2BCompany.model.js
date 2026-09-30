import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const b2bCompanySchema = new mongoose.Schema(
    {
        companyName: { 
            type: String, 
            required: true, 
            trim: true 
        },
        gstNumber: { 
            type: String, 
            required: true, 
            trim: true 
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
            enum: ['Pending Verification', 'Approved', 'Rejected', 'Suspended'], 
            default: 'Pending Verification' 
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

