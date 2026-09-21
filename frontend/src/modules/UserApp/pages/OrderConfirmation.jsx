import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiCheckCircle, FiTruck, FiEye, FiFileText, FiDownload } from 'react-icons/fi';
import { motion } from 'framer-motion';
import MobileLayout from "../components/Layout/MobileLayout";
import { useOrderStore } from '../../../shared/store/orderStore';
import { formatPrice } from '../../../shared/utils/helpers';
import { formatVariantLabel } from '../../../shared/utils/variant';
import PageTransition from '../../../shared/components/PageTransition';
import LazyImage from '../../../shared/components/LazyImage';
import InvoiceModal from '../../../shared/components/InvoiceModal';
import api from '../../../shared/utils/api';
import toast from 'react-hot-toast';

const MobileOrderConfirmation = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { getOrder, fetchOrderById, lastError } = useOrderStore();
  const [isResolving, setIsResolving] = useState(true);
  const order = getOrder(orderId);
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  const displayOrderId = order?.id || order?.orderId || orderId;
  const earnedPoints = parseInt(localStorage.getItem(`earned_points_${order?.id}`) || "0", 10);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadInvoice = async () => {
    if (!displayOrderId) return;
    setDownloading(true);
    const toastId = toast.loading("Downloading official invoice...");
    try {
      const res = await api.get(`/user/orders/${displayOrderId}/invoice/pdf`, { responseType: 'blob' });
      const blob = res instanceof Blob ? res : new Blob([res?.data || res], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.setAttribute("download", `Invoice-${displayOrderId}.pdf`);
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
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!order && orderId) {
        await fetchOrderById(orderId);
      }
      if (mounted) setIsResolving(false);
    })();
    return () => {
      mounted = false;
    };
  }, [order, orderId, fetchOrderById]);

  useEffect(() => {
    if (!isResolving && !order) {
      navigate('/home');
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
              {lastError ? (
                <p className="text-sm text-gray-500 mb-4">{lastError}</p>
              ) : null}
              <button
                onClick={() => navigate('/home')}
                className="gradient-green text-white px-6 py-3 rounded-xl font-semibold"
              >
                Go Home
              </button>
            </div>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <div className="w-full min-h-screen flex items-center justify-center px-4 py-8 bg-gray-50">
          <div className="w-full max-w-md lg:max-w-lg">
            {/* Success Animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="flex flex-col items-center justify-center mb-8"
            >
              <div className="w-24 h-24 gradient-green rounded-full flex items-center justify-center mb-4 shadow-glow-green">
                <FiCheckCircle className="text-white text-5xl" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Confirmed!</h1>
              <p className="text-gray-600 text-center text-sm">
                Thank you for your purchase. Your order has been received and is being processed.
              </p>
            </motion.div>

            {/* Earned Loyalty Points Message Banner */}
            {earnedPoints > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl p-5 mb-4 shadow-md flex items-center gap-4 relative overflow-hidden"
              >
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  🎉
                </div>
                <div>
                  <h3 className="font-extrabold text-base">You earned {earnedPoints} Loyalty Points!</h3>
                  <p className="text-xs text-amber-100 mt-0.5">Use these points on your next checkout to save money.</p>
                </div>
              </motion.div>
            )}

            {/* Order Details */}
            <div className="glass-card rounded-2xl p-6 mb-4">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-600 mb-1">Order Number</p>
                <p className="text-xl font-bold text-gray-800">{displayOrderId}</p>
                {order.trackingNumber && (
                  <>
                    <p className="text-sm text-gray-600 mt-3 mb-1">Tracking Number</p>
                    <p className="text-lg font-bold text-primary-600">{order.trackingNumber}</p>
                  </>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order Date</span>
                  <span className="font-semibold text-gray-800">{formatDate(order.date || order.createdAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-bold text-primary-600 text-lg">{formatPrice(order.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment Method</span>
                  <span className="font-semibold text-gray-800 capitalize">{order.paymentMethod || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100">
                  <span className="text-gray-600 font-medium">Tax Invoice</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsInvoiceModalOpen(true)}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    >
                      <FiFileText className="w-3.5 h-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadInvoice}
                      disabled={downloading}
                      className="flex items-center gap-1 text-xs font-bold text-[#7B0A0A] hover:text-[#AE020B] px-2.5 py-1 rounded-lg hover:bg-[#7B0A0A]/5 transition-colors"
                    >
                      <FiDownload className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items Summary */}
            <div className="glass-card rounded-2xl p-6 mb-4">
              <h2 className="text-base font-bold text-gray-800 mb-4">Order Items</h2>
              <div className="space-y-3">
                {orderItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
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
                {orderItems.length > 3 && (
                  <p className="text-sm text-gray-600 text-center pt-2">
                    +{orderItems.length - 3} more item{orderItems.length - 3 !== 1 ? 's' : ''}
                  </p>
                )}
                {orderItems.length === 0 && (
                  <p className="text-sm text-gray-600 text-center pt-2">No item details available for this order.</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="py-3 px-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-800 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs text-sm"
                >
                  <FiEye className="text-base text-gray-600" />
                  View Invoice
                </button>
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  disabled={downloading}
                  className="py-3 px-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs text-sm disabled:opacity-50"
                >
                  <FiDownload className="text-base" />
                  {downloading ? 'Downloading...' : 'Download PDF'}
                </button>
              </div>
              <Link
                to={`/orders/${displayOrderId}`}
                className="block w-full py-3 gradient-green text-white rounded-xl font-semibold text-center hover:shadow-glow-green transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <FiEye className="text-lg" />
                  View Order Details
                </div>
              </Link>
              <Link
                to={`/track-order/${displayOrderId}`}
                className="block w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-center hover:bg-gray-200 transition-colors"
              >
                <div className="flex items-center justify-center gap-2">
                  <FiTruck className="text-lg" />
                  Track Order
                </div>
              </Link>
              <button
                onClick={() => navigate('/home')}
                className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>

        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          orderId={displayOrderId}
          role="customer"
        />
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileOrderConfirmation;

