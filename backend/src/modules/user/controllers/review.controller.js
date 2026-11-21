import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Review from '../../../models/Review.model.js';
import Product from '../../../models/Product.model.js';
import Order from '../../../models/Order.model.js';
import User from '../../../models/User.model.js';
import { uploadLocalFileToCloudinaryAndCleanup, cleanupLocalFiles } from '../../../services/upload.service.js';

export const MAX_REVIEW_IMAGES = 3;

// Only keep http(s) URLs (uploaded via /user/reviews/images); drop anything else a client sends.
const sanitizeReviewImages = (images) => {
    if (images == null) return [];
    if (!Array.isArray(images)) throw new ApiError(400, 'images must be an array of URLs.');
    const urls = images
        .map((u) => (typeof u === 'string' ? u.trim() : ''))
        .filter((u) => /^https?:\/\/[^\s]+$/i.test(u) && u.length <= 2048);
    if (urls.length !== images.length) throw new ApiError(400, 'Each review image must be an uploaded image URL. Upload photos first.');
    if (urls.length > MAX_REVIEW_IMAGES) throw new ApiError(400, `A review can have at most ${MAX_REVIEW_IMAGES} photos.`);
    return [...new Set(urls)];
};

// POST /api/user/reviews/images  (multipart, field "images", up to 3 files)
export const uploadReviewImages = asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw new ApiError(400, 'Select at least one photo to upload.');
    const uploaded = [];
    try {
        for (let i = 0; i < files.length; i += 1) {
            const r = await uploadLocalFileToCloudinaryAndCleanup(files[i].path, 'reviews');
            uploaded.push(r.url);
        }
    } catch (error) {
        await cleanupLocalFiles(files.slice(uploaded.length).map((f) => f.path));
        throw error;
    }
    res.status(201).json(new ApiResponse(201, { urls: uploaded }, 'Photos uploaded.'));
});

// GET /api/user/reviews/product/:productId
export const getProductReviews = asyncHandler(async (req, res) => {
    const { sort = 'newest', page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const sortMap = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        'highest-rating': { rating: -1 },
        'lowest-rating': { rating: 1 },
        'most-helpful': { helpfulCount: -1 },
    };

    const reviews = await Review.find({ productId: req.params.productId, isApproved: true })
        .populate('userId', 'name avatar')
        .sort(sortMap[sort] || { createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

    const total = await Review.countDocuments({ productId: req.params.productId, isApproved: true });
    res.status(200).json(new ApiResponse(200, { reviews, total, page: Number(page), pages: Math.ceil(total / limit) }, 'Reviews fetched.'));
});

// GET /api/user/reviews/eligibility/:productId
// Can the logged-in buyer review this product? (has a delivered order with it, not yet reviewed)
export const getReviewEligibility = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    if (!/^[a-f\d]{24}$/i.test(String(productId))) throw new ApiError(400, 'Invalid product id.');
    const [order, existing] = await Promise.all([
        Order.findOne({ userId: req.user.id, 'items.productId': productId, status: 'delivered' })
            .sort({ deliveredAt: -1, createdAt: -1 })
            .select('_id orderId')
            .lean(),
        Review.findOne({ productId, userId: req.user.id }).select('_id isApproved').lean(),
    ]);
    res.status(200).json(new ApiResponse(200, {
        eligible: !!order && !existing,
        orderId: order?._id || null,
        alreadyReviewed: !!existing,
        reviewStatus: existing ? (existing.isApproved ? 'approved' : 'pending') : null,
    }, 'Review eligibility.'));
});

// POST /api/user/reviews
export const addReview = asyncHandler(async (req, res) => {
    const { productId, orderId, rating, comment, images } = req.body;
    const cleanImages = sanitizeReviewImages(images);

    // Verify purchase
    const order = await Order.findOne({ _id: orderId, userId: req.user.id, 'items.productId': productId, status: 'delivered' });
    if (!order) throw new ApiError(403, 'You can only review products you have purchased and received.');

    const existing = await Review.findOne({ productId, userId: req.user.id });
    if (existing) throw new ApiError(409, 'You have already reviewed this product.');

    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found.');

    const reviewerType = user.companyName ? 'B2B' : 'B2C';
    const companyName = user.companyName || undefined;
    const verificationStatus = user.verificationStatus || undefined;

    const review = await Review.create({
        productId,
        userId: req.user.id,
        orderId,
        rating,
        comment,
        images: cleanImages,
        isVerifiedPurchase: true,
        reviewerType,
        companyName,
        verificationStatus,
    });
    res.status(201).json(new ApiResponse(201, review, 'Review submitted and pending approval.'));
});

// POST /api/user/reviews/:id/helpful
export const voteHelpful = asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(req.params.id, { $inc: { helpfulCount: 1 } }, { new: true });
    if (!review) throw new ApiError(404, 'Review not found.');
    res.status(200).json(new ApiResponse(200, review, 'Vote recorded.'));
});
