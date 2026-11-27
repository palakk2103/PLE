/**
 * Same B2B price rule as the server (backend/src/utils/b2bPricing.js) — keep them in step,
 * otherwise the cart shows one price and checkout charges another.
 *
 *  - Only when the product has B2B selling on (b2bEnabled).
 *  - Base: wholesale price if set, else the normal price.
 *  - Slab: of the slabs whose range contains qty (minQty <= qty <= maxQty when maxQty is set),
 *    the one with the highest minQty wins.
 */
export const pickBulkSlab = (slabs, qty) => {
  const quantity = Number(qty) || 0;
  let best = null;
  for (const s of Array.isArray(slabs) ? slabs : []) {
    const min = Number(s?.minQty);
    const max = Number(s?.maxQty);
    const price = Number(s?.pricePerUnit ?? s?.price);
    if (!(min > 0) || !(price > 0)) continue;
    if (quantity < min) continue;
    if (max > 0 && quantity > max) continue;
    if (!best || min > best.minQty) best = { minQty: min, maxQty: max > 0 ? max : null, price };
  }
  return best;
};

export const resolveB2BUnitPrice = (product, normalPrice, qty) => {
  const base = Number(normalPrice) || 0;
  if (!product?.b2bEnabled) return base;
  const slab = pickBulkSlab(product.b2bBulkPricingSlabs, qty);
  if (slab) return slab.price;
  const wholesale = Number(product.b2bWholesalePrice);
  return wholesale > 0 ? wholesale : base;
};
