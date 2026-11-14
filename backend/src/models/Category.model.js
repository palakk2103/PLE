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
        // Optional admin-configured specification fields (overrides built-in presets)
        specFields: [{
            _id: false,
            key: { type: String, required: true, trim: true },
            label: { type: String, required: true, trim: true },
            group: { type: String, enum: ['features', 'additional', 'itemDetails'], default: 'features' },
            type: { type: String, enum: ['text', 'textarea', 'number', 'select', 'multiselect', 'boolean', 'date'], default: 'text' },
            options: [String],
            unit: String,
            units: [String],
            required: { type: Boolean, default: false },
            placeholder: String,
        }],
    },
    { timestamps: true }
);

categorySchema.index({ parentId: 1, order: 1 });
categorySchema.index({ isRefurbishedCategory: 1 });
categorySchema.index({ status: 1 });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
export { Category };
export default Category;

