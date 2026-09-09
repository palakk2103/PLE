import { Router } from 'express';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import Product from '../models/Product.model.js';
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
import ManagedVendorUser from '../models/ManagedVendorUser.model.js';
import Admin from '../models/Admin.model.js';

const router = Router();

router.get('/setup-test-data', asyncHandler(async (req, res) => {
    let admin = await Admin.findOne({ isActive: true });
    if (!admin) {
        admin = await Admin.create({
            name: "Test Admin",
            email: "admin@test.com",
            password: "password123",
            role: "admin",
            isActive: true
        });
    }

    let shop = await ManagedShop.findOne({ name: "Anita Mega Mart" });
    if (!shop) {
        shop = await ManagedShop.create({
            name: "Anita Mega Mart",
            logo: "https://via.placeholder.com/150",
            address: "123 Mart Street",
            phone: "9876543210",
            gst: "27AAAAA1111A1Z1",
            warehouse: "Mumbai Warehouse",
            status: "active",
            description: "Managed Superstore"
        });
    }

    let vendorUser = await ManagedVendorUser.findOne({ username: "rahul" });
    if (!vendorUser) {
        vendorUser = await ManagedVendorUser.create({
            name: "Rahul Kumar",
            phone: "9999999999",
            username: "rahul",
            password: "password123",
            role: "managed_vendor",
            shopId: shop._id,
            createdBy: admin._id,
            status: "active"
        });
    }

    res.status(200).json(new ApiResponse(200, {
        shop,
        vendorUser: {
            id: vendorUser._id,
            name: vendorUser.name,
            username: vendorUser.username,
            role: vendorUser.role,
            status: vendorUser.status
        }
    }, 'Test data seeded successfully!'));
}));

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

const toPublicVendor = (vendorDoc) => {
    const vendor = typeof vendorDoc?.toObject === 'function'
        ? vendorDoc.toObject()
        : (vendorDoc || {});

    return {
        ...vendor,
        password: undefined,
        otp: undefined,
        otpExpiry: undefined,
        bankDetails: undefined,
        commissionRate: undefined,
    };
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
        approvalStatus: { $ne: 'pending' },
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
    if (searchQuery) filter.$text = { $search: searchQuery };

    const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, 'price-asc': { price: 1 }, 'price-desc': { price: -1 }, popular: { reviewCount: -1 }, rating: { rating: -1, createdAt: -1 } };

    const products = await Product.find(filter).populate('categoryId', 'name').populate('brandId', 'name').populate('vendorId', 'storeName').sort(sortMap[sort] || { rating: -1, createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Product.countDocuments(filter);

    res.status(200).json(new ApiResponse(200, { products, total, page: Number(page), pages: Math.ceil(total / limit) }, 'Products fetched.'));
});

router.get('/', listProducts);
router.get('/products', listProducts);

// GET /api/products/flash-sale
router.get('/flash-sale', asyncHandler(async (req, res) => {
    const filter = { isActive: true, flashSale: true };
    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }
    const products = await Product.find(filter).limit(20);
    res.status(200).json(new ApiResponse(200, products, 'Flash sale products.'));
}));

// GET /api/products/new-arrivals
router.get('/new-arrivals', asyncHandler(async (req, res) => {
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

    const filter = { isActive: true, isNewArrival: true };
    
    // Channel filter based on user type context
    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }

    const searchQuery = String(search || q || '').trim();
    if (searchQuery) filter.$text = { $search: searchQuery };
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
        rating: { rating: -1 },
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
}));

// GET /api/products/popular
router.get('/popular', asyncHandler(async (req, res) => {
    const filter = { isActive: true };
    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }
    const products = await Product.find(filter).sort({ reviewCount: -1, rating: -1 }).limit(10);
    res.status(200).json(new ApiResponse(200, products, 'Popular products.'));
}));

// GET /api/products/similar/:id
router.get('/similar/:id', asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw new ApiError(404, 'Product not found.');
    
    const filter = { isActive: true, _id: { $ne: product._id }, categoryId: product.categoryId };
    const channelQuery = req.query.channel;
    if (channelQuery === 'b2c') {
        filter.salesChannel = { $in: ['B2C', 'BOTH'] };
    } else if (channelQuery === 'b2b') {
        filter.salesChannel = { $in: ['B2B', 'BOTH'] };
    }

    const similar = await Product.find(filter).limit(6);
    res.status(200).json(new ApiResponse(200, similar, 'Similar products.'));
}));

const getProductDetail = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).populate('categoryId', 'name').populate('brandId', 'name').populate('vendorId', 'storeName storeLogo rating');
    if (!product) throw new ApiError(404, 'Product not found.');
    res.status(200).json(new ApiResponse(200, product, 'Product detail.'));
});

// GET /api/products/:id
router.get('/products/:id', getProductDetail);

// GET /api/categories (public)
const getPublicCategoriesList = asyncHandler(async (req, res) => {
    const categories = await Category.find({
        isActive: true,
        $or: [{ status: 'approved' }, { status: { $exists: false } }],
    }).sort({ order: 1 });
    res.status(200).json(new ApiResponse(200, categories, 'Categories fetched.'));
});

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

// GET /api/campaigns (public)
router.get('/campaigns', asyncHandler(async (req, res) => {
    const campaigns = await Campaign.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, campaigns, 'Campaigns fetched.'));
}));

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
        filter.$or = [{ name: safeRegex }, { email: safeRegex }, { storeName: safeRegex }];
    }

    const vendors = await Vendor.find(filter)
        .select('-password -otp -otpExpiry')
        .sort({ rating: -1, reviewCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .lean();

    const activeShops = await ManagedShop.find({ status: 'active' }).lean();

    const mappedShops = await Promise.all(activeShops.map(async (shop) => {
        const productCount = await Product.countDocuments({ shopId: shop._id, isActive: true });
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
        const productCount = await Product.countDocuments({ vendorId: v._id, isActive: true });
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
    }).select('-password -otp -otpExpiry').lean();

    if (!seller) {
        const shop = await ManagedShop.findOne({
            _id: req.params.id,
            status: 'active'
        }).lean();
        if (shop) {
            const productCount = await Product.countDocuments({ shopId: shop._id, isActive: true });
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

    const filter = { isActive: true };
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
router.get('/coupons/available', asyncHandler(async (req, res) => {
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
router.post('/shipping/estimate', asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const shippingAddress = req.body?.shippingAddress || {};
    const shippingOption = String(req.body?.shippingOption || 'standard');
    const couponType = req.body?.couponType || null;

    if (!items.length) {
        return res.status(200).json(
            new ApiResponse(200, { shipping: 0, byVendor: {} }, 'Shipping estimate calculated.')
        );
    }

    const productIds = items
        .map((item) => String(item?.productId || '').trim())
        .filter((id) => /^[a-fA-F0-9]{24}$/.test(id));
    if (!productIds.length) {
        return res.status(200).json(
            new ApiResponse(200, { shipping: 0, byVendor: {} }, 'Shipping estimate calculated.')
        );
    }

    const products = await Product.find({ _id: { $in: productIds }, isActive: true })
        .populate('vendorId', 'shippingEnabled defaultShippingRate freeShippingThreshold')
        .populate('shopId', 'name logo')
        .select('_id vendorId shopId price variants.prices')
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
        const price = Math.max(0, Number(resolveVariantPrice(product, item?.variant) || 0));
        const subtotal = price * quantity;

        if (!vendorMap[vendorId]) {
            vendorMap[vendorId] = {
                vendorId,
                subtotal: 0,
                shippingEnabled: isManagedShop ? true : (product.vendorId.shippingEnabled !== false),
                defaultShippingRate: isManagedShop ? 0 : (product.vendorId.defaultShippingRate || 0),
                freeShippingThreshold: isManagedShop ? 0 : (product.vendorId.freeShippingThreshold || 0),
            };
        }
        vendorMap[vendorId].subtotal += subtotal;
    });

    const { totalShipping, shippingByVendor } = await calculateVendorShippingForGroups({
        vendorGroups: Object.values(vendorMap),
        shippingAddress,
        shippingOption,
        couponType,
    });

    res.status(200).json(
        new ApiResponse(200, { shipping: totalShipping, byVendor: shippingByVendor }, 'Shipping estimate calculated.')
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
        isActive: true
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
router.get('/settings/:key', asyncHandler(async (req, res) => {
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

export default router;

