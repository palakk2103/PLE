import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Vendor from '../../../models/Vendor.model.js';
import { buildStoreProfileUpdates, buildPublicStoreProfile } from '../../../services/vendorStoreProfile.service.js';

const STORE_FIELDS = 'name storeName storeLogo storeDescription storeProfile businessName tradeName ownerName businessType gstNumber verificationStatus businessAddress city state pincode address';

const view = (vendor) => ({
    storeName: vendor.storeName,
    storeLogo: vendor.storeLogo || '',
    storeDescription: vendor.storeDescription || '',
    // exactly what customers will see (preview)
    public: buildPublicStoreProfile(vendor),
});

// GET /api/vendor/store-profile
export const getStoreProfile = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') throw new ApiError(403, 'Managed vendor stores are set up by the Administrator.');
    const vendor = await Vendor.findById(req.user.id).select(STORE_FIELDS).lean();
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    res.status(200).json(new ApiResponse(200, view(vendor), 'Store profile fetched.'));
});

// PUT /api/vendor/store-profile
// Appearance only (logo, banner, theme, tagline, about, hours). Business identity (name, GST,
// address) is verified by PLE and edited under Business Profile, never here.
export const updateStoreProfile = asyncHandler(async (req, res) => {
    if (req.user.role === 'managed_vendor') throw new ApiError(403, 'Managed vendor stores are set up by the Administrator.');
    const existing = await Vendor.findById(req.user.id).select('storeLogo storeProfile.bannerUrl').lean();
    if (!existing) throw new ApiError(404, 'Vendor not found.');
    const set = buildStoreProfileUpdates(req.body, existing);
    const vendor = await Vendor.findByIdAndUpdate(req.user.id, { $set: set }, { new: true, runValidators: true }).select(STORE_FIELDS).lean();
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    res.status(200).json(new ApiResponse(200, view(vendor), 'Store profile saved.'));
});
