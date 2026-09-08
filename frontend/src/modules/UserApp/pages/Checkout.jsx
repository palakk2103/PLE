import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  FiMapPin,
  FiCreditCard,
  FiTruck,
  FiCheck,
  FiX,
  FiPlus,
  FiArrowLeft,
  FiShoppingBag,
  FiTag,
  FiAward,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { FiLock } from "react-icons/fi";
import { useCartStore } from "../../../shared/store/useStore";
import { useAuthStore } from "../../../shared/store/authStore";
import { useAddressStore } from "../../../shared/store/addressStore";
import { useWalletStore } from "../../../shared/store/walletStore";
import { useOrderStore } from "../../../shared/store/orderStore";
import { useLoyaltyStore } from "../../../shared/store/loyaltyStore";
import { useB2BAdminStore } from "../../B2BAdmin/store/b2bAdminStore";

import { formatPrice } from "../../../shared/utils/helpers";
import api from "../../../shared/utils/api";
import toast from "react-hot-toast";
import MobileLayout from "../components/Layout/MobileLayout";
import MobileCheckoutSteps from "../components/Mobile/MobileCheckoutSteps";
import PageTransition from "../../../shared/components/PageTransition";
import OrderSummary from "../components/Mobile/CheckoutOrderSummary";
import { useBusinessBuyer } from "../hooks/useBusinessBuyer";

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const MobileCheckout = () => {
  const navigate = useNavigate();
  const { items, getTotal, clearCart, getItemsByVendor } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { dbCompanyProfile } = useB2BAdminStore();
  const { addresses, getDefaultAddress, addAddress, fetchAddresses } = useAddressStore();
  const { createOrder } = useOrderStore();
  
  const { availablePoints, rules: loyaltyConfig, fetchBalance, fetchConfig } = useLoyaltyStore();
  const [pointsToApply, setPointsToApply] = useState("");
  const [appliedPoints, setAppliedPoints] = useState(0);
  
  const { isBusiness } = useBusinessBuyer();
  const { balance: walletBalance, fetchWallet } = useWalletStore();
  const [useWallet, setUseWallet] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isBusiness) {
      fetchWallet().catch(() => null);
    }
  }, [isAuthenticated, isBusiness, fetchWallet]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBalance();
      fetchConfig(user?.role);
    }
  }, [isAuthenticated, user]);

  // Group items by vendor
  const itemsByVendor = useMemo(
    () => getItemsByVendor(),
    [items, getItemsByVendor]
  );

  const [step, setStep] = useState(1);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [b2bSettings, setB2bSettings] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [shippingOption, setShippingOption] = useState(() => isBusiness ? "bulk" : "standard");
  const [estimatedShipping, setEstimatedShipping] = useState(null);
  const [isEstimatingShipping, setIsEstimatingShipping] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [selectedUpiApp, setSelectedUpiApp] = useState("gpay"); // "gpay" | "phonepe" | "paytm"
  const [showUpiRedirect, setShowUpiRedirect] = useState(false);
  const [shippingDetails, setShippingDetails] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    zipCode: "",
    state: "",
    country: "",
    paymentMethod: "card",
  });



  useEffect(() => {
    if (isBusiness) {
      setShippingOption("bulk");
    } else {
      setShippingOption("standard");
    }
  }, [isBusiness]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses().catch(() => null);
    }
  }, [isAuthenticated, fetchAddresses]);

  useEffect(() => {
    let cancelled = false;
    const fetchCoupons = async () => {
      try {
        const response = await api.get("/coupons/available");
        const payload = response?.data ?? response;
        if (!cancelled) {
          setAvailableCoupons(Array.isArray(payload) ? payload : []);
        }
      } catch {
        if (!cancelled) {
          setAvailableCoupons([]);
        }
      }
    };

    const fetchB2bSettings = async () => {
      try {
        const response = await api.get("/settings/b2b");
        if (response.data?.data && !cancelled) {
          setB2bSettings(response.data.data);
        }
      } catch (err) {
        console.error("Failed to load b2b settings", err);
      }
    };

    fetchCoupons();
    if (isBusiness) fetchB2bSettings();
    return () => {
      cancelled = true;
    };
  }, [isBusiness]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const defaultAddress = getDefaultAddress();
      
      // Base fallback data
      let baseName = user.name || "";
      let baseEmail = user.email || "";
      let basePhone = user.phone || "";
      let baseAddress = user.address || "";
      
      // If B2B, prefer company data for fallbacks
      if (isBusiness && dbCompanyProfile) {
        baseAddress = dbCompanyProfile.companyAddress || baseAddress;
        baseName = dbCompanyProfile.companyName || baseName;
        // B2B Admin could use company phone, but employee might use their own phone
        if (user.role === 'b2bAdmin') {
            basePhone = dbCompanyProfile.businessPhone || basePhone;
        }
      }

      setFormData((prev) => ({
        ...prev,
        name: baseName,
        email: baseEmail,
        phone: basePhone,
        address: baseAddress,
      }));

      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
        setFormData((prev) => ({
          ...prev,
          name: defaultAddress.fullName || baseName,
          email: baseEmail,
          phone: defaultAddress.phone || basePhone,
          address: defaultAddress.address || baseAddress,
          city: defaultAddress.city || "",
          zipCode: defaultAddress.zipCode || "",
          state: defaultAddress.state || "",
          country: defaultAddress.country || "",
        }));
      }
    }
  }, [isAuthenticated, user, dbCompanyProfile, isBusiness, getDefaultAddress, addresses]);

  const calculateShippingFallback = () => {
    const total = getTotal();
    if (isBusiness) {
      return 1500; // Flat B2B bulk cargo pallet fee
    }
    if (shippingOption === "express") {
      return 150; // Express local same-city surcharge
    }
    if (appliedCoupon?.type === "freeship") {
      return 0;
    }
    if (total >= 100) {
      return 0;
    }
    return 50;
  };

  const calculateItemisedGST = (tot, coupDisc) => {
    let totalTaxSum = 0;
    const discountRatio = tot > 0 ? Math.min(1, coupDisc / tot) : 0;
    (items || []).forEach((item) => {
      const itemQty = Math.max(1, Number(item.quantity || 1));
      const itemPrice = Math.max(0, Number(item.price || 0));
      const itemSubtotal = itemPrice * itemQty;
      const itemDisc = itemSubtotal * discountRatio;
      const netTaxable = Math.max(0, itemSubtotal - itemDisc);
      const effectiveGstRate = Number(item.gstRate ?? item.resolvedGstRate ?? item.taxRate ?? 18);
      const itemTax = (netTaxable * effectiveGstRate) / 100;
      totalTaxSum += itemTax;
    });
    return parseFloat(totalTaxSum.toFixed(2));
  };

  const total = getTotal();
  const shipping = calculateShippingFallback();
  const couponDiscount = appliedCoupon ? appliedDiscount : 0;
  const tax = calculateItemisedGST(total, couponDiscount);
  const prePointsTotal = total + shipping + tax;
  const maxRedeemableCash = Math.min(prePointsTotal, appliedPoints * (loyaltyConfig?.redemptionRatio || 0.2));
  const pointsDiscount = maxRedeemableCash;
  const discount = couponDiscount + pointsDiscount;
  const taxableAmount = Math.max(0, total - couponDiscount);
  const finalTotal = Math.max(0, prePointsTotal - pointsDiscount);

  function taxAmount(tot, coupDisc) {
    return calculateItemisedGST(tot, coupDisc);
  }

  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
    }
  }, [total, appliedCoupon]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const validItems = items
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
        const response = await api.post("/shipping/estimate", {
          items: validItems,
          shippingAddress: {
            country: String(formData.country || "").trim(),
          },
          shippingOption,
          couponType: appliedCoupon?.type || null,
        });

        const payload = response?.data ?? response;
        const nextShipping = Number(payload?.shipping);
        if (active) {
          setEstimatedShipping(Number.isFinite(nextShipping) ? nextShipping : null);
        }
      } catch {
        if (active) {
          setEstimatedShipping(null);
        }
      } finally {
        if (active) {
          setIsEstimatingShipping(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [items, formData.country, shippingOption, appliedCoupon?.type]);

  const handleApplyCoupon = async (codeOverride = "") => {
    const normalizedCode = String(codeOverride || couponCode).trim().toUpperCase();
    if (!normalizedCode) {
      toast.error("Please enter a coupon code");
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const response = await api.post("/coupons/validate", {
        code: normalizedCode,
        cartTotal: total,
      });
      const payload = response?.data ?? response;
      const coupon = payload?.coupon;
      const discountAmount = Number(payload?.discount || 0);

      if (!coupon) {
        throw new Error("Invalid coupon response");
      }

      setCouponCode(coupon.code || normalizedCode);
      setAppliedCoupon(coupon);
      setAppliedDiscount(discountAmount);
      toast.success(`Coupon "${coupon.code}" applied!`);
    } catch {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleApplyPoints = (e) => {
    e?.preventDefault();
    const pts = parseInt(pointsToApply, 10);
    if (Number.isNaN(pts) || pts <= 0) {
      toast.error("Please enter a valid number of points to redeem");
      return;
    }
    if (pts > availablePoints) {
      toast.error(`You only have ${availablePoints} points available`);
      return;
    }
    setAppliedPoints(pts);
    toast.success(`Successfully applied ${pts} points!`);
  };

  const handleRemovePoints = () => {
    setAppliedPoints(0);
    setPointsToApply("");
    toast.success("Loyalty points removed");
  };

  const handleSelectAddress = (address) => {
    setSelectedAddressId(address.id);
    setFormData({
      ...formData,
      name: address.fullName,
      phone: address.phone,
      address: address.address,
      city: address.city,
      zipCode: address.zipCode,
      state: address.state,
      country: address.country,
    });
  };

  const handleNewAddress = async (addressData) => {
    try {
      const newAddress = await addAddress(addressData);
      handleSelectAddress(newAddress);
      setShowAddressForm(false);
      toast.success("Address added and selected!");
    } catch (error) {
      toast.error(error?.message || "Failed to add address");
    }
  };

  if (items.length === 0 && !orderSuccess) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={false} showCartBar={false}>
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Your cart is empty
              </h2>
              <button
                onClick={() => navigate("/home")}
                className="gradient-green text-white px-6 py-3 rounded-xl font-semibold">
                Continue Shopping
              </button>
            </div>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizedShipping = {
      name: String(formData.name || "").trim(),
      email: String(formData.email || "").trim().toLowerCase(),
      phone: String(formData.phone || "").replace(/\D/g, "").slice(-10),
      address: String(formData.address || "").trim(),
      city: String(formData.city || "").trim(),
      zipCode: String(formData.zipCode || "").trim(),
      state: String(formData.state || "").trim(),
      country: String(formData.country || "").trim(),
    };

    const missingRequired = Object.values(normalizedShipping).some((v) => !v);
    if (missingRequired) {
      toast.error("Please fill all shipping details correctly.");
      return;
    }

    if (normalizedShipping.phone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }

    if (isBusiness && b2bSettings?.minOrderValue && total < b2bSettings.minOrderValue) {
      toast.error(`Minimum order value for B2B purchases is ${formatPrice(b2bSettings.minOrderValue)}`);
      return;
    }

    if (step === 2 && isApplyingCoupon) {
      toast.error("Please wait for coupon validation to complete.");
      return;
    }
    if (step === 2 && isPlacingOrder) {
      return;
    }

    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setIsPlacingOrder(true);
      try {
        const userWalletBalance = user?.role === 'b2bEmployee' ? (user?.b2bWalletBalance || 0) : (walletBalance || 0);
        const walletAmountToUse = useWallet ? Math.min(userWalletBalance, finalTotal) : 0;
        const finalPaymentMethod = walletAmountToUse >= finalTotal ? 'wallet' : (useWallet ? 'mixed' : formData.paymentMethod);

        const order = await createOrder({
          userId: isAuthenticated ? user?.id : null,
          items: items,
          shippingAddress: normalizedShipping,
          paymentMethod: finalPaymentMethod,
          walletAmountToUse,
          subtotal: total,
          shipping: shipping,
          tax: tax,
          discount: discount,
          total: finalTotal,
          couponCode: appliedCoupon ? (appliedCoupon.code || couponCode.trim().toUpperCase()) : null,
          shippingOption,
          loyaltyPointsToRedeem: appliedPoints > 0 ? appliedPoints : undefined,

        });

        if (order.razorpayOrder) {
          const rzpLoaded = await loadRazorpayScript();
          if (!rzpLoaded) {
            toast.error("Failed to load Razorpay SDK. Please check your internet connection.");
            setIsPlacingOrder(false);
            return;
          }

          const options = {
            key: order.razorpayOrder.key,
            amount: order.razorpayOrder.amount,
            currency: order.razorpayOrder.currency,
            name: "PLE Marketplace",
            description: "Order Checkout Payment",
            order_id: order.razorpayOrder.id,
            handler: async function (response) {
              setIsPlacingOrder(true);
              try {
                await api.post("/user/payments/verify", {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  orderId: order.orderId || order.id,
                });

                localStorage.setItem(`earned_points_${order.orderId || order.id}`, order.loyaltyPointsEarned?.toString() || "0");
                localStorage.setItem(`applied_points_${order.orderId || order.id}`, appliedPoints.toString());

                clearCart();
                setOrderSuccess(true);
                setTimeout(() => {
                  navigate(`/order-confirmation/${order.orderId || order.id}`);
                }, 2000);
              } catch (verifyError) {
                toast.error(verifyError?.response?.data?.message || verifyError?.message || "Payment verification failed.");
                navigate(`/orders/${order.orderId || order.id}`);
              } finally {
                setIsPlacingOrder(false);
              }
            },
            prefill: {
              name: normalizedShipping.name,
              email: normalizedShipping.email,
              contact: normalizedShipping.phone,
            },
            theme: {
              color: "#7B0A0A",
            },
            modal: {
              ondismiss: function () {
                toast.error("Payment checkout cancelled.");
                setIsPlacingOrder(false);
                navigate(`/orders/${order.orderId || order.id}`);
              },
            },
          };

          const rzp = new window.Razorpay(options);
          rzp.open();
        } else {
          localStorage.setItem(`earned_points_${order.orderId || order.id}`, order.loyaltyPointsEarned?.toString() || "0");
          localStorage.setItem(`applied_points_${order.orderId || order.id}`, appliedPoints.toString());

          clearCart();
          setOrderSuccess(true);
          setTimeout(() => {
            navigate(`/order-confirmation/${order.orderId || order.id}`);
          }, 2000);
        }
      } catch (error) {
        toast.error(error?.message || "Failed to place order");
      } finally {
        setIsPlacingOrder(false);
      }
    }
  };

  const handleCompleteUpiOrder = async () => {
    if (isPlacingOrder) return;
    setIsPlacingOrder(true);
    try {
      const remainder = finalTotal;
      const finalPaymentMethod = 'upi';

      const order = await createOrder({
        userId: isAuthenticated ? user?.id : null,
        items: items,
        shippingAddress: shippingDetails,
        paymentMethod: finalPaymentMethod,
        subtotal: total,
        shipping: shipping,
        tax: tax,
        discount: discount,
        total: finalTotal,
        couponCode: appliedCoupon ? (appliedCoupon.code || couponCode.trim().toUpperCase()) : null,
        shippingOption,

      });

      if (appliedPoints > 0) {
        redeemPoints(appliedPoints, order.id);
      }
      const ptsEarned = earnPoints(finalTotal, order.id);
      localStorage.setItem(`earned_points_${order.id}`, ptsEarned.toString());
      localStorage.setItem(`applied_points_${order.id}`, appliedPoints.toString());

      clearCart();
      toast.success("Order placed successfully!");
      setShowUpiRedirect(false);
      navigate(`/order-confirmation/${order.id}`);
    } catch (error) {
      toast.error(error?.message || "Failed to place order");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        {/* Success Interstitial Modal */}
      {createPortal(
        <AnimatePresence>
          {orderSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
              className="bg-white/80 backdrop-blur-md flex flex-col items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex flex-col items-center bg-white p-8 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-100 max-w-sm w-full text-center relative overflow-hidden"
              >
                {/* Decorative background glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b from-green-50 to-transparent opacity-50 -z-10" />
                
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 bg-gradient-to-tr from-green-500 to-emerald-400 rounded-2xl rotate-3 flex items-center justify-center mb-6 shadow-xl shadow-green-500/20"
                >
                  <motion.div
                    initial={{ rotate: -3 }}
                    animate={{ rotate: 0 }}
                  >
                    <FiCheck className="text-white text-4xl" strokeWidth={3} />
                  </motion.div>
                </motion.div>
                
                <h2 className="text-2xl font-extrabold text-gray-900 mb-2 tracking-tight">Order Successful!</h2>
                <p className="text-gray-500 text-sm font-medium">Sit tight, we are redirecting you.</p>
                
                <div className="mt-8 w-full max-w-[200px]">
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                     <motion.div 
                       initial={{ width: "0%" }}
                       animate={{ width: "100%" }}
                       transition={{ duration: 2, ease: "linear" }}
                       className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                     />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="flex flex-col min-h-screen bg-gray-50 pb-32">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
            {/* Title Bar */}
            <div className="px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <FiArrowLeft className="text-xl text-gray-700" />
              </button>
              <h1 className="text-xl font-bold text-gray-800">Checkout</h1>
            </div>
            {/* Steps Bar */}
            <div className="px-4 pb-3">
              <MobileCheckoutSteps currentStep={step} totalSteps={2} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="lg:px-4 lg:py-6">
            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              {/* Left Column - Steps */}
              <div className="lg:col-span-8 space-y-6">
                {/* Step 1: Shipping Information */}
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="px-4 py-4 lg:p-0">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <FiTruck className="text-primary-600" />
                      Shipping Information
                    </h2>

                    {/* Saved Addresses */}
                    {isAuthenticated && addresses.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                          Saved Addresses
                        </h3>
                        <div className="space-y-2 mb-3">
                          {addresses.map((address) => (
                            <div
                              key={address.id}
                              onClick={() => handleSelectAddress(address)}
                              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedAddressId === address.id
                                ? "border-primary-500 bg-primary-50"
                                : "border-gray-200"
                                }`}>
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-2 flex-1">
                                  <FiMapPin className="text-primary-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <h4 className="font-bold text-gray-800 text-sm">
                                      {address.name}
                                    </h4>
                                    <p className="text-xs text-gray-600">
                                      {address.fullName}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      {address.address}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      {address.city}, {address.state}{" "}
                                      {address.zipCode}
                                    </p>
                                  </div>
                                </div>
                                {selectedAddressId === address.id && (
                                  <FiCheck className="text-primary-600 text-xl flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddressForm(true)}
                          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold text-sm">
                          <FiPlus />
                          Add New Address
                        </button>
                      </div>
                    )}

                    {/* Address Form */}
                    <div className="space-y-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm lg:p-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Email
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Address
                        </label>
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          required
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            City
                          </label>
                          <input
                            type="text"
                            name="city"
                            value={formData.city}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            State
                          </label>
                          <input
                            type="text"
                            name="state"
                            value={formData.state}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            ZIP Code
                          </label>
                          <input
                            type="text"
                            name="zipCode"
                            value={formData.zipCode}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Country
                          </label>
                          <input
                            type="text"
                            name="country"
                            value={formData.country}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Payment */}
                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="px-4 py-4 lg:p-0">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <FiCreditCard className="text-primary-600" />
                      Payment Method
                    </h2>

                      {isBusiness && (
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-blue-800 text-sm">Use Business Wallet Balance</span>
                            <span className="font-bold text-blue-900 text-sm">
                              ₹{((user?.role === 'b2bEmployee' ? user?.b2bWalletBalance : walletBalance) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={useWallet}
                              onChange={(e) => setUseWallet(e.target.checked)}
                              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs text-blue-700 font-medium">
                              Pay ₹{Math.min(((user?.role === 'b2bEmployee' ? user?.b2bWalletBalance : walletBalance) || 0), finalTotal).toLocaleString("en-IN")} from wallet
                            </span>
                          </label>

                          {useWallet && ((user?.role === 'b2bEmployee' ? user?.b2bWalletBalance : walletBalance) || 0) < finalTotal && (
                            <div className="text-xs text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                              Partial payment: Wallet covers ₹{((user?.role === 'b2bEmployee' ? user?.b2bWalletBalance : walletBalance) || 0).toLocaleString("en-IN")}. Remaining ₹{(finalTotal - ((user?.role === 'b2bEmployee' ? user?.b2bWalletBalance : walletBalance) || 0)).toLocaleString("en-IN")} will be paid online.
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-3 mb-6">
                        {(!useWallet || ((user?.role === 'b2bEmployee' ? user?.b2bWalletBalance : walletBalance) || 0) < finalTotal) ? (
                          [
                            {
                              id: "card",
                              title: "Online Payment (Razorpay)",
                              desc: "Pay securely via Credit/Debit Cards, UPI, NetBanking & Wallets",
                              badge: "Instant & Secure",
                              icon: "⚡"
                            },
                            {
                              id: "cash",
                              title: "Cash on Delivery (COD)",
                              desc: "Pay in cash upon physical order delivery",
                              badge: "Pay at Doorstep",
                              icon: "💵"
                            }
                          ].map((option) => (
                            <label
                              key={option.id}
                              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                formData.paymentMethod === option.id
                                  ? "border-primary-500 bg-primary-50/60 shadow-sm"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                            >
                              <input
                                type="radio"
                                name="paymentMethod"
                                value={option.id}
                                checked={formData.paymentMethod === option.id}
                                onChange={handleInputChange}
                                className="w-5 h-5 text-primary-500 mt-1 cursor-pointer"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                                    <span>{option.icon} {option.title}</span>
                                  </span>
                                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                                    {option.badge}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                                  {option.desc}
                                </p>
                              </div>
                            </label>
                          ))
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-emerald-800 text-sm font-semibold flex items-center gap-2">
                            <FiCheck className="w-5 h-5 text-emerald-600" />
                            <span>Full payment will be processed via Wallet. No other payment method required.</span>
                          </div>
                        )}
                      </div>

                    {/* B2C/B2B Smart Shipping Options */}
                    <div className="mb-6">
                      <h3 className="text-base font-bold text-gray-800 mb-3">
                        Shipping & Logistics Options
                      </h3>
                      {isBusiness ? (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="shippingOption"
                              value="bulk"
                              checked={true}
                              readOnly
                              className="w-5 h-5 text-primary-500 mt-1"
                            />
                            <div className="flex-1">
                              <span className="font-extrabold text-[#7B0A0A] text-base flex items-center gap-1.5">
                                <span>📦 B2B Bulk Pallet Dispatch</span>
                                <span className="bg-red-100 text-[#7B0A0A] text-[9px] uppercase font-black px-2 py-0.5 rounded-full border border-red-200">
                                  Enterprise SLA
                                </span>
                              </span>
                              <p className="text-xs text-[#7B0A0A] font-bold mt-1">
                                Estimated Handover: 3–5 Business Days
                              </p>
                              <p className="text-[10px] text-[#7B0A0A]/80 leading-normal mt-1">
                                High-volume pallet security dispatch with priority freight logistics. Delivery is fully vetted and audited for business invoice clearance.
                              </p>
                            </div>
                            <span className="font-black text-[#7B0A0A] shrink-0 text-sm">
                              {formatPrice(1500)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Express Local same-city shipping option */}
                          <label
                            className={`flex items-start justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${shippingOption === "express"
                              ? "border-primary-500 bg-primary-50"
                              : "border-gray-200"
                              }`}>
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="shippingOption"
                                value="express"
                                checked={shippingOption === "express"}
                                onChange={(e) => setShippingOption(e.target.value)}
                                className="w-5 h-5 text-primary-500 mt-1"
                              />
                              <div>
                                <span className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                                  <span>⚡ Local Same-City Express</span>
                                </span>
                                <p className="text-xs text-gray-700 font-semibold mt-0.5">
                                  Delivered inside 8–16 Hours
                                </p>
                                <p className="text-[10px] text-gray-400 leading-normal mt-0.5 max-w-[280px]">
                                  Guaranteed same-day local dispatch loop inside municipal metro limits.
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-gray-800 shrink-0">
                              {formatPrice(150)}
                            </span>
                          </label>

                          {/* Standard shipping option */}
                          <label
                            className={`flex items-start justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${shippingOption === "standard"
                              ? "border-primary-500 bg-primary-50"
                              : "border-gray-200"
                              }`}>
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="shippingOption"
                                value="standard"
                                checked={shippingOption === "standard"}
                                onChange={(e) => setShippingOption(e.target.value)}
                                className="w-5 h-5 text-primary-500 mt-1"
                              />
                              <div>
                                <span className="font-bold text-gray-800 text-base">
                                  Standard National Courier
                                </span>
                                <p className="text-xs text-gray-700 font-semibold mt-0.5">
                                  Delivered in 2–4 Business Days
                                </p>
                                <p className="text-[10px] text-gray-400 leading-normal mt-0.5 max-w-[280px]">
                                  Nationwide delivery via regional express cargo lines.
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-gray-800 shrink-0">
                              {total >= 100 ? "FREE" : formatPrice(50)}
                            </span>
                          </label>
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-500 mt-2 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Logistics Cost Verified: {formatPrice(shipping)}</span>
                      </p>
                    </div>

                    {/* Loyalty Points Redemption (B2C Only, Flipkart Style Toggle) */}
                    {!isBusiness && loyaltyConfig?.enabled && (() => {
                      const redemptionRatio = loyaltyConfig?.redemptionRatio || 0.2;
                      const minRedeemPoints = loyaltyConfig?.minRedeemPoints || 50;
                      const maxRedemptionPercent = loyaltyConfig?.maxRedemptionPercent || 50;

                      // Calculate max discount allowed (up to maxRedemptionPercent% of subtotal after coupon)
                      const maxDiscountAllowed = ((total - couponDiscount) * maxRedemptionPercent) / 100;
                      const maxPointsNeeded = Math.floor(maxDiscountAllowed / redemptionRatio);
                      const autoPointsToApply = Math.min(availablePoints, maxPointsNeeded);
                      const potentialSavings = autoPointsToApply * redemptionRatio;

                      const handleCheckboxChange = (e) => {
                        if (e.target.checked) {
                          if (availablePoints < minRedeemPoints) {
                            toast.error(`Minimum redemption amount is ${minRedeemPoints} points.`);
                            e.target.checked = false;
                            return;
                          }
                          setAppliedPoints(autoPointsToApply);
                          toast.success(`Applied ${autoPointsToApply} loyalty points! Saved ${formatPrice(potentialSavings)}`);
                        } else {
                          setAppliedPoints(0);
                          toast.success("Loyalty points removed");
                        }
                      };

                      return (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex items-center justify-between">
                          <label htmlFor="loyalty-checkbox" className="flex items-center gap-3 cursor-pointer select-none flex-1">
                            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shrink-0">
                              <FiAward className="text-xl" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-gray-800">
                                Use Loyalty Points
                              </h3>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Balance: <strong className="text-amber-700">{availablePoints} Points</strong> (worth {formatPrice(availablePoints * redemptionRatio)})
                              </p>
                              {availablePoints >= minRedeemPoints ? (
                                <p className="text-xs text-emerald-600 font-semibold mt-1">
                                  Check to save {formatPrice(potentialSavings)} using {autoPointsToApply} points
                                </p>
                              ) : (
                                <p className="text-xs text-red-500 mt-1">
                                  Min {minRedeemPoints} points required to redeem
                                </p>
                              )}
                            </div>
                          </label>
                          <div className="flex items-center justify-center pl-4">
                            <input
                              type="checkbox"
                              id="loyalty-checkbox"
                              checked={appliedPoints > 0}
                              onChange={handleCheckboxChange}
                              className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Coupon Code */}
                    <div className="mb-6">
                      <h3 className="text-base font-semibold text-gray-800 mb-3">
                        Coupon Code
                      </h3>
                      {!appliedCoupon ? (
                        <>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value)}
                              placeholder="Enter code"
                              className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyCoupon()}
                              disabled={isApplyingCoupon}
                              className="px-4 py-3 gradient-green text-white rounded-xl font-semibold hover:shadow-glow-green transition-all">
                              {isApplyingCoupon ? "Applying..." : "Apply"}
                            </button>
                          </div>
                          {availableCoupons.length > 0 && (
                            <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                              <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <FiTag className="text-primary-600" />
                                Available coupons
                              </h4>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {availableCoupons.slice(0, 8).map((coupon) => (
                                  <button
                                    key={coupon._id || coupon.code}
                                    type="button"
                                    onClick={() => handleApplyCoupon(coupon.code)}
                                    disabled={isApplyingCoupon}
                                    className="w-full text-left p-2 bg-white rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-semibold text-gray-800">{coupon.code}</p>
                                      <p className="text-xs font-semibold text-primary-700">
                                        {coupon.type === "percentage"
                                          ? `${coupon.value}% OFF`
                                          : coupon.type === "fixed"
                                            ? `${formatPrice(coupon.value)} OFF`
                                            : "Free Shipping"}
                                      </p>
                                    </div>
                                    <p className="text-xs text-gray-600">
                                      Min order: {formatPrice(coupon.minOrderValue || 0)}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                          <div>
                            <p className="text-sm font-semibold text-green-800">
                              {appliedCoupon.code || "Coupon"} Applied
                            </p>
                            <p className="text-xs text-green-600">
                              Code: {couponCode}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAppliedCoupon(null);
                              setAppliedDiscount(0);
                              setCouponCode("");
                            }}
                            className="text-red-600 hover:text-red-700">
                            <FiX className="text-lg" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Available Offers & Suggestions (UI Only) */}
                    <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 text-primary-600">
                        <FiTag className="text-lg" />
                        <h3 className="text-sm font-extrabold text-gray-800 uppercase tracking-wide">
                          Available Savings & Offers
                        </h3>
                      </div>
                      
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-emerald-800">Potential Savings Available</p>
                          <p className="text-[10px] text-emerald-600">Try applying coupon codes listed below to save extra.</p>
                        </div>
                        <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                          Save Up To 20%
                        </span>
                      </div>

                      {/* Coupon Suggestions */}
                      <div className="space-y-2">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-gray-850">🏦 SBI Card 10% Discount</span>
                            <span className="font-mono font-bold text-[#C07A3D]">SBISAVE10</span>
                          </div>
                          <p className="text-[10px] text-gray-400">Min transaction: ₹5,000. Save up to ₹1,500.</p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-gray-850">🎉 Site-wide Festival Sale</span>
                            <span className="font-mono font-bold text-[#C07A3D]">FESTIVAL20</span>
                          </div>
                          <p className="text-[10px] text-gray-400">Flat 20% off all products across clothing & accessories.</p>
                        </div>
                      </div>
                    </div>

                    {/* Order Summary (Mobile Only) */}
                    <div className="glass-card rounded-xl p-4 lg:hidden">
                      <OrderSummary
                        itemsByVendor={itemsByVendor}
                        total={total}
                        discount={discount}
                        shipping={shipping}
                        tax={tax}
                        finalTotal={finalTotal}
                        formatPrice={formatPrice}
                        pointsDiscount={pointsDiscount}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Right Column - Desktop Order Summary */}
              <div className="hidden lg:block lg:col-span-4">
                <div className="sticky top-24 space-y-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <OrderSummary
                      itemsByVendor={itemsByVendor}
                      total={total}
                      discount={discount}
                      shipping={shipping}
                      tax={tax}
                      finalTotal={finalTotal}
                      formatPrice={formatPrice}
                      pointsDiscount={pointsDiscount}
                    />
                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                      <button
                        type="submit"
                        disabled={step === 2 && isPlacingOrder}
                        className="w-full gradient-green text-white py-3.5 rounded-xl font-bold text-lg shadow-lg hover:shadow-glow-green transition-all duration-300 transform hover:-translate-y-0.5">
                        {step === 2 ? (isPlacingOrder ? "Placing Order..." : "Place Order") : "Continue to Payment"}
                      </button>
                      {step === 2 && (
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="w-full mt-3 py-2 text-gray-500 font-semibold hover:text-gray-700 transition-colors text-sm">
                          Back to Shipping
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Trust Badges or Info */}
                  <div className="flex justify-center gap-4 text-gray-400 text-2xl pt-2 opacity-70">
                    <FiLock className="w-6 h-6" />
                    <span className="text-xs text-gray-500">Secure Checkout</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons (Mobile Fixed Bottom) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 sm:p-4 z-40 safe-area-bottom lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
              <div className="flex gap-2 sm:gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="px-4 sm:px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors text-sm sm:text-base">
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={step === 2 && isPlacingOrder}
                  className="flex-1 gradient-green text-white py-3 rounded-xl font-semibold hover:shadow-glow-green transition-all duration-300 text-sm sm:text-base">
                  {step === 2 ? (isPlacingOrder ? "Placing..." : "Place Order") : "Continue"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Address Form Modal */}
        <AnimatePresence>
          {showAddressForm && (
            <AddressFormModal
              onSubmit={handleNewAddress}
              onCancel={() => setShowAddressForm(false)}
            />
          )}
        </AnimatePresence>
      </MobileLayout>
    </PageTransition>
  );
};

// Address Form Modal Component
const AddressFormModal = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: "",
    fullName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onCancel}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl p-6 w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">Add New Address</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full">
            <FiX className="text-xl" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Address Label
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
              placeholder="Home, Work, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Street Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Zip Code
              </label>
              <input
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Country
            </label>
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 gradient-green text-white py-3 rounded-xl font-semibold hover:shadow-glow-green transition-all">
              Add Address
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// Simulated Fullscreen UPI redirect payment gateway
const UpiRedirectModal = ({ show, upiApp, totalAmount, onSuccess, onCancel }) => {
  const [paymentState, setPaymentState] = useState("redirecting"); // "redirecting" | "authorizing"

  useEffect(() => {
    if (show) {
      setPaymentState("redirecting");
      // Stage 1: Redirecting simulation (1.5 seconds)
      const redirectTimer = setTimeout(() => {
        setPaymentState("authorizing");
      }, 1500);

      return () => clearTimeout(redirectTimer);
    }
  }, [show]);

  // Theme configuration based on the chosen app
  const appThemes = {
    gpay: {
      name: "Google Pay",
      bgColor: "bg-blue-600",
      textColor: "text-blue-900",
      bgLight: "bg-blue-50",
      borderColor: "border-blue-200",
      btnColor: "bg-blue-600 hover:bg-blue-750 focus:ring-blue-400",
      logo: "🟢",
    },
    phonepe: {
      name: "PhonePe",
      bgColor: "bg-purple-700",
      textColor: "text-purple-900",
      bgLight: "bg-purple-50",
      borderColor: "border-purple-200",
      btnColor: "bg-purple-700 hover:bg-purple-800 focus:ring-purple-400",
      logo: "🟣",
    },
    paytm: {
      name: "Paytm",
      bgColor: "bg-cyan-600",
      textColor: "text-cyan-900",
      bgLight: "bg-cyan-50",
      borderColor: "border-cyan-200",
      btnColor: "bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-400",
      logo: "🔵",
    },
  };

  const theme = appThemes[upiApp] || appThemes.gpay;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
      className="bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full border border-gray-150 flex flex-col min-h-[420px]"
      >
        {/* App Bar Header */}
        <div className={`p-5 ${theme.bgColor} text-white flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{theme.logo}</span>
            <span className="font-extrabold tracking-wide text-lg">{theme.name}</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
            Secure UPI
          </span>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-6">
          {paymentState === "redirecting" && (
            <div className="space-y-4 py-8">
              <div className="w-16 h-16 border-4 border-t-transparent border-teal-500 rounded-full animate-spin mx-auto"></div>
              <p className="font-bold text-gray-750 text-base">
                Redirecting to {theme.name} sandbox...
              </p>
              <p className="text-xs text-gray-400">
                Launching payment interface. Do not refresh or press back.
              </p>
            </div>
          )}

          {paymentState === "authorizing" && (
            <div className="space-y-6 w-full">
              {/* Payment Details Card */}
              <div className={`${theme.bgLight} border ${theme.borderColor} rounded-2xl p-5 text-left space-y-3`}>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Merchant</span>
                  <span className="font-extrabold text-gray-800">PLE eCommerce Store</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Transaction ID</span>
                  <span className="font-mono font-bold text-gray-800">TXN{Date.now().toString().slice(-8)}</span>
                </div>
                <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">Total Payable Amount</span>
                  <span className="text-xl font-black text-gray-900">{formatPrice(totalAmount)}</span>
                </div>
              </div>

              {/* Action Prompt */}
              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-800">
                  Confirm UPI Authorization
                </p>
                <p className="text-xs text-gray-500 px-4">
                  Please tap the button below to simulate entering your security UPI PIN and complete payment transaction.
                </p>
              </div>

              {/* Complete / Cancel Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={onSuccess}
                  className={`w-full py-4 text-white font-bold rounded-xl transition-all ${theme.btnColor} shadow-lg flex items-center justify-center gap-2`}
                >
                  <span>Pay & Authorize</span>
                  <span className="font-black bg-white/20 px-2 py-1 rounded-lg text-sm">
                    {formatPrice(totalAmount)}
                  </span>
                </button>
                <button
                  onClick={onCancel}
                  className="w-full py-3 text-gray-500 font-semibold rounded-xl hover:bg-gray-100 transition-colors text-sm"
                >
                  Cancel Transaction
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Powered by logo */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-bold">
          <span>🔒 Powered by UPI Unified Payments Interface</span>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MobileCheckout;
