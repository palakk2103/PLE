/**
 * One rule for the B2B (business buyer) unit price, used by checkout and the shipping estimate.
 * The storefront has the same rule in frontend/src/shared/utils/b2bPricing.js — keep them in step.
 *
 *  - B2B pricing only applies when the product has B2B selling turned on (b2bEnabled).
 *  - Base price: the wholesale price if set, otherwise the normal price.
 *  - Bulk slabs: of the slabs whose range contains the quantity (minQty <= qty, and qty <= maxQty
 *    when a maxQty is set), the one with the highest minQty wins. Slabs are matched in that order
 *    regardless of how they were saved, so the result never depends on the slab order.
 */
export const isB2BRole = (role) => role === 'b2bAdmin' || role === 'b2bEmployee';

export const pickBulkSlab = (slabs, qty) => {
    const quantity = Number(qty) || 0;
    let best = null;
    for (const s of Array.isArray(slabs) ? slabs : []) {
        const min = Number(s?.minQty);
        const max = Number(s?.maxQty);
        const price = Number(s?.pricePerUnit);
        if (!(min > 0) || !(price > 0)) continue;
        if (quantity < min) continue;
        if (max > 0 && quantity > max) continue;
        if (!best || min > best.minQty) best = { minQty: min, maxQty: max > 0 ? max : null, pricePerUnit: price };
    }
    return best;
};

/** Unit price a business buyer pays for `qty` of `product`, given the normal (variant) price. */
export const resolveB2BUnitPrice = (product, normalPrice, qty) => {
    const base = Number(normalPrice) || 0;
    if (!product?.b2bEnabled) return base;
    const wholesale = Number(product.b2bWholesalePrice);
    const slab = pickBulkSlab(product.b2bBulkPricingSlabs, qty);
    if (slab) return slab.pricePerUnit;
    return wholesale > 0 ? wholesale : base;
};
