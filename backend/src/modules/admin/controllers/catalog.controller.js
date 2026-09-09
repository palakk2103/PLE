import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Product from '../../../models/Product.model.js';
import Category from '../../../models/Category.model.js';
import Brand from '../../../models/Brand.model.js';
import Settings from '../../../models/Settings.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { slugify } from '../../../utils/slugify.js';

const sanitizeFaqs = (faqs) => {
    if (!Array.isArray(faqs)) return [];
    return faqs
        .map((faq) => ({
            question: String(faq?.question || '').trim(),
            answer: String(faq?.answer || '').trim(),
        }))
        .filter((faq) => faq.question && faq.answer);
};

const normalizeVariantPart = (value) => String(value || '').trim().toLowerCase();

const uniqueAxisValues = (values = []) => {
    const seen = new Set();
    const out = [];
    for (const raw of values) {
        const value = String(raw || '').trim();
        if (!value) continue;
        const key = normalizeVariantPart(value);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
    }
    return out;
};

const createVariantKey = (size = '', color = '') =>
    `${normalizeVariantPart(size)}|${normalizeVariantPart(color)}`;
const normalizeAxisName = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
const createDynamicVariantKey = (selection = {}) =>
    Object.entries(selection || {})
        .map(([axis, value]) => [normalizeAxisName(axis), normalizeVariantPart(value)])
        .filter(([axis, value]) => axis && value)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([axis, value]) => `${axis}=${value}`)
        .join('|');

const toObjectEntries = (value) => {
    if (!value) return [];
    if (value instanceof Map) return Array.from(value.entries());
    if (typeof value === 'object') return Object.entries(value);
    return [];
};

const toNonNegativeNumber = (raw) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeAttributes = (rawAttributes = []) => {
    const seen = new Set();
    const attributes = [];
    for (const raw of rawAttributes || []) {
        const name = String(raw?.name || '').trim();
        const axisKey = normalizeAxisName(name);
        if (!name || !axisKey || seen.has(axisKey)) continue;
        seen.add(axisKey);
        const values = uniqueAxisValues(raw?.values || []);
        if (!values.length) continue;
        attributes.push({ name, axisKey, values });
    }
    return attributes;
};

const buildCombinationsFromAttributes = (attributes = []) => {
    if (!attributes.length) return [];
    let combos = [{}];
    attributes.forEach((attr) => {
        const next = [];
        combos.forEach((selection) => {
            attr.values.forEach((value) => next.push({ ...selection, [attr.axisKey]: value }));
        });
        combos = next;
    });
    return combos;
};

const normalizeVariantsPayload = (rawVariants = {}, fallbackPrice) => {
    if (!rawVariants || typeof rawVariants !== 'object') {
        return { sizes: [], colors: [], prices: {}, stockMap: {}, imageMap: {}, defaultVariant: {} };
    }

    const sizes = uniqueAxisValues(rawVariants.sizes || []);
    const colors = uniqueAxisValues(rawVariants.colors || []);
    const attributes = normalizeAttributes(rawVariants.attributes || []);
    const hasSizeAxis = sizes.length > 0;
    const hasColorAxis = colors.length > 0;
    const hasDynamicAxes = attributes.length > 0;
    const hasAnyAxis = hasDynamicAxes || hasSizeAxis || hasColorAxis;

    if (!hasAnyAxis) {
        return { sizes: [], colors: [], attributes: [], prices: {}, stockMap: {}, imageMap: {}, defaultVariant: {}, defaultSelection: {} };
    }

    const combinations = [];
    if (hasDynamicAxes) {
        buildCombinationsFromAttributes(attributes).forEach((selection) => combinations.push({ selection }));
    } else if (hasSizeAxis && hasColorAxis) {
        sizes.forEach((size) => colors.forEach((color) => combinations.push({ selection: { size, color } })));
    } else if (hasSizeAxis) {
        sizes.forEach((size) => combinations.push({ selection: { size } }));
    } else {
        colors.forEach((color) => combinations.push({ selection: { color } }));
    }

    const pricesSource = Object.fromEntries(toObjectEntries(rawVariants.prices));
    const stockSource = Object.fromEntries(toObjectEntries(rawVariants.stockMap));
    const imageSource = Object.fromEntries(toObjectEntries(rawVariants.imageMap));
    const prices = {};
    const stockMap = {};
    const imageMap = {};

    combinations.forEach(({ selection }) => {
        const size = String(selection?.size || '');
        const color = String(selection?.color || '');
        const key = hasDynamicAxes
            ? createDynamicVariantKey(selection)
            : createVariantKey(size, color);
        const parsedPrice = toNonNegativeNumber(pricesSource[key]);
        if (parsedPrice !== null) {
            prices[key] = parsedPrice;
        } else {
            const fallback = toNonNegativeNumber(fallbackPrice);
            if (fallback !== null) prices[key] = fallback;
        }

        const parsedStock = toNonNegativeNumber(stockSource[key]);
        if (parsedStock !== null) stockMap[key] = parsedStock;

        const image = String(imageSource[key] || '').trim();
        if (image) imageMap[key] = image;
    });

    const defaultSize = String(rawVariants?.defaultVariant?.size || '').trim();
    const defaultColor = String(rawVariants?.defaultVariant?.color || '').trim();
    const normalizedDefaultSize = hasSizeAxis ? defaultSize : '';
    const normalizedDefaultColor = hasColorAxis ? defaultColor : '';
    const hasValidDefaultSize = !normalizedDefaultSize || sizes.some((s) => normalizeVariantPart(s) === normalizeVariantPart(normalizedDefaultSize));
    const hasValidDefaultColor = !normalizedDefaultColor || colors.some((c) => normalizeVariantPart(c) === normalizeVariantPart(normalizedDefaultColor));
    if (!hasValidDefaultSize || !hasValidDefaultColor) {
        throw new ApiError(400, 'Default variant must exist in provided sizes/colors.');
    }

    const defaultSelection = {};
    if (rawVariants?.defaultSelection && typeof rawVariants.defaultSelection === 'object') {
        Object.entries(rawVariants.defaultSelection).forEach(([axis, value]) => {
            const axisKey = normalizeAxisName(axis);
            const selectedValue = String(value || '').trim();
            if (!axisKey || !selectedValue) return;
            const axisMeta = attributes.find((attr) => attr.axisKey === axisKey);
            if (!axisMeta) return;
            const matched = axisMeta.values.find(
                (candidate) => normalizeVariantPart(candidate) === normalizeVariantPart(selectedValue)
            );
            if (matched) defaultSelection[axisKey] = matched;
        });
    }

    return {
        sizes,
        colors,
        attributes: attributes.map((attr) => ({ name: attr.name, values: attr.values })),
        prices,
        stockMap,
        imageMap,
        defaultVariant: {
            size: normalizedDefaultSize,
            color: normalizedDefaultColor,
        },
        defaultSelection,
    };
};

const calculateVariantAggregateStock = (variants = {}) => {
    const entries = toObjectEntries(variants.stockMap);
    if (!entries.length) return null;
    return entries.reduce((sum, [, value]) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? sum + parsed : sum;
    }, 0);
};

const sanitizeCategoryPayload = (payload = {}) => {
    const allowed = ['name', 'description', 'image', 'icon', 'parentId', 'order', 'isActive', 'isRefurbishedCategory', 'gstRate'];
    const sanitized = {};
    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            sanitized[key] = payload[key];
        }
    }
    if (Object.prototype.hasOwnProperty.call(sanitized, 'parentId')) {
        sanitized.parentId = sanitized.parentId || null;
    }
    return sanitized;
};

const assertValidCategoryParent = async ({ categoryId = null, parentId }) => {
    if (!parentId) return;

    if (categoryId && String(categoryId) === String(parentId)) {
        throw new ApiError(400, 'Category cannot be parent of itself.');
    }

    const parent = await Category.findById(parentId).select('_id parentId');
    if (!parent) {
        throw new ApiError(400, 'Selected parent category does not exist.');
    }

    // Prevent cycles when changing parent during edit.
    if (categoryId) {
        let cursor = parent;
        while (cursor?.parentId) {
            if (String(cursor.parentId) === String(categoryId)) {
                throw new ApiError(400, 'Invalid parent category hierarchy.');
            }
            cursor = await Category.findById(cursor.parentId).select('_id parentId');
        }
    }
};

const sanitizeBrandPayload = (payload = {}) => {
    const allowed = ['name', 'logo', 'description', 'website', 'isActive', 'displayOrder'];
    const sanitized = {};
    for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            sanitized[key] = payload[key];
        }
    }
    return sanitized;
};

// GET /api/admin/products
export const getAllProducts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, vendorId, categoryId, status, includeInactive = 'false', b2bOnly, salesChannel, shopId, approvalStatus, sellerType } = req.query;
    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 20;
    const skip = (numericPage - 1) * numericLimit;
    const filter = {};
    if (search) filter.$text = { $search: search };
    if (vendorId) filter.vendorId = vendorId;
    if (categoryId) filter.categoryId = categoryId;
    if (status) filter.stock = status;
    if (String(includeInactive) !== 'true') {
        filter.isActive = { $ne: false };
    }
    if (String(b2bOnly) === 'true') {
        filter.b2bEnabled = true;
    }
    if (salesChannel) {
        filter.salesChannel = salesChannel;
    }
    if (shopId) {
        filter.shopId = shopId;
    }
    if (approvalStatus) {
        filter.approvalStatus = approvalStatus;
    }
    if (sellerType === 'independent') {
        filter.shopId = { $exists: false };
    } else if (sellerType === 'managed') {
        filter.shopId = { $exists: true };
    }

    const products = await Product.find(filter)
        .populate('vendorId', 'storeName')
        .populate('categoryId', 'name')
        .populate('brandId', 'name')
        .populate('shopId', 'name logo')
        .populate('vendorUserId', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit);
    const total = await Product.countDocuments(filter);
    res.status(200).json(new ApiResponse(200, { products, total, page: numericPage, pages: Math.ceil(total / numericLimit) }, 'Products fetched.'));
});

// GET /api/admin/products/:id
export const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
        .populate('vendorId', 'storeName')
        .populate('categoryId', 'name')
        .populate('brandId', 'name');

    if (!product) throw new ApiError(404, 'Product not found.');
    res.status(200).json(new ApiResponse(200, product, 'Product fetched.'));
});

// POST /api/admin/products
export const createProduct = asyncHandler(async (req, res) => {
    const { name, stockQuantity = 0, stock, ...rest } = req.body;
    const slug = slugify(name) + '-' + Date.now();
    const normalizedVariants = normalizeVariantsPayload(rest.variants, rest.price);

    const numericStockQuantity = Number(stockQuantity) || 0;
    const variantAggregateStock = calculateVariantAggregateStock(normalizedVariants);
    const finalStockQuantity = Number.isFinite(variantAggregateStock)
        ? variantAggregateStock
        : numericStockQuantity;
    const normalizedStock = stock || (finalStockQuantity <= 0
        ? 'out_of_stock'
        : finalStockQuantity <= 10
            ? 'low_stock'
            : 'in_stock');

    const product = await Product.create({
        name,
        slug,
        stock: normalizedStock,
        stockQuantity: finalStockQuantity,
        ...rest,
        variants: normalizedVariants,
        faqs: sanitizeFaqs(rest.faqs),
    });
    res.status(201).json(new ApiResponse(201, product, 'Product created.'));
});



// PUT /api/admin/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
    const payload = { ...req.body };
    if (payload.name) {
        payload.slug = slugify(payload.name) + '-' + Date.now();
    }

    if (payload.stockQuantity !== undefined) {
        const numericStockQuantity = Number(payload.stockQuantity) || 0;
        payload.stockQuantity = numericStockQuantity;
        if (!payload.stock) {
            payload.stock = numericStockQuantity <= 0
                ? 'out_of_stock'
                : numericStockQuantity <= 10
                    ? 'low_stock'
                    : 'in_stock';
        }
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'faqs')) {
        payload.faqs = sanitizeFaqs(payload.faqs);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'variants')) {
        const fallbackPrice =
            Object.prototype.hasOwnProperty.call(payload, 'price')
                ? payload.price
                : (await Product.findById(req.params.id).select('price').lean())?.price;
        payload.variants = normalizeVariantsPayload(payload.variants, fallbackPrice);
        const variantAggregateStock = calculateVariantAggregateStock(payload.variants);
        if (Number.isFinite(variantAggregateStock)) {
            payload.stockQuantity = variantAggregateStock;
            if (!payload.stock) {
                payload.stock = variantAggregateStock <= 0
                    ? 'out_of_stock'
                    : variantAggregateStock <= 10
                        ? 'low_stock'
                        : 'in_stock';
            }
        }
    }

    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found.');
    Object.assign(product, payload);
    await product.save();
    res.status(200).json(new ApiResponse(200, product, 'Product updated.'));
});

// DELETE /api/admin/products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true, runValidators: true }
    );
    if (!product) throw new ApiError(404, 'Product not found.');
    res.status(200).json(new ApiResponse(200, null, 'Product disabled.'));
});

// GET /api/admin/products/tax-pricing-rules
export const getTaxPricingRules = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne({ key: 'product_tax_pricing_rules' }).lean();
    const value = settings?.value || {};
    const taxRules = Array.isArray(value.taxRules) ? value.taxRules : [];
    const pricingRules = Array.isArray(value.pricingRules) ? value.pricingRules : [];

    res.status(200).json(
        new ApiResponse(200, { taxRules, pricingRules }, 'Tax and pricing rules fetched.')
    );
});

// PUT /api/admin/products/tax-pricing-rules
export const updateTaxPricingRules = asyncHandler(async (req, res) => {
    const { taxRules = [], pricingRules = [] } = req.body;

    await Settings.findOneAndUpdate(
        { key: 'product_tax_pricing_rules' },
        { key: 'product_tax_pricing_rules', value: { taxRules, pricingRules } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(
        new ApiResponse(200, { taxRules, pricingRules }, 'Tax and pricing rules updated.')
    );
});

// GET /api/admin/categories
export const getAllCategories = asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== 'all') {
        if (status === 'approved') {
            filter.$or = [{ status: 'approved' }, { status: { $exists: false } }];
        } else {
            filter.status = status;
        }
    }

    if (search) {
        filter.name = { $regex: String(search).trim(), $options: 'i' };
    }

    const categories = await Category.find(filter)
        .populate('requestedBy', 'storeName email phone contactPerson')
        .populate('requestedByShop', 'name logo')
        .populate('reviewedBy', 'name email')
        .populate('parentId', 'name')
        .sort({ order: 1, createdAt: -1 });

    const categoryIds = categories.map((c) => c._id);
    const productCounts = await Product.aggregate([
        { $match: { categoryId: { $in: categoryIds } } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(productCounts.map((p) => [String(p._id), p.count]));

    const categoriesWithCounts = categories.map((c) => ({
        ...c.toObject(),
        productCount: countMap[String(c._id)] || 0,
    }));

    res.status(200).json(new ApiResponse(200, categoriesWithCounts, 'Categories fetched.'));
});

// PATCH /api/admin/categories/:id/review
export const reviewCategory = asyncHandler(async (req, res) => {
    const { status, reason, autoActivateProducts = true } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        throw new ApiError(400, 'Invalid review status. Must be approved or rejected.');
    }

    const category = await Category.findById(req.params.id);
    if (!category) throw new ApiError(404, 'Category not found.');

    category.status = status;
    category.reviewedBy = req.user.id;
    category.reviewedAt = new Date();

    if (status === 'approved') {
        category.isActive = true;
        category.rejectionReason = undefined;

        if (autoActivateProducts) {
            await Product.updateMany(
                { categoryId: category._id, approvalStatus: 'pending' },
                {
                    $set: {
                        approvalStatus: 'approved',
                        categoryApprovalStatus: 'approved',
                        isActive: true,
                        approvedBy: req.user.id,
                        approvalDate: new Date(),
                    },
                    $push: {
                        auditLog: {
                            action: 'approved',
                            userId: req.user.id,
                            userType: 'admin',
                            timestamp: new Date(),
                            reason: `Category "${category.name}" approved by admin`,
                        },
                    },
                }
            );
        }

        if (category.requestedBy) {
            await createNotification({
                recipientId: category.requestedBy,
                recipientType: 'vendor',
                title: 'Category Request Approved! 🎉',
                message: `Your category request for "${category.name}" has been approved. Products linked to this category are now active and available for listing.`,
                type: 'system',
                data: { categoryId: category._id, categoryName: category.name, status: 'approved' },
            }).catch((err) => console.error('Notification error:', err));
        }
    } else {
        category.isActive = false;
        category.rejectionReason = reason || 'Category request rejected by admin.';

        await Product.updateMany(
            { categoryId: category._id, approvalStatus: 'pending' },
            {
                $set: {
                    approvalStatus: 'rejected',
                    categoryApprovalStatus: 'rejected',
                    rejectionReason: category.rejectionReason,
                    isActive: false,
                },
                $push: {
                    auditLog: {
                        action: 'rejected',
                        userId: req.user.id,
                        userType: 'admin',
                        timestamp: new Date(),
                        reason: `Category "${category.name}" rejected: ${category.rejectionReason}`,
                    },
                },
            }
        );

        if (category.requestedBy) {
            await createNotification({
                recipientId: category.requestedBy,
                recipientType: 'vendor',
                title: 'Category Request Update',
                message: `Your category request for "${category.name}" was not approved. Reason: ${category.rejectionReason}`,
                type: 'system',
                data: { categoryId: category._id, categoryName: category.name, status: 'rejected', rejectionReason: category.rejectionReason },
            }).catch((err) => console.error('Notification error:', err));
        }
    }

    await category.save();
    res.status(200).json(new ApiResponse(200, category, `Category successfully ${status}.`));
});

// POST /api/admin/categories
export const createCategory = asyncHandler(async (req, res) => {
    const payload = sanitizeCategoryPayload(req.body);
    const { name, ...rest } = payload;
    await assertValidCategoryParent({ parentId: rest.parentId });
    const slug = slugify(name);
    const category = await Category.create({ name, slug, ...rest });
    res.status(201).json(new ApiResponse(201, category, 'Category created.'));
});

// PUT /api/admin/categories/:id
export const updateCategory = asyncHandler(async (req, res) => {
    const existingCategory = await Category.findById(req.params.id);
    if (!existingCategory) throw new ApiError(404, 'Category not found.');

    const payload = sanitizeCategoryPayload(req.body);
    await assertValidCategoryParent({
        categoryId: existingCategory._id,
        parentId: payload.parentId,
    });

    if (payload.name) {
        payload.slug = slugify(payload.name);
    }

    const category = await Category.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
    });
    if (!category) throw new ApiError(404, 'Category not found.');
    res.status(200).json(new ApiResponse(200, category, 'Category updated.'));
});

// DELETE /api/admin/categories/:id
export const deleteCategory = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id).select('_id');
    if (!category) {
        throw new ApiError(404, 'Category not found.');
    }

    const [subcategoriesCount, productsCount] = await Promise.all([
        Category.countDocuments({ parentId: req.params.id }),
        Product.countDocuments({ categoryId: req.params.id }),
    ]);

    if (subcategoriesCount > 0) {
        throw new ApiError(409, 'Cannot delete category with existing subcategories.');
    }
    if (productsCount > 0) {
        throw new ApiError(409, 'Cannot delete category with existing products.');
    }

    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json(new ApiResponse(200, null, 'Category deleted.'));
});

// PATCH /api/admin/categories/reorder
export const reorderCategories = asyncHandler(async (req, res) => {
    const uniqueIds = Array.from(new Set(req.body.categoryIds.map((id) => String(id))));

    const rootCategories = await Category.find({
        _id: { $in: uniqueIds },
        parentId: null,
    }).select('_id');

    if (rootCategories.length !== uniqueIds.length) {
        throw new ApiError(400, 'Only root categories can be reordered.');
    }

    const bulkUpdates = uniqueIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { $set: { order: index + 1 } },
        },
    }));

    if (bulkUpdates.length > 0) {
        await Category.bulkWrite(bulkUpdates);
    }

    const categories = await Category.find().sort({ order: 1, name: 1 });
    res.status(200).json(new ApiResponse(200, categories, 'Category order updated.'));
});

// GET /api/admin/brands
export const getAllBrands = asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== 'all') {
        if (status === 'approved') {
            filter.$or = [{ status: 'approved' }, { status: { $exists: false } }];
        } else {
            filter.status = status;
        }
    }

    if (search) {
        filter.name = { $regex: String(search).trim(), $options: 'i' };
    }

    const brands = await Brand.find(filter)
        .populate('requestedBy', 'storeName email phone contactPerson')
        .populate('requestedByShop', 'name logo')
        .populate('reviewedBy', 'name email')
        .sort({ displayOrder: 1, createdAt: -1 });

    const brandIds = brands.map((b) => b._id);
    const productCounts = await Product.aggregate([
        { $match: { brandId: { $in: brandIds } } },
        { $group: { _id: '$brandId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(productCounts.map((p) => [String(p._id), p.count]));

    const brandsWithCounts = brands.map((b) => ({
        ...b.toObject(),
        productCount: countMap[String(b._id)] || 0,
    }));

    res.status(200).json(new ApiResponse(200, brandsWithCounts, 'Brands fetched.'));
});

// POST /api/admin/brands
export const createBrand = asyncHandler(async (req, res) => {
    const payload = sanitizeBrandPayload(req.body);
    const { name, ...rest } = payload;
    const slug = slugify(name);
    const brand = await Brand.create({ name, slug, status: 'approved', isActive: true, ...rest });
    res.status(201).json(new ApiResponse(201, brand, 'Brand created.'));
});

// PUT /api/admin/brands/:id
export const updateBrand = asyncHandler(async (req, res) => {
    const payload = sanitizeBrandPayload(req.body);
    if (payload.name) {
        payload.slug = slugify(payload.name);
    }

    const brand = await Brand.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!brand) throw new ApiError(404, 'Brand not found.');
    res.status(200).json(new ApiResponse(200, brand, 'Brand updated.'));
});

// DELETE /api/admin/brands/:id
export const deleteBrand = asyncHandler(async (req, res) => {
    const brand = await Brand.findById(req.params.id).select('_id');
    if (!brand) throw new ApiError(404, 'Brand not found.');

    const linkedProductsCount = await Product.countDocuments({ brandId: req.params.id });
    if (linkedProductsCount > 0) {
        throw new ApiError(409, 'Cannot delete brand with existing products.');
    }

    await Brand.findByIdAndDelete(req.params.id);
    res.status(200).json(new ApiResponse(200, null, 'Brand deleted.'));
});

// PATCH /api/admin/brands/:id/review
export const reviewBrand = asyncHandler(async (req, res) => {
    const { status, reason, autoActivateProducts = true } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        throw new ApiError(400, 'Invalid review status. Must be approved or rejected.');
    }

    const brand = await Brand.findById(req.params.id);
    if (!brand) throw new ApiError(404, 'Brand not found.');

    brand.status = status;
    brand.reviewedBy = req.user.id;
    brand.reviewedAt = new Date();

    if (status === 'approved') {
        brand.isActive = true;
        brand.rejectionReason = undefined;

        if (autoActivateProducts) {
            await Product.updateMany(
                { brandId: brand._id, approvalStatus: 'pending' },
                {
                    $set: {
                        approvalStatus: 'approved',
                        brandApprovalStatus: 'approved',
                        isActive: true,
                        approvedBy: req.user.id,
                        approvalDate: new Date(),
                    },
                    $push: {
                        auditLog: {
                            action: 'approved',
                            userId: req.user.id,
                            userType: 'admin',
                            timestamp: new Date(),
                            reason: `Brand "${brand.name}" approved by admin`,
                        },
                    },
                }
            );
        }

        if (brand.requestedBy) {
            await createNotification({
                recipientId: brand.requestedBy,
                recipientType: 'vendor',
                title: 'Brand Request Approved! 🎉',
                message: `Your brand request for "${brand.name}" has been approved. Products linked to this brand are now active, and the brand is available for future listings.`,
                type: 'system',
                data: { brandId: brand._id, brandName: brand.name, status: 'approved' },
            }).catch((err) => console.error('Notification error:', err));
        }
    } else {
        brand.isActive = false;
        brand.rejectionReason = reason || 'Brand request rejected by admin.';

        await Product.updateMany(
            { brandId: brand._id, approvalStatus: 'pending' },
            {
                $set: {
                    approvalStatus: 'rejected',
                    brandApprovalStatus: 'rejected',
                    rejectionReason: brand.rejectionReason,
                    isActive: false,
                },
                $push: {
                    auditLog: {
                        action: 'rejected',
                        userId: req.user.id,
                        userType: 'admin',
                        timestamp: new Date(),
                        reason: `Brand "${brand.name}" rejected: ${brand.rejectionReason}`,
                    },
                },
            }
        );

        if (brand.requestedBy) {
            await createNotification({
                recipientId: brand.requestedBy,
                recipientType: 'vendor',
                title: 'Brand Request Update',
                message: `Your brand request for "${brand.name}" was not approved. Reason: ${brand.rejectionReason}`,
                type: 'system',
                data: { brandId: brand._id, brandName: brand.name, status: 'rejected', rejectionReason: brand.rejectionReason },
            }).catch((err) => console.error('Notification error:', err));
        }
    }

    await brand.save();
    res.status(200).json(new ApiResponse(200, brand, `Brand successfully ${status}.`));
});

// PATCH /api/admin/products/:id/review
export const reviewProduct = asyncHandler(async (req, res) => {
    const {
        status,
        reason,
        price,
        originalPrice,
        name,
        description,
        images,
        salesChannel,
        b2bWholesalePrice,
        b2bMinOrderQty,
        b2bBulkPricingSlabs,
        approveBrand = true,
        approveCategory = true,
    } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        throw new ApiError(400, 'Invalid review status. Must be approved or rejected.');
    }

    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found.');

    product.approvalStatus = status;
    product.approvedBy = req.user.id;
    product.approvalDate = new Date();

    if (status === 'rejected') {
        product.rejectionReason = reason || '';
        product.isActive = false;
        if (product.brandApprovalStatus === 'pending') {
            product.brandApprovalStatus = 'rejected';
        }
        if (product.categoryApprovalStatus === 'pending') {
            product.categoryApprovalStatus = 'rejected';
        }
    } else {
        product.rejectionReason = undefined;
        product.isActive = true;
        product.isVisible = true;
        if (product.brandApprovalStatus === 'pending') {
            product.brandApprovalStatus = 'approved';
        }
        if (product.categoryApprovalStatus === 'pending') {
            product.categoryApprovalStatus = 'approved';
        }

        // If product has a linked category that is currently pending approval, approve the category
        if (product.categoryId && approveCategory) {
            const linkedCategory = await Category.findById(product.categoryId);
            if (linkedCategory && linkedCategory.status === 'pending') {
                linkedCategory.status = 'approved';
                linkedCategory.isActive = true;
                linkedCategory.reviewedBy = req.user.id;
                linkedCategory.reviewedAt = new Date();
                await linkedCategory.save();

                if (linkedCategory.requestedBy) {
                    await createNotification({
                        recipientId: linkedCategory.requestedBy,
                        recipientType: 'vendor',
                        title: 'Category Approved! 🎉',
                        message: `Your category "${linkedCategory.name}" was approved during product review.`,
                        type: 'system',
                        data: { categoryId: linkedCategory._id, categoryName: linkedCategory.name, status: 'approved' },
                    }).catch((err) => console.error('Notification error:', err));
                }
            }
        }

        // If product has a linked brand that is currently pending approval, approve the brand
        let targetBrandId = product.brandId;
        if (!targetBrandId && product.customBrandName) {
            const escaped = product.customBrandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const matchedBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });
            if (matchedBrand) {
                targetBrandId = matchedBrand._id;
                product.brandId = matchedBrand._id;
            }
        }
        if (targetBrandId && approveBrand) {
            const linkedBrand = await Brand.findById(targetBrandId);
            if (linkedBrand && (linkedBrand.status === 'pending' || !linkedBrand.isActive)) {
                linkedBrand.status = 'approved';
                linkedBrand.isActive = true;
                linkedBrand.reviewedBy = req.user.id;
                linkedBrand.reviewedAt = new Date();
                await linkedBrand.save();
                product.brandId = linkedBrand._id;

                if (linkedBrand.requestedBy) {
                    await createNotification({
                        recipientId: linkedBrand.requestedBy,
                        recipientType: 'vendor',
                        title: 'Brand Approved! 🎉',
                        message: `Your brand "${linkedBrand.name}" was approved during product review.`,
                        type: 'system',
                        data: { brandId: linkedBrand._id, brandName: linkedBrand.name, status: 'approved' },
                    }).catch((err) => console.error('Notification error:', err));
                }
            }
        }

        if (salesChannel && ['B2C', 'B2B', 'BOTH'].includes(salesChannel)) {
            product.salesChannel = salesChannel;
            product.b2bEnabled = (salesChannel === 'B2B' || salesChannel === 'BOTH');
        }

        if (b2bWholesalePrice !== undefined && Number(b2bWholesalePrice) >= 0) {
            product.b2bWholesalePrice = Number(b2bWholesalePrice);
        } else if ((product.salesChannel === 'B2B' || product.salesChannel === 'BOTH') && !product.b2bWholesalePrice) {
            product.b2bWholesalePrice = price !== undefined ? Number(price) : product.price;
        }

        if (b2bMinOrderQty !== undefined && Number(b2bMinOrderQty) >= 1) {
            product.b2bMinOrderQty = Number(b2bMinOrderQty);
        }

        if (b2bBulkPricingSlabs !== undefined) {
            product.b2bBulkPricingSlabs = b2bBulkPricingSlabs;
        }
    }

    // Admin can edit product details during review
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (originalPrice !== undefined) product.originalPrice = originalPrice;
    if (images !== undefined) product.images = images;

    // Log this action in audit log
    product.auditLog.push({
        action: status,
        userId: req.user.id,
        userType: 'admin',
        timestamp: new Date(),
        reason: reason || (status === 'approved' ? `Approved with channel: ${product.salesChannel}` : '')
    });

    await product.save();
    res.status(200).json(new ApiResponse(200, product, `Product successfully ${status}.`));
});
