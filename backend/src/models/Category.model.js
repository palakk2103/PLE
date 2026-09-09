import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true },
        description: { type: String, trim: true, default: '' },
        image: { type: String },
        icon: { type: String, default: 'Package' },
        parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
        order: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'approved',
            index: true,
        },
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor',
            index: true,
        },
        requestedByShop: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ManagedShop',
        },
        rejectionReason: { type: String },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
        },
        reviewedAt: { type: Date },
        isActive: { type: Boolean, default: true },
        isRefurbishedCategory: { type: Boolean, default: false },
        gstRate: { type: Number, min: 0, max: 100, default: 18 },
    },
    { timestamps: true }
);

categorySchema.index({ parentId: 1, order: 1 });
categorySchema.index({ isRefurbishedCategory: 1 });
categorySchema.index({ status: 1 });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
export { Category };
export default Category;

