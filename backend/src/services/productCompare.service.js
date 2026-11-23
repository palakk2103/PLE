import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import Product from '../models/Product.model.js';
import ManagedShop from '../models/ManagedShop.model.js';
import { publicApprovalFilter } from '../utils/productVisibility.js';
import { buildPublicStoreProfile } from './vendorStoreProfile.service.js';

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

/** "a,b,c" (or an array) -> unique valid ids in the order given, 2 to 4 of them. */
export const parseCompareIds = (raw) => {
    const list = (Array.isArray(raw) ? raw : String(raw || '').split(','))
        .map((v) => String(v).trim().toLowerCase())
        .filter(Boolean);
    const ids = [...new Set(list)];
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id) || String(new mongoose.Types.ObjectId(id)) !== id.toLowerCase())) {
        throw new ApiError(400, 'One or more product ids are invalid.');
    }
    if (ids.length < MIN_COMPARE) throw new ApiError(400, `Pick at least ${MIN_COMPARE} products to compare.`);
    if (ids.length > MAX_COMPARE) throw new ApiError(400, `You can compare at most ${MAX_COMPARE} products at a time.`);
    return ids;
};

const SPEC_SECTIONS = ['features', 'additional', 'itemDetails'];

const formatSpecValue = (entry) => {
    let v = entry?.value;
    if (Array.isArray(v)) v = v.filter((x) => x !== null && x !== undefined && x !== '').join(', ');
    else if (typeof v === 'boolean') v = v ? 'Yes' : 'No';
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const unit = entry?.unit ? ` ${entry.unit}` : '';
    return `${String(v).trim()}${unit}`;
};

/** One row per spec label across all products (case-insensitive); a product without it gets null. */
export const buildSpecRows = (products) => {
    const rows = new Map();
    products.forEach((product, index) => {
        const specs = product.specifications || {};
        for (const section of SPEC_SECTIONS) {
            for (const entry of specs[section] || []) {
                const label = String(entry?.label || entry?.key || '').trim();
                const value = formatSpecValue(entry);
                if (!label || value === null) continue;
                const key = label.toLowerCase();
                if (!rows.has(key)) rows.set(key, { label, values: new Array(products.length).fill(null) });
                const row = rows.get(key);
                if (row.values[index] === null) row.values[index] = value;
            }
        }
        const box = (specs.whatsInBox || []).map((s) => String(s).trim()).filter(Boolean);
        if (box.length) {
            if (!rows.has("what's in the box")) rows.set("what's in the box", { label: "What's in the box", values: new Array(products.length).fill(null) });
            rows.get("what's in the box").values[index] = box.join(', ');
        }
    });
    return [...rows.values()].map((row) => {
        const present = row.values.map((v) => (v === null ? null : v.toLowerCase()));
        return { ...row, differs: new Set(present).size > 1 };
    });
};

const toSeller = (product, shopsById) => {
    if (product.vendorId && typeof product.vendorId === 'object') {
        const v = product.vendorId;
        const profile = buildPublicStoreProfile(v);
        const address = profile.business.address;
        return {
            type: 'vendor',
            id: String(v._id),
            name: v.storeName || v.name,
            logo: v.storeLogo || '',
            rating: Number(v.rating) || 0,
            reviewCount: Number(v.reviewCount) || 0,
            isVerified: !!v.isVerified,
            gstVerified: profile.business.gstVerified,
            location: [address?.city, address?.state].filter(Boolean).join(', '),
            memberSince: v.joinDate || v.createdAt || null,
            tagline: profile.tagline,
        };
    }
    const shop = shopsById.get(String(product.shopId));
    return {
        type: 'ple_shop',
        id: product.shopId ? String(product.shopId) : null,
        name: shop?.name || 'PLE Store',
        logo: shop?.logo || '',
        rating: 0,
        reviewCount: 0,
        isVerified: true,
        gstVerified: false,
        location: '',
        memberSince: null,
        tagline: '',
    };
};

const effectiveStock = (p) => {
    if (p.stock === 'out_of_stock' || (typeof p.stockQuantity === 'number' && p.stockQuantity <= 0 && p.stock !== 'in_stock')) return 'out_of_stock';
    return p.stock || 'in_stock';
};

/**
 * Side-by-side data for 2-4 products. Products that are not publicly available (deleted, hidden,
 * unapproved) are reported in `unavailable` instead of failing the whole comparison.
 * Seller details are the public ones only: never phone, email, GST number, PAN or bank details.
 */
export const buildComparison = async (ids) => {
    const found = await Product.find({
        _id: { $in: ids },
        isSourceProduct: { $ne: true },
        publicationStatus: { $nin: ['draft', 'unpublished', 'archived'] },
        isActive: true,
        ...publicApprovalFilter(),
    })
        .select('name slug image images price originalPrice unit rating reviewCount stock stockQuantity minimumOrderQuantity warrantyPeriod guaranteePeriod returnable cancelable codAllowed taxIncluded isRefurbished condition variants specifications categoryId brandId vendorId shopId')
        .populate('categoryId', 'name')
        .populate('brandId', 'name')
        .populate('vendorId', 'name storeName storeLogo rating reviewCount isVerified joinDate createdAt storeProfile city state address businessAddress verificationStatus gstNumber')
        .lean();

    const shopIds = found.filter((p) => p.shopId && !p.vendorId).map((p) => p.shopId);
    const shops = shopIds.length ? await ManagedShop.find({ _id: { $in: shopIds } }).select('name logo').lean() : [];
    const shopsById = new Map(shops.map((s) => [String(s._id), s]));

    const byId = new Map(found.map((p) => [String(p._id), p]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

    const products = ordered.map((p) => {
        const price = Number(p.price) || 0;
        const original = Number(p.originalPrice) || 0;
        return {
            id: String(p._id),
            name: p.name,
            slug: p.slug,
            image: p.image || p.images?.[0] || '',
            price,
            originalPrice: original > price ? original : null,
            discountPercent: original > price ? Math.round(((original - price) / original) * 100) : 0,
            unit: p.unit || 'Piece',
            rating: Number(p.rating) || 0,
            reviewCount: Number(p.reviewCount) || 0,
            brand: p.brandId?.name || '',
            category: p.categoryId?.name || '',
            stock: effectiveStock(p),
            minimumOrderQuantity: p.minimumOrderQuantity || 1,
            warranty: p.warrantyPeriod || '',
            guarantee: p.guaranteePeriod || '',
            returnable: p.returnable !== false,
            cancelable: p.cancelable !== false,
            codAllowed: p.codAllowed !== false,
            taxIncluded: !!p.taxIncluded,
            condition: p.isRefurbished ? (p.condition || 'refurbished') : 'brand_new',
            variants: {
                sizes: p.variants?.sizes || [],
                colors: p.variants?.colors || [],
                materials: p.variants?.materials || [],
            },
            seller: toSeller(p, shopsById),
            specifications: p.specifications || {},
        };
    });

    const specRows = buildSpecRows(products);
    const slim = products.map(({ specifications, ...rest }) => rest); // eslint-disable-line no-unused-vars
    return {
        products: slim,
        specRows,
        unavailable: ids.filter((id) => !byId.has(id)),
        sameCategory: new Set(slim.map((p) => p.category)).size <= 1,
    };
};
