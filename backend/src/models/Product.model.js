import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, index: true },
        slug: { type: String, required: true, unique: true },
        description: { type: String },
        price: { type: Number, required: true, min: 0 },
        originalPrice: { type: Number },
        unit: { type: String, default: 'Piece' },
        images: [{ type: String }],
        image: { type: String }, // primary image
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
        brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', index: true },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: function() { return !this.shopId; }, index: true },
        stock: {
            type: String,
            enum: ['in_stock', 'low_stock', 'out_of_stock'],
            default: 'in_stock',
            index: true,
        },
        stockQuantity: { type: Number, default: 0, min: 0 },
        totalAllowedQuantity: { type: Number, min: 0 },
        minimumOrderQuantity: { type: Number, min: 1, default: 1 },
        lowStockThreshold: { type: Number, default: 10 },
        variants: {
            sizes: [String],
            colors: [String],
            materials: [String],
            attributes: [{
                name: String,
                values: [String],
            }],
            prices: { type: Map, of: Number },
            stockMap: { type: Map, of: Number },
            imageMap: { type: Map, of: String },
            defaultVariant: {
                size: String,
                color: String,
            },
            defaultSelection: {
                type: Map,
                of: String,
            },
        },
        flashSale: { type: Boolean, default: false, index: true },
        isNewArrival: { type: Boolean, default: false, index: true },
        isFeatured: { type: Boolean, default: false, index: true },
        isActive: { type: Boolean, default: true, index: true },
        isVisible: { type: Boolean, default: true },
        codAllowed: { type: Boolean, default: true },
        returnable: { type: Boolean, default: true },
        cancelable: { type: Boolean, default: true },
        taxIncluded: { type: Boolean, default: false },
        warrantyPeriod: { type: String },
        guaranteePeriod: { type: String },
        hsnCode: { type: String },
        rating: { type: Number, default: 0, min: 0, max: 5 },
        reviewCount: { type: Number, default: 0 },
        taxRate: { type: Number, default: 18 },
        gstMode: { type: String, enum: ['category', 'custom'], default: 'category', index: true },
        gstRate: { type: Number, min: 0, max: 100, default: 18 },
        b2bEnabled: { type: Boolean, default: false },
        salesChannel: {
            type: String,
            enum: ['B2C', 'B2B', 'BOTH'],
            default: 'B2C',
            index: true,
        },
        b2bWholesalePrice: { type: Number },
        b2bMinOrderQty: { type: Number, default: 1 },
        b2bBulkPricingSlabs: [{
            minQty: Number,
            maxQty: Number,
            pricePerUnit: Number
        }],
        isRefurbished: { type: Boolean, default: false },
        refurbishedDetails: {
            condition: { type: String, enum: ['refurbished', 'renewed', 'open_box'] },
            grade: { type: String, enum: ['A', 'B', 'C'] },
            usageAge: { type: String },
            purchaseYear: { type: Number },
            batteryHealth: { type: Number },
            cosmeticCondition: { type: String },
            functionalCondition: { type: String },
            replacedParts: { type: String },
            repairDetails: { type: String },
            warrantyDuration: { type: String },
            warrantyType: { type: String },
            accessories: [{ type: String }],
            tested: { type: Boolean, default: false },
            certified: { type: Boolean, default: false },
            qualityChecked: { type: Boolean, default: false },
            flagged: { type: Boolean, default: false },
            flagReason: { type: String },
            approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
            rejectionReason: { type: String },
        },
        seoTitle: { type: String },
        seoDescription: { type: String },
        relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
        faqs: [{ question: String, answer: String }],
        tags: [String],

        // Flat refurbished fields sent from frontend forms
        condition: { type: String, default: 'brand_new' },
        refurbishedGrade: { type: String },
        refurbishedWarrantyDuration: { type: String },
        deviceHealthBattery: { type: Number },
        deviceHealthCosmetic: { type: String },
        deviceHealthFunctional: { type: String },
        isTested: { type: Boolean },
        isFullyFunctional: { type: Boolean },
        isCertified: { type: Boolean },
        refurbishedOriginalMrp: { type: Number },
        refurbishedSellingPrice: { type: Number },
        accessoryCharger: { type: Boolean },
        accessoryBox: { type: Boolean },
        accessoryOthers: { type: Boolean },
        cosmeticDamageNotes: { type: String },
        productAgeMonths: { type: String },
        purchaseYear: { type: Number },
        repairHistory: { type: String },
        refurbishedApprovalStatus: { type: String },
        shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManagedShop', index: true },
        vendorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManagedVendorUser', index: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId },
        updatedBy: { type: mongoose.Schema.Types.ObjectId },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        approvalStatus: { type: String, enum: ['draft', 'pending', 'approved', 'rejected', 'archived'], default: 'approved', index: true },
        brandApprovalStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none', index: true },
        customBrandName: { type: String, trim: true },
        categoryApprovalStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none', index: true },
        customCategoryName: { type: String, trim: true },
        customParentCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        rejectionReason: { type: String },
        auditLog: [{
            action: { type: String },
            userId: { type: mongoose.Schema.Types.ObjectId },
            userType: { type: String, enum: ['admin', 'managed_vendor', 'vendor'] },
            timestamp: { type: Date, default: Date.now },
            reason: { type: String }
        }],
    },
    { timestamps: true }
);

productSchema.index({ vendorId: 1, isActive: 1 });
productSchema.index({ categoryId: 1, isActive: 1 });
productSchema.index({ salesChannel: 1, isActive: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

productSchema.pre('save', function (next) {
    // Sync b2bEnabled from salesChannel for backward compatibility
    if (this.isModified('salesChannel') || this.isNew) {
        this.b2bEnabled = (this.salesChannel === 'B2B' || this.salesChannel === 'BOTH');
    }

    const cond = this.get('condition');
    if (cond && cond !== 'brand_new') {
        this.isRefurbished = true;
        
        const details = this.refurbishedDetails || {};
        details.condition = cond;
        
        if (this.get('refurbishedGrade')) details.grade = this.get('refurbishedGrade');
        if (this.get('productAgeMonths')) details.usageAge = String(this.get('productAgeMonths'));
        if (this.get('purchaseYear')) details.purchaseYear = Number(this.get('purchaseYear'));
        if (this.get('deviceHealthBattery')) details.batteryHealth = Number(this.get('deviceHealthBattery'));
        if (this.get('deviceHealthCosmetic')) details.cosmeticCondition = String(this.get('deviceHealthCosmetic'));
        if (this.get('deviceHealthFunctional')) details.functionalCondition = String(this.get('deviceHealthFunctional'));
        if (this.get('repairHistory')) details.repairDetails = String(this.get('repairHistory'));
        if (this.get('refurbishedWarrantyDuration')) details.warrantyDuration = String(this.get('refurbishedWarrantyDuration'));
        
        const accs = [];
        if (this.get('accessoryCharger')) accs.push('Charger');
        if (this.get('accessoryBox')) accs.push('Box');
        if (this.get('accessoryOthers')) accs.push('Others');
        details.accessories = accs;
        
        details.tested = !!this.get('isTested');
        details.certified = !!this.get('isCertified');
        details.qualityChecked = true;
        details.approvalStatus = this.get('refurbishedApprovalStatus') || 'approved';
        
        this.refurbishedDetails = details;
    } else if (cond === 'brand_new') {
        this.isRefurbished = false;
        this.refurbishedDetails = undefined;
    }
    next();
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
export { Product };
export default Product;

