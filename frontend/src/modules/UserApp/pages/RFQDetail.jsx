import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiFileText, FiCalendar, FiBriefcase, FiDollarSign, FiClock, FiCheckCircle, FiXCircle, FiMessageSquare, FiPaperclip, FiSend } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import MobileLayout from "../components/Layout/MobileLayout";
import { formatPrice } from '../../../shared/utils/helpers';
import api from '../../../shared/utils/api';
import toast from 'react-hot-toast';
import PageTransition from '../../../shared/components/PageTransition';
import Badge from '../../../shared/components/Badge';
import LazyImage from '../../../shared/components/LazyImage';

const MobileRFQDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rfq, setRfq] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Counter offer state
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterPrice, setCounterPrice] = useState(0);
  const [counterQty, setCounterQty] = useState(0);
  const [counterNotes, setCounterNotes] = useState('');

  const fetchRFQDetail = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/user/rfq/${id}`);
      if (res && res.data) {
        setRfq(res.data);
        setCounterPrice(res.data.targetPrice);
        setCounterQty(res.data.quantity);
      } else {
        toast.error('Failed to load RFQ details');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error fetching RFQ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchRFQDetail();
    }
  }, [id]);

  const handleAccept = async () => {
    if (!window.confirm('Are you sure you want to accept the seller\'s latest quote and place an order?')) {
      return;
    }
    try {
      setIsActionLoading(true);
      const res = await api.post(`/user/rfq/${id}/accept`);
      toast.success(res.message || 'Quote accepted! Order has been generated.');
      navigate('/orders');
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to accept quote');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Are you sure you want to reject this RFQ/quote? This will close the negotiation.')) {
      return;
    }
    try {
      setIsActionLoading(true);
      const res = await api.post(`/user/rfq/${id}/reject`);
      toast.success(res.message || 'RFQ rejected successfully.');
      fetchRFQDetail();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to reject RFQ');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCounterSubmit = async (e) => {
    e.preventDefault();
    if (counterPrice <= 0 || counterQty <= 0) {
      toast.error('Please enter valid counter price and quantity');
      return;
    }
    try {
      setIsActionLoading(true);
      const res = await api.post(`/user/rfq/${id}/counter`, {
        price: counterPrice,
        quantity: counterQty,
        notes: counterNotes
      });
      toast.success(res.message || 'Counter offer sent successfully!');
      setShowCounterModal(false);
      setCounterNotes('');
      fetchRFQDetail();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to submit counter offer');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'Accepted':
      case 'Converted To Order':
        return 'success';
      case 'Rejected':
        return 'danger';
      case 'Negotiating':
      case 'Seller Responded':
        return 'warning';
      default:
        return 'info';
    }
  };

  if (isLoading) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={false} showCartBar={false}>
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <p className="text-gray-600 font-bold">Loading RFQ details...</p>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  if (!rfq) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={false} showCartBar={false}>
          <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 mb-4">RFQ Not Found</h2>
              <button
                onClick={() => navigate('/profile')}
                className="gradient-green text-white px-6 py-3 rounded-xl font-semibold"
              >
                Back to Profile
              </button>
            </div>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  const latestOffer = [...rfq.timeline].reverse().find(t => t.senderType === 'seller');
  const canAct = ['Pending', 'Negotiating', 'Seller Responded'].includes(rfq.status);

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
                <h1 className="text-xl font-bold text-gray-800">RFQ Details</h1>
                <p className="text-sm text-gray-600">ID: {rfq.rfqId}</p>
              </div>
              <Badge variant={getStatusBadgeVariant(rfq.status)}>{rfq.status.toUpperCase()}</Badge>
            </div>
          </div>

          <div className="px-4 py-4 space-y-4">
            {/* Product & Summary */}
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-base font-bold text-gray-800 mb-3">Product Requested</h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  <LazyImage
                    src={rfq.productId?.image}
                    alt={rfq.productId?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-sm mb-1">{rfq.productId?.name}</h3>
                  <p className="text-xs text-gray-600">
                    Retail Price: {formatPrice(rfq.productId?.price || 0)} / {rfq.productId?.unit || 'unit'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3 text-sm">
                <div>
                  <span className="text-gray-400 block text-xs">RFQ Quantity</span>
                  <span className="font-bold text-gray-800">{rfq.quantity} {rfq.productId?.unit || 'units'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-xs">Target Price</span>
                  <span className="font-bold text-gray-800">{formatPrice(rfq.targetPrice)} / unit</span>
                </div>
                {rfq.expectedDeliveryDate && (
                  <div>
                    <span className="text-gray-400 block text-xs">Expected Delivery</span>
                    <span className="font-bold text-gray-800">
                      {new Date(rfq.expectedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {rfq.attachment && (
                  <div>
                    <span className="text-gray-400 block text-xs">Attachment</span>
                    <a
                      href={rfq.attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 font-bold hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <FiPaperclip className="text-xs" />
                      View File
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Vendor Profile Info */}
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                <FiBriefcase className="text-primary-600" />
                Vendor Details
              </h2>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-bold text-gray-800">{rfq.sellerId?.storeName || rfq.sellerId?.name || 'N/A'}</p>
                <p>Email: {rfq.sellerId?.email || 'N/A'}</p>
              </div>
            </div>

            {/* Negotiation Timeline */}
            <div className="glass-card rounded-2xl p-4">
              <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <FiMessageSquare className="text-primary-600" />
                Negotiation History
              </h2>
              <div className="relative pl-6 border-l-2 border-gray-150 space-y-6">
                {rfq.timeline.map((step, index) => {
                  const isBuyer = step.senderType === 'buyer';
                  return (
                    <div key={index} className="relative">
                      {/* Icon Indicator */}
                      <span className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 ${
                        isBuyer ? 'bg-primary-500 border-primary-200' : 'bg-amber-500 border-amber-200'
                      }`} />

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-800">
                            {isBuyer ? 'Your Offer (Buyer)' : 'Seller Quote'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {step.timestamp ? new Date(step.timestamp).toLocaleDateString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: 'numeric',
                              month: 'short'
                            }) : ''}
                          </span>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-sm">
                          <div className="flex justify-between font-bold text-gray-900 mb-1">
                            <span>Qty: {step.quantity}</span>
                            <span>{formatPrice(step.price)} / unit</span>
                          </div>
                          {step.notes && (
                            <p className="text-xs text-gray-600 italic">"{step.notes}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions Panel */}
            {canAct && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-700">Respond to Seller</h3>
                <div className="grid grid-cols-2 gap-3">
                  {latestOffer ? (
                    <button
                      onClick={handleAccept}
                      disabled={isActionLoading}
                      className="col-span-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <FiCheckCircle className="text-lg" />
                      Accept Quote & Order
                    </button>
                  ) : (
                    <div className="col-span-2 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-center font-medium">
                      Waiting for the seller's initial quote response.
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowCounterModal(true)}
                    disabled={isActionLoading}
                    className="py-3 bg-white text-primary-600 border border-primary-200 hover:bg-primary-50 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <FiSend className="text-base" />
                    Counter Offer
                  </button>
                  
                  <button
                    onClick={handleReject}
                    disabled={isActionLoading}
                    className="py-3 bg-red-50 text-red-650 hover:bg-red-100 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <FiXCircle className="text-base" />
                    Reject / Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Counter Offer Modal */}
        <AnimatePresence>
          {showCounterModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCounterModal(false)}
                className="absolute inset-0 bg-black"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 p-6 space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h3 className="font-bold text-lg text-gray-800">Submit Counter Offer</h3>
                  <button
                    onClick={() => setShowCounterModal(false)}
                    className="text-gray-400 hover:text-gray-650 p-1 rounded-lg"
                  >
                    <FiXCircle className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleCounterSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={counterQty}
                        onChange={(e) => setCounterQty(parseInt(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 font-bold text-gray-900 focus:border-primary-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                        Offer Price (₹/unit)
                      </label>
                      <input
                        type="number"
                        value={counterPrice}
                        onChange={(e) => setCounterPrice(parseInt(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 font-bold text-gray-900 focus:border-primary-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Message / Notes
                    </label>
                    <textarea
                      rows={3}
                      value={counterNotes}
                      onChange={(e) => setCounterNotes(e.target.value)}
                      placeholder="Specify shipping requirements or negotiation terms..."
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:border-primary-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCounterModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-750 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isActionLoading}
                      className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FiSend />
                      <span>Send Offer</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileRFQDetail;
