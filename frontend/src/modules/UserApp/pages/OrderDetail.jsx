import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiPackage, FiTruck, FiMapPin, FiCreditCard, FiRotateCw, FiArrowLeft, FiShoppingBag, FiX, FiDownload, FiEye, FiMail } from 'react-icons/fi';
import { motion } from 'framer-motion';
import MobileLayout from "../components/Layout/MobileLayout";
import InvoiceModal from '../../../shared/components/InvoiceModal';
import { useOrderStore } from '../../../shared/store/orderStore';
import { useCartStore } from '../../../shared/store/useStore';
import { formatPrice } from '../../../shared/utils/helpers';
import { formatVariantLabel, getVariantSignature } from '../../../shared/utils/variant';
import toast from 'react-hot-toast';
import PageTransition from '../../../shared/components/PageTransition';
import Badge from '../../../shared/components/Badge';
import LazyImage from '../../../shared/components/LazyImage';
import socketService from '../../../shared/utils/socket';
import api from '../../../shared/utils/api';
import OrderStatusTimeline from '../../../shared/components/OrderStatusTimeline';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const MobileOrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { getOrder, cancelOrder, fetchOrderById, requestReturn, fetchUserReturns } = useOrderStore();
  const { addItem } = useCartStore();
  const [isResolving, setIsResolving] = useState(true);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('Product issue');
  const [returnVendorId, setReturnVendorId] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [existingReturn, setExistingReturn] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (orderId) {
      fetchOrderById(orderId).finally(() => {
        if (mounted) setIsResolving(false);
      });
    }

    fetchUserReturns().then(returns => {
      if (mounted) {
        const found = returns.find(r => String(r.orderId) === String(orderId));
        if (found) setExistingReturn(found);
      }
    }).catch(() => null);

    const socket = socketService.getSocket();
    if (socket) {
      const handleStatusUpdate = (data) => {
        if (String(data?.orderId) === String(orderId) || String(data?._id) === String(orderId)) {
          fetchOrderById(orderId).catch(() => null);
        }
      };
      socket.on('order_status_updated', handleStatusUpdate);
      return () => {
        mounted = false;
        socket.off('order_status_updated', handleStatusUpdate);
      };
    }

    return () => { mounted = false; };
  }, [orderId, fetchOrderById, fetchUserReturns]);

  const order = getOrder(orderId);
  const shippingAddress = order?.shippingAddress || {};
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  const vendorOptions = Array.isArray(order?.vendorItems)
    ? order.vendorItems
      .map((group) => ({
        id: String(group?.vendorId || ''),
        name: group?.vendorName || 'Vendor',
      }))
    : [];

  const handleDownloadInvoice = async () => {
    if (!order) return;
    const cleanId = order.orderId || order.id || order._id;
    const toastId = toast.loading("Downloading official invoice...");
    try {
      const res = await api.get(`/user/orders/${cleanId}/invoice/pdf`, { responseType: 'blob' });
      const blob = res instanceof Blob ? res : new Blob([res?.data || res], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.setAttribute("download", `Invoice-${cleanId}.pdf`);
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1500);
      toast.success("Invoice downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("Invoice download error:", err);
      toast.error("Failed to download invoice PDF.", { id: toastId });
    }
  };

  const handleRetryPayment = async () => {
    if (!order) return;
    const toastId = toast.loading("Initiating payment gateway...");
    try {
      const response = await api.post("/user/payments/retry", {
        orderId: order.orderId || order.id
      });
      toast.dismiss(toastId);
      
      const rzpOrder = response.data?.data || response.data || response;
      const rzpLoaded = await loadRazorpayScript();
      if (!rzpLoaded) {
        toast.error("Failed to load Razorpay SDK. Please check your internet connection.");
        return;
      }

      const options = {
        key: rzpOrder.key,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: "PLE Marketplace",
        description: "Retry Order Payment",
        order_id: rzpOrder.id,
        handler: async function (response) {
          const verifyToastId = toast.loading("Verifying payment...");
          try {
            await api.post("/user/payments/verify", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              orderId: order.orderId || order.id,
            });
            toast.dismiss(verifyToastId);
            toast.success("Payment verified successfully!");
            await fetchOrderById(orderId);
          } catch (verifyError) {
            toast.dismiss(verifyToastId);
            toast.error(verifyError?.response?.data?.message || verifyError?.message || "Payment verification failed.");
          }
        },
        prefill: {
          name: order.shippingAddress?.name,
          email: order.shippingAddress?.email,
          contact: order.shippingAddress?.phone,
        },
        theme: {
          color: "#7B0A0A",
        },
        modal: {
          ondismiss: function () {
            toast.error("Payment checkout cancelled.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.response?.data?.message || err?.message || "Failed to retry payment.");
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (orderId) {
        await fetchOrderById(orderId);
      }
      if (mounted) setIsResolving(false);
    })();
    return () => {
      mounted = false;
    };
  }, [orderId, fetchOrderById]);

  useEffect(() => {
    if (order?.userId) {
      const socket = socketService.getSocket();
      socket.emit('join_user_room', order.userId);

      const handleStatusUpdate = (data) => {
        if (String(data.orderId) === String(order.orderId) || String(data._id) === String(order.id)) {
          toast(`Order #${data.orderId} status updated to ${data.status}`);
          fetchOrderById(orderId).catch(() => null);
        }
      };

      socket.on('order_status_updated', handleStatusUpdate);

      return () => {
        socket.off('order_status_updated', handleStatusUpdate);
        socket.emit('leave_user_room', order.userId);
      };
    }
  }, [order?.userId, order?.orderId, order?.id, orderId, fetchOrderById]);

  useEffect(() => {
    if (!isResolving && !order) {
      navigate('/orders');
    }
  }, [isResolving, order, navigate]);

  if (isResolving) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={false} showCartBar={false}>
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <p className="text-gray-600">Loading order...</p>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  if (!order) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={false} showCartBar={false}>
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Order Not Found</h2>
              <button
                onClick={() => navigate('/orders')}
                className="bg-[#7B0A0A] hover:bg-[#AE020B] text-white px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                Back to Orders
              </button>
            </div>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleReorder = () => {
    order.items.forEach((item) => {
      addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: item.quantity,
        variant: item.variant || undefined,
      });
    });
    toast.success('Items added to cart!');
    navigate('/checkout');
  };

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this order?')) {
      if (['pending', 'processing'].includes(order.status)) {
        try {
          await cancelOrder(order.id);
          toast.success('Order cancelled successfully');
          navigate('/orders');
        } catch (error) {
          toast.error(error?.message || 'Failed to cancel order');
        }
      } else {
        toast.error('This order cannot be cancelled');
      }
    }
  };

  const openReturnModal = () => {
    if (order.status !== 'delivered') {
      toast.error('Return can only be requested for delivered orders');
      return;
    }
    if (vendorOptions.length === 1) {
      setReturnVendorId(vendorOptions[0].id);
    } else if (!vendorOptions.find((v) => v.id === returnVendorId)) {
      setReturnVendorId(vendorOptions[0]?.id || '');
    }
    setShowReturnModal(true);
  };

  const handleRequestReturn = async () => {
    if (isSubmittingReturn) return;

    const reason = String(returnReason || '').trim();
    if (reason.length < 5) {
      toast.error('Please enter a valid return reason');
      return;
    }

    if (vendorOptions.length > 1 && !returnVendorId) {
      toast.error('Please select a vendor for return request');
      return;
    }

    try {
      setIsSubmittingReturn(true);
      await requestReturn(order.id, {
        reason,
        ...(returnVendorId ? { vendorId: returnVendorId } : {}),
      });
      toast.success('Return request submitted successfully');
      setShowReturnModal(false);
      setReturnReason('Product issue');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to submit return request');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={true}>
          <div className="w-full pb-24">
            {/* Header */}
            <div className="px-4 py-4 bg-white border-b border-gray-200 sticky top-1 z-30">
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FiArrowLeft className="text-xl text-gray-700" />
                </button>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-gray-800">Order Details</h1>
                  <p className="text-sm text-gray-600">Order #{order.id}</p>
                </div>
                <Badge variant={order.status}>{order.status.toUpperCase()}</Badge>
              </div>
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Order Status Stepper Timeline */}
              <OrderStatusTimeline order={order} showTrackingLink={true} />

              {/* Order Items */}
              <div className="glass-card rounded-2xl p-4">
                <h2 className="text-base font-bold text-gray-800 mb-4">Order Items</h2>
                {order.vendorItems && order.vendorItems.length > 0 ? (
                  <div className="space-y-4">
                    {order.vendorItems.map((vendorGroup) => (
                      <div key={vendorGroup.vendorId} className="space-y-2">
                        {/* Vendor Header */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-50 to-red-100 rounded-lg border border-red-200/50">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-[#7B0A0A] flex items-center justify-center flex-shrink-0">
                            <FiShoppingBag className="text-white text-[10px]" />
                          </div>
                          <span className="text-sm font-bold text-red-700 flex-1">
                            {vendorGroup.vendorName}
                          </span>
                          <span className="text-xs font-semibold text-[#7B0A0A] bg-white px-2 py-0.5 rounded-md">
                            {formatPrice(vendorGroup.subtotal)}
                          </span>
                        </div>
                        {/* Vendor Items */}
                        <div className="space-y-2 pl-2">
                          {vendorGroup.items.map((item, itemIndex) => (
                            <div key={`${item.id}-${itemIndex}-${getVariantSignature(item?.variant || {})}`} className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                                <LazyImage
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-800 text-sm mb-1">{item.name}</h3>
                                <p className="text-xs text-gray-600">
                                  {formatPrice(item.price)} x {item.quantity}
                                </p>
                                {formatVariantLabel(item?.variant) && (
                                  <p className="text-[11px] text-gray-500">
                                    {formatVariantLabel(item?.variant)}
                                  </p>
                                )}
                              </div>
                              <p className="font-bold text-gray-800 text-sm">
                                {formatPrice(item.price * item.quantity)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderItems.map((item, itemIndex) => (
                      <div key={`${item.id}-${itemIndex}-${getVariantSignature(item?.variant || {})}`} className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                          <LazyImage
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-800 text-sm mb-1">{item.name}</h3>
                          <p className="text-xs text-gray-600">
                            {formatPrice(item.price)} x {item.quantity}
                          </p>
                          {formatVariantLabel(item?.variant) && (
                                  <p className="text-[11px] text-gray-500">
                                    {formatVariantLabel(item?.variant)}
                                  </p>
                                )}
                        </div>
                        <p className="font-bold text-gray-800 text-sm">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Shipping Address */}
              <div className="glass-card rounded-2xl p-4">
                <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <FiMapPin className="text-[#7B0A0A]" />
                  Shipping Address
                </h2>
                <div className="text-sm text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-800">{shippingAddress.name || 'N/A'}</p>
                  <p>{shippingAddress.address || 'N/A'}</p>
                  <p>
                    {shippingAddress.city || 'N/A'}, {shippingAddress.state || 'N/A'}{' '}
                    {shippingAddress.zipCode || 'N/A'}
                  </p>
                  <p>{shippingAddress.country || 'N/A'}</p>
                  <p className="mt-2">Phone: {shippingAddress.phone || 'N/A'}</p>
                </div>
              </div>

              {/* Payment Info */}
              <div className="glass-card rounded-2xl p-4">
                <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <FiCreditCard className="text-[#7B0A0A]" />
                  Payment Information
                </h2>
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span className="font-semibold text-gray-800 capitalize">
                      {order.paymentMethod === 'card' ? 'Credit/Debit Card' : order.paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Status:</span>
                    <Badge variant={order.paymentStatus === 'paid' ? 'delivered' : order.paymentStatus === 'pending' ? 'pending' : 'cancelled'} className="text-xs uppercase">
                      {order.paymentStatus || 'Pending'}
                    </Badge>
                  </div>
                  {(order.paymentDetails?.razorpayPaymentId || order.walletTransactionId) && (
                    <div className="flex justify-between">
                      <span>Transaction ID:</span>
                      <span className="font-mono font-semibold text-gray-800 text-xs">
                        {order.paymentDetails?.razorpayPaymentId || order.walletTransactionId}
                      </span>
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div className="flex justify-between">
                      <span>Tracking Number:</span>
                      <span className="font-semibold text-gray-800">{order.trackingNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Order Date:</span>
                    <span className="font-semibold text-gray-800">{formatDate(order.date)}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap justify-between items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">Tax Invoice:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsInvoiceModalOpen(true)}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                      >
                        <FiEye className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadInvoice}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#7B0A0A] hover:text-[#AE020B] px-2.5 py-1 rounded-lg hover:bg-[#7B0A0A]/5 transition-colors"
                      >
                        <FiDownload />
                        Download
                      </button>
                    </div>
                  </div>
                  {(order.invoiceEmailSent || (order.emailNotifications && order.emailNotifications.some((n) => n.status === 'invoice' && n.success))) && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60 mt-1">
                      <FiMail className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Invoice sent to your registered email</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Summary */}
              <div className="glass-card rounded-2xl p-4">
                <h2 className="text-base font-bold text-gray-800 mb-3">Order Summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  {order.discount - (order.loyaltyDiscount || 0) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Coupon Discount</span>
                      <span>-{formatPrice(order.discount - (order.loyaltyDiscount || 0))}</span>
                    </div>
                  )}
                  {order.loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Loyalty Discount ({order.loyaltyPointsRedeemed} Pts)</span>
                      <span>-{formatPrice(order.loyaltyDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>{formatPrice(order.shipping)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span>{formatPrice(order.tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-800 pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span className="text-[#7B0A0A]">{formatPrice(order.total)}</span>
                  </div>
                  {order.loyaltyPointsEarned > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-150 text-center text-xs text-emerald-800 font-semibold flex items-center justify-center gap-1">
                      <span>🎯 Earned:</span>
                      <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-black">
                        {order.loyaltyPointsEarned} Loyalty Points
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {['pending', 'processing'].includes(order.status) && (
                  <button
                    onClick={handleCancel}
                    className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition-colors"
                  >
                    Cancel Order
                  </button>
                )}
                {order.paymentMethod === 'card' && order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                  <button
                    onClick={handleRetryPayment}
                    className="w-full py-3 bg-[#7B0A0A] hover:bg-[#AE020B] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-md transition-all uppercase tracking-wide"
                  >
                    <FiCreditCard className="text-lg" />
                    Retry Payment
                  </button>
                )}
                <button
                  onClick={handleReorder}
                  className="w-full py-3 bg-[#7B0A0A] hover:bg-[#AE020B] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-md transition-all"
                >
                  <FiRotateCw className="text-lg" />
                  Reorder
                </button>
                {order.status === 'delivered' && (
                  existingReturn ? (
                    <button
                      onClick={() => navigate(`/returns/${existingReturn.id}`)}
                      className="w-full py-3 bg-blue-50 text-blue-700 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                    >
                      <FiPackage className="text-lg" />
                      View Return Request ({existingReturn.status})
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/returns/request/${order.id}`)}
                      className="w-full py-3 bg-amber-50 text-amber-700 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
                    >
                      <FiPackage className="text-lg" />
                      Return Item
                    </button>
                  )
                )}
                <button
                  onClick={() => navigate(`/track-order/${order.id}`)}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                >
                  <FiTruck className="text-lg" />
                  Track Order
                </button>
              </div>
            </div>
          </div>

          {showReturnModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center sm:justify-center"
              onClick={() => setShowReturnModal(false)}
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Request Return</h3>
                  <button
                    onClick={() => setShowReturnModal(false)}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <FiX className="text-gray-600" />
                  </button>
                </div>

                {vendorOptions.length > 1 && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Vendor
                    </label>
                    <select
                      value={returnVendorId}
                      onChange={(e) => setReturnVendorId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Choose vendor</option>
                      {vendorOptions.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reason
                  </label>
                  <textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Describe the issue briefly"
                  />
                </div>

                <button
                  onClick={handleRequestReturn}
                  disabled={isSubmittingReturn}
                  className="w-full py-3 bg-[#7B0A0A] hover:bg-[#AE020B] text-white rounded-xl font-semibold disabled:opacity-70 transition-colors"
                >
                  {isSubmittingReturn ? 'Submitting...' : 'Submit Return Request'}
                </button>
              </motion.div>
            </motion.div>
          )}

        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          orderId={order?.orderId || order?.id}
          role="customer"
        />
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileOrderDetail;




