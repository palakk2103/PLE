import { useEffect, useState, useRef, useMemo } from "react";
import {
  FiX,
  FiPlus,
  FiMinus,
  FiTrash2,
  FiShoppingBag,
  FiHeart,
  FiAlertCircle,
  FiArrowLeft,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore, useUIStore } from "../../store/useStore";
import { useAuthStore } from "../../store/authStore";
import { formatPrice } from "../../utils/helpers";
import { Link, useNavigate } from "react-router-dom";
import SwipeableCartItem from "./SwipeableCartItem";
import { useBusinessBuyer } from "../../../modules/UserApp/hooks/useBusinessBuyer";
import { B2BCartSummary } from "../../../modules/UserApp/components/B2B/B2BCartSummary";
import { useCategoryStore } from "../../store/categoryStore";
import LucideIcon from "../LucideIcon";

const CartDrawer = () => {
  const navigate = useNavigate();
  const checkoutLink = "/checkout";
  const { isBusiness } = useBusinessBuyer();
  const { isCartOpen, toggleCart, closeCart } = useUIStore();
  const {
    items,
    getTotal,
    clearCart,
    getItemsByVendor,
  } = useCartStore();
  const { categories, getRootCategories, initialize: initializeCategories } = useCategoryStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const total = getTotal();

  useEffect(() => {
    initializeCategories();
  }, [initializeCategories]);

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // In desktop view, cart is a full page at /cart. Close drawer and navigate if opened.
  useEffect(() => {
    if (isCartOpen && !isMobile) {
      if (typeof closeCart === "function") {
        closeCart();
      } else {
        useUIStore.setState({ isCartOpen: false });
      }
      navigate("/cart");
    }
  }, [isCartOpen, isMobile, closeCart, navigate]);

  if (!isMobile) {
    return null;
  }

  const rootCategories = useMemo(() => {
    return getRootCategories().filter(cat => cat.isActive !== false).slice(0, 4);
  }, [categories, getRootCategories]);

  // Group items by vendor
  const itemsByVendor = useMemo(
    () => getItemsByVendor(),
    [items, getItemsByVendor]
  );

  // Prevent body scroll when cart is open
  useEffect(() => {
    if (!isAuthenticated && items.length > 0) {
      clearCart();
    }
  }, [isAuthenticated, items.length, clearCart]);

  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflowY = "hidden";
    } else {
      document.body.style.overflowY = "";
    }
    return () => {
      document.body.style.overflowY = "";
    };
  }, [isCartOpen]);

  const estimatedGst = useMemo(() => {
    let totalTax = 0;
    (items || []).forEach((item) => {
      const qty = Math.max(1, Number(item.quantity || 1));
      const price = Math.max(0, Number(item.price || 0));
      const rate = Number(item.gstRate ?? item.resolvedGstRate ?? item.taxRate ?? 18);
      totalTax += (price * qty * rate) / 100;
    });
    return parseFloat(totalTax.toFixed(2));
  }, [items]);
  const estimatedShipping = isBusiness ? 1500 : 50;
  const drawerFinalTotal = total + estimatedShipping + estimatedGst;

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleCart}
            className="fixed inset-0 bg-black/50 z-[10000]"
          />

          {/* Cart Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag={isMobile ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={isMobile ? 0.2 : 0}
            onDragEnd={(event, info) => {
              if (isMobile && info.offset.x > 200) {
                toggleCart();
              }
            }}
            style={{ willChange: "transform", transform: "translateZ(0)" }}
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl z-[10000] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 sm:p-5 bg-[#7B0A0A] text-white shadow-sm">
              <button
                onClick={toggleCart}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
              >
                <FiArrowLeft className="text-xl text-white" />
              </button>
              <h2 className="text-lg font-bold tracking-wide">My Cart</h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
                  {/* Sad Bag SVG Illustration */}
                  <div className="relative w-56 h-56 mb-6 flex items-center justify-center select-none">
                    {/* Background circle and shadow */}
                    <div className="absolute w-40 h-40 rounded-full bg-red-50/70 dark:bg-red-950/10 top-4 right-4 -z-10" />
                    
                    {/* Soft Shadow below bag */}
                    <div className="absolute bottom-6 w-32 h-3 bg-gray-250/30 dark:bg-black/20 rounded-full blur-sm -z-10" />
                    
                    <svg
                      width="160"
                      height="160"
                      viewBox="0 0 160 160"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="drop-shadow-sm"
                    >
                      {/* Background decorative circular arc */}
                      <circle
                        cx="90"
                        cy="60"
                        r="35"
                        stroke="#9CA3AF"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        opacity="0.5"
                      />

                      {/* Bag Side crease shadow */}
                      <path
                        d="M98 60H110V110C110 112.209 108.209 114 106 114H98V60Z"
                        fill="#FECACA"
                        stroke="#1F2937"
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                      {/* Bag Body */}
                      <path
                        d="M50 60H98V114H54C51.7909 114 50 112.209 50 110V60Z"
                        fill="white"
                        stroke="#1F2937"
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                      {/* Handles */}
                      <path
                        d="M68 60C68 48 72 42 80 42C88 42 92 48 92 60"
                        stroke="#1F2937"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      {/* Handle Attachments (Pink circles) */}
                      <circle cx="68" cy="60" r="4.5" fill="#FDA4AF" stroke="#1F2937" strokeWidth="2.5" />
                      <circle cx="92" cy="60" r="4.5" fill="#FDA4AF" stroke="#1F2937" strokeWidth="2.5" />
                      
                      {/* Sad Face Eyes */}
                      <circle cx="69" cy="80" r="3.5" fill="#1F2937" />
                      <circle cx="87" cy="80" r="3.5" fill="#1F2937" />
                      
                      {/* Sad Mouth */}
                      <path
                        d="M72 94C74 90 82 90 84 94"
                        stroke="#1F2937"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />

                      {/* Speed/Wind lines to the right */}
                      <line x1="118" y1="78" x2="134" y2="78" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                      <line x1="124" y1="88" x2="140" y2="88" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                      <line x1="116" y1="98" x2="128" y2="98" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                    </svg>

                    {/* Floating Plus Icons */}
                    <span className="absolute text-gray-400 font-bold text-xl top-12 left-10 select-none">+</span>
                    <span className="absolute text-gray-400 font-bold text-sm bottom-12 left-16 select-none">+</span>
                    <span className="absolute text-gray-400 font-bold text-xl top-6 right-16 select-none">+</span>
                    <span className="absolute text-gray-400 font-bold text-sm bottom-16 right-8 select-none">+</span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-1">
                    Ohhh... Your cart is empty
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-10">
                    but it doesn't have to be.
                  </p>

                  {/* Start Shopping CTA - Capsule style */}
                  <Link
                    to="/home"
                    onClick={toggleCart}
                    className="w-full max-w-[260px] bg-[#7B0A0A] hover:bg-[#AE020B] text-white py-3.5 rounded-full font-bold text-sm text-center shadow-md hover:shadow-lg transition-all duration-300 uppercase tracking-wider"
                  >
                    SHOP NOW
                  </Link>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-6">
                    {itemsByVendor.map((vendorGroup, vendorIndex) => (
                      <div key={vendorGroup.vendorId} className="space-y-3">
                        {/* Vendor Header */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200/50 shadow-sm">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                            <FiShoppingBag className="text-white text-xs" />
                          </div>
                          <span className="text-sm font-bold text-primary-700 flex-1">
                            {vendorGroup.vendorName}
                          </span>
                          <span className="text-xs font-semibold text-primary-600 bg-white px-2 py-1 rounded-md">
                            {formatPrice(vendorGroup.subtotal)}
                          </span>
                        </div>
                        {/* Vendor Items */}
                        <div className="space-y-3 pl-2">
                          {vendorGroup.items.map((item, index) => (
                            <SwipeableCartItem
                              key={item.cartLineKey || `${item.id}-${index}`}
                              item={item}
                              index={index}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-gray-200 p-3 sm:p-6 bg-gray-50">
                <B2BCartSummary cartItems={items} subtotal={total} />
                <div className="space-y-1.5 mb-3 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-gray-800">{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Delivery:</span>
                    <span className="font-semibold text-gray-800">
                      {formatPrice(estimatedShipping)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated GST:</span>
                    <span className="font-semibold text-gray-800">
                      {formatPrice(estimatedGst)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2 sm:mb-4 pt-2 border-t border-gray-200">
                  <span className="text-sm sm:text-base font-bold text-gray-800">
                    Total:
                  </span>
                  <span className="text-lg sm:text-2xl font-bold text-primary-600">
                    {formatPrice(drawerFinalTotal)}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <Link
                    to={checkoutLink}
                    onClick={toggleCart}
                    className="w-full bg-[#7B0A0A] hover:bg-[#AE020B] text-white py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base text-center hover:shadow-glow">
                    Proceed to Checkout
                  </Link>
                  <button
                    onClick={clearCart}
                    className="w-full py-1.5 sm:py-2 text-sm sm:text-base text-gray-600 hover:text-red-600 font-medium transition-colors">
                    Clear Cart
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
