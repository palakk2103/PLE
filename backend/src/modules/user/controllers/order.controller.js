import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Razorpay from 'razorpay';
import Order from '../../../models/Order.model.js';
import Product from '../../../models/Product.model.js';
import Coupon from '../../../models/Coupon.model.js';
import Commission from '../../../models/Commission.model.js';
import ReturnRequest from '../../../models/ReturnRequest.model.js';
import Admin from '../../../models/Admin.model.js';
import { generateOrderId } from '../../../utils/generateOrderId.js';
import { generateTrackingNumber } from '../../../utils/generateTrackingNumber.js';
import mongoose from 'mongoose';
import { User } from '../../../models/User.model.js';
import Wallet from '../../../models/Wallet.model.js';
import WalletTransaction from '../../../models/WalletTransaction.model.js';
import * as walletService from '../../../services/wallet.service.js';
import LoyaltyTransaction from '../../../models/LoyaltyTransaction.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { calculateVendorShippingForGroups } from '../../../services/vendorShipping.service.js';
import { getIO } from '../../../config/socket.js';
import { sendNotificationToUser } from '../../../utils/pushNotificationHelper.js';
import { resolveProductGST, calculateItemGST } from '../../../utils/gstUtils.js';
import { generateInvoiceForOrder, sendOrderInvoiceEmail } from '../../../services/invoice.service.js';
import { handleOrderStatusTransition } from '../../../services/orderStatus.service.js';

const normalizeVariantPart = (value) => String(value || '').trim().toLowerCase();
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

const toVariantPriceEntries = (variantPrices) => {
    if (!variantPrices) return [];
    if (variantPrices instanceof Map) return Array.from(variantPrices.entries());
    if (typeof variantPrices === 'object') return Object.entries(variantPrices);
    return [];
};

const toVariantStockEntries = (stockMap) => {
    if (!stockMap) return [];
    if (stockMap instanceof Map) return Array.from(stockMap.entries());
    if (typeof stockMap === 'object') return Object.entries(stockMap);
    return [];
};

const resolveVariantSelection = (product, selectedVariant) => {
    const basePrice = Number(product?.price);
    if (!Number.isFinite(basePrice)) {
        throw new ApiError(400, `Invalid price configured for product ${product?.name || product?._id || ''}.`);
    }

    const entries = toVariantPriceEntries(product?.variants?.prices);
    const attributeAxes = Array.isArray(product?.variants?.attributes)
        ? product.variants.attributes
            .map((attr) => ({
                axisKey: normalizeAxisName(attr?.name),
                values: Array.isArray(attr?.values) ? attr.values : [],
            }))
            .filter((attr) => attr.axisKey && attr.values.length > 0)
        : [];
    const hasDynamicAxes = attributeAxes.length > 0;

    if (hasDynamicAxes) {
        const normalizedSelection = {};
        Object.entries(selectedVariant || {}).forEach(([axis, value]) => {
            const axisKey = normalizeAxisName(axis);
            const selectedValue = String(value || '').trim();
            if (axisKey && selectedValue) normalizedSelection[axisKey] = selectedValue;
        });

        const missingAxis = attributeAxes.find((attr) => !String(normalizedSelection[attr.axisKey] || '').trim());
        if (missingAxis) {
            throw new ApiError(400, `Please select ${missingAxis.axisKey.replace(/_/g, ' ')} for ${product?.name || 'product'}.`);
        }

        const selectionKey = createDynamicVariantKey(normalizedSelection);
        if (!selectionKey) {
            throw new ApiError(400, `Please select a variant for ${product?.name || 'product'}.`);
        }
        if (!entries.length) {
            return { price: basePrice, variantKey: selectionKey, hasVariantAxes: true };
        }

        const exact = entries.find(([rawKey]) => String(rawKey).trim() === selectionKey);
        if (exact) {
            const price = Number(exact[1]);
            if (Number.isFinite(price) && price >= 0) {
                return { price, variantKey: String(exact[0]).trim(), hasVariantAxes: true };
            }
        }
        const normalized = entries.find(
            ([rawKey]) => normalizeVariantPart(rawKey) === normalizeVariantPart(selectionKey)
        );
        if (normalized) {
            const price = Number(normalized[1]);
            if (Number.isFinite(price) && price >= 0) {
                return { price, variantKey: String(normalized[0]).trim(), hasVariantAxes: true };
            }
        }
        throw new ApiError(400, `Selected variant is not available for ${product?.name || 'product'}.`);
    }

    const sizes = Array.isArray(product?.variants?.sizes) ? product.variants.sizes : [];
    const colors = Array.isArray(product?.variants?.colors) ? product.variants.colors : [];
    const hasVariantAxes = sizes.length > 0 || colors.length > 0;

    const size = normalizeVariantPart(selectedVariant?.size);
    const color = normalizeVariantPart(selectedVariant?.color);
    if (hasVariantAxes && !size && !color) {
        throw new ApiError(400, `Please select a variant for ${product?.name || 'product'}.`);
    }
    if (!entries.length || (!size && !color)) {
        return { price: basePrice, variantKey: null, hasVariantAxes };
    }

    const candidateKeys = [
        `${size}|${color}`,
        `${size}-${color}`,
        `${size}_${color}`,
        `${size}:${color}`,
        size && !color ? size : null,
        color && !size ? color : null,
    ].filter(Boolean);

    for (const candidate of candidateKeys) {
        const exact = entries.find(([rawKey]) => String(rawKey).trim() === candidate);
        if (exact) {
            const price = Number(exact[1]);
            if (Number.isFinite(price) && price >= 0) {
                return { price, variantKey: String(exact[0]).trim(), hasVariantAxes };
            }
        }

        const normalized = entries.find(
            ([rawKey]) => normalizeVariantPart(rawKey) === normalizeVariantPart(candidate)
        );
        if (normalized) {
            const price = Number(normalized[1]);
            if (Number.isFinite(price) && price >= 0) {
                return { price, variantKey: String(normalized[0]).trim(), hasVariantAxes };
            }
        }
    }

    if (hasVariantAxes) {
        throw new ApiError(400, `Selected variant is not available for ${product?.name || 'product'}.`);
    }
    return { price: basePrice, variantKey: null, hasVariantAxes };
};

const resolveOrderItemVariantKey = (product, orderItem) => {
    const explicitKey = String(orderItem?.variantKey || '').trim();
    if (explicitKey) return explicitKey;

    const stockEntries = toVariantStockEntries(product?.variants?.stockMap).map(([k]) => String(k).trim());
    const priceEntries = toVariantPriceEntries(product?.variants?.prices).map(([k]) => String(k).trim());
    const existingKeys = [...new Set([...stockEntries, ...priceEntries])];
    if (!existingKeys.length) return null;

    const dynamicSelection = Object.entries(orderItem?.variant || {}).reduce((acc, [axis, value]) => {
        const axisKey = normalizeAxisName(axis);
        const selectedValue = String(value || '').trim();
        if (axisKey && selectedValue) acc[axisKey] = selectedValue;
        return acc;
    }, {});
    const dynamicKey = createDynamicVariantKey(dynamicSelection);
    if (dynamicKey) {
        const exactDynamic = existingKeys.find((key) => key === dynamicKey);
        if (exactDynamic) return exactDynamic;
        const normalizedDynamic = existingKeys.find(
            (key) => normalizeVariantPart(key) === normalizeVariantPart(dynamicKey)
        );
        if (normalizedDynamic) return normalizedDynamic;
    }

    const size = normalizeVariantPart(orderItem?.variant?.size);
    const color = normalizeVariantPart(orderItem?.variant?.color);
    if (!size && !color) return null;

    const candidates = [
        `${size}|${color}`,
        `${size}-${color}`,
        `${size}_${color}`,
        `${size}:${color}`,
        size && !color ? size : null,
        color && !size ? color : null,
    ].filter(Boolean);

    for (const candidate of candidates) {
        const exact = existingKeys.find((key) => key === candidate);
        if (exact) return exact;
        const normalized = existingKeys.find((key) => normalizeVariantPart(key) === normalizeVariantPart(candidate));
        if (normalized) return normalized;
    }
    return null;
};

// POST /api/user/orders
export const placeOrder = asyncHandler(async (req, res) => {
    const { items, shippingAddress, paymentMethod, couponCode, shippingOption, loyaltyPointsToRedeem = 0, walletAmountToUse = 0 } = req.body;
    const normalizedPaymentMethod = paymentMethod === 'cash' ? 'cod' : paymentMethod;
    const userId = req.user?.id || null;
    const rawIdempotencyKey = String(req.get('x-idempotency-key') || '').trim();
    const idempotencyKey = rawIdempotencyKey || null;
    // Ensure shippingAddress has the authenticated user's email if missing
    if (shippingAddress && !shippingAddress.email && req.user?.email) {
        shippingAddress.email = req.user.email;
    }
    const normalizedGuestEmail = String(shippingAddress?.email || '').trim().toLowerCase();
    const normalizedGuestPhone = String(shippingAddress?.phone || '').replace(/\D/g, '').slice(-10);
    const idempotencyScope = userId
        ? `user:${String(userId)}`
        : `guest:${normalizedGuestEmail || normalizedGuestPhone || 'anonymous'}`;

    if (idempotencyKey) {
        const existingOrder = await Order.findOne({ idempotencyScope, idempotencyKey })
            .select('orderId total trackingNumber')
            .lean();
        if (existingOrder) {
            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        orderId: existingOrder.orderId,
                        total: existingOrder.total,
                        trackingNumber: existingOrder.trackingNumber,
                        idempotentReplay: true,
                    },
                    'Duplicate order request ignored. Returning existing order.'
                )
            );
        }
    }

    // 1. Validate items and calculate subtotal
    let subtotal = 0;
    const enrichedItems = [];
    const vendorMap = {};

    for (const item of items) {
        const product = await Product.findById(item.productId)
            .populate('vendorId', 'commissionRate storeName shippingEnabled defaultShippingRate freeShippingThreshold')
            .populate('shopId', 'name logo')
            .populate('categoryId', 'name gstRate');
        if (!product) throw new ApiError(404, `Product not found: ${item.productId}`);
        if (product.stock === 'out_of_stock') throw new ApiError(400, `${product.name} is out of stock.`);
        if (product.stockQuantity < item.quantity) throw new ApiError(400, `Only ${product.stockQuantity} units of ${product.name} available.`);

        // Always trust server-side product pricing; never trust client-sent item.price.
        let { price: itemPrice, variantKey, hasVariantAxes } = resolveVariantSelection(product, item.variant);

        // Apply B2B Pricing if applicable
        const isB2BUser = req.user?.role === 'b2bAdmin' || req.user?.role === 'b2bEmployee';
        if (isB2BUser && product.b2bEnabled) {
            let b2bPrice = product.b2bWholesalePrice || itemPrice;
            if (product.b2bBulkPricingSlabs && product.b2bBulkPricingSlabs.length > 0) {
                const slab = product.b2bBulkPricingSlabs.find(
                    s => item.quantity >= s.minQty && (!s.maxQty || item.quantity <= s.maxQty)
                );
                if (slab && slab.pricePerUnit) {
                    b2bPrice = slab.pricePerUnit;
                }
            }
            itemPrice = b2bPrice;
        }
        const variantStockValue = variantKey ? Number(product?.variants?.stockMap?.get?.(variantKey) ?? product?.variants?.stockMap?.[variantKey]) : null;
        if (hasVariantAxes && variantKey && Number.isFinite(variantStockValue) && variantStockValue < item.quantity) {
            throw new ApiError(400, `Only ${variantStockValue} units available for selected variant of ${product.name}.`);
        }
        const itemSubtotal = itemPrice * item.quantity;
        subtotal += itemSubtotal;

        // Resolve seller-controlled GST for this product/category
        const itemGstRate = resolveProductGST(product, product.categoryId);
        const { taxableAmount, gstAmount } = calculateItemGST(itemPrice, item.quantity, itemGstRate, 0, product.taxIncluded);

        const variantImage =
            variantKey
                ? String((product?.variants?.imageMap?.get?.(variantKey) ?? product?.variants?.imageMap?.[variantKey]) || '').trim()
                : '';

        const isManagedShop = !!product.shopId;
        const vendorIdObj = isManagedShop ? product.shopId._id : product.vendorId?._id;
        const vendorNameStr = isManagedShop ? (product.shopId.name || "Managed Shop") : (product.vendorId?.storeName || "Unknown Vendor");
        const commissionRateNum = isManagedShop ? 0 : (product.vendorId?.commissionRate || 10);
        const shippingEnabledVal = isManagedShop ? true : (product.vendorId?.shippingEnabled !== false);
        const defaultShippingRateVal = isManagedShop ? 0 : (product.vendorId?.defaultShippingRate || 0);
        const freeShippingThresholdVal = isManagedShop ? 0 : (product.vendorId?.freeShippingThreshold || 0);

        if (!vendorIdObj) {
            throw new ApiError(400, `Vendor or Shop mapping missing for product: ${product.name}`);
        }

        const hasVariantStock = variantKey && Number.isFinite(variantStockValue);

        const enriched = {
            productId: product._id,
            vendorId: vendorIdObj,
            name: product.name,
            image: variantImage || product.image,
            price: itemPrice,
            quantity: item.quantity,
            variant: item.variant,
            variantKey: variantKey || undefined,
            hasVariantStock: hasVariantStock || undefined,
            gstMode: product.gstMode || 'category',
            gstRate: itemGstRate,
            gstAmount,
            taxableAmount,
            taxIncluded: !!product.taxIncluded,
        };
        enrichedItems.push(enriched);

        // Group by vendor
        const vid = vendorIdObj.toString();
        if (!vendorMap[vid]) {
            vendorMap[vid] = {
                vendorId: vendorIdObj,
                vendorName: vendorNameStr,
                commissionRate: commissionRateNum,
                shippingEnabled: shippingEnabledVal,
                defaultShippingRate: defaultShippingRateVal,
                freeShippingThreshold: freeShippingThresholdVal,
                items: [],
                subtotal: 0,
                tax: 0,
            };
        }
        vendorMap[vid].items.push(enriched);
        vendorMap[vid].subtotal += itemSubtotal;
        vendorMap[vid].tax = parseFloat(((vendorMap[vid].tax || 0) + gstAmount).toFixed(2));
    }

    // 2. Validate coupon
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
        if (!coupon) throw new ApiError(400, 'Invalid coupon code.');
        if (coupon.startsAt && coupon.startsAt > Date.now()) throw new ApiError(400, 'Coupon is not active yet.');
        if (coupon.expiresAt && coupon.expiresAt < Date.now()) throw new ApiError(400, 'Coupon has expired.');
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new ApiError(400, 'Coupon usage limit reached.');
        if (subtotal < coupon.minOrderValue) throw new ApiError(400, `Minimum order value for this coupon is Rs.${coupon.minOrderValue}.`);

        if (coupon.type === 'percentage') {
            couponDiscount = (subtotal * coupon.value) / 100;
            if (coupon.maxDiscount) couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
        } else if (coupon.type === 'fixed') {
            couponDiscount = coupon.value;
        }
        appliedCoupon = coupon;
    }

    // 3. Calculate shipping
    const vendorShippingInput = Object.values(vendorMap).map((vendorGroup) => ({
        vendorId: vendorGroup.vendorId,
        subtotal: vendorGroup.subtotal,
        shippingEnabled: vendorGroup.shippingEnabled,
        defaultShippingRate: vendorGroup.defaultShippingRate,
        freeShippingThreshold: vendorGroup.freeShippingThreshold,
    }));
    const { totalShipping: shipping, shippingByVendor } = await calculateVendorShippingForGroups({
        vendorGroups: vendorShippingInput,
        shippingAddress,
        shippingOption,
        couponType: appliedCoupon?.type || null,
    });

    // 4. Calculate loyalty discount (server-side validation)
    let loyaltyDiscount = 0;
    const isB2C = req.user?.role === 'customer';
    const isB2B = req.user?.role === 'b2bAdmin' || req.user?.role === 'b2bEmployee';
    const isEligibleForLoyalty = isB2C || isB2B;
    
    // Import dynamically or at top of file
    const loyaltyService = await import('../../../services/loyalty.service.js');
    
    if (isEligibleForLoyalty && loyaltyPointsToRedeem > 0) {
        const config = await loyaltyService.getLoyaltyConfig();
        const enabled = isB2B ? config.b2bEnabled : config.enabled;
        const minRedeemPoints = isB2B ? (config.b2bMinRedeemPoints ?? 50) : (config.minRedeemPoints ?? 50);
        const redemptionRatio = isB2B ? (1 / (config.b2bPointsToRupeeRatio ?? 5)) : (config.redemptionRatio ?? 0.2);
        const maxRedemptionPercent = isB2B ? (config.b2bMaxRedemptionPercent ?? 50) : (config.maxRedemptionPercent ?? 50);

        if (enabled && loyaltyPointsToRedeem >= minRedeemPoints) {
            const potentialDiscount = parseFloat((loyaltyPointsToRedeem * redemptionRatio).toFixed(2));
            const maxDiscount = ((subtotal - couponDiscount) * maxRedemptionPercent) / 100;
            loyaltyDiscount = Math.min(potentialDiscount, maxDiscount);
        }
    }

    // 4. Calculate tax aggregated from itemized GST snapshots
    const totalGstFromItems = enrichedItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const tax = parseFloat(totalGstFromItems.toFixed(2));
    const total = parseFloat(Math.max(0, subtotal - couponDiscount - loyaltyDiscount + shipping + tax).toFixed(2));

    // 5. Build vendor item groups
    const vendorItems = Object.values(vendorMap).map((v) => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        items: v.items,
        subtotal: v.subtotal,
        shipping: Number(shippingByVendor[String(v.vendorId)] || 0),
        tax: parseFloat((v.tax || 0).toFixed(2)),
        discount: 0,
        status: 'pending',
    }));

    // 6-9. Transactional order creation to avoid partial writes.
    let order = null;
    let idempotentReplay = false;
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            if (idempotencyKey) {
                const existingOrder = await Order.findOne({ idempotencyScope, idempotencyKey })
                    .select('orderId total trackingNumber')
                    .session(session);
                if (existingOrder) {
                    order = existingOrder;
                    idempotentReplay = true;
                    return;
                }
            }

            // Wallet Payment Validation & Deduction
            const isB2B = req.user?.role === 'b2bAdmin' || req.user?.role === 'b2bEmployee';
            let walletTxId = null;
            let walletUsed = 0;

            if (normalizedPaymentMethod === 'wallet' || walletAmountToUse > 0) {
                if (!isB2B) {
                    throw new ApiError(400, 'Wallet payment system is no longer available for B2C.');
                }
                
                const reqWalletAmount = normalizedPaymentMethod === 'wallet' ? total : Number(walletAmountToUse);
                if (reqWalletAmount > total) {
                    throw new ApiError(400, 'Wallet amount used cannot exceed order total.');
                }

                if (req.user.role === 'b2bEmployee') {
                    const employeeUser = await User.findById(req.user.id).session(session);
                    if (!employeeUser) {
                        throw new ApiError(404, 'Employee user not found.');
                    }
                    if (employeeUser.b2bWalletBalance < reqWalletAmount) {
                        throw new ApiError(400, `Insufficient employee wallet balance. Available: ₹${employeeUser.b2bWalletBalance}`);
                    }
                    if (employeeUser.b2bSpendingLimit && employeeUser.b2bSpendingLimit < reqWalletAmount) {
                        throw new ApiError(400, `Payment exceeds employee spending limit of ₹${employeeUser.b2bSpendingLimit}`);
                    }

                    // Deduct from employee user model
                    employeeUser.b2bWalletBalance = parseFloat((employeeUser.b2bWalletBalance - reqWalletAmount).toFixed(2));
                    await employeeUser.save({ session });

                    // Update their Wallet document and record transaction log
                    const employeeWallet = await walletService.getOrCreateWallet(req.user.id, session);
                    employeeWallet.balance = employeeUser.b2bWalletBalance;
                    employeeWallet.totalDebit = parseFloat((employeeWallet.totalDebit + reqWalletAmount).toFixed(2));
                    await employeeWallet.save({ session });

                    const [tx] = await WalletTransaction.create([{
                        walletId: employeeWallet._id,
                        userId: req.user.id,
                        amount: reqWalletAmount,
                        type: 'debit',
                        transactionCategory: 'order_payment',
                        balanceAfterTransaction: employeeWallet.balance,
                        description: `Payment for order`,
                        status: 'completed'
                    }], { session });

                    walletTxId = tx._id;
                    walletUsed = reqWalletAmount;

                } else {
                    const adminWallet = await walletService.getOrCreateWallet(req.user.id, session);
                    if (adminWallet.isFrozen) {
                        throw new ApiError(400, 'B2B Admin wallet is frozen. Cannot place order.');
                    }
                    if (adminWallet.balance < reqWalletAmount) {
                        throw new ApiError(400, `Insufficient wallet balance. Available: ₹${adminWallet.balance}`);
                    }

                    const { transaction } = await walletService.debitWallet({
                        userId: req.user.id,
                        amount: reqWalletAmount,
                        category: 'order_payment',
                        description: `Payment for order`,
                        session
                    });

                    walletTxId = transaction._id;
                    walletUsed = reqWalletAmount;
                }
            }

            // Loyalty Point Redemption deduction
            let actualPointsRedeemed = 0;
            if (isEligibleForLoyalty && loyaltyDiscount > 0) {
                // Determine exact points matching this discount
                const config = await loyaltyService.getLoyaltyConfig();
                const redemptionRatio = isB2B ? (1 / (config.b2bPointsToRupeeRatio ?? 5)) : (config.redemptionRatio ?? 0.2);
                actualPointsRedeemed = Math.round(loyaltyDiscount / redemptionRatio);
                if (actualPointsRedeemed > 0) {
                    await loyaltyService.redeemPoints(userId, null, actualPointsRedeemed, session);
                }
            }

            // Award new points
            let pointsToEarn = 0;
            if (isEligibleForLoyalty) {
                pointsToEarn = await loyaltyService.calculateEarnablePoints(subtotal - couponDiscount - loyaltyDiscount, req.user?.role);
            }            let razorpayOrderId = undefined;
            let finalPaymentMethod = normalizedPaymentMethod;
            const remainingToPay = parseFloat((total - walletUsed).toFixed(2));
            
            if (finalPaymentMethod === 'mixed' && remainingToPay <= 0) {
                finalPaymentMethod = 'wallet';
            }

            if (finalPaymentMethod === 'card' || finalPaymentMethod === 'online' || finalPaymentMethod === 'razorpay' || (finalPaymentMethod === 'mixed' && remainingToPay > 0)) {
                const amountToPayRzp = finalPaymentMethod === 'mixed' ? remainingToPay : total;
                try {
                    const razorpayInstance = new Razorpay({
                        key_id: process.env.RAZORPAY_KEY_ID,
                        key_secret: process.env.RAZORPAY_KEY_SECRET,
                    });
                    const rzpOrder = await razorpayInstance.orders.create({
                        amount: Math.round(amountToPayRzp * 100), // in paise
                        currency: 'INR',
                        receipt: `rcpt_${Date.now()}`
                    });
                    razorpayOrderId = rzpOrder.id;
                } catch (err) {
                    console.error('Razorpay Order Creation Error:', err);
                    throw new ApiError(500, 'Failed to create payment gateway order: ' + err.message);
                }
            }

            let initialPaymentStatus = 'pending';
            if (finalPaymentMethod === 'wallet') {
                initialPaymentStatus = 'paid';
            }

            const [createdOrder] = await Order.create([{
                orderId: generateOrderId(),
                userId,
                items: enrichedItems,
                vendorItems,
                shippingAddress,
                paymentMethod: finalPaymentMethod,
                paymentStatus: initialPaymentStatus,
                paymentDetails: razorpayOrderId ? {
                    razorpayOrderId,
                    amount: finalPaymentMethod === 'mixed' ? remainingToPay : total,
                    status: 'created',
                    gatewayName: 'Razorpay',
                    paymentMethod: 'card'
                } : undefined,
                subtotal,
                shipping,
                tax,
                discount: couponDiscount + loyaltyDiscount,
                total,
                couponCode: couponCode?.toUpperCase(),
                couponDiscount,
                loyaltyPointsEarned: pointsToEarn,
                loyaltyPointsRedeemed: actualPointsRedeemed,
                loyaltyDiscount: loyaltyDiscount,
                walletAmountUsed: walletUsed,
                walletTransactionId: walletTxId || undefined,
                trackingNumber: generateTrackingNumber(),
                estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // +5 days
                orderType: (isB2B || !!req.user?.companyId) ? 'b2b' : 'b2c',
                idempotencyKey: idempotencyKey || undefined,
                idempotencyScope: idempotencyKey ? idempotencyScope : undefined,
            }], { session });
            order = createdOrder;
            // Associate order with transaction log if any points were redeemed
            if (actualPointsRedeemed > 0) {
                await LoyaltyTransaction.updateOne(
                    { userId, type: 'redeem', orderId: null },
                    { $set: { orderId: order._id } },
                    { session }
                );
            }

            // Defer earn points transaction until status transitions to delivered.
            // Saved pre-calculated points to order.loyaltyPointsEarned.

            // 7. Deduct stock atomically to prevent oversell under concurrent checkout.
            for (const item of enrichedItems) {
                const useVariantStock = item.variantKey && item.hasVariantStock;
                const variantPath = useVariantStock ? `variants.stockMap.${item.variantKey}` : null;
                const baseFilter = {
                    _id: item.productId,
                    stock: { $ne: 'out_of_stock' },
                    stockQuantity: { $gte: Number(item.quantity || 0) },
                };
                if (variantPath) {
                    baseFilter[variantPath] = { $gte: Number(item.quantity || 0) };
                }

                const updatePayload = { $inc: { stockQuantity: -Number(item.quantity || 0) } };
                if (variantPath) {
                    updatePayload.$inc[variantPath] = -Number(item.quantity || 0);
                }

                const updatedProduct = await Product.findOneAndUpdate(
                    baseFilter,
                    updatePayload,
                    { new: true, session }
                );

                if (!updatedProduct) {
                    throw new ApiError(409, `Insufficient stock while processing ${item.name}. Please refresh and try again.`);
                }

                const nextStockState =
                    updatedProduct.stockQuantity <= 0
                        ? 'out_of_stock'
                        : (updatedProduct.stockQuantity <= updatedProduct.lowStockThreshold ? 'low_stock' : 'in_stock');

                await Product.updateOne(
                    { _id: updatedProduct._id },
                    { $set: { stock: nextStockState } },
                    { session }
                );
            }

            // 8. Record commissions
            const commissionDocs = Object.values(vendorMap).map((v) => ({
                orderId: order._id,
                vendorId: v.vendorId,
                vendorName: v.vendorName,
                subtotal: v.subtotal,
                commissionRate: v.commissionRate,
                commission: parseFloat(((v.subtotal * v.commissionRate) / 100).toFixed(2)),
                vendorEarnings: parseFloat((v.subtotal - (v.subtotal * v.commissionRate) / 100).toFixed(2)),
            }));
            await Commission.insertMany(commissionDocs, { session });

            // 9. Increment coupon usage
            if (appliedCoupon) {
                if (appliedCoupon.usageLimit) {
                    const usageResult = await Coupon.updateOne(
                        {
                            _id: appliedCoupon._id,
                            usedCount: { $lt: appliedCoupon.usageLimit },
                        },
                        { $inc: { usedCount: 1 } },
                        { session }
                    );
                    if (!usageResult?.modifiedCount) {
                        throw new ApiError(409, 'Coupon usage limit reached.');
                    }
                } else {
                    await Coupon.updateOne(
                        { _id: appliedCoupon._id },
                        { $inc: { usedCount: 1 } },
                        { session }
                    );
                }
            }
        });
    } catch (err) {
        if (idempotencyKey && err?.code === 11000) {
            const existingOrder = await Order.findOne({ idempotencyScope, idempotencyKey })
                .select('orderId total trackingNumber')
                .lean();
            if (existingOrder) {
                order = existingOrder;
                idempotentReplay = true;
            } else {
                throw err;
            }
        } else {
            throw err;
        }
    } finally {
        await session.endSession();
    }

    const responseStatus = idempotentReplay ? 200 : 201;
    const responseMessage = idempotentReplay
        ? 'Duplicate order request ignored. Returning existing order.'
        : 'Order placed successfully.';
    if (!idempotentReplay && order && (order.paymentStatus === 'paid' || order.paymentMethod === 'cod')) {
        // Trigger real-time notifications to vendors
        (async () => {
            try {
                let io;
                try {
                    io = getIO();
                } catch (err) {
                    console.warn("Socket.io is not initialized yet:", err.message);
                }

                if (order.vendorItems && order.vendorItems.length > 0) {
                    for (const v of order.vendorItems) {
                        // Create Database notification
                        await createNotification({
                            recipientId: v.vendorId,
                            recipientType: 'vendor',
                            title: 'New Order Received',
                            message: `You have received a new order ${order.orderId} for Rs.${v.subtotal}`,
                            type: 'order',
                            data: {
                                orderId: String(order.orderId || order._id),
                                dbOrderId: String(order._id),
                                vendorId: String(v.vendorId),
                                subtotal: String(v.subtotal)
                            }
                        }).catch(e => console.error("Error creating database notification for vendor:", e));

                        // Emit socket event to the vendor's room
                        if (io) {
                            io.to(`user_${v.vendorId}`).emit('new_order_placed', {
                                orderId: order.orderId,
                                dbOrderId: order._id,
                                total: v.subtotal,
                                items: v.items,
                                customerName: order.shippingAddress?.name || 'Guest',
                                shippingAddress: order.shippingAddress,
                                createdAt: order.createdAt
                            });
                        }
                    }
                }

                // Send push notification to buyer
                if (order.userId) {
                    await sendNotificationToUser(order.userId, {
                        title: 'Order Confirmed! 🎉',
                        body: `Your order ${order.orderId} of Rs.${order.total} has been successfully placed.`,
                        data: {
                            type: 'order',
                            orderId: String(order.orderId || order._id),
                            link: `/orders/${order.orderId}`
                        }
                    });
                }
            } catch (err) {
                console.error("Error in sending order notifications to vendors:", err);
            }

            // Trigger Order Confirmed status lifecycle, record initial history, and send confirmation email
            try {
                await handleOrderStatusTransition(order, 'pending', {
                    updatedBy: order.userId,
                    updatedByRole: 'user',
                    note: 'Order placed successfully by customer',
                    notifyCustomer: true,
                });
            } catch (statusErr) {
                console.error("Order status transition error on placeOrder:", statusErr?.message);
            }

            // Generate invoice and send customer invoice email idempotently in background
            try {
                const inv = await generateInvoiceForOrder(order._id);
                if (inv) {
                    await sendOrderInvoiceEmail(order._id, { invoice: inv });
                }
            } catch (invErr) {
                console.error("Automatic invoice / email generation error on placeOrder:", invErr?.message);
            }
        })();
    }

    res.status(responseStatus).json(
        new ApiResponse(
            responseStatus,
            {
                orderId: order.orderId,
                total: order.total,
                trackingNumber: order.trackingNumber,
                ...(idempotentReplay ? { idempotentReplay: true } : {}),
                razorpayOrder: order.paymentDetails?.razorpayOrderId ? {
                    id: order.paymentDetails.razorpayOrderId,
                    amount: Math.round(order.total * 100),
                    currency: 'INR',
                    key: process.env.RAZORPAY_KEY_ID
                } : null
            },
            responseMessage
        )
    );
});

// GET /api/user/orders
export const getUserOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
    const total = await Order.countDocuments({ userId: req.user.id });
    res.status(200).json(new ApiResponse(200, { orders, total, page: Number(page), pages: Math.ceil(total / limit) }, 'Orders fetched.'));
});

// GET /api/user/orders/:id
export const getOrderDetail = asyncHandler(async (req, res) => {
    const order = await Order.findOne({
        $or: [
            { orderId: req.params.id },
            { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }
        ],
        userId: req.user.id,
        isDeleted: { $ne: true }
    });
    if (!order) throw new ApiError(404, 'Order not found.');
    res.status(200).json(new ApiResponse(200, order, 'Order detail fetched.'));
});

// PATCH /api/user/orders/:id/cancel
export const cancelOrder = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const order = await Order.findOne({ orderId: req.params.id, userId: req.user.id }).session(session);
            if (!order) throw new ApiError(404, 'Order not found.');
            if (!['pending', 'processing'].includes(order.status)) throw new ApiError(400, 'Order cannot be cancelled at this stage.');

            order.status = 'cancelled';
            order.cancelledAt = new Date();
            order.cancellationReason = req.body.reason || 'Cancelled by customer';
            if (Array.isArray(order.vendorItems)) {
                order.vendorItems = order.vendorItems.map((vendorGroup) => ({
                    ...vendorGroup.toObject(),
                    status: 'cancelled',
                }));
            }
            await order.save({ session });

            // Restore stock and status
            for (const item of order.items) {
                const quantity = Number(item.quantity || 0);
                if (quantity <= 0) continue;

                const productSnapshot = await Product.findById(item.productId)
                    .select('variants.stockMap variants.prices')
                    .session(session)
                    .lean();
                const variantKey = resolveOrderItemVariantKey(productSnapshot, item);

                const incUpdate = { stockQuantity: quantity };
                if (variantKey) {
                    incUpdate[`variants.stockMap.${variantKey}`] = quantity;
                }

                const product = await Product.findByIdAndUpdate(item.productId, { $inc: incUpdate }, { new: true, session });
                if (!product) continue;

                const nextStockState =
                    product.stockQuantity <= 0
                        ? 'out_of_stock'
                        : (product.stockQuantity <= product.lowStockThreshold ? 'low_stock' : 'in_stock');

                await Product.updateOne(
                    { _id: product._id },
                    { $set: { stock: nextStockState } },
                    { session }
                );
            }

            // Reverse vendor earnings visibility for this order.
            await Commission.updateMany(
                {
                    orderId: order._id,
                    status: { $ne: 'cancelled' },
                },
                {
                    $set: {
                        status: 'cancelled',
                        paidAt: null,
                        settlementId: null,
                    },
                },
                { session }
            );

            // Revert loyalty points transactions for both B2C and B2B
            const isB2C = req.user?.role === 'customer';
            const isB2B = req.user?.role === 'b2bAdmin' || req.user?.role === 'b2bEmployee';
            if (isB2C || isB2B) {
                const loyaltyService = await import('../../../services/loyalty.service.js');
                if (order.loyaltyPointsEarned > 0) {
                    await loyaltyService.reverseEarnedPoints(req.user.id, order._id, session);
                }
                if (order.loyaltyPointsRedeemed > 0) {
                    await loyaltyService.restoreRedeemedPoints(req.user.id, order._id, session);
                }
            }
        });
    } finally {
        await session.endSession();
    }

    // Trigger order status transition and customer email for cancellation
    try {
        const cancelledOrder = await Order.findOne({
            $or: [
                { orderId: req.params.id },
                { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }
            ],
            userId: req.user.id
        });
        if (cancelledOrder) {
            await handleOrderStatusTransition(cancelledOrder, 'cancelled', {
                updatedBy: req.user.id,
                updatedByRole: 'user',
                note: req.body.reason || 'Cancelled by customer',
                notifyCustomer: true,
            });
        }
    } catch (cancelNotifErr) {
        console.error("Cancel order status transition error:", cancelNotifErr?.message);
    }

    res.status(200).json(new ApiResponse(200, null, 'Order cancelled successfully.'));
});

const enrichReturnItems = (request) => {
    const orderItems = Array.isArray(request?.orderId?.items) ? request.orderId.items : [];
    const returnItems = Array.isArray(request?.items) ? request.items : [];

    return returnItems.map((item) => {
        const productId = String(item?.productId || '');
        const matchedOrderItem = orderItems.find(
            (orderItem) => String(orderItem?.productId || '') === productId
        );

        return {
            ...item,
            name: item?.name || matchedOrderItem?.name || 'Unknown Product',
            price: Number(item?.price ?? matchedOrderItem?.price ?? 0),
            image: item?.image || matchedOrderItem?.image || '',
        };
    });
};

const normalizeReturnRequest = (requestDoc) => {
    const request = typeof requestDoc?.toObject === 'function' ? requestDoc.toObject() : requestDoc;
    const orderOrderId = request?.orderId?.orderId || '';
    const orderRefId = request?.orderId?._id || request?.orderId || null;
    return {
        ...request,
        id: String(request?._id || ''),
        orderId: orderOrderId || String(orderRefId || ''),
        orderRefId: orderRefId ? String(orderRefId) : null,
        requestDate: request?.createdAt,
        items: enrichReturnItems(request),
    };
};

// POST /api/user/orders/:id/returns
export const createReturnRequest = asyncHandler(async (req, res) => {
    const order = await Order.findOne({ orderId: req.params.id, userId: req.user.id });
    if (!order) throw new ApiError(404, 'Order not found.');
    if (order.status !== 'delivered') {
        throw new ApiError(400, 'Return can only be requested for delivered orders.');
    }

    const requestedVendorId = String(req.body.vendorId || '').trim();
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const orderVendorIds = [...new Set(orderItems.map((item) => String(item?.vendorId || '')).filter(Boolean))];

    let vendorId = requestedVendorId;
    if (!vendorId) {
        if (orderVendorIds.length > 1) {
            throw new ApiError(400, 'vendorId is required for multi-vendor orders.');
        }
        vendorId = orderVendorIds[0] || '';
    }
    if (!vendorId) {
        throw new ApiError(400, 'Unable to resolve vendor for return request.');
    }

    const vendorScopedItems = orderItems.filter((item) => String(item?.vendorId || '') === vendorId);
    if (vendorScopedItems.length === 0) {
        throw new ApiError(400, 'Selected vendor has no items in this order.');
    }

    const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
    let normalizedItems = [];

    if (requestedItems.length > 0) {
        normalizedItems = requestedItems.map((inputItem) => {
            const productId = String(inputItem?.productId || '');
            const orderItem = vendorScopedItems.find((it) => String(it?.productId || '') === productId);
            if (!orderItem) {
                throw new ApiError(400, `Product ${productId} is not valid for this return request.`);
            }

            const requestedQty = Number(inputItem?.quantity || 0);
            const maxQty = Number(orderItem?.quantity || 0);
            if (!Number.isFinite(requestedQty) || requestedQty <= 0 || requestedQty > maxQty) {
                throw new ApiError(400, `Invalid quantity for product ${orderItem.name || productId}.`);
            }

            return {
                productId: orderItem.productId,
                name: orderItem.name,
                price: orderItem.price,
                image: orderItem.image,
                quantity: requestedQty,
                reason: String(inputItem?.reason || req.body.reason || '').trim(),
            };
        });
    } else {
        normalizedItems = vendorScopedItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            image: item.image,
            quantity: Number(item.quantity || 1),
            reason: String(req.body.reason || '').trim(),
        }));
    }

    const existingOpen = await ReturnRequest.findOne({
        orderId: order._id,
        userId: req.user.id,
        vendorId,
        status: { $in: ['pending', 'approved', 'processing'] },
    });
    if (existingOpen) {
        throw new ApiError(409, 'An active return request already exists for this vendor in the selected order.');
    }

    const refundAmount = normalizedItems.reduce((sum, item) => {
        const orderItem = vendorScopedItems.find((it) => String(it?.productId || '') === String(item.productId || ''));
        const unitPrice = Number(orderItem?.price || 0);
        return sum + unitPrice * Number(item.quantity || 0);
    }, 0);

    const request = await ReturnRequest.create({
        orderId: order._id,
        userId: req.user.id,
        vendorId,
        items: normalizedItems,
        reason: String(req.body.reason || '').trim(),
        status: 'pending',
        refundAmount: Number(refundAmount.toFixed(2)),
        refundStatus: 'pending',
        refundDestination: req.body.refundDestination || 'Original Payment Method',
        images: Array.isArray(req.body.images) ? req.body.images : [],
    });

    const admins = await Admin.find({ isActive: true }).select('_id').lean();
    await Promise.all(
        admins.map((admin) =>
            createNotification({
                recipientId: admin._id,
                recipientType: 'admin',
                title: 'New Return Request',
                message: `Order ${order.orderId} has a new return request awaiting review.`,
                type: 'order',
                data: {
                    returnRequestId: String(request._id),
                    orderId: String(order.orderId),
                    vendorId: String(vendorId),
                },
            })
        )
    );

    await createNotification({
        recipientId: vendorId,
        recipientType: 'vendor',
        title: 'New Return Request',
        message: `Order ${order.orderId} has a return request from customer.`,
        type: 'order',
        data: {
            returnRequestId: String(request._id),
            orderId: String(order.orderId),
        },
    });

    const populated = await ReturnRequest.findById(request._id)
        .populate('orderId', 'orderId total items createdAt')
        .populate('vendorId', 'storeName email');

    res.status(201).json(new ApiResponse(201, normalizeReturnRequest(populated), 'Return request submitted successfully.'));
});

// GET /api/user/returns
export const getUserReturnRequests = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const numericPage = Math.max(1, Number(page) || 1);
    const numericLimit = Math.max(1, Number(limit) || 20);
    const filter = { userId: req.user.id };
    if (status && status !== 'all') filter.status = status;

    const [requests, total] = await Promise.all([
        ReturnRequest.find(filter)
            .populate('orderId', 'orderId total items createdAt')
            .populate('vendorId', 'storeName email')
            .sort({ createdAt: -1 })
            .skip((numericPage - 1) * numericLimit)
            .limit(numericLimit),
        ReturnRequest.countDocuments(filter),
    ]);

    res.status(200).json(new ApiResponse(200, {
        returnRequests: requests.map(normalizeReturnRequest),
        pagination: {
            total,
            page: numericPage,
            limit: numericLimit,
            pages: Math.ceil(total / numericLimit),
        },
    }, 'Return requests fetched.'));
});

// GET /api/user/returns/:id
export const getUserReturnRequestById = asyncHandler(async (req, res) => {
    const request = await ReturnRequest.findOne({ _id: req.params.id, userId: req.user.id })
        .populate('orderId', 'orderId total items createdAt')
        .populate('vendorId', 'storeName email');
    if (!request) throw new ApiError(404, 'Return request not found.');
    res.status(200).json(new ApiResponse(200, normalizeReturnRequest(request), 'Return request fetched.'));
});
