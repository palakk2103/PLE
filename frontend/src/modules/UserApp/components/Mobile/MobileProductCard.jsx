import React, { useState, useRef, useMemo, memo } from "react";
import { FiHeart, FiShoppingBag, FiStar, FiTrash2, FiArrowRight } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useCartStore, useUIStore } from "../../../../shared/store/useStore";
import { useWishlistStore } from "../../../../shared/store/wishlistStore";
import {
  formatPrice,
  getPlaceholderImage,
} from "../../../../shared/utils/helpers";
import toast from "react-hot-toast";
import LazyImage from "../../../../shared/components/LazyImage";
import useLongPress from "../../hooks/useLongPress";
import LongPressMenu from "./LongPressMenu";
import FlyingItem from "./FlyingItem";
import VendorBadge from "../../../Vendor/components/VendorBadge";
import { getVendorById } from "../../data/catalogData";
import { getVariantSignature } from "../../../../shared/utils/variant";
import { useBusinessBuyer } from "../../hooks/useBusinessBuyer";
import { B2BProductCardOverlay } from "../B2B/B2BProductCardOverlay";

const MobileProductCard = memo(({ product }) => {
  const navigate = useNavigate();
  const { isBusiness } = useBusinessBuyer();
  const productLink = `/product/${product?.id}`;

  // Selective store subscriptions to eliminate wasteful re-rendering
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

  const [showLongPressMenu, setShowLongPressMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [showFlyingItem, setShowFlyingItem] = useState(false);
  const [flyingItemPos, setFlyingItemPos] = useState({
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
  });
  const buttonRef = useRef(null);

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
      gstRate: product.gstRate !== undefined ? Number(product.gstRate) : (product.taxRate !== undefined ? Number(product.taxRate) : 18),
      taxRate: product.gstRate !== undefined ? Number(product.gstRate) : (product.taxRate !== undefined ? Number(product.taxRate) : 18),
      taxIncluded: Boolean(product.taxIncluded),
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
      navigator.clipboard.writeText(
        window.location.origin + productLink
      );
      toast.success("Link copied to clipboard");
    }
  };

  const longPressHandlers = useLongPress(handleLongPress, 500);

  const vendor = useMemo(() => {
    return product?.vendorId ? getVendorById(product.vendorId) : null;
  }, [product?.vendorId]);

  return (
    <>
      <motion.div
        onClick={handleCardClick}
        whileTap={{ scale: 0.98 }}
        style={{ willChange: "transform", transform: "translateZ(0)", touchAction: "manipulation" }}
        className="glass-card rounded-2xl overflow-hidden mb-4 cursor-pointer"
        {...longPressHandlers}
      >
        <div className="flex gap-4 p-4">
          {/* Product Image */}
          <Link to={productLink} state={{ product }} className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 block">
            <LazyImage
              src={product?.image}
              alt={product?.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = getPlaceholderImage(200, 200, "Product");
              }}
            />
          </Link>

          {/* Product Info */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-1">
              <Link to={productLink} state={{ product }} className="flex-1">
                <h3 className="font-bold text-gray-800 text-sm line-clamp-2">
                  {product?.name}
                </h3>
              </Link>
              <button
                type="button"
                data-interactive="true"
                onClick={handleFavorite}
                className="flex-shrink-0 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiHeart
                  className={`text-lg ${
                    isFavorite ? "text-red-500 fill-red-500" : "text-gray-400"
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-2">{product?.unit}</p>

            {/* Vendor Badge */}
            {vendor && (
              <div className="mb-2">
                <VendorBadge
                  vendor={vendor}
                  showVerified={true}
                  size="sm"
                  disableLink={true}
                />
              </div>
            )}

            {/* Rating */}
            {!!product?.rating && (
              <div className="flex items-center gap-1 mb-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <FiStar
                      key={i}
                      className={`text-xs ${
                        i < Math.floor(product.rating)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-600 font-medium">
                  {product.rating} ({product.reviewCount || 0})
                </span>
              </div>
            )}

            {/* Price */}
            {!isBusiness ? (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-bold text-gray-800">
                  {formatPrice(product?.price)}
                </span>
                {product?.originalPrice && (
                  <span className="text-xs text-gray-400 line-through font-medium">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>
            ) : (
              <B2BProductCardOverlay product={product} className="mb-3" />
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
                className="w-full py-3 rounded-full font-semibold text-sm bg-[#7B0A0A] hover:bg-[#AE020B] text-white shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <span>Order Bulk</span>
                <FiArrowRight className="text-base" />
              </motion.button>
            ) : isInCart ? (
              <motion.button
                type="button"
                data-interactive="true"
                onClick={handleRemoveFromCart}
                whileTap={{ scale: 0.95 }}
                style={{ touchAction: "manipulation" }}
                className="w-full py-3 rounded-full font-semibold text-sm bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <FiTrash2 className="text-base" />
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
                style={{ touchAction: "manipulation" }}
                className={`w-full py-3 rounded-full font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                  product?.stock === "out_of_stock"
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#7B0A0A] hover:bg-[#AE020B] text-white hover:shadow-glow active:scale-95"
                }`}
              >
                <FiShoppingBag className="text-base" />
                <span>
                  {product?.stock === "out_of_stock"
                    ? "Out of Stock"
                    : "Add"}
                </span>
              </motion.button>
            )}
          </div>
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

MobileProductCard.displayName = "MobileProductCard";

export default MobileProductCard;
