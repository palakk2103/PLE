import { isB2BRole, resolveB2BUnitPrice } from '../utils/b2bPricing.js';
import { Router } from 'express';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import Product from '../models/Product.model.js';
import { publicApprovalFilter } from '../utils/productVisibility.js';
import Category from '../models/Category.model.js';

import Brand from '../models/Brand.model.js';
import Vendor from '../models/Vendor.model.js';
import Coupon from '../models/Coupon.model.js';
import Banner from '../models/Banner.model.js';
import Campaign from '../models/Campaign.model.js';
import { calculateVendorShippingForGroups } from '../services/vendorShipping.service.js';
import AboutPage from '../models/AboutPage.model.js';
import Portfolio from '../models/Portfolio.model.js';
import PortfolioPage from '../models/PortfolioPage.model.js';
import { getPortfolioPage } from '../modules/admin/controllers/cms.controller.js';

import ManagedShop from '../models/ManagedShop.model.js';
import Wallet from '../models/Wallet.model.js';
import User from '../models/User.model.js';
import { optionalAuth } from '../middlewares/authenticate.js';
import { resolveProductGST } from '../utils/gstUtils.js';
import { resolveSpecTemplate } from '../services/productSpecs.service.js';
import { moderateMessage, MODERATION_ACTION } from '../services/chatModeration.service.js';
import { buildPublicStoreProfile } from '../services/vendorStoreProfile.service.js';
import { parseCompareIds, buildComparison } from '../services/productCompare.service.js';
import rateLimit from 'express-rate-limit';
import SupportTicket from '../models/SupportTicket.model.js';
import { generateTicketNumber, notifyAdmins } from '../services/supportTicket.service.js';
import { assertTextLength } from '../utils/chatLimits.js';
import { resolveSellerState, resolveBuyerState, determineSupplyType } from '../utils/gstUtils.js';

const router = Router();

// (A public GET /setup-test-data route used to live here. It created a working vendor login
// "rahul / password123" for anyone who called it, so it was removed.)

router.get('/loyalty/config', asyncHandler(async (req, res) => {
    const loyaltyService = await import('../services/loyalty.service.js');
    const config = await loyaltyService.getLoyaltyConfig();
    res.status(200).json(new ApiResponse(200, {
        enabled: config.enabled,
        purchaseToPointsRatio: config.purchaseToPointsRatio,
        purchaseAmountUnit: config.purchaseAmountUnit,
        redemptionRatio: config.redemptionRatio,
        minRedeemPoints: config.minRedeemPoints,
        maxRedemptionPercent: config.maxRedemptionPercent,
        b2bEnabled: config.b2bEnabled,
        b2bPurchaseToPointsRatio: config.b2bPurchaseToPointsRatio,
        b2bPurchaseAmountUnit: config.b2bPurchaseAmountUnit,
        b2bRedemptionRatio: config.b2bRedemptionRatio,
        b2bMinRedeemPoints: config.b2bMinRedeemPoints,
        b2bMaxRedemptionPercent: config.b2bMaxRedemptionPercent
    }, 'Public loyalty config fetched.'));
}));

// Customers must NEVER receive a vendor's contact or business-identity details
// (phone, email, address, bank, PAN/GST, documents...). Whitelist only what the
// storefront needs, so any field added to the Vendor model later stays private by default.
const PUBLIC_VENDOR_FIELDS = [
    '_id', 'name', 'storeName', 'storeLogo', 'logo', 'rating', 'reviewCount',
    'isVerified', 'status', 'joinDate', 'createdAt', 'businessType', 'totalProducts',
    'isManagedShop', 'id',
];

const toPublicVendor = (vendorDoc, { detail = false } = {}) => {
    const vendor = typeof vendorDoc?.toObject === 'function'
        ? vendorDoc.toObject()
        : (vendorDoc || {});

    const safe = {};
    for (const key of PUBLIC_VENDOR_FIELDS) {
        if (vendor[key] !== undefined) safe[key] = vendor[key];
    }
    // Free-text store description is vendor-written: never let it carry contact details.
    const description = vendor.storeDescription ?? vendor.description;
    if (description) {
        safe.storeDescription = moderateMessage(String(description)).action === MODERATION_ACTION.ALLOW
            ? description
            : '';
        safe.description = safe.storeDescription;
    }
    // The single seller page also shows the vendor's chosen theme and verified business details
    // (real name, GST number, address). Still no phone / email / PAN / bank / documents.
    if (detail) safe.storeProfile = buildPublicStoreProfile(vendor);
    return safe;
};

const normalizeVariantPart = (value) => String(value || '').trim().toLowerCase();
const normalizeVariantKey = (key) => String(key || '').trim().toLowerCase();

const toVariantPriceEntries = (variantPrices) => {
    if (!variantPrices) return [];
    if (variantPrices instanceof Map) return Array.from(variantPrices.entries());
    if (typeof variantPrices === 'object') return Object.entries(variantPrices);
    return [];
};

const resolveVariantPrice = (product, selectedVariant) => {
    const basePrice = Number(product?.price);
    if (!Number.isFinite(basePrice) || basePrice < 0) return 0;

    const selectionEntries = Object.entries(selectedVariant || {})
        .map(([axis, value]) => [String(axis || '').trim(), String(value || '').trim()])
        .filter(([axis, value]) => axis && value);

    const dynamicKey = selectionEntries.length
        ? selectionEntries
            .map(([axis, value]) => `${normalizeVariantPart(axis)}=${normalizeVariantPart(value)}`)
            .sort()
            .join('|')
        : '';

    const size = normalizeVariantPart(selectedVariant?.size);
    const color = normalizeVariantPart(selectedVariant?.color);
    const entries = toVariantPriceEntries(product?.variants?.prices);
    if (!entries.length || (!dynamicKey && !size && !color)) return basePrice;

    const candidateKeys = [
        dynamicKey || null,
        `${size}|${color}`,
        `${size}-${color}`,
        `${size}_${color}`,
        `${size}:${color}`,
        size && !color ? size : null,
        color && !size ? color : null,
    ].filter(Boolean);

    for (const candidate of candidateKeys) {
        if (!candidate) continue;
        const exact = entries.find(([rawKey]) => String(rawKey).trim() === candidate);
        if (exact) {
            const price = Number(exact[1]);
            if (Number.isFinite(price) && price >= 0) return price;
        }

        const normalized = entries.find(
            ([rawKey]) => normalizeVariantKey(rawKey) === normalizeVariantKey(candidate)
        );
        if (normalized) {
            const price = Number(normalized[1]);
            if (Number.isFinite(price) && price >= 0) return price;
        }
    }

    return basePrice;
};

// GET /api/products — list with filters
const listProducts = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 12,
        category,
        brand,
        vendor,
        search,
        q,
        sort = 'rating',
        flashSale,
        isNewArrival,
        minPrice,
        maxPrice,
        minRating,
        condition
    } = req.query;
    const skip = (page - 1) * limit;
    const filter = {
        isActive: true,
        ...publicApprovalFilter(),
        isSourceProduct: { $ne: true },
        publicationStatus: { $nin: ['draft', 'unpublished', 'archived'] },
        brandApprovalStatus: { $ne: 'pending' },
        categoryApprovalStatus: { $ne: 'pending' },
    };

    if (category) {
        const categoryId = String(category).trim();
        if (mongoose.Types.ObjectId.isValid(categoryId)) {
            const childCategories = await Category.find({ parentId: categoryId }).select('_id');
            const categoryIds = [categoryId, ...childCategories.map((cat) => String(cat._id))];
            filter.categoryId = { $in: categoryIds };
        } else {
            const catDoc = await Category.findOne({
                $or: [
                    { slug: categoryId.toLowerCase() },
                    { name: new RegExp(`^${categoryId}$`, 'i') },
                ],
            }).select('_id');

            if (catDoc) {
                const childCategories = await Category.find({ parentId: catDoc._id }).select('_id');
                const categoryIds = [String(catDoc._id), ...childCategories.map((cat) => String(cat._id))];
                filter.categoryId = { $in: categoryIds };
            } else {
                filter.categoryId = new mongoose.Types.ObjectId();
            }
        }
    }
    if (brand) {
        const brandId = String(brand).trim();
        if (mongoose.Types.ObjectId.isValid(brandId)) {
            filter.brandId = brandId;
        } else {
            const brandDoc = await Brand.findOne({
                $or: [
                    { slug: brandId.toLowerCase() },
                    { name: new RegExp(`^${brandId}$`, 'i') },
                ],
            }).select('_id');
            filter.brandId = brandDoc ? brandDoc._id : new mongoose.Types.ObjectId();
        }
    }
    if (vendor) {
        const vendorId = String(vendor).trim();
        if (mongoose.Types.ObjectId.isValid(vendorId)) {
            filter.vendorId = vendorId;
        } else {
            filter.vendorId = new mongoose.Types.ObjectId();
        }
    }
    if (flashSale === 'true') filter.flashSale = true;
    if (isNewArrival === 'true') filter.isNewArrival = true;
    if (minPrice || maxPrice) filter.price = { ...(minPrice && { $gte: Number(minPrice) }), ...(maxPrice && { $lte: Number(maxPrice) }) };
    if (minRating) filter.rating = { $gte: Number(minRating) };
    if (condition === 'refurbished') {
        filter.isRefurbished = true;
    } else if (condition === 'brand_new') {
        filter.isRefurbished = { $ne: true };
    }
    
    // Channel filter based on user type context
    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }

    const searchQuery = String(search || q || '').trim();
    if (searchQuery) {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escaped, 'i');
        // Also match products whose real category or brand name matches the query.
        const [matchedCategories, matchedBrands] = await Promise.all([
            Category.find({ name: searchRegex }).select('_id').limit(50),
            Brand.find({ name: searchRegex }).select('_id').limit(50),
        ]);
        filter.$or = [
            { name: searchRegex },
            { description: searchRegex },
            { customCategoryName: searchRegex },
            { customBrandName: searchRegex },
            ...(matchedCategories.length ? [{ categoryId: { $in: matchedCategories.map((c) => c._id) } }] : []),
            ...(matchedBrands.length ? [{ brandId: { $in: matchedBrands.map((b) => b._id) } }] : []),
        ];
    }

    const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, 'price-asc': { price: 1 }, 'price-desc': { price: -1 }, popular: { reviewCount: -1 }, rating: { rating: -1, createdAt: -1 } };

    const products = await Product.find(filter)
        .select('-negotiatedSupplyPrice -requestedSupplyPrice -agreementId -sourceProductId -auditLog')
        .populate('categoryId', 'name gstRate parentId')
        .populate('brandId', 'name')
        .populate('vendorId', 'storeName categoryGstRates defaultGstRate')
        .sort(sortMap[sort] || { rating: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));
    const total = await Product.countDocuments(filter);

    const resolvedProducts = products.map((prod) => {
        const prodObj = prod.toObject ? prod.toObject() : prod;
        const effectiveGst = resolveProductGST(prod, prod.categoryId, prod.vendorId);
        return {
            ...prodObj,
            gstRate: effectiveGst,
            taxRate: effectiveGst,
        };
    });

    res.status(200).json(new ApiResponse(200, { products: resolvedProducts, total, page: Number(page), pages: Math.ceil(total / limit) }, 'Products fetched.'));
});

router.get('/', listProducts);
router.get('/products', listProducts);

// GET /api/flash-sale & /api/products/flash-sale
const getFlashSale = asyncHandler(async (req, res) => {
    const filter = {
        isActive: true,
        ...publicApprovalFilter(),
        flashSale: true,
        isSourceProduct: { $ne: true },
        publicationStatus: { $nin: ['draft', 'unpublished', 'archived'] },
    };
    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }
    const products = await Product.find(filter)
        .select('-negotiatedSupplyPrice -requestedSupplyPrice -agreementId -sourceProductId -auditLog')
        .limit(20);
    res.status(200).json(new ApiResponse(200, products, 'Flash sale products.'));
});

// GET /api/new-arrivals & /api/products/new-arrivals
const getNewArrivals = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        sort = 'newest',
        search,
        q,
        minPrice,
        maxPrice,
        minRating,
    } = req.query;

    const numericPage = Math.max(Number(page) || 1, 1);
    const numericLimit = Math.max(Number(limit) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const filter = {
        isActive: true,
        ...publicApprovalFilter(),
        isSourceProduct: { $ne: true },
        publicationStatus: { $nin: ['draft', 'unpublished', 'archived'] },
        $or: [
            { isNewArrival: true },
            { createdAt: { $gte: thirtyDaysAgo } }
        ]
    };
    
    // Channel filter based on user type context
    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }

    const searchQuery = String(search || q || '').trim();
    if (searchQuery) {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escaped, 'i');
        const arrivalCondition = {
            $or: [
                { isNewArrival: true },
                { createdAt: { $gte: thirtyDaysAgo } }
            ]
        };
        const textCondition = {
            $or: [
                { name: searchRegex },
                { description: searchRegex },
                { customCategoryName: searchRegex },
                { customBrandName: searchRegex }
            ]
        };
        delete filter.$or;
        filter.$and = [arrivalCondition, textCondition];
    }
    if (minPrice || maxPrice) {
        filter.price = {
            ...(minPrice ? { $gte: Number(minPrice) } : {}),
            ...(maxPrice ? { $lte: Number(maxPrice) } : {}),
        };
    }
    if (minRating) {
        filter.rating = { $gte: Number(minRating) };
    }

    const sortMap = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        'price-asc': { price: 1 },
        'price-desc': { price: -1 },
        popular: { reviewCount: -1 },
        rating: { rating: -1, createdAt: -1 },
    };

    const [products, total] = await Promise.all([
        Product.find(filter)
            .populate('categoryId', 'name')
            .populate('brandId', 'name')
            .populate('vendorId', 'storeName')
            .sort(sortMap[sort] || sortMap.newest)
            .skip(skip)
            .limit(numericLimit),
        Product.countDocuments(filter),
    ]);

    res.status(200).json(new ApiResponse(200, {
        products,
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit),
    }, 'New arrivals fetched.'));
});

// GET /api/popular & /api/products/popular
const getPopular = asyncHandler(async (req, res) => {
    const filter = {
        isActive: true,
        ...publicApprovalFilter(),
        isSourceProduct: { $ne: true },
        publicationStatus: { $nin: ['draft', 'unpublished', 'archived'] },
    };
    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }
    const products = await Product.find(filter)
        .select('-negotiatedSupplyPrice -requestedSupplyPrice -agreementId -sourceProductId -auditLog')
        .sort({ reviewCount: -1, rating: -1 })
        .limit(10);
    res.status(200).json(new ApiResponse(200, products, 'Popular products.'));
});

router.get('/flash-sale', getFlashSale);
router.get('/products/flash-sale', getFlashSale);

router.get('/new-arrivals', getNewArrivals);
router.get('/products/new-arrivals', getNewArrivals);

router.get('/popular', getPopular);
router.get('/products/popular', getPopular);

// GET /api/products/compare?ids=a,b,c  (public; 2-4 products, side by side with seller details)
router.get('/products/compare', asyncHandler(async (req, res) => {
    const ids = parseCompareIds(req.query.ids);
    res.status(200).json(new ApiResponse(200, await buildComparison(ids), 'Product comparison.'));
}));

// GET /api/products/similar/:id
router.get('/similar/:id', asyncHandler(async (req, res) => {
    const product = await Product.findOne({
        _id: req.params.id,
        isSourceProduct: { $ne: true },
        publicationStatus: { $nin: ['draft', 'unpublished', 'archived'] },
    });
    if (!product) throw new ApiError(404, 'Product not found.');
    
    const filter = {
        isActive: true,
        ...publicApprovalFilter(),
        isSourceProduct: { $ne: true },
        publicationStatus: { $nin: ['draft', 'unpublished', 'archived'] },
        _id: { $ne: product._id },
        categoryId: product.categoryId,
    };
    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }

    const similar = await Product.find(filter)
        .select('-negotiatedSupplyPrice -requestedSupplyPrice -agreementId -sourceProductId -auditLog')
        .limit(6);
    res.status(200).json(new ApiResponse(200, similar, 'Similar products.'));
}));

const getProductDetail = asyncHandler(async (req, res) => {
    const product = await Product.findOne({
        _id: req.params.id,
        isSourceProduct: { $ne: true },
        publicationStatus: { $nin: ['draft', 'unpublished', 'archived'] },
        isActive: true,
        ...publicApprovalFilter(),
    })
        .select('-negotiatedSupplyPrice -requestedSupplyPrice -agreementId -sourceProductId -auditLog')
        .populate('categoryId', 'name gstRate parentId')
        .populate('brandId', 'name')
        .populate('vendorId', 'storeName storeLogo rating categoryGstRates defaultGstRate');
    if (!product) throw new ApiError(404, 'Product not found.');
    
    const prodObj = product.toObject ? product.toObject() : product;
    const effectiveGst = resolveProductGST(product, product.categoryId, product.vendorId);

    res.status(200).json(new ApiResponse(200, {
        ...prodObj,
        gstRate: effectiveGst,
        taxRate: effectiveGst,
    }, 'Product detail.'));
});

// GET /api/products/:id
router.get('/products/:id', getProductDetail);

// GET /api/products/:id/delivery-check?pincode=560001
// Real delivery check for the product page: the same courier/zone logic checkout uses, so what the
// customer sees here matches what checkout will charge (replaces the old simulated "speed check").
const deliveryCheckLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
router.get('/products/:id/delivery-check', deliveryCheckLimiter, asyncHandler(async (req, res) => {
    const pincode = String(req.query.pincode || '').trim();
    if (!/^\d{6}$/.test(pincode)) throw new ApiError(400, 'Enter a valid 6-digit pincode.');
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Product not found.');

    const product = await Product.findOne({ _id: req.params.id, isActive: { $ne: false } })
        .select('vendorId shopId price weight packageWeight')
        .lean();
    if (!product) throw new ApiError(404, 'Product not found.');

    const sellerId = String(product.shopId || product.vendorId || '');
    const quantity = Math.max(1, Math.min(1000, parseInt(req.query.quantity, 10) || 1));
    const { isServiceable, isCodAvailable, shippingByVendor, courierInfo } = await calculateVendorShippingForGroups({
        vendorGroups: [{
            vendorId: sellerId,
            subtotal: Number(product.price || 0) * quantity,
            items: [{ quantity, weight: product.weight || product.packageWeight }],
        }],
        shippingAddress: { zipCode: pincode, country: 'India' },
        shippingOption: 'standard',
        paymentMethod: 'cod', // asks the courier about COD as well, so we can say whether it is available
    });

    const courier = courierInfo?.[sellerId] || null;
    const etdDays = Number(courier?.estimated_delivery_days || courier?.estimatedDeliveryDays);
    res.status(200).json(new ApiResponse(200, {
        pincode,
        serviceable: isServiceable !== false,
        codAvailable: isCodAvailable !== false,
        shippingCharge: Number(shippingByVendor?.[sellerId] || 0),
        estimatedDelivery: courier?.etd
            || (Number.isFinite(etdDays) && etdDays > 0 ? `${etdDays} day${etdDays === 1 ? '' : 's'}` : null)
            || courier?.estimatedDays
            || '3–5 business days',
        courierName: courier?.courier_name || courier?.courierName || null,
    }, isServiceable === false ? 'Delivery not available to this pincode.' : 'Delivery available.'));
}));

// GET /api/categories (public)
const getPublicCategoriesList = asyncHandler(async (req, res) => {
    const categories = await Category.find({
        isActive: true,
        $or: [{ status: 'approved' }, { status: { $exists: false } }],
    }).sort({ order: 1 });
    res.status(200).json(new ApiResponse(200, categories, 'Categories fetched.'));
});

// GET /api/spec-template?categoryId= — category-aware specification field definitions
router.get('/spec-template', asyncHandler(async (req, res) => {
    const { categoryId } = req.query;
    if (categoryId && !mongoose.Types.ObjectId.isValid(String(categoryId))) {
        throw new ApiError(400, 'Invalid categoryId.');
    }
    const template = await resolveSpecTemplate(categoryId || null);
    res.status(200).json(new ApiResponse(200, template, 'Specification template.'));
}));

router.get('/categories', getPublicCategoriesList);
router.get('/categories/all', getPublicCategoriesList);

const getPublicBrandsList = asyncHandler(async (req, res) => {
    const brands = await Brand.find({
        isActive: true,
        $or: [{ status: 'approved' }, { status: { $exists: false } }],
    }).sort({ displayOrder: 1, name: 1 });
    res.status(200).json(new ApiResponse(200, brands, 'Brands fetched.'));
});

// GET /api/brands & /api/brands/all (public)
router.get('/brands', getPublicBrandsList);
router.get('/brands/all', getPublicBrandsList);

// GET /api/vendors/all (public)
router.get('/vendors/all', asyncHandler(async (req, res) => {
    const { status = 'approved', page = 1, limit = 50, search } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 50, 1);
    const skip = (numericPage - 1) * numericLimit;
    const filter = {};

    if (status && status !== 'all') {
        filter.status = status;
    }

    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch) {
        const safeRegex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ name: safeRegex }, { storeName: safeRegex }];
    }

    const vendors = await Vendor.find(filter)
        .select('name storeName storeLogo storeDescription rating reviewCount isVerified status joinDate createdAt businessType')
        .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .lean();

    const activeShops = await ManagedShop.find({ status: 'active' }).lean();

    const mappedShops = await Promise.all(activeShops.map(async (shop) => {
        const productCount = await Product.countDocuments({ shopId: shop._id, isActive: true, ...publicApprovalFilter() });
        return {
            _id: shop._id,
            id: String(shop._id),
            name: shop.name,
            storeName: shop.name,
            storeLogo: shop.logo,
            logo: shop.logo,
            description: shop.description,
            rating: 4.8,
            reviewCount: 15,
            isVerified: true,
            isManagedShop: true,
            status: 'approved',
            totalProducts: productCount
        };
    }));

    const mappedVendors = await Promise.all(vendors.map(async (v) => {
        const productCount = await Product.countDocuments({ vendorId: v._id, isActive: true, ...publicApprovalFilter() });
        return {
            ...toPublicVendor(v),
            id: String(v._id),
            storeName: v.storeName || v.name,
            storeLogo: v.storeLogo || v.logo,
            totalProducts: productCount
        };
    }));

    const allSellers = [...mappedShops, ...mappedVendors];

    res.status(200).json(new ApiResponse(200, {
        vendors: allSellers,
        total: allSellers.length,
        page: 1,
        pages: 1
    }, 'Sellers fetched.'));
}));

// GET /api/vendors/:id (public)
router.get('/vendors/:id', asyncHandler(async (req, res) => {
    let seller = await Vendor.findOne({
        _id: req.params.id,
        status: 'approved',
    }).lean();
    if (seller) {
        seller = {
            ...toPublicVendor(seller, { detail: true }),
            id: String(seller._id),
            totalProducts: await Product.countDocuments({ vendorId: seller._id, isActive: true, ...publicApprovalFilter() }),
        };
    }

    if (!seller) {
        const shop = await ManagedShop.findOne({
            _id: req.params.id,
            status: 'active'
        }).lean();
        if (shop) {
            const productCount = await Product.countDocuments({ shopId: shop._id, isActive: true, ...publicApprovalFilter() });
            seller = {
                _id: shop._id,
                id: String(shop._id),
                name: shop.name,
                storeName: shop.name,
                storeLogo: shop.logo,
                logo: shop.logo,
                description: shop.description,
                rating: 4.8,
                reviewCount: 15,
                isVerified: true,
                isManagedShop: true,
                status: 'approved',
                totalProducts: productCount
            };
        }
    }

    if (!seller) throw new ApiError(404, 'Seller not found.');
    res.status(200).json(new ApiResponse(200, seller, 'Seller detail fetched.'));
}));

// GET /api/vendors/:id/products (public)
router.get('/vendors/:id/products', asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, sort = 'newest' } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;

    const sortMap = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        'price-asc': { price: 1 },
        'price-desc': { price: -1 },
        popular: { reviewCount: -1 },
        rating: { rating: -1 },
    };

    const isShop = await ManagedShop.exists({ _id: req.params.id, status: 'active' });
    const isVendor = !isShop ? await Vendor.exists({ _id: req.params.id, status: 'approved' }) : false;

    if (!isShop && !isVendor) throw new ApiError(404, 'Seller not found.');

    const filter = { isActive: true, ...publicApprovalFilter() };
    if (isShop) {
        filter.shopId = req.params.id;
    } else {
        filter.vendorId = req.params.id;
    }

    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }

    const products = await Product.find(filter)
        .populate('categoryId', 'name')
        .populate('brandId', 'name')
        .populate('vendorId', 'storeName')
        .populate('shopId', 'name logo')
        .sort(sortMap[sort] || { createdAt: -1 })
        .skip(skip)
        .limit(numericLimit);
    const total = await Product.countDocuments(filter);

    res.status(200).json(new ApiResponse(200, {
        products,
        total,
        page: numericPage,
        pages: Math.ceil(total / numericLimit)
    }, 'Seller products fetched.'));
}));

// POST /api/coupons/validate
router.post('/coupons/validate', asyncHandler(async (req, res) => {
    const rawCode = String(req.body?.code || '').trim();
    const cartTotal = Number(req.body?.cartTotal);

    if (!rawCode) {
        throw new ApiError(400, 'Coupon code is required.');
    }
    if (!Number.isFinite(cartTotal) || cartTotal < 0) {
        throw new ApiError(400, 'Cart total must be a valid non-negative number.');
    }

    const coupon = await Coupon.findOne({ code: rawCode.toUpperCase(), isActive: true });
    if (!coupon) throw new ApiError(400, 'Invalid coupon code.');
    if (coupon.startsAt && coupon.startsAt > Date.now()) throw new ApiError(400, 'Coupon is not active yet.');
    if (coupon.expiresAt && coupon.expiresAt < Date.now()) throw new ApiError(400, 'Coupon has expired.');
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new ApiError(400, 'Coupon usage limit reached.');
    if (cartTotal < coupon.minOrderValue) throw new ApiError(400, `Minimum order value for this coupon is Rs.${coupon.minOrderValue}.`);

    let discount = 0;
    if (coupon.type === 'percentage') {
        discount = (cartTotal * coupon.value) / 100;
        if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else if (coupon.type === 'fixed') {
        discount = coupon.value;
    }

    res.status(200).json(new ApiResponse(200, { coupon: { code: coupon.code, type: coupon.type, value: coupon.value }, discount }, 'Coupon is valid.'));
}));

// GET /api/coupons/available
router.get('/coupons/available', optionalAuth, asyncHandler(async (req, res) => {
    // If a customer is logged in, check their wallet balance
    if (req.user?.id) {
        let balance = 0;
        const wallet = await Wallet.findOne({ userId: req.user.id });
        if (wallet) {
            balance = Number(wallet.balance || 0);
        }

        if (req.user.role === 'b2bEmployee') {
            const userDoc = await User.findById(req.user.id).select('b2bWalletBalance');
            if (userDoc && typeof userDoc.b2bWalletBalance === 'number') {
                balance = userDoc.b2bWalletBalance;
            }
        }

        // If customer's wallet has 0 rupees (or less), do not show any coupons
        if (balance <= 0) {
            return res.status(200).json(new ApiResponse(200, [], 'Available coupons fetched.'));
        }
    }

    const now = new Date();
    const coupons = await Coupon.find({
        isActive: true,
        $and: [
            { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
            { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gte: now } }] }
        ]
    })
        .select('code name type value minOrderValue maxDiscount expiresAt usageLimit usedCount')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

    res.status(200).json(new ApiResponse(200, coupons, 'Available coupons fetched.'));
}));

// POST /api/shipping/estimate
router.post('/shipping/estimate', optionalAuth, asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const shippingAddress = req.body?.shippingAddress || {};
    const shippingOption = String(req.body?.shippingOption || 'standard');
    const paymentMethod = String(req.body?.paymentMethod || 'prepaid');
    const couponType = req.body?.couponType || null;

    if (!items.length) {
        return res.status(200).json(
            new ApiResponse(200, {
                shipping: 0,
                byVendor: {},
                isCodAvailable: true,
                isServiceable: true,
                courierInfo: {},
                paymentMethod
            }, 'Shipping estimate calculated.')
        );
    }

    const productIds = items
        .map((item) => String(item?.productId || '').trim())
        .filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
    if (!productIds.length) {
        return res.status(200).json(
            new ApiResponse(200, {
                shipping: 0,
                byVendor: {},
                isCodAvailable: true,
                isServiceable: true,
                courierInfo: {},
                paymentMethod
            }, 'Shipping estimate calculated.')
        );
    }

    const products = await Product.find({ _id: { $in: productIds }, isActive: true, ...publicApprovalFilter() })
        .populate('vendorId', 'shippingEnabled defaultShippingRate freeShippingThreshold pincode address gstNumber documents.gst b2bSellingGstNumber b2bSellingState state businessAddress')
        .populate('shopId', 'name logo warehouse address gst')
        .select('_id vendorId shopId price variants.prices b2bEnabled b2bWholesalePrice b2bBulkPricingSlabs')
        .lean();

    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const vendorMap = {};

    items.forEach((item) => {
        const product = productMap.get(String(item?.productId || ''));
        if (!product) return;

        const isManagedShop = !!product.shopId;
        const vendorIdObj = isManagedShop ? product.shopId._id : product.vendorId?._id;
        if (!vendorIdObj) return;

        const vendorId = String(vendorIdObj);
        const quantity = Math.max(1, Number(item?.quantity || 1));
        const normalPrice = Math.max(0, Number(resolveVariantPrice(product, item?.variant) || 0));
        // Business buyers pay the B2B price at checkout, so the estimate (free-shipping thresholds) must use it too.
        const price = isB2BRole(req.user?.role) ? resolveB2BUnitPrice(product, normalPrice, quantity) : normalPrice;
        const subtotal = price * quantity;

        if (!vendorMap[vendorId]) {
            vendorMap[vendorId] = {
                vendorId,
                subtotal: 0,
                shippingEnabled: isManagedShop ? true : (product.vendorId?.shippingEnabled !== false),
                defaultShippingRate: isManagedShop ? 0 : (product.vendorId?.defaultShippingRate || 0),
                freeShippingThreshold: isManagedShop ? 0 : (product.vendorId?.freeShippingThreshold || 0),
                items: [],
            };
        }
        vendorMap[vendorId].subtotal += subtotal;
        vendorMap[vendorId].items.push({
            productId: String(product._id),
            quantity,
            price
        });
    });

    const { totalShipping, shippingByVendor, isCodAvailable, isServiceable, courierInfo } = await calculateVendorShippingForGroups({
        vendorGroups: Object.values(vendorMap),
        shippingAddress,
        shippingOption,
        paymentMethod,
        couponType,
    });

    // CGST+SGST vs IGST for each product, decided by seller state vs delivery state.
    const buyerState = resolveBuyerState(shippingAddress);
    const supplyByProduct = {};
    for (const product of products) {
        const sellerState = resolveSellerState(product.shopId || product.vendorId);
        supplyByProduct[String(product._id)] = {
            supplyType: determineSupplyType(sellerState, buyerState),
            sellerState: sellerState?.name || null,
        };
    }

    res.status(200).json(
        new ApiResponse(200, {
            shipping: totalShipping,
            byVendor: shippingByVendor,
            isCodAvailable,
            isServiceable,
            courierInfo,
            gst: {
                placeOfSupply: buyerState ? { state: buyerState.name, code: buyerState.code } : null,
                byProduct: supplyByProduct,
            },
            paymentMethod: ['cod', 'cash'].includes(paymentMethod.toLowerCase()) ? 'cod' : 'prepaid'
        }, 'Shipping estimate calculated.')
    );
}));

// GET /api/banners
router.get('/banners', asyncHandler(async (req, res) => {
    const { type } = req.query;
    const now = new Date();
    const filter = {
        isActive: true,
        $and: [
            { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] }
        ]
    };
    if (type) filter.type = type;
    const banners = await Banner.find(filter).sort({ order: 1 });
    res.status(200).json(new ApiResponse(200, banners, 'Banners fetched.'));
}));

// GET /api/campaigns
router.get('/campaigns', asyncHandler(async (req, res) => {
    const { type, limit = 20 } = req.query;
    const parsedLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const now = new Date();

    const query = {
        isActive: true,
        $and: [
            { $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] }
        ]
    };
    if (type) query.type = type;

    const campaigns = await Campaign.find(query)
        .select('name slug type route discountType discountValue startDate endDate bannerConfig')
        .sort({ createdAt: -1 })
        .limit(parsedLimit);

    res.status(200).json(new ApiResponse(200, campaigns, 'Campaigns fetched.'));
}));

// GET /api/campaigns/:slug
router.get('/campaigns/:slug', asyncHandler(async (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) throw new ApiError(400, 'Campaign slug is required.');

    const campaign = await Campaign.findOne({ slug, isActive: true });
    if (!campaign) throw new ApiError(404, 'Campaign not found.');

    const now = new Date();
    if (campaign.startDate && campaign.startDate > now) {
        throw new ApiError(404, 'Campaign is not active yet.');
    }
    if (campaign.endDate && campaign.endDate < now) {
        throw new ApiError(404, 'Campaign has ended.');
    }

    const productIds = Array.isArray(campaign.productIds)
        ? campaign.productIds
            .map((value) => String(value || '').trim())
            .filter((value) => value && /^[a-fA-F0-9]{24}$/.test(value))
        : [];

    const products = await Product.find({
        _id: { $in: productIds },
        isActive: true,
        ...publicApprovalFilter(),
    })
        .populate('categoryId', 'name')
        .populate('brandId', 'name')
        .populate('vendorId', 'storeName')
        .sort({ createdAt: -1 });

    const payload = {
        ...campaign.toObject(),
        id: String(campaign._id),
        products,
    };

    res.status(200).json(new ApiResponse(200, payload, 'Campaign fetched.'));
}));

// GET /api/orders/track/:id (public order tracking)
router.get('/orders/track/:id', asyncHandler(async (req, res) => {
    const { default: Order } = await import('../models/Order.model.js');
    const order = await Order.findOne({ orderId: req.params.id }).select('orderId status trackingNumber estimatedDelivery deliveredAt createdAt updatedAt cancelledAt');
    if (!order) throw new ApiError(404, 'Order not found.');
    res.status(200).json(new ApiResponse(200, order, 'Order tracking info.'));
}));

// GET /api/settings/:key (public settings)
// Allowlist only: other keys (e.g. 'email', which holds the SMTP password) are admin-only.
const PUBLIC_SETTING_KEYS = new Set(['landingPageCms', 'b2b', 'general']);
router.get('/settings/:key', asyncHandler(async (req, res) => {
    if (!PUBLIC_SETTING_KEYS.has(req.params.key)) throw new ApiError(404, 'Settings not found.');
    const { default: Settings } = await import('../models/Settings.model.js');
    const setting = await Settings.findOne({ key: req.params.key });
    res.status(200).json(new ApiResponse(200, setting ? setting.value : null, `Settings for ${req.params.key} fetched.`));
}));

// GET /api/about (public CMS)
router.get('/about', asyncHandler(async (req, res) => {
    let about = await AboutPage.findOne();
    if (!about) {
        about = await AboutPage.create({});
    }
    res.status(200).json(new ApiResponse(200, about, 'About page content fetched successfully'));
}));

// GET /api/portfolio (public CMS)
router.get('/portfolio', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 12;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.category && req.query.category !== 'all') {
        filter.category = req.query.category;
    }

    const portfolios = await Portfolio.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Portfolio.countDocuments(filter);

    res.json(new ApiResponse(200, {
        data: portfolios,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    }, 'Portfolios fetched successfully'));
}));

// Portfolio Page content
router.get('/portfolio-page', getPortfolioPage);

// GET /api/public/agreement-template/active (public agreement template)
router.get('/agreement-template/active', asyncHandler(async (req, res) => {
    const { default: AgreementTemplate } = await import('../models/AgreementTemplate.model.js');
    const templateKey = req.query.templateKey || 'B2B_ACCEPTANCE_EXECUTION';
    let template = await AgreementTemplate.findOne({ templateKey, status: 'Active' }).sort({ createdAt: -1 });
    if (!template && templateKey === 'B2B_ACCEPTANCE_EXECUTION') {
        template = await AgreementTemplate.findOne({ status: 'Active' }).sort({ createdAt: -1 });
    }
    res.status(200).json(new ApiResponse(200, template, 'Active agreement template fetched.'));
}));

// ─── POST /api/support/contact ───────────────────────────────────────────────
// "Contact us" form for customers, vendors, delivery partners and visitors who are not signed in.
// Creates a real support ticket (previously the forms only pretended to submit).
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 5 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many messages sent. Please try again in an hour.' },
});

router.post('/support/contact', contactLimiter, optionalAuth, asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim().slice(0, 20);
    const subject = String(req.body?.subject || req.body?.category || 'General enquiry').trim();
    const message = String(req.body?.message || '').trim();
    const storeName = String(req.body?.storeName || '').trim();

    if (!name) throw new ApiError(400, 'Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ApiError(400, 'Please enter a valid email address.');
    if (message.length < 10) throw new ApiError(400, 'Please describe your issue (at least 10 characters).');
    assertTextLength(name, 'Name', 100);
    assertTextLength(subject, 'Subject', 200);
    assertTextLength(message, 'Message', 5000);

    // Attach the ticket to the signed-in account when there is one
    const role = req.user?.role;
    const owner = {};
    let requesterType = 'guest';
    let senderType = 'user';
    if (['customer', 'b2bAdmin', 'b2bEmployee'].includes(role)) { owner.userId = req.user.id; requesterType = 'user'; }
    else if (['vendor', 'managed_vendor'].includes(role)) { owner.vendorId = req.user.id; requesterType = 'vendor'; senderType = 'vendor'; }
    else if (role === 'delivery') { owner.deliveryBoyId = req.user.id; requesterType = 'delivery'; senderType = 'delivery'; }

    const body = storeName ? `${message}\n\nStore: ${storeName}` : message;
    const ticketNumber = await generateTicketNumber();
    const ticket = await SupportTicket.create({
        ticketNumber,
        ...owner,
        requesterType,
        guestContact: { name, email, phone },
        category: String(req.body?.category || 'General').slice(0, 80),
        subject,
        description: body,
        priority: 'medium',
        status: 'open',
        messages: [{ senderId: owner.userId || owner.vendorId || owner.deliveryBoyId, senderType, message: body, createdAt: new Date() }],
        timeline: [{ status: 'open', changedAt: new Date(), note: 'Submitted through the contact form' }],
    });

    await notifyAdmins(ticket, 'New contact request', `${name} (${requesterType}) wrote: ${subject}`);
    res.status(201).json(new ApiResponse(201, { ticketNumber }, 'Your message has been received. Our support team will contact you shortly.'));
}));


export default router;

