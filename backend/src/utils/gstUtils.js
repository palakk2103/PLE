import { stateFromGstin, normalizeState, stateFromAddressText } from './gstStates.js';

/**
 * Centralized GST resolution logic according to Seller-Controlled GST System rules.
 * Hierarchy:
 * 1. Product Custom GST (if product.gstMode === 'custom' and product.gstRate is specified)
 * 2. Vendor Custom Category GST (if vendor has configured categoryGstRates for product.categoryId)
 * 3. Vendor Store Default GST (if vendor has defaultGstRate)
 * 4. Category Default GST (if category/populated categoryId has gstRate)
 * 5. Product legacy taxRate / default fallback (18%)
 */
export const resolveProductGST = (product, category = null, vendor = null) => {
    if (!product) return 18;

    const mode = String(product.gstMode || '').toLowerCase();

    // 1. If product explicitly uses Custom GST mode
    if (mode === 'custom') {
        const customGst = Number(product.gstRate ?? product.taxRate);
        if (Number.isFinite(customGst) && customGst >= 0 && customGst <= 100) {
            return customGst;
        }
    }

    // 2. If Vendor has a custom Category GST rate for this category or parent category
    const targetCatId = String(
        category?._id || category?.id || product.categoryId?._id || product.categoryId || ''
    );
    const parentCatId = String(
        category?.parentId?._id || category?.parentId || product.categoryId?.parentId?._id || product.categoryId?.parentId || ''
    );
    const ven = vendor || (product.vendorId && typeof product.vendorId === 'object' ? product.vendorId : null);
    if (ven && Array.isArray(ven.categoryGstRates)) {
        const vendorCatRule = ven.categoryGstRates.find((r) => {
            const rCat = String(r.categoryId?._id || r.categoryId);
            return (targetCatId && rCat === targetCatId) || (parentCatId && rCat === parentCatId);
        });
        if (vendorCatRule && Number.isFinite(Number(vendorCatRule.gstRate))) {
            return Number(vendorCatRule.gstRate);
        }
    }

    // 3. If vendor has a default global GST rate configured
    if (ven && Number.isFinite(Number(ven.defaultGstRate))) {
        return Number(ven.defaultGstRate);
    }

    // 4. If Category is provided or populated on product
    const cat = category || (product.categoryId && typeof product.categoryId === 'object' ? product.categoryId : null);
    if (cat) {
        const catGst = Number(cat.gstRate);
        if (Number.isFinite(catGst) && catGst >= 0 && catGst <= 100) {
            return catGst;
        }
    }

    // 5. Fallback to product.gstRate or product.taxRate if numeric
    const prodGst = Number(product.gstRate ?? product.taxRate);
    if (Number.isFinite(prodGst) && prodGst >= 0 && prodGst <= 100) {
        return prodGst;
    }

    // 6. Platform default fallback
    return 18;
};

// ─── Place of supply: CGST + SGST (intra-state) vs IGST (inter-state) ───────────

export const SUPPLY_TYPE = Object.freeze({
    INTRA: 'INTRA_STATE',   // CGST + SGST
    INTER: 'INTER_STATE',   // IGST
    UNKNOWN: 'UNKNOWN',     // seller or buyer state could not be determined
});

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Seller's registered state. The GSTIN prefix is authoritative (it IS the state of registration);
 * explicit state fields and address text are fallbacks. Works for Vendor and ManagedShop documents.
 * PLATFORM_GST_STATE (env) is the last resort for admin-owned stock with no data.
 */
export const resolveSellerState = (seller) => {
    if (seller) {
        for (const g of [seller.gstNumber, seller.documents?.gst, seller.b2bSellingGstNumber, seller.gst]) {
            const s = stateFromGstin(g);
            if (s) return { ...s, source: 'gstin' };
        }
        for (const st of [seller.state, seller.address?.state, seller.b2bSellingState]) {
            const s = normalizeState(st);
            if (s) return { ...s, source: 'state' };
        }
        for (const txt of [seller.businessAddress, typeof seller.address === 'string' ? seller.address : '', seller.warehouse]) {
            const s = stateFromAddressText(txt);
            if (s) return { ...s, source: 'address' };
        }
    }
    const platform = normalizeState(process.env.PLATFORM_GST_STATE);
    return platform ? { ...platform, source: 'platform_default' } : null;
};

/** Buyer's place of supply = the delivery address state. */
export const resolveBuyerState = (shippingAddress) => {
    if (!shippingAddress) return null;
    return normalizeState(shippingAddress.state) || stateFromAddressText(shippingAddress.address);
};

export const determineSupplyType = (sellerState, buyerState) => {
    if (!sellerState?.code || !buyerState?.code) return SUPPLY_TYPE.UNKNOWN;
    return sellerState.code === buyerState.code ? SUPPLY_TYPE.INTRA : SUPPLY_TYPE.INTER;
};

/**
 * Splits an already-computed GST amount. The total never changes — only how it is labelled.
 * CGST + SGST always add back to exactly gstAmount (any odd paisa goes to SGST).
 */
export const splitGST = (gstAmount, supplyType) => {
    const total = round2(gstAmount);
    if (supplyType === SUPPLY_TYPE.INTRA) {
        const cgstAmount = round2(total / 2);
        return { cgstAmount, sgstAmount: round2(total - cgstAmount), igstAmount: 0 };
    }
    if (supplyType === SUPPLY_TYPE.INTER) {
        return { cgstAmount: 0, sgstAmount: 0, igstAmount: total };
    }
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
};

/** Adds the split fields to one line item (mutates & returns it). */
export const applyGSTSplit = (item, supplyType) => {
    Object.assign(item, { supplyType }, splitGST(item.gstAmount, supplyType));
    return item;
};

/** Totals across items: { cgst, sgst, igst, unsplit } — unsplit = GST on lines with UNKNOWN supply. */
export const summarizeGST = (items = []) => {
    const out = { cgst: 0, sgst: 0, igst: 0, unsplit: 0 };
    for (const it of items) {
        out.cgst += Number(it.cgstAmount) || 0;
        out.sgst += Number(it.sgstAmount) || 0;
        out.igst += Number(it.igstAmount) || 0;
        if (!it.supplyType || it.supplyType === SUPPLY_TYPE.UNKNOWN) out.unsplit += Number(it.gstAmount) || 0;
    }
    return { cgst: round2(out.cgst), sgst: round2(out.sgst), igst: round2(out.igst), unsplit: round2(out.unsplit) };
};

/**
 * Calculates taxable amount and GST amount for a given unit price, quantity, and GST rate.
 */
export const calculateItemGST = (unitPrice, quantity = 1, gstRate = 18, itemDiscount = 0, taxIncluded = false) => {
    const qty = Math.max(1, Number(quantity) || 1);
    const price = Math.max(0, Number(unitPrice) || 0);
    const discount = Math.max(0, Number(itemDiscount) || 0);
    const rate = Math.max(0, Number(gstRate) || 0);

    const lineTotal = Math.max(0, price * qty - discount);

    if (taxIncluded) {
        // Price is inclusive of GST: LineTotal = Taxable + GST
        // Taxable = LineTotal / (1 + Rate/100)
        const taxableAmount = parseFloat((lineTotal / (1 + rate / 100)).toFixed(2));
        const gstAmount = parseFloat((lineTotal - taxableAmount).toFixed(2));
        return { taxableAmount, gstAmount, totalAmount: lineTotal, gstRate: rate };
    } else {
        // Price is exclusive of GST: Taxable = LineTotal, GST = Taxable * Rate / 100
        const taxableAmount = parseFloat(lineTotal.toFixed(2));
        const gstAmount = parseFloat(((taxableAmount * rate) / 100).toFixed(2));
        const totalAmount = parseFloat((taxableAmount + gstAmount).toFixed(2));
        return { taxableAmount, gstAmount, totalAmount, gstRate: rate };
    }
};
