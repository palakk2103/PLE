import { Product } from '../../../models/Product.model.js';
import { Category } from '../../../models/Category.model.js';
import Vendor from '../../../models/Vendor.model.js';
import { ApiResponse } from '../../../utils/ApiResponse.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { ApiError } from '../../../utils/ApiError.js';
import mongoose from 'mongoose';

/**
 * @desc Get vendor GST settings overview & categories stats
 * @route GET /api/vendor/gst-settings
 */
export const getVendorGstSettings = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;

  // Get vendor profile settings
  const vendorDoc = await Vendor.findById(vendorId).select('categoryGstRates defaultGstRate');

  // Get total count of products for this vendor
  const totalProducts = await Product.countDocuments({ vendorId });

  // Get count by gstMode
  const customGstCount = await Product.countDocuments({ vendorId, gstMode: 'custom' });
  const categoryGstCount = totalProducts - customGstCount;

  // 1. Fetch all active and approved categories from platform
  const allCategories = await Category.find({
    status: { $ne: 'rejected' },
    isActive: { $ne: false },
  })
    .select('name parentId gstRate icon image order')
    .sort({ order: 1, name: 1 })
    .lean();

  // 2. Aggregate vendor product counts per category
  const categoryGroup = await Product.aggregate([
    { $match: { vendorId: new mongoose.Types.ObjectId(vendorId) } },
    {
      $group: {
        _id: '$categoryId',
        count: { $sum: 1 },
        customGstCount: {
          $sum: { $cond: [{ $eq: ['$gstMode', 'custom'] }, 1, 0] },
        },
      },
    },
  ]);

  const productCountMap = new Map();
  categoryGroup.forEach((item) => {
    if (item._id) {
      productCountMap.set(String(item._id), {
        totalProducts: item.count,
        customGstCount: item.customGstCount,
        categoryGstCount: item.count - item.customGstCount,
      });
    }
  });

  // 3. Build comprehensive category breakdown for all categories
  const categoryBreakdown = allCategories.map((cat) => {
    const catIdStr = String(cat._id);
    const prodCounts = productCountMap.get(catIdStr) || {
      totalProducts: 0,
      customGstCount: 0,
      categoryGstCount: 0,
    };

    const vendorRule = vendorDoc?.categoryGstRates?.find(
      (r) => String(r.categoryId) === catIdStr
    );
    const vendorRate = vendorRule ? vendorRule.gstRate : null;
    const effectiveRate = vendorRate !== null && vendorRate !== undefined ? vendorRate : (cat?.gstRate ?? 18);

    return {
      categoryId: cat._id,
      categoryName: cat.name,
      parentId: cat.parentId,
      categoryGstRate: cat?.gstRate !== undefined ? cat.gstRate : 18,
      vendorCategoryGstRate: vendorRate,
      effectiveGstRate: effectiveRate,
      totalProducts: prodCounts.totalProducts,
      customGstCount: prodCounts.customGstCount,
      categoryGstCount: prodCounts.categoryGstCount,
    };
  });

  // Sort: Categories with products first, then categories with custom store rules, then alphabetically
  categoryBreakdown.sort((a, b) => {
    const aHasRule = a.vendorCategoryGstRate !== null && a.vendorCategoryGstRate !== undefined;
    const bHasRule = b.vendorCategoryGstRate !== null && b.vendorCategoryGstRate !== undefined;
    if (a.totalProducts !== b.totalProducts) return b.totalProducts - a.totalProducts;
    if (aHasRule !== bHasRule) return aHasRule ? -1 : 1;
    return a.categoryName.localeCompare(b.categoryName);
  });

  // Get list of all products for product-wise manager
  const products = await Product.find({ vendorId })
    .select('name image price gstMode gstRate categoryId brandId stockQuantity isVisible')
    .populate('categoryId', 'name gstRate')
    .sort({ updatedAt: -1 });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalProducts,
        customGstCount,
        categoryGstCount,
        vendorDefaultGstRate: vendorDoc?.defaultGstRate ?? 18,
        categoryGstRates: vendorDoc?.categoryGstRates || [],
        categoryBreakdown,
        products: products.map((p) => {
          const vendorCatRule = vendorDoc?.categoryGstRates?.find(
            (r) => String(r.categoryId) === String(p.categoryId?._id || p.categoryId)
          );
          const effectiveCatRate = vendorCatRule ? vendorCatRule.gstRate : (p.categoryId?.gstRate ?? 18);
          const resolvedRate = p.gstMode === 'custom' && Number.isFinite(p.gstRate)
            ? p.gstRate
            : effectiveCatRate;

          return {
            _id: p._id,
            name: p.name,
            image: p.image,
            price: p.price,
            gstMode: p.gstMode || 'category',
            gstRate: resolvedRate,
            categoryName: p.categoryId?.name || 'Uncategorized',
            categoryDefaultRate: p.categoryId?.gstRate ?? 18,
            vendorCategoryRate: vendorCatRule ? vendorCatRule.gstRate : null,
            isVisible: p.isVisible,
          };
        }),
      },
      'Vendor GST settings fetched successfully'
    )
  );
});

/**
 * @desc Bulk update global GST rate for all vendor products or set global mode
 * @route POST /api/vendor/gst-settings/global
 */
export const updateGlobalGst = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { gstRate, applyToAll } = req.body;

  if (gstRate === undefined || isNaN(gstRate) || gstRate < 0 || gstRate > 100) {
    throw new ApiError(400, 'Valid GST Rate (0-100%) is required');
  }

  const rate = Number(gstRate);

  // If applyToAll is true, set all vendor products to custom mode with specified gstRate
  if (applyToAll) {
    await Vendor.findByIdAndUpdate(vendorId, { defaultGstRate: rate });
    const result = await Product.updateMany(
      { vendorId },
      { $set: { gstMode: 'custom', gstRate: rate, taxRate: rate } }
    );
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { modifiedCount: result.modifiedCount },
          `Successfully applied ${rate}% GST rate to all ${result.modifiedCount} products and saved as your store default`
        )
      );
  } else {
    // Revert all products to category mode
    const result = await Product.updateMany(
      { vendorId },
      { $set: { gstMode: 'category' } }
    );
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { modifiedCount: result.modifiedCount },
          `Successfully reset all products to Category-default GST mode`
        )
      );
  }
});

/**
 * @desc Bulk update GST rate for products under a specific category for vendor
 * @route POST /api/vendor/gst-settings/category
 */
export const updateCategoryGst = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { categoryId, gstRate, gstMode = 'custom' } = req.body;

  if (!categoryId) {
    throw new ApiError(400, 'Category ID is required');
  }

  if (gstMode === 'custom') {
    if (gstRate === undefined || isNaN(gstRate) || gstRate < 0 || gstRate > 100) {
      throw new ApiError(400, 'Valid GST Rate (0-100%) is required');
    }
    const rate = Number(gstRate);

    // Persist vendor's custom category rate
    await Vendor.findByIdAndUpdate(vendorId, {
      $pull: { categoryGstRates: { categoryId: new mongoose.Types.ObjectId(categoryId) } },
    });
    await Vendor.findByIdAndUpdate(vendorId, {
      $push: { categoryGstRates: { categoryId: new mongoose.Types.ObjectId(categoryId), gstRate: rate } },
    });

    // Support both parent category and any subcategories under this category
    const targetCatObjectId = mongoose.Types.ObjectId.isValid(categoryId)
      ? new mongoose.Types.ObjectId(categoryId)
      : null;
    const childCats = targetCatObjectId
      ? await Category.find({ parentId: targetCatObjectId }).select('_id').lean()
      : [];
    const allTargetCatIds = [
      categoryId,
      ...(targetCatObjectId ? [targetCatObjectId] : []),
      ...childCats.map((c) => c._id),
      ...childCats.map((c) => String(c._id)),
    ];

    const result = await Product.updateMany(
      { vendorId, categoryId: { $in: allTargetCatIds } },
      { $set: { gstMode: 'category', gstRate: rate, taxRate: rate } }
    );
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { modifiedCount: result.modifiedCount, savedVendorRate: rate },
          `Successfully set ${rate}% GST for ${result.modifiedCount} products in this category and saved as your category default`
        )
      );
  } else {
    // Remove vendor custom rate for this category, revert to platform category default
    await Vendor.findByIdAndUpdate(vendorId, {
      $pull: { categoryGstRates: { categoryId: new mongoose.Types.ObjectId(categoryId) } },
    });

    const targetCatObjectId = mongoose.Types.ObjectId.isValid(categoryId)
      ? new mongoose.Types.ObjectId(categoryId)
      : null;
    const childCats = targetCatObjectId
      ? await Category.find({ parentId: targetCatObjectId }).select('_id').lean()
      : [];
    const allTargetCatIds = [
      categoryId,
      ...(targetCatObjectId ? [targetCatObjectId] : []),
      ...childCats.map((c) => c._id),
      ...childCats.map((c) => String(c._id)),
    ];

    const result = await Product.updateMany(
      { vendorId, categoryId: { $in: allTargetCatIds } },
      { $set: { gstMode: 'category' } }
    );
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { modifiedCount: result.modifiedCount },
          `Successfully reset products in category to Category-default GST mode`
        )
      );
  }
});

/**
 * @desc Quick update gstMode & gstRate for a single product or batch
 * @route PATCH /api/vendor/gst-settings/product
 */
export const quickUpdateProductGst = asyncHandler(async (req, res) => {
  const vendorId = req.user.id;
  const { productId, productIds, gstMode, gstRate } = req.body;

  const targetIds = productIds || (productId ? [productId] : []);

  if (!targetIds || targetIds.length === 0) {
    throw new ApiError(400, 'At least one Product ID is required');
  }

  const updateFields = {};
  if (gstMode && ['category', 'custom'].includes(gstMode)) {
    updateFields.gstMode = gstMode;
  }

  if (gstRate !== undefined && !isNaN(gstRate)) {
    const rate = Number(gstRate);
    updateFields.gstRate = rate;
    updateFields.taxRate = rate;
  }

  const result = await Product.updateMany(
    { _id: { $in: targetIds }, vendorId },
    { $set: updateFields }
  );

  res.status(200).json(
    new ApiResponse(
      200,
      { modifiedCount: result.modifiedCount },
      `Updated GST settings for ${result.modifiedCount} product(s)`
    )
  );
});
