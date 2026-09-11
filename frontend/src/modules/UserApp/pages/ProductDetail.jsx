import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import {
  FiStar,
  FiHeart,
  FiShoppingBag,
  FiMinus,
  FiPlus,
  FiArrowLeft,
  FiShare2,
  FiCheckCircle,
  FiTrash2,
  FiFileText,
  FiPackage,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useCartStore, useUIStore } from "../../../shared/store/useStore";
import { useWishlistStore } from "../../../shared/store/wishlistStore";
import { useReviewsStore } from "../../../shared/store/reviewsStore";
import { useOrderStore } from "../../../shared/store/orderStore";
import { useAuthStore } from "../../../shared/store/authStore";
import {
  getProductById,
  getSimilarProducts,
  getVendorById,
  getBrandById,
} from "../data/catalogData";
import api from "../../../shared/utils/api";
import { formatPrice } from "../../../shared/utils/helpers";
import toast from "react-hot-toast";
import MobileLayout from "../components/Layout/MobileLayout";
import ImageGallery from "../../../shared/components/Product/ImageGallery";
import VariantSelector from "../../../shared/components/Product/VariantSelector";
import ReviewForm from "../../../shared/components/Product/ReviewForm";
import MobileProductCard from "../components/Mobile/MobileProductCard";
import PageTransition from "../../../shared/components/PageTransition";
import Badge from "../../../shared/components/Badge";
import ProductCard from "../../../shared/components/ProductCard";
import { getVariantSignature } from "../../../shared/utils/variant";
import { useSafeBack } from "../../../shared/hooks/useSafeBack";
import { useBusinessBuyer } from "../hooks/useBusinessBuyer";
import { useLoyaltyStore } from "../../../shared/store/loyaltyStore";
import {
  B2BBulkQuantitySelector,
  B2BProductDetailSections,
  B2BRequestQuoteModal,
  B2BRequestStockModal,
  B2BNotifyMe,
  B2BStockAvailability,
} from "../components/B2B";
import { estimateDeliveryETA } from "../../../shared/data/deliveryMockData";
import { ProductEnquiryModal } from "../components/Enquiry/ProductEnquiryModal";

// Offers System Imports
import { useOffers } from "../../offers/hooks/useOffers";
import OfferCard from "../../offers/components/OfferCard";
import OfferModal from "../../offers/components/OfferModal";
import SEO from "../../../shared/components/SEO/SEO";

const resolveVariantPrice = (product, selectedVariant) => {
  const basePrice = Number(product?.price) || 0;
  if (!selectedVariant || !product?.variants?.prices) return basePrice;

  const entries =
    product.variants.prices instanceof Map
      ? Array.from(product.variants.prices.entries())
      : Object.entries(product.variants.prices || {});
  const dynamicKey = getVariantSignature(selectedVariant || {});
  if (dynamicKey) {
    const direct = entries.find(([key]) => String(key).trim() === dynamicKey);
    if (direct) {
      const parsed = Number(direct[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    const normalized = entries.find(
      ([key]) => String(key).trim().toLowerCase() === dynamicKey.toLowerCase(),
    );
    if (normalized) {
      const parsed = Number(normalized[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }

  const size = String(selectedVariant.size || "")
    .trim()
    .toLowerCase();
  const color = String(selectedVariant.color || "")
    .trim()
    .toLowerCase();

  const candidates = [
    `${size}|${color}`,
    `${size}-${color}`,
    `${size}_${color}`,
    `${size}:${color}`,
    size && !color ? size : null,
    color && !size ? color : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const exact = entries.find(([key]) => String(key).trim() === candidate);
    if (exact) {
      const parsed = Number(exact[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    const normalized = entries.find(
      ([key]) => String(key).trim().toLowerCase() === candidate,
    );
    if (normalized) {
      const parsed = Number(normalized[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }

  return basePrice;
};

const isMongoId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || ""));
const normalizeProduct = (raw) => {
  if (!raw) return null;

  const vendorObj =
    raw?.vendor && typeof raw.vendor === "object"
      ? raw.vendor
      : raw?.vendorId && typeof raw.vendorId === "object"
        ? raw.vendorId
        : null;
  const brandObj =
    raw?.brand && typeof raw.brand === "object"
      ? raw.brand
      : raw?.brandId && typeof raw.brandId === "object"
        ? raw.brandId
        : null;
  const categoryObj =
    raw?.category && typeof raw.category === "object"
      ? raw.category
      : raw?.categoryId && typeof raw.categoryId === "object"
        ? raw.categoryId
        : null;

  const id = String(raw?.id || raw?._id || "").trim();
  if (!id) return null;

  const vendorId = String(
    vendorObj?._id || vendorObj?.id || raw?.vendorId || "",
  ).trim();
  const brandId = String(
    brandObj?._id || brandObj?.id || raw?.brandId || "",
  ).trim();
  const categoryId = String(
    categoryObj?._id || categoryObj?.id || raw?.categoryId || "",
  ).trim();
  const image = raw?.image || raw?.images?.[0] || "";
  const images = Array.isArray(raw?.images)
    ? raw.images.filter(Boolean)
    : image
      ? [image]
      : [];

  return {
    ...raw,
    id,
    _id: id,
    vendorId,
    brandId,
    categoryId,
    image,
    images,
    price: Number(raw?.price) || 0,
    originalPrice:
      raw?.originalPrice !== undefined && raw?.originalPrice !== null
        ? Number(raw.originalPrice)
        : undefined,
    rating: Number(raw?.rating) || 0,
    reviewCount: Number(raw?.reviewCount) || 0,
    stockQuantity: Number(raw?.stockQuantity) || 0,
    vendorName:
      raw?.vendorName || vendorObj?.storeName || vendorObj?.name || "",
    brandName: raw?.brandName || brandObj?.name || "",
    categoryName: raw?.categoryName || categoryObj?.name || "",
    vendor: vendorObj
      ? {
          ...vendorObj,
          id: String(vendorObj?.id || vendorObj?._id || vendorId),
        }
      : null,
    brand: brandObj
      ? {
          ...brandObj,
          id: String(brandObj?.id || brandObj?._id || brandId),
        }
      : null,
    stock:
      raw?.stock ||
      (Number(raw?.stockQuantity) > 0 ? "in_stock" : "out_of_stock"),
    description: String(raw?.description || "").trim(),
  };
};

const MobileProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = useSafeBack('/home');

  const passedProduct = useMemo(() => {
    return normalizeProduct(location.state?.product);
  }, [location.state?.product]);

  const localFallbackProduct = useMemo(
    () => passedProduct || normalizeProduct(getProductById(id)),
    [passedProduct, id],
  );
  const [product, setProduct] = useState(localFallbackProduct);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState(!localFallbackProduct);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    if (passedProduct && (!product || String(product.id) !== String(passedProduct.id))) {
      setProduct(passedProduct);
      setIsLoadingProduct(false);
    }
  }, [passedProduct]);

  const [selectedOffer, setSelectedOffer] = useState(null);
  // Get active offers for this specific product
  const { offers: productOffers } = useOffers({ productId: product?.id, categoryId: product?.categoryId });

  const { isBusiness: rawIsBusiness, getWholesaleSpecs, getWholesalePriceForQty } =
    useBusinessBuyer();
  
  const isBusiness = useMemo(() => {
    if (!product) return rawIsBusiness;
    const channel = product.salesChannel || (product.b2bEnabled ? "BOTH" : "B2C");
    if (channel === 'B2C') return false;
    if (channel === 'B2B') return true;
    return rawIsBusiness;
  }, [product, rawIsBusiness]);
  
  const { rules: loyaltyConfig, fetchConfig } = useLoyaltyStore();

  useEffect(() => {
    fetchConfig();
  }, []);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isStockRequestModalOpen, setIsStockRequestModalOpen] = useState(false);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);

  // Smart Delivery State Hooks
  const [pincode, setPincode] = useState("");
  const [estDelivery, setEstDelivery] = useState(null);
  const [checkedPincode, setCheckedPincode] = useState(false);

  const handleCheckDelivery = (e) => {
    e.preventDefault();
    if (!pincode.trim() || pincode.trim().length < 5) {
      toast.error("Please enter a valid postal code");
      return;
    }
    // Simulate lookup: Super Electro is vendor 400001, otherwise Noida 201301. Pincodes match if first 3 digits match Crawford Mumbai.
    const vendorZip = product?.vendorId === "SEL-301" || product?.id % 2 === 0 ? "400001" : "201301";
    const info = estimateDeliveryETA(vendorZip, pincode, isBusiness);
    setEstDelivery(info);
    setCheckedPincode(true);
    toast.success("Delivery SLA updated for your location!");
  };

  useEffect(() => {
    if (product?.id && isBusiness) {
      const specs = getWholesaleSpecs(product.id, product.price);
      setQuantity(specs.moq);
    } else {
      setQuantity(1);
    }
  }, [product?.id, isBusiness]);

  const { items, addItem, removeItem } = useCartStore();
  const triggerCartAnimation = useUIStore(
    (state) => state.triggerCartAnimation,
  );
  const {
    addItem: addToWishlist,
    removeItem: removeFromWishlist,
    isInWishlist,
  } = useWishlistStore();
  const { fetchReviews, sortReviews, addReview } = useReviewsStore();
  const { getAllOrders } = useOrderStore();
  const { user, isAuthenticated } = useAuthStore();
  const vendor = useMemo(() => {
    if (!product) return null;
    if (product.vendor?.id) return product.vendor;
    return getVendorById(product.vendorId);
  }, [product]);
  const brand = useMemo(() => {
    if (!product) return null;
    if (product.brand?.id) return product.brand;
    return getBrandById(product.brandId);
  }, [product]);

  const isFavorite = product ? isInWishlist(product.id) : false;
  const selectedVariantSignature = getVariantSignature(selectedVariant || {});
  const isInCart = product
    ? items.some(
        (item) =>
          String(item.id) === String(product.id) &&
          getVariantSignature(item.variant || {}) === selectedVariantSignature,
      )
    : false;
  const productReviews = product ? sortReviews(product.id, "newest") : [];

  useEffect(() => {
    let active = true;
    setIsLoadingProduct(true);

    const loadProductDetail = async () => {
      try {
        const [detailRes, similarRes] = await Promise.allSettled([
          api.get(`/products/${id}`),
          api.get(`/similar/${id}`),
        ]);

        const detailPayload =
          detailRes.status === "fulfilled"
            ? (detailRes.value?.data ?? detailRes.value)
            : null;
        const resolvedProduct =
          normalizeProduct(detailPayload) || localFallbackProduct;

        const similarPayload =
          similarRes.status === "fulfilled"
            ? (similarRes.value?.data ?? similarRes.value)
            : null;
        const resolvedSimilar = Array.isArray(similarPayload)
          ? similarPayload
              .map(normalizeProduct)
              .filter(
                (item) =>
                  item?.id &&
                  String(item.id) !== String(resolvedProduct?.id || ""),
              )
              .slice(0, 5)
          : [];

        if (!active) return;

        setProduct(resolvedProduct);
        if (resolvedSimilar.length > 0) {
          setSimilarProducts(resolvedSimilar);
        } else if (resolvedProduct?.id) {
          setSimilarProducts(getSimilarProducts(resolvedProduct.id, 5));
        } else {
          setSimilarProducts([]);
        }
      } catch {
        if (!active) return;
        setProduct(localFallbackProduct);
        setSimilarProducts(
          localFallbackProduct?.id
            ? getSimilarProducts(localFallbackProduct.id, 5)
            : [],
        );
      } finally {
        if (active) setIsLoadingProduct(false);
      }
    };

    loadProductDetail();
    return () => {
      active = false;
    };
  }, [id, localFallbackProduct]);

  useEffect(() => {
    if (
      product?.variants?.defaultSelection &&
      typeof product.variants.defaultSelection === "object"
    ) {
      setSelectedVariant(product.variants.defaultSelection);
      return;
    }
    if (product?.variants?.defaultVariant) {
      setSelectedVariant(product.variants.defaultVariant);
      return;
    }
    setSelectedVariant({});
  }, [product]);

  useEffect(() => {
    if (product?.id) {
      fetchReviews(product.id, { sort: "newest", limit: 50 });
    }
  }, [product?.id, fetchReviews]);

  const productImages = useMemo(() => {
    if (!product) return [];
    const selectedVariantKey = getVariantSignature(selectedVariant || {});
    const variantImage = String(
      product?.variants?.imageMap?.[selectedVariantKey] ||
        product?.variants?.imageMap?.get?.(selectedVariantKey) ||
        "",
    ).trim();
    const images =
      Array.isArray(product.images) && product.images.length > 0
        ? product.images.filter(Boolean)
        : product.image
          ? [product.image]
          : [];
    if (variantImage) {
      return [variantImage, ...images.filter((img) => img !== variantImage)];
    }
    return images;
  }, [product, selectedVariant]);

  const currentPrice = useMemo(() => {
    return resolveVariantPrice(product, selectedVariant);
  }, [product, selectedVariant]);

  const activePrice = useMemo(() => {
    if (isBusiness && product?.id) {
      return getWholesalePriceForQty(product.id, currentPrice, quantity);
    }
    return currentPrice;
  }, [product?.id, currentPrice, quantity, isBusiness]);

  const selectedAvailableStock = useMemo(() => {
    const variantKey = getVariantSignature(selectedVariant || {});
    const variantStockValue = Number(
      product?.variants?.stockMap?.[variantKey] ??
        product?.variants?.stockMap?.get?.(variantKey),
    );
    if (Number.isFinite(variantStockValue)) {
      return Math.max(0, variantStockValue);
    }
    return Number(product?.stockQuantity || 0);
  }, [product, selectedVariant]);

  const productFaqs = useMemo(() => {
    if (!Array.isArray(product?.faqs)) return [];
    return product.faqs
      .map((faq) => ({
        question: String(faq?.question || "").trim(),
        answer: String(faq?.answer || "").trim(),
      }))
      .filter((faq) => faq.question && faq.answer);
  }, [product?.faqs]);

  const eligibleDeliveredOrderId = useMemo(() => {
    if (!isAuthenticated || !user?.id || !isMongoId(product?.id)) return null;
    const userOrders = getAllOrders(user.id) || [];
    const eligibleOrder = userOrders.find((order) => {
      if (String(order?.status || "").toLowerCase() !== "delivered")
        return false;
      const items = Array.isArray(order?.items) ? order.items : [];
      return items.some(
        (item) =>
          String(item?.productId || item?.id || "") === String(product.id),
      );
    });
    return eligibleOrder?._id || null;
  }, [isAuthenticated, user?.id, product?.id, getAllOrders]);

  if (!product) {
    return (
      <PageTransition>
        <MobileLayout showHeader={false} showBottomNav={false} showCartBar={false}>
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="text-center">
              {isLoadingProduct ? (
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Loading product...
                </h2>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">
                    Product Not Found
                  </h2>
                  <button
                    onClick={() => navigate("/home")}
                    className="bg-[#7B0A0A] hover:bg-[#AE020B] text-white px-6 py-3 rounded-xl font-semibold hover:shadow-glow"
                  >
                    Go Back Home
                  </button>
                </>
              )}
            </div>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  const handleEnquiryClick = () => {
    if (!isAuthenticated) {
      toast.error("Please sign in or create an account to send inquiries.");
      return;
    }
    setIsEnquiryModalOpen(true);
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (!isAuthenticated) {
      toast.error("Please sign in or create an account to purchase items.");
      return;
    }
    if (product.stock === "out_of_stock") {
      toast.error("Product is out of stock");
      return;
    }

    // Verify if product has variants and user has selected one
    const hasVariants = 
      (Array.isArray(product?.variants?.sizes) && product.variants.sizes.length > 0) ||
      (Array.isArray(product?.variants?.colors) && product.variants.colors.length > 0) ||
      (Array.isArray(product?.variants?.attributes) && product.variants.attributes.length > 0);

    if (hasVariants && (!selectedVariant || Object.keys(selectedVariant).length === 0)) {
      toast.error("Please select a variant option (size, color, etc.) first!");
      return;
    }

    const attributeAxes = Array.isArray(product?.variants?.attributes)
      ? product.variants.attributes.filter(
          (attr) => Array.isArray(attr?.values) && attr.values.length > 0,
        )
      : [];
    const hasDynamicAxes = attributeAxes.length > 0;
    const hasSizeVariants =
      Array.isArray(product?.variants?.sizes) &&
      product.variants.sizes.length > 0;
    const hasColorVariants =
      Array.isArray(product?.variants?.colors) &&
      product.variants.colors.length > 0;
    const isMissingDynamicAxis = hasDynamicAxes
      ? attributeAxes.some(
          (attr) =>
            !String(
              selectedVariant?.[attr.name] ||
                selectedVariant?.[
                  String(attr.name || "")
                    .toLowerCase()
                    .replace(/\s+/g, "_")
                ] ||
                "",
            ).trim(),
        )
      : false;
    const selectedSize = String(selectedVariant?.size || "").trim();
    const selectedColor = String(selectedVariant?.color || "").trim();
    if (
      isMissingDynamicAxis ||
      (hasSizeVariants && !selectedSize) ||
      (hasColorVariants && !selectedColor)
    ) {
      toast.error("Please select required variant options");
      return;
    }

    const finalPrice = isBusiness
      ? getWholesalePriceForQty(
          product.id,
          resolveVariantPrice(product, selectedVariant),
          quantity,
        )
      : resolveVariantPrice(product, selectedVariant);
    const variantKey = getVariantSignature(selectedVariant || {});
    const variantStockValue = Number(
      product?.variants?.stockMap?.[variantKey] ??
        product?.variants?.stockMap?.get?.(variantKey),
    );
    const effectiveStock = Number.isFinite(variantStockValue)
      ? variantStockValue
      : Number(product.stockQuantity || 0);
    if (effectiveStock <= 0) {
      toast.error("Selected variant is out of stock");
      return;
    }
    if (quantity > effectiveStock) {
      toast.error(
        `Only ${effectiveStock} item(s) available for selected variant`,
      );
      return;
    }

    const addedToCart = addItem({
      id: product.id,
      name: product.name,
      price: finalPrice,
      image: product.image,
      quantity: quantity,
      variant: selectedVariant,
      stockQuantity: effectiveStock,
      vendorId: product.vendorId,
      vendorName: vendor?.storeName || vendor?.name || product.vendorName,
    });
    if (!addedToCart) return;
    triggerCartAnimation();
    toast.success("Added to cart!");
  };

  const handleRemoveFromCart = () => {
    if (!product) return;
    removeItem(product.id, selectedVariant || {});
    toast.success("Removed from cart!");
  };

  const handleFavorite = () => {
    if (!product) return;
    if (!isAuthenticated) {
      toast.error("Please sign in or create an account to use the wishlist.");
      return;
    }
    if (isFavorite) {
      removeFromWishlist(product.id);
      toast.success("Removed from wishlist");
    } else {
      const addedToWishlist = addToWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
      });
      if (addedToWishlist) {
        toast.success("Added to wishlist");
      }
    }
  };

  const handleQuantityChange = (change) => {
    const newQuantity = quantity + change;
    const variantKey = getVariantSignature(selectedVariant || {});
    const variantStockValue = Number(
      product?.variants?.stockMap?.[variantKey] ??
        product?.variants?.stockMap?.get?.(variantKey),
    );
    const maxStock = Number.isFinite(variantStockValue)
      ? Math.max(0, variantStockValue)
      : Number(product?.stockQuantity || 0);
    if (newQuantity >= 1 && newQuantity <= (maxStock || 10)) {
      setQuantity(newQuantity);
    }
  };

  const handleSubmitReview = async (reviewData) => {
    if (!eligibleDeliveredOrderId) {
      toast.error("You can review only after this product is delivered");
      return false;
    }

    const ok = await addReview(product.id, {
      ...reviewData,
      orderId: eligibleDeliveredOrderId,
    });
    if (!ok) {
      toast.error("Unable to submit review");
      return false;
    }

    await fetchReviews(product.id, { sort: "newest", limit: 50 });
    return true;
  };

  const productSchema = useMemo(() => {
    if (!product) return null;
    const origin = window.location.origin;
    const prodUrl = window.location.href;

    const brandName = product.brandName || product.brand?.name || "PLE";
    const categoryName = product.categoryName || product.category?.name || "Products";
    
    return [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "image": productImages.map(img => img.startsWith('http') ? img : `${origin}${img}`),
        "description": product.description || `Buy ${product.name} online at Peoples League of Electronics.`,
        "sku": product.sku || product.id || product._id,
        "brand": {
          "@type": "Brand",
          "name": brandName
        },
        "offers": {
          "@type": "Offer",
          "url": prodUrl,
          "priceCurrency": "INR",
          "price": currentPrice,
          "availability": selectedAvailableStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "itemCondition": product.isRefurbished ? "https://schema.org/RefurbishedCondition" : "https://schema.org/NewCondition"
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": origin
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": categoryName,
            "item": `${origin}/category/${product.categoryId}`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": product.name,
            "item": prodUrl
          }
        ]
      }
    ];
  }, [product, productImages, currentPrice, selectedAvailableStock]);

  return (
    <>
      {product && (
        <SEO
          title={product.name}
          description={product.description || `Buy ${product.name} online. Details: ${product.description}`}
          image={productImages[0]}
          type="product"
          schema={productSchema}
        />
      )}
      <PageTransition>
      <MobileLayout showHeader={false} showBottomNav={false} showCartBar={true}>
        <div className="w-full pb-24 lg:pb-12 max-w-7xl mx-auto">
          {/* Back Button */}
          <div className="px-4 pt-2 lg:pt-8 lg:px-8 mb-2">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors group"
            >
              <div className="p-2 rounded-full group-hover:bg-gray-100 transition-colors">
                <FiArrowLeft className="text-xl" />
              </div>
              <span className="font-medium">Back</span>
            </button>
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-16 lg:px-8 lg:items-start">
            {/* Left Column: Product Image */}
            <div className="px-4 py-2 lg:p-0 relative lg:sticky lg:top-24 mb-6 lg:mb-0">
              <div className="relative group">
                <ImageGallery
                  images={productImages}
                  productName={product.name}
                />
                
                {/* Floating Wishlist and Share buttons */}
                <div className="absolute top-4 right-4 flex flex-col gap-2.5 z-30">
                  <button
                    onClick={handleFavorite}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 border ${
                      isFavorite
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "bg-white/90 backdrop-blur-xs text-gray-700 border-gray-200 hover:bg-white"
                    }`}
                    title={isFavorite ? "Remove from Wishlist" : "Add to Wishlist"}
                  >
                    <FiHeart className={`text-lg ${isFavorite ? "fill-red-600" : ""}`} />
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: product.name,
                          text: `Check out ${product.name}`,
                          url: window.location.href,
                        });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Link copied to clipboard");
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-xs text-gray-700 border border-gray-200 flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 hover:bg-white"
                    title="Share Product"
                  >
                    <FiShare2 className="text-lg" />
                  </button>
                </div>
              </div>
              {product.flashSale && (
                <div className="mt-3 flex justify-center lg:justify-start">
                  <Badge variant="flash" size="lg">
                    Flash Sale - Limited Time Offer
                  </Badge>
                </div>
              )}
            </div>

            {/* Right Column: Product Info */}
            <div className="px-4 py-4 lg:p-0">
              <div className="flex flex-col gap-6">
                <div>
                  {/* Vendor Badge */}
                  {vendor && (
                    <div className="mb-4">
                      <Link
                        to={`/seller/${vendor.id}`}
                        className="inline-flex items-center gap-3 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full transition-all duration-300 border border-gray-200 group"
                      >
                        {vendor.storeLogo ? (
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                            <img
                              src={vendor.storeLogo}
                              alt={vendor.storeName || vendor.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                            <FiShoppingBag className="text-white text-xs" />
                          </div>
                        )}
                        <span className="font-medium text-sm group-hover:text-primary-600 transition-colors">
                          {vendor.storeName || vendor.name}
                        </span>
                        {vendor.isVerified && (
                          <FiCheckCircle
                            className="text-accent-500 text-sm"
                            title="Verified Vendor"
                          />
                        )}
                        <span className="text-gray-400 group-hover:translate-x-1 transition-transform">
                          {"->"}
                        </span>
                      </Link>
                    </div>
                  )}
                  {brand && (
                    <div className="mb-4">
                      <Link
                        to={`/brand/${brand.id}`}
                        className="inline-flex items-center gap-3 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full transition-all duration-300 border border-gray-200 group"
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                          <img
                            src={brand.logo}
                            alt={brand.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                        <span className="font-medium text-sm group-hover:text-primary-600 transition-colors">
                          {brand.name}
                        </span>
                        <span className="text-gray-400 group-hover:translate-x-1 transition-transform">
                          {"->"}
                        </span>
                      </Link>
                    </div>
                  )}

                  {product.condition && product.condition !== "brand_new" && (
                    <div className="mb-4">
                      <Badge
                        variant={
                          product.condition === "open_box"
                            ? "open-box"
                            : product.condition
                        }
                        className="inline-block text-xs uppercase font-extrabold tracking-wider px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        Certified {product.condition.replace("_", " ")}
                      </Badge>
                    </div>
                  )}

                  <h1 className="text-2xl lg:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
                    {product.name}
                  </h1>

                  {/* Rating & Reviews */}
                  {!!product.rating && (
                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                        <span className="font-bold text-yellow-700">
                          {product.rating}
                        </span>
                        <FiStar className="text-yellow-500 fill-yellow-500" />
                      </div>
                      <span className="text-gray-500 text-sm font-medium hover:text-gray-700 cursor-pointer">
                        {product.reviewCount || 0} Reviews
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="text-green-600 text-sm font-medium bg-green-50 px-2 py-1 rounded-lg">
                        {product.stock === "in_stock"
                          ? "In Stock"
                          : product.stock === "low_stock"
                            ? "Low Stock"
                            : "Out of Stock"}
                      </span>
                    </div>
                  )}

                  {/* Price */}
                  <div className="bg-gray-50 rounded-2xl p-6 mb-6 border border-gray-100">
                    <div className="flex items-end gap-3 mb-2">
                      <span className="text-4xl font-extrabold text-gray-900">
                        {formatPrice(activePrice)}
                      </span>
                      {(product.originalPrice ||
                        (isBusiness && currentPrice !== activePrice)) && (
                        <span className="text-xl text-gray-400 line-through font-medium mb-1.5">
                          {formatPrice(
                            isBusiness ? currentPrice : product.originalPrice,
                          )}
                        </span>
                      )}
                    </div>
                    {isBusiness ? (
                      <div className="flex items-center gap-2">
                        <span className="text-primary-700 font-bold bg-primary-100 px-3 py-1 rounded-full text-sm">
                          Wholesale Price
                        </span>
                        <span className="text-sm text-gray-500 font-medium">
                          (Saved{" "}
                          {Math.round(
                            ((currentPrice - activePrice) / currentPrice) * 100,
                          )}
                          % based on quantity)
                        </span>
                      </div>
                    ) : (
                      product.originalPrice && (
                        <div className="flex items-center gap-2">
                          <span className="text-accent-600 font-bold bg-accent-50 px-3 py-1 rounded-full text-sm">
                            {Math.round(
                              ((product.originalPrice - currentPrice) /
                                product.originalPrice) *
                                100,
                            )}
                            % OFF
                          </span>
                          <span className="text-sm text-gray-500">
                            Best price guaranteed
                          </span>
                        </div>
                      )
                    )}
                    
                    {/* Loyalty Points Earn Message */}
                    {!isBusiness && loyaltyConfig?.enabled && (
                      <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center gap-2 text-xs font-semibold text-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>
                          Buy this product & earn{" "}
                          <strong className="font-extrabold text-emerald-700">
                            {Math.floor((activePrice / (loyaltyConfig.purchaseAmountUnit || 100)) * (loyaltyConfig.purchaseToPointsRatio || 5))}
                          </strong>{" "}
                          Loyalty Points
                        </span>
                      </div>
                    )}
                  </div>

                  {/* B2B Stock Availability */}
                  {isBusiness && (
                    <B2BStockAvailability
                      product={product}
                      stockQuantity={selectedAvailableStock}
                    />
                  )}

                  {/* Notify Me for Out of Stock */}
                  {product.stock === "out_of_stock" && isBusiness && (
                    <B2BNotifyMe product={product} isBusiness={isBusiness} />
                  )}

                  {/* Condition Details Dashboard */}
                  {product.condition && product.condition !== "brand_new" && (
                    <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100 shadow-sm space-y-6">
                      <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></span>
                        Product Condition & Inspection Report
                      </h3>

                      {/* 3-Column Metrics */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <span className="block text-xs text-gray-500 font-medium mb-1">
                            Cosmetic Grade
                          </span>
                          <span className="text-lg font-black text-gray-800 uppercase bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200">
                            Grade {product.refurbishedGrade}
                          </span>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <span className="block text-xs text-gray-500 font-medium mb-1">
                            Warranty
                          </span>
                          <span className="text-sm font-bold text-gray-850">
                            {product.refurbishedWarrantyDuration || "3 Months"}
                          </span>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <span className="block text-xs text-gray-500 font-medium mb-1">
                            Prior Usage
                          </span>
                          <span className="text-sm font-bold text-gray-850">
                            {product.refurbishedUsedDuration || "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Battery Health Slider (if applicable) */}
                      {product.refurbishedBatteryHealth && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold text-gray-750">
                            <span>Battery Capacity Health</span>
                            <span className="text-cyan-600">
                              {product.refurbishedBatteryHealth}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                              style={{
                                width: `${product.refurbishedBatteryHealth}%`,
                              }}
                            />
                          </div>
                          <span className="block text-[10px] text-gray-400 font-medium">
                            Battery capacity is guaranteed to exceed 80% of
                            original brand-new specification.
                          </span>
                        </div>
                      )}

                      {/* Quality Checklist */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-gray-750 uppercase tracking-wider">
                          Quality Vetting & Testing Checks
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <span className="text-green-500 text-sm">✓</span>
                            <span>
                              {product.refurbishedTestingPassed
                                ? "Diagnostic Testing Passed"
                                : "Fully Functional"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <span className="text-green-500 text-sm">✓</span>
                            <span>Sanitized & Cleaned</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <span className="text-green-500 text-sm">✓</span>
                            <span>
                              {product.refurbishedCertified
                                ? "Certified Refurbished Seals"
                                : "Quality Inspected"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-700">
                            <span className="text-green-500 text-sm">✓</span>
                            <span>Accessories Included</span>
                          </div>
                        </div>
                      </div>

                      {/* Included Accessories */}
                      {product.refurbishedAccessories &&
                        product.refurbishedAccessories.length > 0 && (
                          <div className="bg-cyan-50/50 dark:bg-cyan-950/10 rounded-xl p-3 border border-cyan-100/50">
                            <span className="block text-xs font-bold text-cyan-800 dark:text-cyan-300 mb-1">
                              Included Accessories:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {product.refurbishedAccessories.map(
                                (acc, idx) => (
                                  <span
                                    key={idx}
                                    className="bg-white dark:bg-gray-800 text-[10px] text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded shadow-sm border border-cyan-100/50"
                                  >
                                    {acc}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Cosmetic Damage Notes */}
                      {product.refurbishedCosmeticNotes && (
                        <div className="bg-orange-50/50 dark:bg-orange-950/10 rounded-xl p-3 border border-orange-100/50 text-xs text-gray-750 leading-relaxed">
                          <span className="block font-bold text-orange-800 dark:text-orange-300 mb-1">
                            Cosmetic Assessment Notes:
                          </span>
                          <p className="text-gray-600 dark:text-gray-400">
                            {product.refurbishedCosmeticNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Variants & Quantity */}
                <div className="space-y-6 border-b border-gray-100 pb-8">
                  {product.variants && (
                    <VariantSelector
                      variants={product.variants}
                      onVariantChange={setSelectedVariant}
                      currentPrice={product.price}
                    />
                  )}

                  {isBusiness ? (
                    <B2BBulkQuantitySelector
                      product={product}
                      quantity={quantity}
                      onChange={setQuantity}
                    />
                  ) : (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-3">
                        Quantity
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200">
                          <button
                            onClick={() => handleQuantityChange(-1)}
                            disabled={quantity <= 1}
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:shadow-md disabled:shadow-none disabled:bg-transparent disabled:opacity-50 transition-all text-gray-700"
                          >
                            <FiMinus />
                          </button>
                          <span className="w-12 text-center font-bold text-gray-900 text-lg">
                            {quantity}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(1)}
                            disabled={
                              quantity >= (selectedAvailableStock || 10)
                            }
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:shadow-md disabled:shadow-none disabled:bg-transparent disabled:opacity-50 transition-all text-gray-700"
                          >
                            <FiPlus />
                          </button>
                        </div>
                        <span className="text-sm text-gray-500">
                          {selectedAvailableStock} {product.unit}s available
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Smart Delivery Estimation Widget */}
                <div className="bg-gray-50 border border-gray-150 rounded-2xl p-5 mb-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                      <span>🚚 Logistics Speed Check</span>
                    </h4>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Dynamic SLA Tracking</span>
                  </div>
                  
                  <form onSubmit={handleCheckDelivery} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter Delivery Pincode (e.g. 400001)"
                      className="flex-1 bg-white border border-gray-250 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                    >
                      Check Speed
                    </button>
                  </form>

                  {checkedPincode && estDelivery ? (
                    <div className="bg-white rounded-xl p-3 border border-gray-100/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-gray-400 font-medium">Estimated Handover Time:</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${estDelivery.badgeColor}`}>
                          {estDelivery.badgeText}
                        </span>
                      </div>
                      <div className="text-gray-700 font-semibold flex items-center gap-1">
                        <span>ETA:</span>
                        <span className="text-primary-600 font-extrabold">{estDelivery.displayETA}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-normal">
                        {estDelivery.type === "express" 
                          ? "⚡ Same-City express guarantees local dispatch inside 2 hours and doorstep delivery within selected ETA window."
                          : estDelivery.type === "bulk"
                          ? "📦 Heavy freight cargo handling. High-volume pallet security dispatch with priority courier routing."
                          : "🚚 Standard nationwide express delivery. Fully tracked regional corridor logistics."}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10.5px] text-gray-400 font-medium">
                      Enter your zipcode to verify Same-City Express eligibility (8–16 Hours) or regional courier durations.
                    </p>
                  )}
                </div>

                {/* Available Offers Section */}
                {productOffers && productOffers.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                        <span>🏷️ Available Offers</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setSelectedOffer(productOffers[0])}
                        className="text-xs text-primary-600 hover:text-primary-800 font-bold hover:underline"
                      >
                        View All Offers
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {productOffers.slice(0, 2).map((offer) => (
                        <OfferCard
                          key={offer.id}
                          offer={offer}
                          onViewDetails={setSelectedOffer}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {/* DESKTOP ACTIONS */}
                <div className="hidden lg:grid grid-cols-6 gap-4 py-4">
                  {isBusiness ? (
                    <>
                      <button
                        onClick={handleAddToCart}
                        disabled={product.stock === "out_of_stock"}
                        className={`col-span-6 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                          product.stock === "out_of_stock"
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                            : "bg-gradient-to-r from-[#9B1C1C] via-[#7B0A0A] to-[#4C0505] text-white hover:opacity-90 hover:shadow-glow hover:-translate-y-0.5"
                        }`}
                      >
                        <FiShoppingBag className="text-xl" />
                        <span>Add Bulk to Cart</span>
                      </button>
                    </>
                  ) : isInCart ? (
                    <button
                      onClick={handleRemoveFromCart}
                      className="col-span-4 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                    >
                      <FiTrash2 className="text-xl" />
                      <span>Remove from Cart</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleAddToCart}
                      disabled={product.stock === "out_of_stock"}
                      className={`col-span-4 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                        product.stock === "out_of_stock"
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                          : "bg-gradient-to-r from-[#9B1C1C] via-[#7B0A0A] to-[#4C0505] text-white hover:opacity-90 hover:shadow-glow hover:-translate-y-0.5"
                      }`}
                    >
                      <FiShoppingBag className="text-xl" />
                      <span>
                        {product.stock === "out_of_stock"
                          ? "Out of Stock"
                          : "Add to Cart"}
                      </span>
                    </button>
                  )}

                  <div className="col-span-6 flex gap-4 mt-2">
                    {rawIsBusiness && (
                      <>
                        <button
                          onClick={handleEnquiryClick}
                          className="flex-1 py-4 bg-[#7B0A0A]/5 text-[#7B0A0A] hover:bg-[#7B0A0A]/10 border-2 border-[#7B0A0A]/20 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                        >
                          <FiFileText className="text-lg shrink-0" />
                          <span className="truncate">Enquire Now</span>
                        </button>
                        <button
                          onClick={() => setIsQuoteModalOpen(true)}
                          className="flex-1 py-4 bg-[#7B0A0A] text-white hover:bg-[#AE020B] rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm text-sm"
                        >
                          <FiFileText className="text-lg shrink-0" />
                          <span className="truncate">Request RFQ</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleFavorite}
                      className={rawIsBusiness
                        ? `w-14 h-14 shrink-0 rounded-xl transition-all duration-300 border-2 flex items-center justify-center ${
                            isFavorite
                              ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"
                              : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`
                        : `flex-1 py-4 rounded-xl font-semibold transition-all duration-300 border-2 flex items-center justify-center ${
                            isFavorite
                              ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100"
                              : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`
                      }
                    >
                      <FiHeart
                        className={`text-2xl ${isFavorite ? "fill-current" : ""}`}
                      />
                      {!rawIsBusiness && <span className="ml-2">Wishlist</span>}
                    </button>

                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: product.name,
                            text: `Check out ${product.name}`,
                            url: window.location.href,
                          });
                        } else {
                          navigator.clipboard.writeText(window.location.href);
                          toast.success("Link copied to clipboard");
                        }
                      }}
                      className={rawIsBusiness
                        ? "w-14 h-14 shrink-0 bg-white text-gray-700 border-2 border-gray-200 rounded-xl transition-all duration-300 hover:border-gray-300 hover:bg-gray-50 flex items-center justify-center"
                        : "flex-1 py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-xl font-semibold transition-all duration-300 hover:border-gray-300 hover:bg-gray-50 flex items-center justify-center"
                      }
                    >
                      <FiShare2 className="text-2xl" />
                      {!rawIsBusiness && <span className="ml-2">Share</span>}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Product Description
                  </h3>
                  <div className="prose prose-sm lg:prose-base text-gray-600 leading-relaxed bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    {product.description ? (
                      <p>{product.description}</p>
                    ) : (
                      <p>
                        High-quality {product.name.toLowerCase()} available in{" "}
                        {product.unit.toLowerCase()}. This product is carefully
                        selected to ensure the best quality and freshness.
                      </p>
                    )}
                  </div>
                </div>

                {/* B2B Technical Specs */}
                <B2BProductDetailSections product={product} />

                {/* FAQs */}
                {productFaqs.length > 0 && (
                  <div className="pt-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Product FAQs
                    </h3>
                    <div className="space-y-3">
                      {productFaqs.map((faq, index) => (
                        <div
                          key={`${faq.question}-${index}`}
                          className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
                        >
                          <p className="text-sm font-bold text-gray-800 mb-2">
                            {faq.question}
                          </p>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Write Review */}
                {isAuthenticated && isMongoId(product?.id) && (
                  <div className="pt-6">
                    {eligibleDeliveredOrderId ? (
                      <ReviewForm
                        productId={product.id}
                        onSubmit={handleSubmitReview}
                      />
                    ) : (
                      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-600">
                        Reviews are available after product delivery.
                      </div>
                    )}
                  </div>
                )}

                {/* Reviews List */}
                {productReviews.length > 0 && (
                  <div className="pt-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Product Reviews ({productReviews.length})
                    </h3>
                    <div className="space-y-4">
                      {productReviews.slice(0, 3).map((review) => (
                        <div
                          key={review.id}
                          className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-extrabold text-gray-700 border border-gray-200">
                                {review.user.charAt(0)}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-gray-900">
                                    {review.user}
                                  </span>
                                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                    review.reviewerType === 'B2B'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                      : 'bg-green-50 text-green-700 border border-green-100'
                                  }`}>
                                    {review.reviewerType === 'B2B' ? 'Business Buyer Review' : 'Customer Review'}
                                  </span>
                                </div>
                                {review.reviewerType === 'B2B' && review.companyName && (
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-xs font-semibold text-gray-600">
                                      🏢 {review.companyName}
                                    </span>
                                    {review.verificationStatus === 'Approved' && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.25 rounded">
                                        ✓ Verified Business
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className="text-[11px] text-gray-450 mt-1 font-medium">
                                  {new Date(review.date || review.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-100/60 px-2.5 py-1 rounded-lg">
                              <span className="font-extrabold text-xs text-yellow-800">
                                {review.rating}
                              </span>
                              <FiStar className="text-yellow-500 fill-yellow-500 text-xs" />
                            </div>
                          </div>
                          <p className="text-sm text-gray-750 leading-relaxed pl-12 font-normal">
                            {review.comment}
                          </p>
                          {review.vendorResponse && (
                            <div className="mt-3 ml-12 bg-primary-50/50 border border-primary-100/60 rounded-xl p-3.5">
                              <p className="text-xs font-bold text-primary-800 mb-1">
                                Vendor Response
                              </p>
                              <p className="text-sm text-primary-900/90 leading-relaxed">
                                {review.vendorResponse}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Similar Products */}
          {similarProducts.length > 0 && (
            <div className="px-4 py-8 lg:px-8 mt-8 lg:mt-16 border-t border-gray-200">
              <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-6">
                You May Also Like
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {similarProducts.map((similarProduct) => (
                  <ProductCard
                    key={similarProduct.id}
                    product={similarProduct}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

      </MobileLayout>
      </PageTransition>

      {/* Sticky Bottom Action Bar (Mobile Only) */}
      {/* Mobile Bottom Sticky Action Bar */}
      <div data-bottom-sticky-bar className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-[9999] safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-2.5 w-full">
          {rawIsBusiness && (
            <>
              <button
                onClick={handleEnquiryClick}
                className="h-12 w-12 shrink-0 bg-[#7B0A0A]/5 text-[#7B0A0A] border border-[#7B0A0A]/20 rounded-xl font-semibold flex items-center justify-center transition-all duration-300 active:scale-95"
                title="Enquire Now"
              >
                <FiFileText className="text-xl" />
              </button>
              <button
                onClick={() => setIsQuoteModalOpen(true)}
                className="flex-1 h-12 bg-[#7B0A0A] text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1.5 transition-all duration-300 active:scale-95 shadow-sm"
                title="Request RFQ"
              >
                <FiFileText className="text-lg" />
                <span>Request RFQ</span>
              </button>
            </>
          )}
          {isBusiness ? (
            <button
              onClick={handleAddToCart}
              disabled={product.stock === "out_of_stock"}
              className={`flex-1 h-12 rounded-xl font-bold text-xs uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 ${
                product.stock === "out_of_stock"
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#9B1C1C] via-[#7B0A0A] to-[#4C0505] text-white hover:opacity-90 hover:shadow-glow"
              }`}
            >
              <FiShoppingBag className="text-lg" />
              <span>Add Bulk</span>
            </button>
          ) : isInCart ? (
            <button
              onClick={handleRemoveFromCart}
              className="flex-1 h-12 rounded-xl font-bold text-xs uppercase transition-all duration-300 flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-100 active:scale-95"
            >
              <FiTrash2 className="text-lg" />
              <span>Remove</span>
            </button>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={product.stock === "out_of_stock"}
              className={`flex-1 h-12 rounded-xl font-bold text-xs uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 ${
                product.stock === "out_of_stock"
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#9B1C1C] via-[#7B0A0A] to-[#4C0505] text-white hover:opacity-90 hover:shadow-glow"
              }`}
            >
              <FiShoppingBag className="text-lg" />
              <span>
                {product.stock === "out_of_stock"
                  ? "Out of Stock"
                  : "Add to Cart"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* B2B Quotation (RFQ) Modal */}
      {product && (
        <B2BRequestQuoteModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          product={product}
        />
      )}
      {/* Product Enquiry Modal */}
      {product && (
        <ProductEnquiryModal
          isOpen={isEnquiryModalOpen}
          onClose={() => setIsEnquiryModalOpen(false)}
          product={product}
        />
      )}
      {/* Offer Details Modal */}
      <OfferModal
        isOpen={!!selectedOffer}
        onClose={() => setSelectedOffer(null)}
        offer={selectedOffer}
      />
    </>
  );
};

export default MobileProductDetail;
