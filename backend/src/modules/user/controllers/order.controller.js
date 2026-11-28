import { isB2BRole, resolveB2BUnitPrice } from '../../../utils/b2bPricing.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import { createRazorpayOrder } from '../../../services/razorpay.service.js';
import { assertWithinSpendingLimits } from '../../../services/b2bSpendingLimit.service.js';
import Order from '../../../models/Order.model.js';
import Product from '../../../models/Product.model.js';
import { isProductPubliclyApproved } from '../../../utils/productVisibility.js';
import Coupon from '../../../models/Coupon.model.js';
import ChatTransactionProposal from '../../../models/ChatTransactionProposal.model.js';
import VendorChatThread from '../../../models/VendorChatThread.model.js';
import VendorChatMessage from '../../../models/VendorChatMessage.model.js';
import Commission from '../../../models/Commission.model.js';
import ReturnRequest from '../../../models/ReturnRequest.model.js';
import Admin from '../../../models/Admin.model.js';
import PurchaseOrder from '../../../models/PurchaseOrder.model.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import Vendor from '../../../models/Vendor.model.js';
import { generateOrderId } from '../../../utils/generateOrderId.js';
import { generateTrackingNumber } from '../../../utils/generateTrackingNumber.js';
import mongoose from 'mongoose';
import {
    generateReturnId,
    getReturnedQuantities,
    enrichReturnItems,
    buildReturnIdentifiers,
    getInvoiceNumberMap,
    lineRefundParts,
} from '../../../utils/returnMapping.js';
import { User } from '../../../models/User.model.js';
import Wallet from '../../../models/Wallet.model.js';
import WalletTransaction from '../../../models/WalletTransaction.model.js';
import * as walletService from '../../../services/wallet.service.js';
import LoyaltyTransaction from '../../../models/LoyaltyTransaction.model.js';
import { createNotification } from '../../../services/notification.service.js';
import { calculateVendorShippingForGroups } from '../../../services/vendorShipping.service.js';
import { getIO } from '../../../config/socket.js';
import { sendNotificationToUser } from '../../../utils/pushNotificationHelper.js';
import {
    resolveProductGST,
    calculateItemGST,
    resolveSellerState,
    resolveBuyerState,
    determineSupplyType,
    applyGSTSplit,
    summarizeGST,
} from '../../../utils/gstUtils.js';
import { generateInvoiceForOrder, sendOrderInvoiceEmail } from '../../../services/invoice.service.js';
import { handleOrderStatusTransition } from '../../../services/orderStatus.service.js';
import { sendReturnRequestSubmittedNotification } from '../../../services/customerNotification.service.js';
import {
    sendVendorNewOrderNotification,
    sendVendorOrderCancelledNotification,
    sendVendorReturnNotification,
} from '../../../services/vendorNotification.service.js';
import {
    sendAdminOrderAlert,
    sendAdminFinanceAlert,
} from '../../../services/adminNotification.service.js';

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
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Checkout of a price negotiated in chat. The client only says WHICH accepted offer it is buying
 * (item.proposalId); price, quantity, discount, tax and delivery all come from the stored offer, so a
 * customer can never pick their own price and a vendor can never change it after acceptance.
 * Returns the offer, or null for a normal cart.
 */
const resolveProposalCheckout = async ({ items, userId, couponCode, loyaltyPointsToRedeem }) => {
    if (!items.some((i) => i.proposalId)) return null;
    if (items.length !== 1) {
        throw new ApiError(400, 'A negotiated offer must be checked out on its own, without other items.');
    }
    if (!userId) throw new ApiError(401, 'Please sign in to buy a negotiated offer.');
    if (couponCode || Number(loyaltyPointsToRedeem) > 0) {
        throw new ApiError(400, 'Coupons and loyalty points cannot be combined with a negotiated offer.');
    }
    const { proposalId, productId } = items[0];
    if (!mongoose.isValidObjectId(proposalId)) throw new ApiError(400, 'Invalid offer reference.');

    const proposal = await ChatTransactionProposal.findOne({ _id: proposalId, customerUserId: userId });
    if (!proposal) throw new ApiError(404, 'Offer not found.');
    if (proposal.status === 'converted_to_order') throw new ApiError(409, 'This offer has already been ordered.');
    if (proposal.status !== 'accepted') throw new ApiError(400, 'Only an accepted offer can be purchased.');
    if (!proposal.productId || String(proposal.productId) !== String(productId)) {
        throw new ApiError(400, 'This offer is not linked to this product. Please ask the seller to send it again with a product selected.');
    }
    return proposal;
};

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

    // 0. Price negotiated in chat? (null for a normal cart)
    const proposalCtx = await resolveProposalCheckout({ items, userId, couponCode, loyaltyPointsToRedeem });

    // 1. Validate items and calculate subtotal
    let subtotal = 0;
    const enrichedItems = [];
    const vendorMap = {};
    // Place of supply = delivery state; decides CGST+SGST vs IGST per seller.
    const buyerState = resolveBuyerState(shippingAddress);

    for (const item of items) {
        if (proposalCtx) item.quantity = proposalCtx.quantity; // quantity is part of the agreed offer
        const product = await Product.findById(item.productId)
            .populate('vendorId', 'commissionRate storeName shippingEnabled defaultShippingRate freeShippingThreshold categoryGstRates defaultGstRate gstNumber documents.gst b2bSellingGstNumber b2bSellingState state address businessAddress')
            .populate('shopId', 'name logo gst address warehouse')
            .populate('categoryId', 'name gstRate parentId');
        if (!product) throw new ApiError(404, `Product not found: ${item.productId}`);
        if (!isProductPubliclyApproved(product) || product.isActive === false) {
            throw new ApiError(400, `${product.name} is not available for purchase.`);
        }
        if (proposalCtx && String(product.vendorId?._id || product.vendorId || '') !== String(proposalCtx.vendorId)) {
            throw new ApiError(400, 'This offer was made by a different seller than the product owner.');
        }
        if (product.stock === 'out_of_stock') throw new ApiError(400, `${product.name} is out of stock.`);
        // Business buyers must respect the product's minimum order quantity (enforced server-side).
        if ((req.user?.role === 'b2bAdmin' || req.user?.role === 'b2bEmployee') && !proposalCtx) {
            const moq = Math.max(Number(product.b2bMinOrderQty) || 1, Number(product.minimumOrderQuantity) || 1);
            if (moq > 1 && Number(item.quantity) < moq) {
                throw new ApiError(400, `Minimum order quantity for ${product.name} is ${moq}.`);
            }
        }
        if (product.stockQuantity < item.quantity) throw new ApiError(400, `Only ${product.stockQuantity} units of ${product.name} available.`);

        // Always trust server-side product pricing; never trust client-sent item.price.
        let { price: itemPrice, variantKey, hasVariantAxes } = resolveVariantSelection(product, item.variant);

        // B2B pricing (wholesale price / bulk slab) — same rule as the storefront, see utils/b2bPricing.js
        if (isB2BRole(req.user?.role)) {
            itemPrice = resolveB2BUnitPrice(product, itemPrice, item.quantity);
        }
        // Negotiated offer: the agreed price per unit (after the agreed discount) replaces catalogue pricing.
        let proposalNetTotal = null;
        if (proposalCtx) {
            proposalNetTotal = round2(proposalCtx.unitPrice * proposalCtx.quantity - (proposalCtx.discount || 0));
            itemPrice = proposalNetTotal / proposalCtx.quantity;
        }
        const variantStockValue = variantKey ? Number(product?.variants?.stockMap?.get?.(variantKey) ?? product?.variants?.stockMap?.[variantKey]) : null;
        if (hasVariantAxes && variantKey && Number.isFinite(variantStockValue) && variantStockValue < item.quantity) {
            throw new ApiError(400, `Only ${variantStockValue} units available for selected variant of ${product.name}.`);
        }
        const itemSubtotal = itemPrice * item.quantity;
        subtotal += itemSubtotal;

        // Resolve seller-controlled GST for this product/category
        let itemGstRate = resolveProductGST(product, product.categoryId, product.vendorId);
        let { taxableAmount, gstAmount } = calculateItemGST(itemPrice, item.quantity, itemGstRate, 0, product.taxIncluded);
        if (proposalCtx) {
            // The offer's tax is part of the amount the customer agreed to pay (added on top of the agreed price).
            gstAmount = round2(proposalCtx.tax || 0);
            taxableAmount = proposalNetTotal;
            itemGstRate = proposalNetTotal > 0 ? round2((gstAmount / proposalNetTotal) * 100) : 0;
        }

        const variantImage =
            variantKey
                ? String((product?.variants?.imageMap?.get?.(variantKey) ?? product?.variants?.imageMap?.[variantKey]) || '').trim()
                : '';

        const isManagedShop = !!product.shopId;
        const isManagedListing = product.listingType === 'admin_managed_listing';
        const unitSupplyPrice = isManagedListing ? (product.negotiatedSupplyPrice || itemPrice) : itemPrice;
        const itemSupplySubtotal = unitSupplyPrice * item.quantity;
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
            taxIncluded: proposalCtx ? false : !!product.taxIncluded,
            ...(proposalCtx ? { proposalId: proposalCtx._id, proposalReference: proposalCtx.proposalReference } : {}),
        };
        const sellerState = resolveSellerState(isManagedShop ? product.shopId : product.vendorId);
        const supplyType = determineSupplyType(sellerState, buyerState);
        applyGSTSplit(enriched, supplyType);
        enrichedItems.push(enriched);

        // Group by vendor
        const vid = vendorIdObj.toString();
        if (!vendorMap[vid]) {
            vendorMap[vid] = {
                vendorId: vendorIdObj,
                vendorName: vendorNameStr,
                commissionRate: commissionRateNum,
                isManagedListing,
                shippingEnabled: shippingEnabledVal,
                defaultShippingRate: defaultShippingRateVal,
                freeShippingThreshold: freeShippingThresholdVal,
                items: [],
                subtotal: 0,
                supplySubtotal: 0,
                tax: 0,
                sellerState: sellerState?.name,
                sellerStateCode: sellerState?.code,
                supplyType,
            };
        }
        vendorMap[vid].items.push(enriched);
        vendorMap[vid].subtotal += itemSubtotal;
        vendorMap[vid].supplySubtotal += itemSupplySubtotal;
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
        couponDiscount = round2(Math.min(Math.max(0, couponDiscount), subtotal));
        appliedCoupon = coupon;
    }

    // 2b. GST is charged on the value after the coupon (Sec. 15(3) CGST Act: a discount shown
    // on the invoice reduces the taxable value). Spread the coupon over lines in proportion to
    // their value (last line takes the rounding remainder), then recompute each line's GST.
    if (couponDiscount > 0 && subtotal > 0) {
        let allocated = 0;
        enrichedItems.forEach((it, idx) => {
            const lineValue = it.price * it.quantity;
            const share = idx === enrichedItems.length - 1
                ? round2(couponDiscount - allocated)
                : round2((couponDiscount * lineValue) / subtotal);
            allocated = round2(allocated + share);
            const lineDiscount = Math.min(lineValue, Math.max(0, share));
            const { taxableAmount: t, gstAmount: g } = calculateItemGST(it.price, it.quantity, it.gstRate, lineDiscount, it.taxIncluded);
            it.discount = lineDiscount;
            it.taxableAmount = t;
            it.gstAmount = g;
            applyGSTSplit(it, it.supplyType);
        });
        Object.values(vendorMap).forEach((v) => {
            v.tax = round2(v.items.reduce((s, it) => s + (it.gstAmount || 0), 0));
            v.discount = round2(v.items.reduce((s, it) => s + (it.discount || 0), 0));
        });
    }

    // 3. Calculate shipping
    const vendorShippingInput = Object.values(vendorMap).map((vendorGroup) => ({
        vendorId: vendorGroup.vendorId,
        subtotal: vendorGroup.subtotal,
        shippingEnabled: vendorGroup.shippingEnabled,
        defaultShippingRate: vendorGroup.defaultShippingRate,
        freeShippingThreshold: vendorGroup.freeShippingThreshold,
        items: vendorGroup.items,
    }));
    let {
        totalShipping: shipping,
        shippingByVendor,
        isCodAvailable,
        isServiceable
    } = await calculateVendorShippingForGroups({
        vendorGroups: vendorShippingInput,
        shippingAddress,
        shippingOption,
        paymentMethod: normalizedPaymentMethod,
        couponType: appliedCoupon?.type || null,
    });

    if (proposalCtx) {
        // Delivery charge is part of the agreed final amount.
        shipping = round2(proposalCtx.deliveryCharge || 0);
        shippingByVendor = { [String(proposalCtx.vendorId)]: shipping };
    }

    // The courier said nobody delivers to this pincode: don't take an order that cannot be shipped.
    // (Only an explicit "not serviceable" answer blocks; if the courier service is down we still accept.)
    if (isServiceable === false) {
        throw new ApiError(
            400,
            `Sorry, we cannot deliver to pincode ${shippingAddress?.zipCode || ''} right now. Please use a different delivery address.`
        );
    }

    const isCodOrder = ['cod', 'cash'].includes(String(normalizedPaymentMethod).toLowerCase());
    if (isCodOrder && isCodAvailable === false) {
        throw new ApiError(
            400,
            `Cash on Delivery is not available for delivery pincode ${shippingAddress?.zipCode || ''}. Please select an Online Payment method.`
        );
    }

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
    // GST of tax-inclusive items is already inside their price: only GST charged on top is added.
    const taxChargedOnTop = parseFloat(
        enrichedItems.reduce((sum, item) => sum + (item.taxIncluded ? 0 : (item.gstAmount || 0)), 0).toFixed(2)
    );
    const total = parseFloat(Math.max(0, subtotal - couponDiscount - loyaltyDiscount + shipping + taxChargedOnTop).toFixed(2));

    // 5. Build vendor item groups
    const vendorItems = Object.values(vendorMap).map((v) => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        items: v.items,
        subtotal: v.subtotal,
        shipping: Number(shippingByVendor[String(v.vendorId)] || 0),
        tax: parseFloat((v.tax || 0).toFixed(2)),
        discount: v.discount || 0,
        status: 'pending',
        sellerState: v.sellerState,
        sellerStateCode: v.sellerStateCode,
        supplyType: v.supplyType,
        ...(({ cgst, sgst, igst }) => ({ cgst, sgst, igst }))(summarizeGST(v.items)),
    }));
    const taxBreakdown = summarizeGST(enrichedItems);

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

            // Claim the negotiated offer atomically: one offer can only ever become one order.
            if (proposalCtx) {
                const claimed = await ChatTransactionProposal.findOneAndUpdate(
                    { _id: proposalCtx._id, customerUserId: userId, status: 'accepted' },
                    {
                        $set: { status: 'converted_to_order' },
                        $push: { history: { action: 'CONVERTED_TO_ORDER', actionBy: userId, actionByRole: 'customer', timestamp: new Date(), note: 'Customer placed an order from this offer.' } },
                    },
                    { session, new: true }
                );
                if (!claimed) throw new ApiError(409, 'This offer has already been ordered or is no longer valid.');
                if (round2(total) !== round2(claimed.finalAmount)) {
                    throw new ApiError(409, 'The order total does not match the agreed offer amount.');
                }
            }

            // B2B employee per-order / monthly spending limits (any payment method)
            await assertWithinSpendingLimits({ userId, role: req.user?.role, amount: total, session });

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
            if (walletUsed > 0) {
                if (remainingToPay <= 0) {
                    finalPaymentMethod = 'wallet';
                } else if (finalPaymentMethod === 'cod') {
                    // Nothing records how much cash would still be due on delivery.
                    throw new ApiError(400, 'Wallet balance cannot be combined with Cash on Delivery. Pay the remaining amount online, or turn off the wallet.');
                } else {
                    // The gateway must only charge what the wallet did not cover.
                    finalPaymentMethod = 'mixed';
                }
            }
            if (finalPaymentMethod === 'wallet' && remainingToPay > 0) {
                throw new ApiError(400, 'Wallet amount does not cover the order total.');
            }

            if (finalPaymentMethod === 'card' || finalPaymentMethod === 'online' || finalPaymentMethod === 'razorpay' || (finalPaymentMethod === 'mixed' && remainingToPay > 0)) {
                const amountToPayRzp = finalPaymentMethod === 'mixed' ? remainingToPay : total;
                const rzpOrder = await createRazorpayOrder(amountToPayRzp, { receipt: `rcpt_${Date.now()}` });
                razorpayOrderId = rzpOrder.id;
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
                taxBreakdown,
                placeOfSupply: buyerState ? { state: buyerState.name, code: buyerState.code } : undefined,
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
            if (proposalCtx) {
                await ChatTransactionProposal.updateOne({ _id: proposalCtx._id }, { $set: { orderRef: createdOrder._id } }, { session });
            }
            // Link the wallet debit back to the order so wallet history shows which order it paid for
            if (walletTxId) {
                await WalletTransaction.updateOne(
                    { _id: walletTxId },
                    { $set: { orderId: createdOrder._id, description: `Payment for order #${createdOrder.orderId}` } },
                    { session }
                );
            }
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
            const commissionDocs = Object.values(vendorMap).map((v) => {
                if (v.isManagedListing) {
                    const supplyEarnings = parseFloat(Number(v.supplySubtotal || 0).toFixed(2));
                    const adminMargin = parseFloat(Math.max(0, v.subtotal - supplyEarnings).toFixed(2));
                    return {
                        orderId: order._id,
                        vendorId: v.vendorId,
                        vendorName: v.vendorName,
                        subtotal: v.subtotal,
                        commissionRate: 0,
                        commission: adminMargin, // Admin retained commercial margin
                        vendorEarnings: supplyEarnings, // Contracted supply price payable to managed shop
                    };
                }

                // Standard third-party vendor commission
                const comm = parseFloat(((v.subtotal * v.commissionRate) / 100).toFixed(2));
                return {
                    orderId: order._id,
                    vendorId: v.vendorId,
                    vendorName: v.vendorName,
                    subtotal: v.subtotal,
                    commissionRate: v.commissionRate,
                    commission: comm,
                    vendorEarnings: parseFloat((v.subtotal - comm).toFixed(2)),
                };
            });
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

            // 10. Automatically generate PurchaseOrder records for B2B Company purchases
            const b2bUser = userId ? await User.findById(userId).session(session) : null;
            const targetCompanyId = req.user?.companyId || b2bUser?.companyId;
            if (targetCompanyId || isB2B) {
                let company = targetCompanyId ? await B2BCompany.findById(targetCompanyId).session(session) : null;
                if (!company && targetCompanyId) {
                    company = await B2BCompany.findById(targetCompanyId);
                }
                if (company) {
                    for (const group of vendorItems) {
                        for (const itm of group.items) {
                            const vendorDoc = await Vendor.findById(group.vendorId).session(session);
                            const poDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                            const randomDigits = Math.floor(1000 + Math.random() * 9000);
                            const poNumber = `PO-${poDateStr}-${randomDigits}`;

                            await PurchaseOrder.create([{
                                poNumber,
                                companyId: company._id,
                                orderId: order._id,
                                orderNumber: order.orderId,
                                sourceType: 'DirectPurchase',
                                companyDetails: {
                                    name: company.companyName || shippingAddress?.name || 'B2B Procurement Buyer',
                                    email: company.businessEmail || shippingAddress?.email || '',
                                    phone: company.businessPhone || shippingAddress?.phone || '',
                                    address: company.companyAddress || (shippingAddress ? `${shippingAddress.address || ''}, ${shippingAddress.city || ''}, ${shippingAddress.state || ''}` : 'Address on File'),
                                    gstin: company.gstNumber || ''
                                },
                                vendorId: group.vendorId,
                                vendorDetails: {
                                    storeName: vendorDoc?.storeName || group.vendorName || 'Vendor Store',
                                    name: vendorDoc?.name || group.vendorName || 'Vendor Representative',
                                    email: vendorDoc?.email || '',
                                    phone: vendorDoc?.phone || '9876543210'
                                },
                                productId: itm.productId,
                                productDetails: {
                                    name: itm.name,
                                    qty: itm.quantity,
                                    unitPrice: itm.price,
                                    totalPrice: itm.price * itm.quantity
                                },
                                terms: {
                                    warranty: 'Standard Warranty',
                                    paymentTerms: finalPaymentMethod === 'wallet' ? 'Wallet Paid' : 'Direct B2B Checkout',
                                    deliveryTerms: 'Standard Delivery',
                                    termsConditions: 'Direct Wholesale Order from Platform.'
                                },
                                pricing: {
                                    subtotal: itm.taxableAmount || (itm.price * itm.quantity),
                                    tax: itm.gstAmount || 0,
                                    total: (itm.price * itm.quantity) + (itm.gstAmount || 0)
                                },
                                deliveryInformation: {
                                    shippingAddress: shippingAddress ? `${shippingAddress.address || ''}, ${shippingAddress.city || ''}, ${shippingAddress.state || ''} - ${shippingAddress.zipCode || ''}` : 'Default Shipping'
                                },
                                status: 'Approved',
                                paymentStatus: initialPaymentStatus === 'paid' ? 'Paid' : 'Unpaid',
                                paymentMethod: finalPaymentMethod === 'card' ? 'Card' : (finalPaymentMethod === 'wallet' ? 'NetBanking' : 'None')
                            }], { session });
                        }
                    }
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

    if (proposalCtx && order && !idempotentReplay) {
        try {
            const thread = await VendorChatThread.findById(proposalCtx.threadId);
            if (thread) {
                const note = await VendorChatMessage.create({
                    threadId: thread._id, senderType: 'system', senderId: null,
                    message: `[Order Placed] Buyer placed order ${order.orderId} for "${proposalCtx.productName}" at the agreed amount of ₹${proposalCtx.finalAmount}.`,
                });
                thread.lastActivity = new Date();
                thread.lastMessage = `[Order Placed] ${order.orderId}`;
                await thread.save();
                const io = getIO();
                io.to(`chat_${thread._id}`).emit('new_message', { id: note._id, sender: 'system', message: note.message, time: note.createdAt });
                io.to(`chat_${thread._id}`).emit('transaction_proposal_updated', { ...proposalCtx.toObject(), status: 'converted_to_order', orderRef: order._id });
            }
        } catch (chatErr) {
            console.warn('Could not post order notice to chat:', chatErr.message);
        }
    }

    const responseStatus = idempotentReplay ? 200 : 201;
    const responseMessage = idempotentReplay
        ? 'Duplicate order request ignored. Returning existing order.'
        : 'Order placed successfully.';
    const isCod = ['cod', 'cash'].includes(String(order?.paymentMethod || '').toLowerCase());
    if (!idempotentReplay && order && (order.paymentStatus === 'paid' || isCod)) {
        (async () => {
            // 1. Prioritize Invoice generation and customer tax invoice PDF email
            try {
                const inv = await generateInvoiceForOrder(order._id);
                if (inv) {
                    await sendOrderInvoiceEmail(order._id, { invoice: inv });
                }
            } catch (invErr) {
                console.error("Automatic invoice / email generation error on placeOrder:", invErr?.message);
            }

            // 2. Trigger Order Confirmed status lifecycle, record initial history
            try {
                await handleOrderStatusTransition(order, 'pending', {
                    updatedBy: order.userId,
                    updatedByRole: 'user',
                    note: 'Order placed successfully by customer',
                    notifyCustomer: false, // Invoice email is already sent above with complete PDF & details
                });
            } catch (statusErr) {
                console.error("Order status transition error on placeOrder:", statusErr?.message);
            }

            // 3. Trigger real-time notifications to vendors & push to buyer
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
                        createNotification({
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

                        // Vendor Notification Item 90: New Order Received with Multi-Vendor Isolation
                        sendVendorNewOrderNotification({
                            vendorId: v.vendorId,
                            order,
                        }).catch(e => console.error('[VendorNotification] New order email error:', e.message));

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

                // Admin Notification Items 130 & 153: High-Value / Large Order Alert
                const orderTotal = Number(order.total || order.totalAmount || 0);
                if (orderTotal >= 50000) {
                    sendAdminOrderAlert({
                        order,
                        alertType: 'high_value',
                        reason: `Order value (₹${orderTotal.toLocaleString('en-IN')}) exceeds high-value threshold of ₹50,000.`,
                    }).catch(e => console.error('[AdminNotification] High-value order email error:', e.message));
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

/**
 * Cancels an order inside a transaction: marks it cancelled, puts stock back, cancels commissions and
 * purchase orders, and reverses loyalty points. Shared by buyer cancellation and the job that releases
 * unpaid online orders, so both follow the same rules. Money refunds happen after the transaction.
 */
export const cancelOrderInSession = async (order, { reason, userId, role, session }) => {
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by customer';
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

    await PurchaseOrder.updateMany(
        { orderId: order._id, status: { $ne: 'Cancelled' } },
        { $set: { status: 'Cancelled' } },
        { session }
    );

    // Revert loyalty points transactions for both B2C and B2B
    const isB2C = role === 'customer';
    const isB2B = role === 'b2bAdmin' || role === 'b2bEmployee';
    if (isB2C || isB2B) {
        const loyaltyService = await import('../../../services/loyalty.service.js');
        if (order.loyaltyPointsEarned > 0) {
            await loyaltyService.reverseEarnedPoints(userId, order._id, session);
        }
        if (order.loyaltyPointsRedeemed > 0) {
            await loyaltyService.restoreRedeemedPoints(userId, order._id, session);
        }
    }
};

// PATCH /api/user/orders/:id/cancel
export const cancelOrder = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const order = await Order.findOne({ orderId: req.params.id, userId: req.user.id }).session(session);
            if (!order) throw new ApiError(404, 'Order not found.');
            if (!['pending', 'processing'].includes(order.status)) throw new ApiError(400, 'Order cannot be cancelled at this stage.');

            await cancelOrderInSession(order, { reason: req.body.reason, userId: req.user.id, role: req.user?.role, session });
        });
    } finally {
        await session.endSession();
    }

    // Trigger order status transition and customer email for cancellation
    let refundResult = null;
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

            // Auto-refund if order was prepaid (Razorpay/online or wallet)
            const refundService = await import('../../../services/refund.service.js');
            refundResult = await refundService.processOrderCancellationRefund(cancelledOrder, {
                reason: req.body.reason || 'Cancelled by customer',
                triggeredBy: req.user.id,
                triggeredByRole: 'user',
            });

            // Vendor Notification Items 85 & 86: Order Cancelled
            for (const vi of cancelledOrder.vendorItems || []) {
                sendVendorOrderCancelledNotification({
                    vendorId: vi.vendorId,
                    order: cancelledOrder,
                    reason: req.body.reason || 'Cancelled by customer',
                }).catch(err => console.error('[VendorNotification] Cancel order email error:', err.message));
            }
        }
    } catch (cancelNotifErr) {
        console.error("Cancel order status transition error:", cancelNotifErr?.message);
    }

    const responseMsg = refundResult?.gatewayRefunded > 0 || refundResult?.walletRefunded > 0
        ? `Order cancelled successfully. Refund of ₹${(refundResult.gatewayRefunded + refundResult.walletRefunded).toFixed(2)} has been initiated.`
        : 'Order cancelled successfully.';

    res.status(200).json(new ApiResponse(200, { refund: refundResult }, responseMsg));
});

const normalizeReturnRequest = (requestDoc, invoiceMap = new Map()) => {
    const request = typeof requestDoc?.toObject === 'function' ? requestDoc.toObject() : requestDoc;
    const refundDetails = request?.refundDetails ? { ...request.refundDetails } : {};
    return {
        ...request,
        id: String(request?._id || ''),
        // returnId = public Return ID; orderId = original public Order ID; never interchanged.
        ...buildReturnIdentifiers(request, invoiceMap),
        requestDate: request?.createdAt,
        items: enrichReturnItems(request),
        refundDetails,
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
    const fallbackReason = String(req.body.reason || '').trim();
    const refundDestination = req.body.refundDestination || 'Original Payment Method';

    let request;
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            // Re-read inside the transaction so quantity checks see a consistent snapshot.
            const txOrder = await Order.findById(order._id).session(session);
            if (!txOrder || txOrder.status !== 'delivered') {
                throw new ApiError(400, 'Return can only be requested for delivered orders.');
            }
            const txVendorItems = (txOrder.items || []).filter((item) => String(item?.vendorId || '') === vendorId);

            // Quantity already claimed on this exact order by earlier (non-rejected) returns.
            const alreadyReturned = await getReturnedQuantities(txOrder, { session });
            const remainingFor = (orderItem) =>
                Number(orderItem.quantity || 0) - (alreadyReturned.get(String(orderItem._id)) || 0);

            let normalizedItems = [];
            if (requestedItems.length > 0) {
                const seen = new Set();
                normalizedItems = requestedItems.map((inputItem) => {
                    const orderItemId = String(inputItem?.orderItemId || '');
                    const productId = String(inputItem?.productId || '');
                    let orderItem;

                    if (orderItemId) {
                        orderItem = txVendorItems.find((it) => String(it._id) === orderItemId);
                        if (!orderItem) {
                            throw new ApiError(400, `Order item ${orderItemId} does not belong to this order/vendor.`);
                        }
                        if (productId && String(orderItem.productId || '') !== productId) {
                            throw new ApiError(400, 'Product does not match the referenced order item.');
                        }
                    } else {
                        // Backward-compatible path for clients that only send productId.
                        const candidates = txVendorItems.filter((it) => String(it?.productId || '') === productId);
                        if (candidates.length === 0) {
                            throw new ApiError(400, `Product ${productId} is not valid for this return request.`);
                        }
                        if (candidates.length > 1) {
                            throw new ApiError(400, 'Multiple order lines match this product. Please send orderItemId.');
                        }
                        orderItem = candidates[0];
                    }

                    const key = String(orderItem._id);
                    if (seen.has(key)) {
                        throw new ApiError(400, `Order item for ${orderItem.name || key} was listed more than once.`);
                    }
                    seen.add(key);

                    const requestedQty = Number(inputItem?.quantity || 0);
                    const remaining = remainingFor(orderItem);
                    if (!Number.isFinite(requestedQty) || requestedQty <= 0 || requestedQty > remaining) {
                        throw new ApiError(
                            400,
                            remaining <= 0
                                ? `${orderItem.name || 'This item'} has already been returned.`
                                : `Invalid quantity for ${orderItem.name || key}. Maximum returnable: ${remaining}.`
                        );
                    }

                    return {
                        orderItemId: orderItem._id,
                        variantKey: orderItem.variantKey || '',
                        productId: orderItem.productId,
                        name: orderItem.name,
                        price: orderItem.price,
                        image: orderItem.image,
                        quantity: requestedQty,
                        gstAmount: lineRefundParts(orderItem, requestedQty).gst,
                        discountShare: lineRefundParts(orderItem, requestedQty).discount,
                        reason: String(inputItem?.reason || fallbackReason).trim(),
                    };
                });
            } else {
                normalizedItems = txVendorItems
                    .filter((item) => remainingFor(item) > 0)
                    .map((item) => ({
                        orderItemId: item._id,
                        variantKey: item.variantKey || '',
                        productId: item.productId,
                        name: item.name,
                        price: item.price,
                        image: item.image,
                        quantity: remainingFor(item),
                        gstAmount: lineRefundParts(item, remainingFor(item)).gst,
                        discountShare: lineRefundParts(item, remainingFor(item)).discount,
                        reason: fallbackReason,
                    }));
                if (normalizedItems.length === 0) {
                    throw new ApiError(400, 'All items of this order have already been returned.');
                }
            }

            // Refund what the buyer actually paid for these units: price + the GST charged on them.
            const refundAmount = normalizedItems.reduce(
                (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0) - Number(item.discountShare || 0) + Number(item.gstAmount || 0),
                0
            );

            // Unique Return ID, independent from the Order ID.
            let returnId = generateReturnId();
            for (let i = 0; i < 5 && (await ReturnRequest.exists({ returnId }).session(session)); i += 1) {
                returnId = generateReturnId();
            }

            // Touch the order so concurrent return submissions for the same order conflict and are retried serially.
            await Order.updateOne({ _id: txOrder._id }, { $set: { updatedAt: new Date() } }, { session });

            // Returns of refurbished/renewed items are tracked separately for the admin refurbished desk.
            const returnedProductIds = normalizedItems.map((it) => it.productId).filter(Boolean);
            const refurbishedCount = returnedProductIds.length
                ? await Product.countDocuments({ _id: { $in: returnedProductIds }, isRefurbished: true }).session(session)
                : 0;

            const [created] = await ReturnRequest.create(
                [
                    {
                        isRefurbishedComplaint: refurbishedCount > 0,
                        returnId,
                        orderId: txOrder._id,
                        orderNumber: txOrder.orderId,
                        userId: req.user.id,
                        vendorId,
                        items: normalizedItems,
                        reason: fallbackReason,
                        status: 'pending',
                        refundAmount: Number(refundAmount.toFixed(2)),
                        refundStatus: 'pending',
                        refundDestination,
                        images: Array.isArray(req.body.images) ? req.body.images : [],
                    },
                ],
                { session }
            );
            request = created;
        });
    } finally {
        await session.endSession();
    }

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

    sendReturnRequestSubmittedNotification({ returnRequest: request, order }).catch((err) =>
        console.warn(`[ReturnRequestEmail] Failed to send customer notification: ${err.message}`)
    );

    // Vendor Notification Item 109: Customer Requested Return
    sendVendorReturnNotification({
        vendorId,
        order,
        returnRequest: request,
        status: 'requested',
        reason: req.body.reason,
    }).catch((err) =>
        console.warn(`[ReturnRequestEmail] Failed to send vendor notification: ${err.message}`)
    );

    const populated = await ReturnRequest.findById(request._id)
        .populate('orderId', 'orderId total items createdAt')
        .populate('vendorId', 'storeName');

    const invoiceMap = await getInvoiceNumberMap([order._id]);
    res.status(201).json(new ApiResponse(201, normalizeReturnRequest(populated, invoiceMap), 'Return request submitted successfully.'));
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
            .populate('vendorId', 'storeName')
            .sort({ createdAt: -1 })
            .skip((numericPage - 1) * numericLimit)
            .limit(numericLimit),
        ReturnRequest.countDocuments(filter),
    ]);

    const invoiceMap = await getInvoiceNumberMap(requests.map((r) => r.orderId?._id || r.orderId));

    res.status(200).json(new ApiResponse(200, {
        returnRequests: requests.map((r) => normalizeReturnRequest(r, invoiceMap)),
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
        .populate('vendorId', 'storeName');
    if (!request) throw new ApiError(404, 'Return request not found.');
    const invoiceMap = await getInvoiceNumberMap([request.orderId?._id || request.orderId]);
    res.status(200).json(new ApiResponse(200, normalizeReturnRequest(request, invoiceMap), 'Return request fetched.'));
});
