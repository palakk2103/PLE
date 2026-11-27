import { useB2bStore } from "../../../shared/store/b2bStore";
import { useAuthStore } from "../../../shared/store/authStore";
import { getB2bProductSpecs } from "../data/b2bMockData";
import { getProductById } from "../data/catalogData";
import { pickBulkSlab, resolveB2BUnitPrice } from "../../../shared/utils/b2bPricing";

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

    // Only real product data, priced with the same rule the server charges at checkout
    // (shared/utils/b2bPricing.js): no wholesale price unless the product has B2B selling on.
    const product = getProductById(productId);
    const price = Number(retailPrice) || 0;
    const realGst = Number(product?.gstRate ?? product?.taxRate);
    if (Number.isFinite(realGst)) specs.gstSlab = realGst;
    // Same rule as the server: the larger of the B2B MOQ and the product's general MOQ.
    const moq = Math.max(1, Number(product?.b2bMinOrderQty) || 1, Number(product?.minimumOrderQuantity) || 1);

    const tiers = [{ minQty: moq, maxQty: null, price: resolveB2BUnitPrice(product, price, moq) }];
    if (product?.b2bEnabled) {
      const slabMins = [...new Set((product.b2bBulkPricingSlabs || [])
        .map((s) => Number(s?.minQty))
        .filter((m) => m > moq))].sort((a, b) => a - b);
      for (const minQty of slabMins) {
        const slab = pickBulkSlab(product.b2bBulkPricingSlabs, minQty);
        tiers.push({ minQty, maxQty: slab?.maxQty ?? null, price: resolveB2BUnitPrice(product, price, minQty) });
      }
    }

    return { ...specs, moq, tiers, retailPrice: price || undefined };
  };

  /**
   * Unit price for a quantity: exactly what checkout will charge a business buyer.
   */
  const getWholesalePriceForQty = (productId, retailPrice, qty) => {
    const product = getProductById(productId);
    return resolveB2BUnitPrice(product, retailPrice, qty);
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
