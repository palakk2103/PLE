import { resolveProductGST } from './gstUtils.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * GST for a purchase order raised from a vendor's RFQ quotation.
 *
 * The quotation's tax field is free text ("18% GST extra"), so it must never be read as a rupee
 * amount. A catalogue product uses its own GST rate; a custom item uses the percentage the vendor
 * wrote. When the vendor says the price includes GST, the total stays as quoted.
 */
export const quotationPricing = ({ quotedTotal, taxDetails, product = null, category = null, vendor = null }) => {
    const total = round2(quotedTotal);
    const text = String(taxDetails || '').trim();
    // Nothing said about tax (for example a locked Direct RFQ price): keep the agreed figure.
    if (!text) return { subtotal: total, tax: 0, total };

    const written = text.match(/(\d+(?:\.\d+)?)\s*%/);
    const rate = product ? resolveProductGST(product, category, vendor) : (written ? Number(written[1]) : 0);
    if (!(rate > 0 && rate <= 100)) return { subtotal: total, tax: 0, total };

    if (/\binclu/i.test(text) && !/\b(not|excl)/i.test(text)) {
        const tax = round2(total - total / (1 + rate / 100));
        return { subtotal: round2(total - tax), tax, total };
    }
    const tax = round2((total * rate) / 100);
    return { subtotal: total, tax, total: round2(total + tax) };
};
