import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FiShoppingBag,
  FiTrash2,
  FiPlus,
  FiMinus,
  FiHeart,
  FiArrowLeft,
  FiArrowRight,
  FiShield,
  FiTruck,
  FiCheckCircle,
  FiLock,
  FiAlertCircle,
  FiTag,
  FiMapPin,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore, useUIStore } from "../../../shared/store/useStore";
import { useWishlistStore } from "../../../shared/store/wishlistStore";
import { useAuthStore } from "../../../shared/store/authStore";
import { useAddressStore } from "../../../shared/store/addressStore";
import { useBusinessBuyer } from "../hooks/useBusinessBuyer";
import { B2BCartSummary } from "../components/B2B/B2BCartSummary";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import SEO from "../../../shared/components/SEO/SEO";
import { formatPrice } from "../../../shared/utils/helpers";
import { formatVariantLabel } from "../../../shared/utils/variant";
import api from "../../../shared/utils/api";
import toast from "react-hot-toast";

const Cart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isBusiness } = useBusinessBuyer();
  const openCart = useUIStore((state) => state.openCart);
  const toggleCart = useUIStore((state) => state.toggleCart);
  const closeCart = useUIStore((state) => state.closeCart);
  const { isAuthenticated } = useAuthStore();
  const { addresses, getDefaultAddress, fetchAddresses } = useAddressStore();

  const [destinationPincode, setDestinationPincode] = useState("");
  const [pincodeInput, setPincodeInput] = useState("");
  const [isChangingPincode, setIsChangingPincode] = useState(false);
  const [estimatedShipping, setEstimatedShipping] = useState(null);
  const [isEstimatingShipping, setIsEstimatingShipping] = useState(false);
  const [courierBreakdown, setCourierBreakdown] = useState(null);
  const [shippingByVendor, setShippingByVendor] = useState({});
  const [liveGstRates, setLiveGstRates] = useState({});

  const {
    items,
    getTotal,
    removeItem,
    updateQuantity,
    clearCart,
    getItemsByVendor,
    addItem: addToCart,
  } = useCartStore();

  const { addItem: addToWishlist } = useWishlistStore();
  const total = getTotal();

  // Mobile detection - If accessed on mobile, open drawer and keep mobile view intact
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // When on mobile, preserve existing mobile experience by opening drawer and going back
  useEffect(() => {
    if (isMobile) {
      if (typeof openCart === "function") {
        openCart();
      } else if (typeof toggleCart === "function") {
        toggleCart();
      }
      const stateFrom = location.state?.from;
      if (stateFrom && stateFrom !== "/cart") {
        navigate(stateFrom, { replace: true });
      } else if (window.history.length > 2) {
        navigate(-1, { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
    }
  }, [isMobile, openCart, toggleCart, navigate, location]);

  // Group items by vendor
  const itemsByVendor = useMemo(() => getItemsByVendor(), [items, getItemsByVendor]);

  // Clear cart if logged out and items present
  useEffect(() => {
    if (!isAuthenticated && items.length > 0) {
      clearCart();
    }
  }, [isAuthenticated, items.length, clearCart]);

  // Fetch user addresses on auth
  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses().catch(() => null);
    }
  }, [isAuthenticated, fetchAddresses]);

  // Use default address pincode if available
  useEffect(() => {
    const defaultAddr = getDefaultAddress() || (addresses.length > 0 ? addresses[0] : null);
    if (defaultAddr?.zipCode && !destinationPincode) {
      setDestinationPincode(defaultAddr.zipCode);
      setPincodeInput(defaultAddr.zipCode);
    }
  }, [addresses, getDefaultAddress, destinationPincode]);

  // Sync live GST rates for cart items
  useEffect(() => {
    if (!items || items.length === 0) return;
    let isCancelled = false;
    const syncCartGst = async () => {
      try {
        const uniqueProductIds = [...new Set(items.map((i) => i.id).filter(Boolean))];
        const rates = {};
        await Promise.all(
          uniqueProductIds.map(async (pid) => {
            try {
              const res = await api.get(`/products/${pid}`);
              const p = res?.data || res;
              if (p) {
                const rate = p.gstRate !== undefined ? Number(p.gstRate) : (p.taxRate !== undefined ? Number(p.taxRate) : 18);
                rates[String(pid)] = rate;
              }
            } catch {
              // fallback
            }
          })
        );
        if (!isCancelled && Object.keys(rates).length > 0) {
          setLiveGstRates(rates);
        }
      } catch (err) {
        console.error("Failed to sync cart GST", err);
      }
    };
    syncCartGst();
    return () => { isCancelled = true; };
  }, [items.length]);

  // Estimate delivery fee based on items and pincode
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      const validItems = (items || [])
        .map((item) => ({
          productId: item?.id,
          quantity: Number(item?.quantity || 1),
          variant: item?.variant || undefined,
        }))
        .filter((item) => item.productId);

      if (!validItems.length) {
        if (active) setEstimatedShipping(0);
        return;
      }

      setIsEstimatingShipping(true);
      try {
        const response = await api.post(
          "/shipping/estimate",
          {
            items: validItems,
            shippingAddress: {
              zipCode: String(destinationPincode || "").trim(),
              pincode: String(destinationPincode || "").trim(),
            },
            shippingOption: isBusiness ? "bulk" : "standard",
            paymentMethod: "prepaid",
          },
          { signal: controller.signal }
        );

        const payload = response?.data ?? response;
        const nextShipping = Number(payload?.shipping);
        if (active) {
          setEstimatedShipping(Number.isFinite(nextShipping) ? nextShipping : null);
          if (payload?.courierInfo) {
            setCourierBreakdown(payload.courierInfo);
          }
          if (payload?.byVendor) {
            setShippingByVendor(payload.byVendor);
          }
        }
      } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") {
          return;
        }
        if (active) {
          setEstimatedShipping(null);
          setCourierBreakdown(null);
        }
      } finally {
        if (active) {
          setIsEstimatingShipping(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [items, destinationPincode, isBusiness]);

  const gstBreakdown = useMemo(() => {
    const slabs = {};
    let totalTaxSum = 0;
    (items || []).forEach((item) => {
      const itemQty = Math.max(1, Number(item.quantity || 1));
      const itemPrice = Math.max(0, Number(item.price || 0));
      const itemSubtotal = itemPrice * itemQty;
      const liveRate = liveGstRates[String(item.id)];
      const effectiveGstRate = Number(
        liveRate ?? item.gstRate ?? item.resolvedGstRate ?? item.taxRate ?? 18
      );
      const itemTax = (itemSubtotal * effectiveGstRate) / 100;
      totalTaxSum += itemTax;

      const rateKey = `${effectiveGstRate}%`;
      if (!slabs[rateKey]) {
        slabs[rateKey] = {
          rate: effectiveGstRate,
          taxableAmount: 0,
          taxAmount: 0,
          count: 0,
        };
      }
      slabs[rateKey].taxableAmount += itemSubtotal;
      slabs[rateKey].taxAmount += itemTax;
      slabs[rateKey].count += itemQty;
    });

    return {
      totalTax: parseFloat(totalTaxSum.toFixed(2)),
      slabs: Object.values(slabs).sort((a, b) => b.rate - a.rate),
    };
  }, [items, liveGstRates]);

  const handleApplyPincode = (e) => {
    e.preventDefault();
    const clean = String(pincodeInput || "").trim();
    if (!/^\d{6}$/.test(clean)) {
      toast.error("Please enter a valid 6-digit PIN code");
      return;
    }
    setDestinationPincode(clean);
    setIsChangingPincode(false);
    toast.success(`Checking delivery fee for PIN ${clean}...`);
  };

  const shipping = estimatedShipping !== null ? estimatedShipping : (isBusiness ? 1500 : 50);
  const tax = gstBreakdown.totalTax;
  const finalTotal = total + shipping + tax;

  // Handlers
  const handleQuantityChange = (item, delta) => {
    const newQty = item.quantity + delta;
    const availableStock = Number(item?.stockQuantity);

    if (newQty <= 0) {
      handleRemoveItem(item);
      return;
    }

    if (Number.isFinite(availableStock) && newQty > availableStock) {
      toast.error(`Only ${availableStock} items available in stock`);
      return;
    }

    updateQuantity(item.id, newQty, item.variant);
  };

  const handleRemoveItem = (item) => {
    const itemCopy = { ...item };
    removeItem(item.id, item.variant);
    toast.success("Item removed from cart", {
      duration: 3500,
      action: {
        label: "Undo",
        onClick: () => {
          addToCart(itemCopy);
        },
      },
    });
  };

  const handleSaveForLater = (item) => {
    const added = addToWishlist({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
    });
    if (!added) return;
    removeItem(item.id, item.variant);
    toast.success("Item saved to wishlist!");
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to remove all items from your cart?")) {
      clearCart();
      toast.success("Cart cleared");
    }
  };

  // If mobile, let redirect effect handle it
  if (isMobile) {
    return null;
  }

  const totalItemsCount = items.reduce((acc, item) => acc + (item.quantity || 1), 0);

  return (
    <PageTransition>
      <SEO title="Shopping Cart - PLE" description="Review items in your shopping cart and proceed to checkout." />
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f10] text-gray-900 dark:text-gray-100 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb & Navigation */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                <Link to="/home" className="hover:text-[#7B0A0A] dark:hover:text-red-400 transition-colors">
                  Home
                </Link>
                <span>/</span>
                <span className="font-bold text-gray-800 dark:text-white">Shopping Cart</span>
              </div>
              <Link
                to="/home"
                className="text-xs font-bold text-[#7B0A0A] dark:text-red-400 hover:underline flex items-center gap-1.5"
              >
                <FiArrowLeft /> Continue Shopping
              </Link>
            </div>

            {/* Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center text-2xl font-bold shadow-sm">
                  <FiShoppingBag />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Shopping Cart
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                    {totalItemsCount > 0
                      ? `You have ${totalItemsCount} ${totalItemsCount === 1 ? "item" : "items"} in your cart`
                      : "Your cart is currently empty"}
                  </p>
                </div>
              </div>

              {items.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl transition-all shadow-sm hover:border-red-200 flex items-center gap-1.5"
                >
                  <FiTrash2 className="text-sm" /> Clear Cart
                </button>
              )}
            </div>

            {/* Cart Content */}
            {items.length === 0 ? (
              /* Empty Cart State */
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200/80 dark:border-zinc-800 p-10 sm:p-16 text-center max-w-2xl mx-auto shadow-sm my-8">
                {/* SVG Illustration */}
                <div className="relative w-48 h-48 mx-auto mb-6 flex items-center justify-center select-none">
                  <div className="absolute w-36 h-36 rounded-full bg-red-50 dark:bg-red-950/20 -z-10" />
                  <svg
                    width="140"
                    height="140"
                    viewBox="0 0 160 160"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-sm"
                  >
                    <circle cx="90" cy="60" r="35" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
                    <path d="M98 60H110V110C110 112.209 108.209 114 106 114H98V60Z" fill="#FECACA" stroke="#1F2937" strokeWidth="3.5" strokeLinejoin="round" />
                    <path d="M50 60H98V114H54C51.7909 114 50 112.209 50 110V60Z" fill="white" stroke="#1F2937" strokeWidth="3.5" strokeLinejoin="round" />
                    <path d="M68 60C68 48 72 42 80 42C88 42 92 48 92 60" stroke="#1F2937" strokeWidth="3.5" strokeLinecap="round" />
                    <circle cx="68" cy="60" r="4.5" fill="#FDA4AF" stroke="#1F2937" strokeWidth="2.5" />
                    <circle cx="92" cy="60" r="4.5" fill="#FDA4AF" stroke="#1F2937" strokeWidth="2.5" />
                    <circle cx="69" cy="80" r="3.5" fill="#1F2937" />
                    <circle cx="87" cy="80" r="3.5" fill="#1F2937" />
                    <path d="M72 94C74 90 82 90 84 94" stroke="#1F2937" strokeWidth="3.5" strokeLinecap="round" />
                  </svg>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-2">
                  Your Cart is Empty
                </h2>
                <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mx-auto mb-8">
                  Looks like you haven't added anything to your cart yet. Explore our categories to find great deals and products.
                </p>

                <Link
                  to="/home"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#7B0A0A] hover:bg-[#AE020B] text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 uppercase tracking-wider"
                >
                  <FiShoppingBag className="text-base" /> Start Shopping
                </Link>
              </div>
            ) : (
              /* Full Page 2-Column Desktop Grid */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Cart Items (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                  {itemsByVendor.map((vendorGroup) => (
                    <div
                      key={vendorGroup.vendorId}
                      className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-sm overflow-hidden"
                    >
                      {/* Vendor Header */}
                      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100/60 dark:from-zinc-850 dark:to-zinc-800/60 border-b border-gray-200/80 dark:border-zinc-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950/40 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center text-sm font-bold">
                            <FiShoppingBag />
                          </div>
                          <span className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                            Sold by: <span className="text-[#7B0A0A] dark:text-red-400">{vendorGroup.vendorName}</span>
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-gray-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-3 py-1 rounded-lg border border-gray-200/60 dark:border-zinc-700">
                          Subtotal: <span className="font-bold text-gray-900 dark:text-white">{formatPrice(vendorGroup.subtotal)}</span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {vendorGroup.items.map((item, index) => {
                          const variantLabel = formatVariantLabel(item.variant);
                          const isMaxQty = Number.isFinite(Number(item.stockQuantity)) && item.quantity >= Number(item.stockQuantity);
                          const lineTotal = item.price * item.quantity;

                          return (
                            <div
                              key={item.cartLineKey || `${item.id}-${index}`}
                              className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-zinc-850/30 transition-colors"
                            >
                              {/* Left: Image & Info */}
                              <div className="flex items-start gap-4 flex-1 min-w-0">
                                <Link
                                  to={`/product/${item.id}`}
                                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200/80 dark:border-zinc-700 p-1.5 flex items-center justify-center shrink-0 overflow-hidden group"
                                >
                                  <img
                                    src={item.image || "/placeholder.png"}
                                    alt={item.name}
                                    className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-300"
                                  />
                                </Link>

                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <Link
                                    to={`/product/${item.id}`}
                                    className="font-bold text-sm sm:text-base text-gray-900 dark:text-zinc-100 hover:text-[#7B0A0A] dark:hover:text-red-400 transition-colors line-clamp-2"
                                  >
                                    {item.name}
                                  </Link>

                                  {variantLabel && (
                                    <div className="inline-block bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 text-xs font-semibold px-2.5 py-0.5 rounded-md">
                                      {variantLabel}
                                    </div>
                                  )}

                                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                    <span className="text-sm font-bold text-gray-700 dark:text-zinc-300">
                                      {formatPrice(item.price)}
                                      <span className="text-[11px] font-normal text-gray-500 dark:text-zinc-400 ml-1">
                                        / unit
                                      </span>
                                    </span>
                                    {(() => {
                                      const itemGst = Number(liveGstRates[String(item.id)] ?? item.gstRate ?? item.resolvedGstRate ?? item.taxRate ?? 18);
                                      const itemTaxAmount = ((item.price * item.quantity * itemGst) / 100);
                                      return (
                                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/40">
                                          {itemGst}% GST (+{formatPrice(itemTaxAmount)})
                                        </span>
                                      );
                                    })()}
                                    {item.stock === "low_stock" && (
                                      <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-full">
                                        Low Stock
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Quantity Controls, Line Total & Actions */}
                              <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-zinc-800">
                                {/* Line Price */}
                                <div className="text-right">
                                  <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                                    {formatPrice(lineTotal)}
                                  </div>
                                </div>

                                {/* Quantity Selector */}
                                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl border border-gray-200 dark:border-zinc-700">
                                  <button
                                    onClick={() => handleQuantityChange(item, -1)}
                                    className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-600 flex items-center justify-center transition-colors shadow-sm disabled:opacity-40"
                                    title="Decrease quantity"
                                  >
                                    <FiMinus className="text-xs" />
                                  </button>
                                  <span className="w-8 text-center text-xs font-bold text-gray-900 dark:text-white">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => handleQuantityChange(item, 1)}
                                    disabled={isMaxQty}
                                    className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-600 flex items-center justify-center transition-colors shadow-sm disabled:opacity-40"
                                    title="Increase quantity"
                                  >
                                    <FiPlus className="text-xs" />
                                  </button>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3 text-xs">
                                  <button
                                    onClick={() => handleSaveForLater(item)}
                                    className="text-gray-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 font-semibold flex items-center gap-1 transition-colors"
                                    title="Save to Wishlist"
                                  >
                                    <FiHeart className="text-sm" /> Save for later
                                  </button>
                                  <span className="text-gray-300 dark:text-zinc-700">|</span>
                                  <button
                                    onClick={() => handleRemoveItem(item)}
                                    className="text-gray-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 font-semibold flex items-center gap-1 transition-colors"
                                    title="Remove from Cart"
                                  >
                                    <FiTrash2 className="text-sm" /> Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Trust and Assurance Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 flex items-center gap-3 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 flex items-center justify-center text-lg shrink-0">
                        <FiTruck />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">Fast Delivery</h4>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400">Doorstep delivery across India</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 flex items-center gap-3 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shrink-0">
                        <FiShield />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">Secure Checkout</h4>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400">256-bit encrypted payments</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 flex items-center gap-3 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center text-lg shrink-0">
                        <FiCheckCircle />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">Verified Products</h4>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400">100% Genuine and assured</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Order Summary (4 cols) */}
                <div className="lg:col-span-4 sticky top-24 space-y-5">
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200/80 dark:border-zinc-800 p-6 shadow-sm">
                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white pb-3 border-b border-gray-100 dark:border-zinc-800">
                      Order Summary
                    </h3>

                    {/* B2B Wholesale Summary if applicable */}
                    {isBusiness && (
                      <div className="mt-4">
                        <B2BCartSummary cartItems={items} subtotal={total} />
                      </div>
                    )}

                    {/* Price Breakdown */}
                    <div className="space-y-3.5 py-4 text-sm">
                      <div className="flex items-center justify-between text-gray-600 dark:text-zinc-400">
                        <span>Items Subtotal ({totalItemsCount} items)</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(total)}</span>
                      </div>

                      {/* Delivery Fee Section */}
                      <div className="pt-2 border-t border-dashed border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between text-gray-600 dark:text-zinc-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <FiTruck className="text-primary-600 text-sm" />
                            <span>Estimated Delivery Fee</span>
                            {isEstimatingShipping && (
                              <span className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" title="Calculating shipping rate..." />
                            )}
                          </span>
                          <span className="font-bold">
                            {shipping === 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">FREE</span>
                            ) : (
                              <span className="text-gray-900 dark:text-white">{formatPrice(shipping)}</span>
                            )}
                          </span>
                        </div>

                        {/* Pincode display & changer */}
                        <div className="mt-1.5 flex items-center justify-between text-[11px] bg-gray-50 dark:bg-zinc-800/60 px-2.5 py-1.5 rounded-lg border border-gray-150 dark:border-zinc-750">
                          <span className="text-gray-500 dark:text-zinc-400 flex items-center gap-1 truncate">
                            <FiMapPin className="text-xs text-primary-500 shrink-0" />
                            {destinationPincode ? (
                              <span>Delivery to: <strong className="text-gray-800 dark:text-zinc-200">{destinationPincode}</strong></span>
                            ) : (
                              <span>Standard delivery nationwide</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsChangingPincode(!isChangingPincode)}
                            className="text-primary-600 dark:text-primary-400 font-bold hover:underline shrink-0 ml-2"
                          >
                            {isChangingPincode ? "Cancel" : destinationPincode ? "Change PIN" : "Check PIN"}
                          </button>
                        </div>

                        {/* Pincode input box when changing */}
                        {isChangingPincode && (
                          <form onSubmit={handleApplyPincode} className="mt-2 flex gap-1.5">
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="Enter 6-digit PIN"
                              value={pincodeInput}
                              onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0"
                            >
                              Check
                            </button>
                          </form>
                        )}

                        {/* Shiprocket Courier Breakdown Card */}
                        {courierBreakdown && Object.keys(courierBreakdown).length > 0 && (() => {
                          const couriers = Object.values(courierBreakdown).filter(Boolean);
                          if (!couriers.length) return null;
                          const primary = couriers[0];
                          return (
                            <div className="mt-2 p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs space-y-1.5">
                              <div className="flex items-center justify-between text-blue-900 dark:text-blue-300 font-bold">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                  {primary.source === 'shiprocket' ? '🚀 Shiprocket Live Rate' : '📦 Assigned Courier'}
                                </span>
                                <span>{primary.estimatedDays || '2–4 Business Days'}</span>
                              </div>
                              <div className="text-[11px] text-blue-800 dark:text-blue-300/80 flex items-center justify-between">
                                <span className="truncate font-medium">{primary.courierName || 'Standard Express'}</span>
                                <span className="font-bold">{formatPrice(primary.rate ?? shipping)}</span>
                              </div>
                              {couriers.length > 1 && (
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 pt-1 border-t border-blue-200/50">
                                  Multi-vendor shipment: {couriers.length} separate parcels will be delivered.
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* GST / Tax Section */}
                      <div className="pt-2 border-t border-dashed border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between text-gray-600 dark:text-zinc-400">
                          <span className="font-medium">Estimated GST & Taxes</span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {formatPrice(tax)}
                          </span>
                        </div>
                        
                        {/* Transparent GST Slabs Breakdown */}
                        {gstBreakdown.slabs.length > 0 && (
                          <div className="mt-2 p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/60 dark:border-zinc-700/50 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-bold text-gray-700 dark:text-zinc-300">
                              <span>Configured GST Slabs</span>
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider">CGST + SGST</span>
                            </div>
                            {gstBreakdown.slabs.map((slab) => (
                              <div key={slab.rate} className="flex items-center justify-between text-[11px] text-gray-600 dark:text-zinc-400">
                                <span>
                                  GST @ {slab.rate}% ({slab.count} items, {formatPrice(slab.taxableAmount)})
                                </span>
                                <span className="font-semibold text-gray-800 dark:text-zinc-200">
                                  {formatPrice(slab.taxAmount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
                          Calculated directly from seller & platform configured GST slabs
                        </p>
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 mb-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-base font-bold text-gray-900 dark:text-white block">
                            Total Payable
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                            Items + Delivery + GST
                          </span>
                        </div>
                        <span className="text-2xl font-black text-[#7B0A0A] dark:text-red-400">
                          {formatPrice(finalTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Checkout CTA */}
                    <Link
                      to="/checkout"
                      className="w-full py-4 bg-[#7B0A0A] hover:bg-[#AE020B] text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-red-950/20 hover:shadow-red-950/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
                    >
                      <FiLock className="text-lg" />
                      <span>Proceed to Checkout</span>
                    </Link>

                    <p className="text-center text-[11px] text-gray-500 dark:text-zinc-400 mt-3 flex items-center justify-center gap-1">
                      <FiShield className="text-green-500" /> Safe and Secure 256-Bit SSL Checkout
                    </p>
                  </div>

                  {/* Continue Shopping Card */}
                  <div className="bg-gradient-to-br from-red-50/50 to-orange-50/30 dark:from-red-950/20 dark:to-zinc-900 p-5 rounded-2xl border border-red-100 dark:border-zinc-800 text-center">
                    <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-3">
                      Need anything else before placing your order?
                    </p>
                    <Link
                      to="/home"
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#7B0A0A] dark:text-red-400 hover:underline"
                    >
                      Browse More Categories <FiArrowRight />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default Cart;
