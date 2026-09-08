import React, { useState, useRef, useMemo, memo } from "react";
import { FiHeart, FiShoppingBag, FiStar, FiTrash2, FiArrowRight } from "react-icons/fi";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore, useUIStore } from "../store/useStore";
import { useWishlistStore } from "../store/wishlistStore";
import { formatPrice, getPlaceholderImage } from "../utils/helpers";
import toast from "react-hot-toast";
import LazyImage from "./LazyImage";
import Badge from "./Badge";
import useLongPress from "../../modules/UserApp/hooks/useLongPress";
import LongPressMenu from "../../modules/UserApp/components/Mobile/LongPressMenu";
import FlyingItem from "../../modules/UserApp/components/Mobile/FlyingItem";
import { getVariantSignature } from "../utils/variant";
import { useBusinessBuyer } from "../../modules/UserApp/hooks/useBusinessBuyer";
import { B2BProductCardOverlay } from "../../modules/UserApp/components/B2B/B2BProductCardOverlay";
import { estimateDeliveryETA } from "../data/deliveryMockData";

// Offers System Imports
import { offerMockService } from "../../modules/offers/services/offerMockService";
import OfferBadge from "../../modules/offers/components/OfferBadge";

const ProductCard = memo(({ product, hideRating = false, isFlashSale = false, showCondition = false }) => {
  const navigate = useNavigate();
  const { isBusiness } = useBusinessBuyer();
  const productLink = `/product/${product?.id}`;

  // Selective store subscriptions to prevent re-rendering all cards when one cart/wishlist item changes
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const isInCart = useCartStore((state) =>
    state.items.some(
      (item) => String(item.id) === String(product?.id) && !getVariantSignature(item?.variant || {})
    )
  );

  const triggerCartAnimation = useUIStore((state) => state.triggerCartAnimation);

  const addToWishlist = useWishlistStore((state) => state.addItem);
  const removeFromWishlist = useWishlistStore((state) => state.removeItem);
  const isFavorite = useWishlistStore((state) =>
    state.items.some((item) => String(item.id) === String(product?.id))
  );

  const [isAdding, setIsAdding] = useState(false);
  const [showLongPressMenu, setShowLongPressMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [showFlyingItem, setShowFlyingItem] = useState(false);
  const [flyingItemPos, setFlyingItemPos] = useState({
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
  });
  const buttonRef = useRef(null);

  // Compute logistics metadata with memoization
  const deliveryInfo = useMemo(() => {
    if (!product?.id) return { badgeText: "Standard Delivery", badgeColor: "bg-gray-100 text-gray-700" };
    const isExpressEligible = product.id % 2 === 0 || product.vendorName === "Super Electro Corp";
    return isExpressEligible
      ? estimateDeliveryETA("400001", "400001", isBusiness)
      : estimateDeliveryETA("400001", "110001", isBusiness);
  }, [product?.id, product?.vendorName, isBusiness]);

  // Check for any active matching offer with memoization
  const activeOffer = useMemo(() => {
    if (!product?.id) return null;
    const productOffers = offerMockService.getOffersForProduct(product.id, product.categoryId);
    return productOffers[0] || null;
  }, [product?.id, product?.categoryId]);

  // Instant card navigation when clicking anywhere on the card surface
  const handleCardClick = (e) => {
    if (e.target.closest("button, a, input, select, textarea, [data-interactive='true']")) {
      return;
    }
    navigate(productLink, { state: { product } });
  };

  const handleAddToCart = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const hasDynamicAxes =
      Array.isArray(product?.variants?.attributes) &&
      product.variants.attributes.some((attr) => Array.isArray(attr?.values) && attr.values.length > 0);
    const hasSizeVariants = Array.isArray(product?.variants?.sizes) && product.variants.sizes.length > 0;
    const hasColorVariants = Array.isArray(product?.variants?.colors) && product.variants.colors.length > 0;
    if (hasDynamicAxes || hasSizeVariants || hasColorVariants) {
      toast.error("Please select variant on product page");
      navigate(productLink, { state: { product } });
      return;
    }

    const isLargeScreen = typeof window !== "undefined" && window.innerWidth >= 1024;

    if (!isLargeScreen) {
      setIsAdding(true);

      const buttonRect = buttonRef.current?.getBoundingClientRect();
      const startX = buttonRect ? buttonRect.left + buttonRect.width / 2 : 0;
      const startY = buttonRect ? buttonRect.top + buttonRect.height / 2 : 0;

      setTimeout(() => {
        const cartBar = document.querySelector("[data-cart-bar]");
        let endX = window.innerWidth / 2;
        let endY = window.innerHeight - 100;

        if (cartBar) {
          const cartRect = cartBar.getBoundingClientRect();
          endX = cartRect.left + cartRect.width / 2;
          endY = cartRect.top + cartRect.height / 2;
        } else {
          const cartIcon = document.querySelector("[data-cart-icon]");
          if (cartIcon) {
            const cartRect = cartIcon.getBoundingClientRect();
            endX = cartRect.left + cartRect.width / 2;
            endY = cartRect.top + cartRect.height / 2;
          }
        }

        setFlyingItemPos({
          start: { x: startX, y: startY },
          end: { x: endX, y: endY },
        });
        setShowFlyingItem(true);
      }, 30);

      setTimeout(() => setIsAdding(false), 500);
    }

    const addedToCart = addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      stockQuantity: product.stockQuantity,
      vendorId: product.vendorId,
      vendorName: product.vendorName,
    });
    if (!addedToCart) return;
    triggerCartAnimation();
    toast.success("Added to cart!");
  };

  const handleRemoveFromCart = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    removeItem(product.id, {});
    toast.success("Removed from cart!");
  };

  const handleLongPress = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setShowLongPressMenu(true);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        text: `Check out ${product?.name}`,
        url: window.location.origin + productLink,
      });
    } else {
      navigator.clipboard.writeText(window.location.origin + productLink);
      toast.success("Link copied to clipboard");
    }
  };

  const longPressHandlers = useLongPress(handleLongPress, 500);

  const handleFavorite = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
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

  // Calculate sold percentage for flash sale (mock logic)
  const soldPercentage = product?.stockQuantity ? Math.min(95, Math.floor(100 - (product.stockQuantity / 2))) : 75;

  return (
    <>
      <motion.div
        onClick={handleCardClick}
        whileTap={{ scale: 0.98 }}
        whileHover={{ y: -4 }}
        style={{ willChange: "transform", transform: "translateZ(0)", touchAction: "manipulation" }}
        className={`glass-card rounded-xl overflow-hidden group cursor-pointer h-full flex flex-col hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(123, 10, 10,0.20)] transition-all duration-300 ${
          isFlashSale ? "border border-red-100 dark:border-[#7B0A0A] bg-red-50/10 dark:bg-black" : ""
        }`}
        {...longPressHandlers}
      >
        <div className="relative">
          {/* Favorite Icon */}
          <div className="absolute top-2 right-2 z-10">
            <button
              type="button"
              data-interactive="true"
              onClick={handleFavorite}
              className="wishlist-btn p-1.5 glass rounded-full shadow-lg transition-all duration-300 group hover:bg-white"
            >
              <FiHeart
                className={`text-xs md:text-sm transition-all duration-300 ${
                  isFavorite
                    ? "text-red-500 fill-red-500 scale-110"
                    : "text-gray-400 group-hover:text-gray-600"
                }`}
              />
            </button>
          </div>

          {/* Product Image */}
          <Link to={productLink} state={{ product }} className="block">
            <div className="product-img-bg w-full h-28 md:h-40 lg:h-36 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden relative group-hover:bg-gray-200/50 transition-colors">
              {activeOffer ? (
                <OfferBadge offer={activeOffer} />
              ) : product?.originalPrice ? (
                <div
                  className={`absolute top-0 left-0 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded-br-lg z-10 shadow-sm dark:!bg-none dark:!bg-[#7B0A0A] ${
                    isFlashSale ? "bg-gradient-to-r from-red-600 to-[#AE020B]" : "bg-red-500"
                  }`}
                >
                  {Math.round(
                    ((product.originalPrice - product.price) / product.originalPrice) * 100
                  )}% OFF
                </div>
              ) : null}
              {isFlashSale && (
                <div className="absolute top-0 right-0 p-1">
                  <div className="bg-red-600 dark:bg-[#7B0A0A] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-tighter">
                    Hot Deal
                  </div>
                </div>
              )}
              <LazyImage
                src={product?.image}
                alt={product?.name}
                className="w-full h-full object-contain p-2 md:p-4 group-hover:scale-110 transition-transform duration-500"
                style={{ willChange: "transform", transform: "translateZ(0)" }}
                onError={(e) => {
                  e.target.src = getPlaceholderImage(300, 300, "Product Image");
                }}
              />
              {showCondition && product?.condition && product.condition !== "brand_new" && (
                <div className="absolute bottom-2 left-2 z-10">
                  <Badge
                    variant={product.condition === "open_box" ? "open-box" : product.condition}
                    className="text-[8px] md:text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded shadow"
                  >
                    {product.condition.replace("_", " ")}
                  </Badge>
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Product Info */}
        <div className="p-1.5 md:p-4 lg:p-3 flex-1 flex flex-col product-info-bg">
          <Link to={productLink} state={{ product }} className="block lg:h-6">
            <h3 className="font-bold text-gray-800 mb-0 md:mb-1 lg:mb-0.5 line-clamp-2 md:line-clamp-1 text-[11px] md:text-sm transition-colors group-hover:text-[#7B0A0A] leading-tight">
              {product?.name}
            </h3>
          </Link>
          <p className="text-[9px] md:text-xs text-gray-400 mb-0.5 md:mb-2 lg:mb-1 font-medium lg:h-4">
            {product?.unit}
          </p>

          {showCondition && product?.condition && product.condition !== "brand_new" && (
            <div className="flex flex-wrap gap-1 mb-1 items-center">
              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-[8px] md:text-[9px] font-extrabold uppercase tracking-wide">
                Grade {product.refurbishedGrade}
              </span>
              {product.refurbishedWarrantyDuration && (
                <span className="px-1.5 py-0.5 bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-300 rounded text-[8px] md:text-[9px] font-medium">
                  {product.refurbishedWarrantyDuration} Warranty
                </span>
              )}
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center justify-between mb-1.5">
            {!!product?.rating && !hideRating && (
              <div className="flex items-center gap-1">
                <div className="flex items-center bg-yellow-50 px-1.5 py-0.5 rounded-md border border-yellow-100">
                  <span className="text-[9px] md:text-xs font-bold text-yellow-700 mr-0.5">{product.rating}</span>
                  <FiStar className="text-[8px] md:text-[10px] text-yellow-500 fill-yellow-500" />
                </div>
                <span className="text-[9px] md:text-xs text-gray-400 font-medium hidden md:inline">
                  ({product.reviewCount || 0})
                </span>
              </div>
            )}
            {isFlashSale && (
              <span className="text-[9px] font-bold text-red-500 uppercase tracking-tighter hidden md:inline">
                Ending Soon
              </span>
            )}
          </div>

          {/* Smart Delivery ETA Badge */}
          <div className="mb-2 flex items-center">
            <span className={`text-[8px] md:text-[9.5px] font-black px-2 py-0.5 rounded-full ${deliveryInfo.badgeColor}`}>
              {deliveryInfo.badgeText}
            </span>
          </div>

          {/* Flash Sale Progress Bar */}
          {isFlashSale && (
            <div className="mb-3 space-y-1">
              <div className="flex justify-between text-[8px] md:text-[10px] font-bold">
                <span className="text-gray-500 uppercase">Available</span>
                <span className="text-red-600 dark:text-[#7B0A0A]">{soldPercentage}% Sold</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 dark:bg-[#2A2A2A] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${soldPercentage}%` }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="h-full bg-gradient-to-r from-red-500 to-red-600 dark:from-[#7B0A0A] dark:to-[#CC1010]"
                />
              </div>
            </div>
          )}

          {/* Price */}
          {!isBusiness ? (
            <div className="flex flex-wrap items-baseline gap-1 md:gap-1.5 mb-1.5 md:mb-3 lg:mb-2 mt-auto">
              <span className={`text-xs xs:text-sm md:text-base lg:text-lg font-black ${isFlashSale ? "text-red-600" : "text-gray-900"}`}>
                {formatPrice(product?.price)}
              </span>
              {product?.originalPrice && (
                <span className="text-[9px] xs:text-[10px] md:text-xs text-gray-400 line-through font-medium leading-none">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
              {product?.condition && product.condition !== "brand_new" && product?.originalPrice && (
                <span className="text-[8px] xs:text-[9px] md:text-xs text-green-600 font-bold leading-none">
                  (Save {formatPrice(product.originalPrice - product.price)})
                </span>
              )}
            </div>
          ) : (
            <B2BProductCardOverlay product={product} />
          )}

          {/* Add/Remove Button */}
          {isBusiness ? (
            <motion.button
              type="button"
              data-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                navigate(productLink, { state: { product } });
              }}
              whileTap={{ scale: 0.95 }}
              style={{ touchAction: "manipulation" }}
              className="w-full py-1.5 xs:py-2 md:py-2.5 rounded-full font-bold text-[11px] xs:text-xs md:text-sm bg-[#7B0A0A] hover:bg-[#AE020B] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-1.5"
            >
              <span>Order Bulk</span>
              <FiArrowRight className="text-xs md:text-base" />
            </motion.button>
          ) : isInCart ? (
            <motion.button
              type="button"
              data-interactive="true"
              onClick={handleRemoveFromCart}
              whileTap={{ scale: 0.95 }}
              style={{ touchAction: "manipulation" }}
              className="w-full py-1.5 xs:py-2 md:py-2.5 rounded-full font-bold text-[11px] xs:text-xs md:text-sm bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all duration-300 flex items-center justify-center gap-1.5"
            >
              <FiTrash2 className="text-xs md:text-base" />
              <span>Remove</span>
            </motion.button>
          ) : (
            <motion.button
              ref={buttonRef}
              type="button"
              data-interactive="true"
              onClick={handleAddToCart}
              disabled={product?.stock === "out_of_stock"}
              whileTap={{ scale: 0.95 }}
              animate={
                isAdding
                  ? {
                      scale: [1, 1.08, 1],
                    }
                  : {}
              }
              style={{ willChange: "transform", transform: "translateZ(0)", touchAction: "manipulation" }}
              className={`w-full py-1.5 xs:py-2 md:py-2.5 rounded-full font-bold text-[10px] xs:text-xs md:text-sm transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 ${
                product?.stock === "out_of_stock"
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                  : isFlashSale
                  ? "bg-gradient-to-r from-[#7B0A0A] to-[#AE020B] dark:!bg-none dark:!bg-[#7B0A0A] text-white shadow-lg hover:shadow-red-200 dark:hover:shadow-red-950/40 hover:-translate-y-0.5 active:scale-95"
                  : "bg-[#7B0A0A] hover:bg-[#AE020B] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
              }`}
            >
              <motion.div
                animate={
                  isAdding
                    ? {
                        rotate: [0, -10, 10, -10, 0],
                      }
                    : {}
                }
                transition={{ duration: 0.4 }}
              >
                <FiShoppingBag className="text-xs md:text-base transition-transform" />
              </motion.div>
              <span>
                {product?.stock === "out_of_stock"
                  ? "Out of Stock"
                  : isAdding
                  ? "Adding..."
                  : (
                    <>
                      <span className="md:hidden">Add</span>
                      <span className="hidden md:inline">Add to Cart</span>
                    </>
                  )}
              </span>
            </motion.button>
          )}
        </div>
      </motion.div>

      <LongPressMenu
        isOpen={showLongPressMenu}
        onClose={() => setShowLongPressMenu(false)}
        position={menuPosition}
        onAddToCart={handleAddToCart}
        onAddToWishlist={handleFavorite}
        onShare={handleShare}
        isInWishlist={isFavorite}
      />

      {showFlyingItem && (
        <FlyingItem
          image={product?.image}
          startPosition={flyingItemPos.start}
          endPosition={flyingItemPos.end}
          onComplete={() => setShowFlyingItem(false)}
        />
      )}
    </>
  );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;
