import { useB2bStore } from "../../../shared/store/b2bStore";
import { useAuthStore } from "../../../shared/store/authStore";
import { getB2bProductSpecs } from "../data/b2bMockData";
import { getProductById } from "../data/catalogData";

export const useBusinessBuyer = () => {
  const userRole = useB2bStore((state) => state.userRole);
  const setUserRole = useB2bStore((state) => state.setUserRole);
  const businessProfile = useB2bStore((state) => state.businessProfile);
  const quotations = useB2bStore((state) => state.quotations);
  const addQuotation = useB2bStore((state) => state.addQuotation);
  const stockRequests = useB2bStore((state) => state.stockRequests);
  const addStockRequest = useB2bStore((state) => state.addStockRequest);
  const updateStockRequestStatus = useB2bStore(
    (state) => state.updateStockRequestStatus,
  );
  const updateBusinessProfile = useB2bStore(
    (state) => state.updateBusinessProfile,
  );
  const resetB2b = useB2bStore((state) => state.resetB2b);

  const { user } = useAuthStore();
  const isB2BUser = user?.role === 'b2bAdmin' || user?.role === 'b2bEmployee' || user?.isEmployee;
  const isBusiness = userRole === "business_buyer" && (!user || isB2BUser);

  /**
   * Get B2B specifications for a given product
   */
  const getWholesaleSpecs = (productId, retailPrice) => {
    const specs = { ...getB2bProductSpecs(productId, retailPrice) }; // copy: we override fields below

    // Use the vendor's real wholesale pricing when the product has it, so what the
    // buyer sees is what the server charges (mirrors order.controller's B2B pricing:
    // a matching quantity slab wins, otherwise b2bWholesalePrice).
    const product = getProductById(productId);
    const wholesale = Number(product?.b2bWholesalePrice);
    const slabs = (product?.b2bBulkPricingSlabs || [])
      .map((s) => ({ minQty: Number(s?.minQty), price: Number(s?.pricePerUnit) }))
      .filter((s) => s.minQty > 0 && s.price > 0)
      .sort((a, b) => a.minQty - b.minQty);

    // Only real product data: no placeholder discounts or MOQs the server would not honour
    // (the old fallback showed 20-40% "bulk" prices that checkout never charged).
    // Same rule as the server: the larger of the B2B MOQ and the product's general MOQ.
    const realGst = Number(product?.gstRate ?? product?.taxRate);
    if (Number.isFinite(realGst)) specs.gstSlab = realGst;
    const realMoq = Math.max(1, Number(product?.b2bMinOrderQty) || 1, Number(product?.minimumOrderQuantity) || 1);
    if (!(wholesale > 0) && slabs.length === 0) {
      const price = Number(retailPrice) || 0;
      return { ...specs, moq: realMoq, tiers: [{ minQty: realMoq, price }], retailPrice: price || undefined };
    }

    const moq = realMoq;
    let basePrice = wholesale > 0 ? wholesale : Number(retailPrice) || 0;
    const tiers = [];
    for (const slab of slabs) {
      if (slab.minQty <= moq) basePrice = slab.price; // slab already applies at MOQ
      else tiers.push(slab);
    }
    tiers.unshift({ minQty: moq, price: basePrice });

    return { ...specs, moq, tiers, retailPrice: Number(retailPrice) || undefined };
  };

  /**
   * Get the applicable wholesale unit price based on ordered quantity
   */
  const getWholesalePriceForQty = (productId, retailPrice, qty) => {
    const specs = getWholesaleSpecs(productId, retailPrice);
    let applicablePrice = retailPrice;

    // Iterate through tiers to find the highest matching minimum quantity
    let matchedPrice = null;
    for (const tier of specs.tiers) {
      if (qty >= tier.minQty) {
        matchedPrice = tier.price;
      }
    }

    if (matchedPrice !== null) {
      return matchedPrice;
    }

    // Default to the first tier's price if they ask for B2B price view
    return specs.tiers[0]?.price || retailPrice * 0.8;
  };

  /**
   * Check if quantity meets MOQ requirement
   */
  const meetsMOQ = (productId, retailPrice, qty) => {
    const specs = getWholesaleSpecs(productId, retailPrice);
    return qty >= specs.moq;
  };

  return {
    userRole,
    setUserRole,
    isBusiness,
    businessProfile,
    quotations,
    addQuotation,
    stockRequests,
    addStockRequest,
    updateStockRequestStatus,
    updateBusinessProfile,
    resetB2b,
    getWholesaleSpecs,
    getWholesalePriceForQty,
    meetsMOQ,
  };
};
