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
  FiPhone,
  FiEdit2,
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
  const { addresses, getDefaultAddress, addAddress, updateAddress, fetchAddresses } = useAddressStore();
  const { createOrder } = useOrderStore();
  
  const { availablePoints, rules: loyaltyConfig, fetchBalance, fetchConfig } = useLoyaltyStore();
  const [pointsToApply, setPointsToApply] = useState("");
  const [appliedPoints, setAppliedPoints] = useState(0);
  
  const { isBusiness } = useBusinessBuyer();
  const { balance: walletBalance, fetchWallet } = useWalletStore();
  const [useWallet, setUseWallet] = useState(false);

  const userWalletBalance = user?.role === 'b2bEmployee' ? (user?.b2bWalletBalance || 0) : (walletBalance || 0);
  const isWalletZero = isAuthenticated && userWalletBalance <= 0;
  const employeeSpendingLimit = (user?.role === 'b2bEmployee' && Number(user?.b2bSpendingLimit) > 0)
    ? Number(user.b2bSpendingLimit)
    : null;
  const effectiveWalletUsable = employeeSpendingLimit !== null
    ? Math.min(userWalletBalance, employeeSpendingLimit)
    : userWalletBalance;

  useEffect(() => {
    if (isAuthenticated) {
      fetchWallet().catch(() => null);
    }
  }, [isAuthenticated, fetchWallet]);

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
  const [showAddressListModal, setShowAddressListModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  const activeSelectedAddress = useMemo(() => {
    if (!addresses || addresses.length === 0) return null;
    return addresses.find((a) => a.id === selectedAddressId) || getDefaultAddress() || addresses[0];
  }, [addresses, selectedAddressId, getDefaultAddress]);
  const [couponCode, setCouponCode] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [b2bSettings, setB2bSettings] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [shippingOption, setShippingOption] = useState(() => isBusiness ? "bulk" : "standard");
  const [estimatedShipping, setEstimatedShipping] = useState(null);
  const [isEstimatingShipping, setIsEstimatingShipping] = useState(false);
  const [isCodAvailable, setIsCodAvailable] = useState(true);
  const [isServiceable, setIsServiceable] = useState(true);
  const [courierBreakdown, setCourierBreakdown] = useState(null);
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
        const payload = response?.data?.data ?? response?.data ?? response;
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
        name: prev.name || baseName,
        email: prev.email || baseEmail,
        phone: prev.phone || basePhone,
        address: prev.address || baseAddress,
        country: prev.country || "India",
      }));

      const activeAddress = (selectedAddressId && addresses.find((a) => a.id === selectedAddressId))
        || defaultAddress
        || (addresses.length > 0 ? addresses[0] : null);

      if (activeAddress) {
        setSelectedAddressId(activeAddress.id);
        setFormData((prev) => ({
          ...prev,
          name: activeAddress.fullName || activeAddress.name || baseName,
          email: prev.email || baseEmail,
          phone: activeAddress.phone || basePhone,
          address: activeAddress.address || baseAddress,
          city: activeAddress.city || "",
          zipCode: activeAddress.zipCode || "",
          state: activeAddress.state || "",
          country: activeAddress.country || "India",
        }));
      }
    }
  }, [isAuthenticated, user, dbCompanyProfile, isBusiness, getDefaultAddress, addresses]);

  const [liveGstRates, setLiveGstRates] = useState({});

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
          const currentItems = useCartStore.getState().items;
          let changed = false;
          const updatedItems = currentItems.map((itm) => {
            const freshRate = rates[String(itm.id)];
            if (freshRate !== undefined && itm.gstRate !== freshRate) {
              changed = true;
              return { ...itm, gstRate: freshRate, taxRate: freshRate };
            }
            return itm;
          });
          if (changed) {
            useCartStore.setState({ items: updatedItems });
          }
        }
      } catch (err) {
        console.error("Failed to sync cart GST", err);
      }
    };
    syncCartGst();
    return () => { isCancelled = true; };
  }, [items.length]);

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

  const gstBreakdown = useMemo(() => {
    let totalTaxSum = 0;
    const slabs = {};
    const tot = getTotal();
    const coupDisc = appliedCoupon ? appliedDiscount : 0;
    const discountRatio = tot > 0 ? Math.min(1, coupDisc / tot) : 0;

    (items || []).forEach((item) => {
      const itemQty = Math.max(1, Number(item.quantity || 1));
      const itemPrice = Math.max(0, Number(item.price || 0));
      const itemSubtotal = itemPrice * itemQty;
      const itemDisc = itemSubtotal * discountRatio;
      const netTaxable = Math.max(0, itemSubtotal - itemDisc);
      const liveRate = liveGstRates[String(item.id)];
      const effectiveGstRate = Number(
        liveRate ?? item.gstRate ?? item.resolvedGstRate ?? item.taxRate ?? 18
      );
      const itemTax = (netTaxable * effectiveGstRate) / 100;
      totalTaxSum += itemTax;

      const rateKey = `${effectiveGstRate}%`;
      if (!slabs[rateKey]) {
        slabs[rateKey] = {
          rate: effectiveGstRate,
          taxableAmount: 0,
          taxAmount: 0,
          count: 0
        };
      }
      slabs[rateKey].taxableAmount += netTaxable;
      slabs[rateKey].taxAmount += itemTax;
      slabs[rateKey].count += itemQty;
    });

    return {
      totalTax: parseFloat(totalTaxSum.toFixed(2)),
      slabs: Object.values(slabs).sort((a, b) => b.rate - a.rate)
    };
  }, [items, liveGstRates, appliedCoupon, appliedDiscount]);

  const total = getTotal();
  const shipping = estimatedShipping !== null ? estimatedShipping : calculateShippingFallback();
  const couponDiscount = appliedCoupon ? appliedDiscount : 0;
  const tax = gstBreakdown.totalTax;
  const prePointsTotal = total + shipping + tax;
  const maxRedeemableCash = Math.min(prePointsTotal, appliedPoints * (loyaltyConfig?.redemptionRatio || 0.2));
  const pointsDiscount = maxRedeemableCash;
  const discount = couponDiscount + pointsDiscount;
  const taxableAmount = Math.max(0, total - couponDiscount);
  const finalTotal = Math.max(0, prePointsTotal - pointsDiscount);

  function taxAmount(tot, coupDisc) {
    return gstBreakdown.totalTax;
  }

  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
    }
  }, [total, appliedCoupon]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      const validItems = items
        .map((item) => ({
          productId: item?.id,
          quantity: Number(item?.quantity || 1),
          variant: item?.variant || undefined,
        }))
        .filter((item) => item.productId);

      if (!validItems.length) {
        if (active) {
          setEstimatedShipping(0);
          setIsCodAvailable(true);
          setIsServiceable(true);
        }
        return;
      }

      setIsEstimatingShipping(true);
      try {
        const response = await api.post(
          "/shipping/estimate",
          {
            items: validItems,
            shippingAddress: {
              address: String(formData.address || "").trim(),
              city: String(formData.city || "").trim(),
              state: String(formData.state || "").trim(),
              zipCode: String(formData.zipCode || "").trim(),
              pincode: String(formData.zipCode || "").trim(),
              country: String(formData.country || "").trim(),
            },
            shippingOption,
            paymentMethod: formData.paymentMethod === "cash" ? "cod" : "prepaid",
            couponType: appliedCoupon?.type || null,
          },
          { signal: controller.signal }
        );

        const payload = response?.data ?? response;
        const nextShipping = Number(payload?.shipping);
        if (active) {
          setEstimatedShipping(Number.isFinite(nextShipping) ? nextShipping : null);
          if (payload?.isCodAvailable !== undefined) {
            setIsCodAvailable(Boolean(payload.isCodAvailable));
          }
          if (payload?.isServiceable !== undefined) {
            setIsServiceable(Boolean(payload.isServiceable));
          }
          if (payload?.courierInfo) {
            setCourierBreakdown(payload.courierInfo);
          }
        }
      } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") {
          return;
        }
        if (active) {
          setEstimatedShipping(null);
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
  }, [
    items,
    formData.zipCode,
    formData.city,
    formData.state,
    formData.country,
    formData.paymentMethod,
    shippingOption,
    appliedCoupon?.type
  ]);

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
    if (!address) return;
    const addressId = address.id || address._id;
    setSelectedAddressId(addressId);
    setFormData((prev) => ({
      ...prev,
      name: address.fullName || address.name || prev.name,
      phone: address.phone || prev.phone,
      address: address.address || prev.address,
      city: address.city || prev.city,
      zipCode: address.zipCode || prev.zipCode,
      state: address.state || prev.state,
      country: address.country || prev.country || "India",
    }));
  };

  const handleSaveAddress = async (addressData) => {
    try {
      if (editingAddress) {
        const addressId = editingAddress.id || editingAddress._id;
        const updated = await updateAddress(addressId, addressData);
        const resolved = updated || { ...editingAddress, ...addressData };
        handleSelectAddress(resolved);
        toast.success("Address updated successfully!");
      } else {
        const newAddress = await addAddress(addressData);
        handleSelectAddress(newAddress);
        toast.success("Address added and selected!");
      }
      setShowAddressForm(false);
      setEditingAddress(null);
    } catch (error) {
      toast.error(error?.message || "Failed to save address");
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

    if (formData.paymentMethod === 'cash' && !isCodAvailable && /^\d{6}$/.test(normalizedShipping.zipCode)) {
      toast.error(`Cash on Delivery is not available for pincode ${normalizedShipping.zipCode}. Please select Online Payment.`);
      return;
    }

    if (!isServiceable && /^\d{6}$/.test(normalizedShipping.zipCode)) {
      toast.error(`Delivery is currently not serviceable to pincode ${normalizedShipping.zipCode}. Please verify your address.`);
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
      if (isAuthenticated && addresses.length === 0 && normalizedShipping.address) {
        addAddress({
          name: "Home",
          fullName: normalizedShipping.name,
          phone: normalizedShipping.phone,
          address: normalizedShipping.address,
          city: normalizedShipping.city,
          state: normalizedShipping.state,
          zipCode: normalizedShipping.zipCode,
          country: normalizedShipping.country || "India",
          isDefault: true,
        }).catch(() => null);
      }
      setStep(2);
    } else if (step === 2) {
      setIsPlacingOrder(true);
      try {
        const walletAmountToUse = useWallet ? Math.min(effectiveWalletUsable, finalTotal) : 0;
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
        const errorMsg = error?.response?.data?.message || (Array.isArray(error?.response?.data?.errors) && error?.response?.data?.errors[0]?.message) || error?.message || "Failed to place order";
        toast.error(errorMsg);
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
            <div className="max-w-7xl mx-auto w-full">
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
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              {/* Left Column - Steps */}
              <div className="lg:col-span-8 space-y-6">
                {/* Step 1: Shipping Information */}
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="px-4 py-4 lg:p-0">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FiTruck className="text-primary-600" />
                        Delivery Address
                      </h2>
                      {isAuthenticated && addresses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAddress(null);
                            setShowAddressForm(true);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-xl transition-all border border-primary-200"
                        >
                          <FiPlus className="text-sm" /> Add New Address
                        </button>
                      )}
                    </div>

                    {/* If user has saved addresses, display the selected address card */}
                    {isAuthenticated && addresses.length > 0 && activeSelectedAddress ? (
                      <div className="bg-white rounded-2xl border-2 border-primary-500 shadow-sm p-4 sm:p-5 relative transition-all">
                        {/* Header & Badges */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 bg-primary-100 text-primary-800 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1">
                              <FiMapPin className="text-xs" />
                              {activeSelectedAddress.name || "Delivery Address"}
                            </span>
                            {activeSelectedAddress.isDefault && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-semibold rounded-md">
                                Default
                              </span>
                            )}
                            <span className="text-[11px] text-green-700 bg-green-50 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <FiCheck className="text-xs" /> Delivering Here
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAddress(activeSelectedAddress);
                                setShowAddressForm(true);
                              }}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                              title="Edit this address"
                            >
                              <FiEdit2 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAddressListModal(true)}
                              className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                            >
                              Change
                            </button>
                          </div>
                        </div>

                        {/* Address Details */}
                        <div className="space-y-1.5 text-sm text-gray-700">
                          <p className="font-bold text-base text-gray-900 flex items-center gap-2">
                            {formData.name || activeSelectedAddress.fullName || activeSelectedAddress.name}
                            {(formData.phone || activeSelectedAddress.phone) && (
                              <span className="text-xs font-normal text-gray-500 flex items-center gap-1">
                                <FiPhone size={12} className="text-gray-400" />
                                {formData.phone || activeSelectedAddress.phone}
                              </span>
                            )}
                          </p>
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {formData.address || activeSelectedAddress.address}
                          </p>
                          <p className="text-gray-700 text-sm font-medium">
                            {[formData.city || activeSelectedAddress.city, formData.state || activeSelectedAddress.state].filter(Boolean).join(", ")} - <span className="font-bold text-gray-900">{formData.zipCode || activeSelectedAddress.zipCode}</span>
                          </p>
                          {(formData.country || activeSelectedAddress.country) && (
                            <p className="text-xs text-gray-500">
                              {formData.country || activeSelectedAddress.country}
                            </p>
                          )}
                        </div>

                        {/* Serviceability / Estimated Courier info badge */}
                        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            {isEstimatingShipping ? (
                              <span className="text-gray-400 animate-pulse flex items-center gap-1">
                                Checking delivery serviceability...
                              </span>
                            ) : isServiceable ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <FiCheck className="text-emerald-600" /> Serviceable by Shiprocket couriers
                              </span>
                            ) : (
                              <span className="text-red-600 font-semibold">
                                ⚠️ Pincode {formData.zipCode} not serviceable
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowAddressListModal(true)}
                            className="text-xs text-primary-600 hover:text-primary-700 font-bold"
                          >
                            {addresses.length > 1
                              ? `Choose from ${addresses.length} saved addresses →`
                              : "+ Add another address"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Address Form for first-time / guest users without saved addresses */
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
                            placeholder="Recipient's full name"
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
                              placeholder="example@mail.com"
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
                              placeholder="10-digit mobile number"
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Address (House / Flat / Street / Area)
                          </label>
                          <textarea
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            required
                            rows={3}
                            placeholder="Street address, flat/house number, landmark"
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
                              placeholder="City"
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
                              placeholder="State"
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              ZIP / PIN Code
                            </label>
                            <input
                              type="text"
                              name="zipCode"
                              value={formData.zipCode}
                              onChange={handleInputChange}
                              required
                              placeholder="6-digit pincode"
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
                              placeholder="Country"
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-base"
                            />
                          </div>
                        </div>
                      </div>
                    )}
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
                              ₹{userWalletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {employeeSpendingLimit !== null && (
                            <div className="text-xs text-blue-800 bg-blue-100/70 border border-blue-200/60 px-3 py-1.5 rounded-xl flex items-center justify-between">
                              <span className="font-medium">Per-Order Spending Limit:</span>
                              <span className="font-bold">₹{employeeSpendingLimit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={useWallet}
                              onChange={(e) => setUseWallet(e.target.checked)}
                              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs text-blue-700 font-medium">
                              Pay ₹{Math.min(effectiveWalletUsable, finalTotal).toLocaleString("en-IN")} from wallet
                              {employeeSpendingLimit !== null && effectiveWalletUsable < userWalletBalance && (
                                <span className="ml-1 text-[11px] text-blue-600 font-semibold">(Capped by spending limit)</span>
                              )}
                            </span>
                          </label>

                          {useWallet && effectiveWalletUsable < finalTotal && (
                            <div className="text-xs text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                              Partial payment: Wallet covers ₹{effectiveWalletUsable.toLocaleString("en-IN")}. Remaining ₹{(finalTotal - effectiveWalletUsable).toLocaleString("en-IN")} will be paid online.
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-3 mb-6">
                        {(!useWallet || effectiveWalletUsable < finalTotal) ? (
                          [
                            {
                              id: "card",
                              title: "Online Payment (Razorpay)",
                              desc: "Pay securely via Credit/Debit Cards, UPI, NetBanking & Wallets",
                              badge: "Instant & Secure",
                              icon: "⚡",
                              disabled: false,
                            },
                            {
                              id: "cash",
                              title: "Cash on Delivery (COD)",
                              desc: "Pay in cash upon physical order delivery",
                              badge: (!isCodAvailable && /^\d{6}$/.test(String(formData.zipCode || "").trim())) ? "Unavailable for PIN" : "Pay at Doorstep",
                              icon: "💵",
                              disabled: !isCodAvailable && /^\d{6}$/.test(String(formData.zipCode || "").trim()),
                            }
                          ].map((option) => (
                            <label
                              key={option.id}
                              onClick={(e) => {
                                if (option.disabled) {
                                  e.preventDefault();
                                  toast.error(`Cash on Delivery is not available for delivery pincode ${formData.zipCode || ""}. Please select Online Payment.`);
                                }
                              }}
                              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                option.disabled
                                  ? "border-gray-200 bg-gray-50/70 opacity-60 cursor-not-allowed"
                                  : formData.paymentMethod === option.id
                                    ? "border-primary-500 bg-primary-50/60 shadow-sm"
                                    : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                            >
                              <input
                                type="radio"
                                name="paymentMethod"
                                value={option.id}
                                disabled={option.disabled}
                                checked={formData.paymentMethod === option.id && !option.disabled}
                                onChange={handleInputChange}
                                className="w-5 h-5 text-primary-500 mt-1 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-gray-800 text-base flex items-center gap-1.5">
                                    <span>{option.icon} {option.title}</span>
                                  </span>
                                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                                    option.disabled
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : "bg-gray-100 text-gray-600 border-gray-200"
                                  }`}>
                                    {option.badge}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                                  {option.desc}
                                </p>
                                {option.disabled && (
                                  <p className="text-[11px] text-red-600 font-semibold mt-1">
                                    ⚠️ Shiprocket couriers do not support Cash on Delivery for pincode {formData.zipCode}.
                                  </p>
                                )}
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
                      
                      <div className="text-xs text-gray-600 mt-2 font-bold flex flex-col gap-1 bg-gray-50 p-2.5 rounded-lg border border-gray-150">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Logistics Fee: {shipping === 0 ? "FREE" : formatPrice(shipping)}</span>
                          </span>
                          {courierBreakdown && Object.values(courierBreakdown)[0]?.source === 'shiprocket' && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-black">
                              🚀 Shiprocket Live
                            </span>
                          )}
                        </div>
                        {courierBreakdown && Object.values(courierBreakdown)[0]?.courierName && (
                          <p className="text-[11px] text-gray-500 font-normal">
                            Partner: <strong>{Object.values(courierBreakdown)[0].courierName}</strong> • Est. Delivery: {Object.values(courierBreakdown)[0].estimatedDays || '2-4 Days'}
                          </p>
                        )}
                      </div>
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
                          {!isWalletZero && availableCoupons.length > 0 && (
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
                        isEstimatingShipping={isEstimatingShipping}
                        paymentMethod={formData.paymentMethod}
                        courierBreakdown={courierBreakdown}
                        liveGstRates={liveGstRates}
                        gstSlabs={gstBreakdown.slabs}
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
                      isEstimatingShipping={isEstimatingShipping}
                      paymentMethod={formData.paymentMethod}
                      courierBreakdown={courierBreakdown}
                      liveGstRates={liveGstRates}
                      gstSlabs={gstBreakdown.slabs}
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

        {/* Address Selection Modal */}
        <AddressListModal
          show={showAddressListModal}
          addresses={addresses}
          selectedId={selectedAddressId || activeSelectedAddress?.id}
          onSelect={(addr) => {
            handleSelectAddress(addr);
            setShowAddressListModal(false);
            toast.success(`Delivering to ${addr.fullName || addr.name}`);
          }}
          onEdit={(addr) => {
            setEditingAddress(addr);
            setShowAddressListModal(false);
            setShowAddressForm(true);
          }}
          onAddNew={() => {
            setEditingAddress(null);
            setShowAddressListModal(false);
            setShowAddressForm(true);
          }}
          onClose={() => setShowAddressListModal(false)}
        />

        {/* Address Add / Edit Modal */}
        <AddressFormModal
          show={showAddressForm}
          initialData={editingAddress}
          onSubmit={handleSaveAddress}
          onCancel={() => {
            setShowAddressForm(false);
            setEditingAddress(null);
          }}
        />
      </MobileLayout>
    </PageTransition>
  );
};

// Address Selection List Modal Component
const AddressListModal = ({
  show,
  addresses = [],
  selectedId,
  onSelect,
  onEdit,
  onAddNew,
  onClose,
}) => {
  if (!show) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Select Delivery Address
              </h3>
              <p className="text-xs text-gray-500">
                Choose where you want your order delivered
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
            >
              <FiX className="text-xl" />
            </button>
          </div>

          {/* Address List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {addresses.map((address) => {
              const isSelected = selectedId === address.id;
              return (
                <div
                  key={address.id}
                  onClick={() => onSelect(address)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all relative ${
                    isSelected
                      ? "border-primary-500 bg-primary-50/60 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? "border-primary-600 bg-primary-600"
                              : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm">
                            {address.fullName || address.name}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md uppercase">
                            {address.name || "Home"}
                          </span>
                          {address.isDefault && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md">
                              Default
                            </span>
                          )}
                        </div>

                        {address.phone && (
                          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <FiPhone size={11} className="text-gray-400" /> {address.phone}
                          </p>
                        )}

                        <p className="text-xs text-gray-600 leading-relaxed">
                          {address.address}
                        </p>
                        <p className="text-xs text-gray-700 font-semibold mt-0.5">
                          {[address.city, address.state].filter(Boolean).join(", ")} - {address.zipCode}
                        </p>
                      </div>
                    </div>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(address);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-primary-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1 transition-colors shrink-0"
                    >
                      <FiEdit2 size={12} />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer with Add New button */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onAddNew}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all text-sm"
            >
              <FiPlus className="text-lg" />
              <span>Add New Address</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

// Address Form Modal Component (Add / Edit)
const AddressFormModal = ({ show, initialData = null, onSubmit, onCancel }) => {
  const isEditing = Boolean(initialData && (initialData.id || initialData._id));

  const [formData, setFormData] = useState({
    name: "Home",
    fullName: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
  });

  useEffect(() => {
    if (show && initialData) {
      setFormData({
        name: initialData.name || "Home",
        fullName: initialData.fullName || "",
        phone: initialData.phone || "",
        address: initialData.address || "",
        city: initialData.city || "",
        state: initialData.state || "",
        zipCode: initialData.zipCode || "",
        country: initialData.country || "India",
      });
    } else if (show && !initialData) {
      setFormData({
        name: "Home",
        fullName: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        country: "India",
      });
    }
  }, [show, initialData]);

  if (!show) return null;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim() || !formData.address.trim() || !formData.zipCode.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    onSubmit(formData);
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        >
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">
              {isEditing ? "Edit Delivery Address" : "Add New Delivery Address"}
            </h3>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
            >
              <FiX className="text-xl" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Address Label
                </label>
                <select
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                >
                  <option value="Home">Home</option>
                  <option value="Work">Work / Office</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="Recipient Name"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Street Address *
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                rows={2}
                placeholder="Flat / House no., Building, Street, Landmark"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  placeholder="City"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  State *
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required
                  placeholder="State"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  PIN / ZIP Code *
                </label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  required
                  placeholder="6-digit pincode"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Country *
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  required
                  placeholder="Country"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <button
                type="submit"
                className="flex-1 gradient-green text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all text-sm"
              >
                {isEditing ? "Update Address" : "Save Address"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
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
