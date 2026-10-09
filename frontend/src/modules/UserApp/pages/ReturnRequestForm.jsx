import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FiArrowLeft, FiCamera, FiTrash2, FiCheck, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from '../../../shared/components/PageTransition';
import { useOrderStore } from '../../../shared/store/orderStore';
import { useReturnStore } from '../../../shared/store/returnStore';
import { useAuthStore } from '../../../shared/store/authStore';
import { formatPrice } from '../../../shared/utils/helpers';
import LazyImage from '../../../shared/components/LazyImage';
import toast from 'react-hot-toast';

const ReturnRequestForm = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { getOrder, fetchOrderById } = useOrderStore();
  const { createReturnRequest } = useReturnStore();
  const { user } = useAuthStore();

  const [order, setOrder] = useState(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [selectedItems, setSelectedItems] = useState({}); // { itemId: true/false }
  const [quantities, setQuantities] = useState({}); // { itemId: qty }
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState([]); // Array of base64 strings
  const [refundDestination, setRefundDestination] = useState('Original Payment Method');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);

  const reasons = [
    'Damaged Product',
    'Wrong Product Received',
    'Missing Parts',
    'Defective Item',
    'Not As Described',
    'Other'
  ];

  useEffect(() => {
    let active = true;
    const loadOrder = async () => {
      setIsLoadingOrder(true);
      const fetched = await fetchOrderById(orderId);
      if (active) {
        setOrder(fetched);
        setIsLoadingOrder(false);
        // Default select all items for return
        if (fetched && fetched.items) {
          const itemsMap = {};
          const qtyMap = {};
          fetched.items.forEach(item => {
            const itemId = item.id || item.productId;
            itemsMap[itemId] = true;
            qtyMap[itemId] = item.quantity || 1;
          });
          setSelectedItems(itemsMap);
          setQuantities(qtyMap);
        }
      }
    };
    loadOrder();
    return () => { active = false; };
  }, [orderId, fetchOrderById]);

  // Handle keyboard arrow navigation & ESC key in lightbox
  useEffect(() => {
    if (previewIndex === null) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPreviewIndex(null);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        setPreviewIndex((prev) => (prev - 1 + images.length) % images.length);
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        setPreviewIndex((prev) => (prev + 1) % images.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, images.length]);

  if (isLoadingOrder) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={false} showCartBar={false}>
          <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  if (!order) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={false} showCartBar={false}>
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Order Not Found</h3>
            <button
              onClick={() => navigate('/orders')}
              className="gradient-green text-white px-6 py-2 rounded-xl font-semibold"
            >
              Go to Orders
            </button>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  const handleToggleItem = (itemId) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleQtyChange = (itemId, val, max) => {
    const qty = Math.max(1, Math.min(max, val));
    setQuantities(prev => ({
      ...prev,
      [itemId]: qty
    }));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      toast.error('You can upload up to 5 images only');
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    // If the image being previewed gets deleted, or previewIndex exceeds boundaries
    if (previewIndex === index) {
      setPreviewIndex(null);
    } else if (previewIndex > index) {
      setPreviewIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedKeys = Object.keys(selectedItems).filter(key => selectedItems[key]);
    if (selectedKeys.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    if (!reason) {
      toast.error('Please select a return reason');
      return;
    }

    if (description.trim().length < 10) {
      toast.error('Please provide a detailed description (min 10 characters)');
      return;
    }

    setIsSubmitting(true);

    const itemsToReturn = order.items
      .filter(item => selectedItems[item.id || item.productId])
      .map(item => ({
        id: item.id || item.productId,
        name: item.name,
        price: item.price,
        quantity: quantities[item.id || item.productId] || 1,
        image: item.image,
        reason: reason
      }));

    const refundAmount = itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const payload = {
      orderId: order.id,
      customer: {
        name: user?.name || order.shippingAddress?.name || 'Customer',
        email: user?.email || order.shippingAddress?.email || 'customer@example.com',
        phone: user?.phone || order.shippingAddress?.phone || ''
      },
      items: itemsToReturn,
      reason,
      description,
      notes,
      images,
      refundAmount,
      refundDestination
    };

    const result = await createReturnRequest(payload);
    setIsSubmitting(false);

    if (result) {
      navigate(`/returns/${result.id}`);
    }
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <div className="w-full pb-24">
          {/* Header */}
          <div className="px-4 py-4 bg-white border-b border-gray-200 sticky top-1 z-30 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiArrowLeft className="text-xl text-gray-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Return Items</h1>
              <p className="text-xs text-gray-500">Order #{order.id}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
            {/* Items Selection */}
            <div className="glass-card rounded-2xl p-4 bg-white shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-800 mb-3">Select items to return</h2>
              <div className="space-y-3">
                {order.items.map((item) => {
                  const itemId = item.id || item.productId;
                  const isSelected = !!selectedItems[itemId];
                  return (
                    <div key={itemId} className="flex gap-3 items-start border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => handleToggleItem(itemId)}
                        className={`w-5 h-5 rounded border mt-1 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && <FiCheck className="text-xs" />}
                      </button>

                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        <LazyImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 text-xs truncate">{item.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{formatPrice(item.price)}</p>
                        
                        {isSelected && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[11px] text-gray-600 font-medium">Qty:</span>
                            <input
                              type="number"
                              min={1}
                              max={item.quantity || 1}
                              value={quantities[itemId] || 1}
                              onChange={(e) => handleQtyChange(itemId, parseInt(e.target.value, 10), item.quantity || 1)}
                              className="w-12 text-center text-xs py-0.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                            />
                            <span className="text-[10px] text-gray-400">max {item.quantity || 1}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Return reason */}
            <div className="glass-card rounded-2xl p-4 bg-white shadow-sm border border-gray-100">
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Reason for Return
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                required
              >
                <option value="">Select a reason</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="glass-card rounded-2xl p-4 bg-white shadow-sm border border-gray-100">
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Detailed Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Please explain in detail why you are returning the product..."
                required
              />
            </div>

            {/* Images Upload */}
            <div className="glass-card rounded-2xl p-4 bg-white shadow-sm border border-gray-100">
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Upload Product Images (Max 5)
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {images.map((img, index) => (
                  <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group">
                    <img 
                      src={img} 
                      alt="upload preview" 
                      onClick={() => setPreviewIndex(index)}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      className="absolute top-0.5 right-0.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors z-10"
                    >
                      <FiTrash2 className="text-[10px]" />
                    </button>
                  </div>
                ))}
                
                {images.length < 5 && (
                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50">
                    <FiCamera className="text-gray-400 text-lg" />
                    <span className="text-[9px] text-gray-500 mt-1">Add Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Refund Destination Selection */}
            <div className="glass-card rounded-2xl p-4 bg-white shadow-sm border border-gray-100">
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Choose Refund Destination
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Select where you want your refund credited once approved.
              </p>

              <div className="space-y-2.5">
                <label
                  onClick={() => setRefundDestination('Wallet')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    refundDestination === 'Wallet'
                      ? 'border-[#7B0A0A] bg-red-50/50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="refundDestination"
                    value="Wallet"
                    checked={refundDestination === 'Wallet'}
                    onChange={() => setRefundDestination('Wallet')}
                    className="mt-1 text-[#7B0A0A] focus:ring-[#7B0A0A]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900">PLE Wallet</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        ⚡ Instant
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Credited instantly upon approval. Can be used anytime for any future order.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setRefundDestination('Original Payment Method')}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    refundDestination === 'Original Payment Method'
                      ? 'border-[#7B0A0A] bg-red-50/50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="refundDestination"
                    value="Original Payment Method"
                    checked={refundDestination === 'Original Payment Method'}
                    onChange={() => setRefundDestination('Original Payment Method')}
                    className="mt-1 text-[#7B0A0A] focus:ring-[#7B0A0A]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900">Original Payment Method</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                        3-5 Business Days
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Refunded directly back to your original Bank Account, Card, or UPI ID.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Additional notes */}
            <div className="glass-card rounded-2xl p-4 bg-white shadow-sm border border-gray-100">
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Any extra details or preferences..."
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 gradient-green text-white rounded-xl font-bold shadow-md hover:shadow-glow-green disabled:opacity-75 transition-all text-sm"
            >
              {isSubmitting ? 'Submitting Request...' : 'Submit Request'}
            </button>
          </form>
        </div>
      </MobileLayout>

      {/* Lightbox Modal rendered via Portal to ensure centering regardless of parent context or scrolling */}
      {createPortal(
        <AnimatePresence>
          {previewIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
              onClick={() => setPreviewIndex(null)}
            >
              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                className="absolute top-4 right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white transition-colors z-10 hover:bg-white/20"
              >
                <FiX className="text-2xl" />
              </button>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center"
              >
                <img
                  src={images[previewIndex]}
                  alt="Full preview"
                  className="max-w-full max-h-[85vh] object-contain rounded-xl"
                />

                {/* Navigation in Lightbox */}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewIndex((prev) => (prev - 1 + images.length) % images.length);
                      }}
                      className="absolute left-2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                      <FiChevronLeft className="text-2xl" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewIndex((prev) => (prev + 1) % images.length);
                      }}
                      className="absolute right-2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                      <FiChevronRight className="text-2xl" />
                    </button>
                  </>
                )}

                {/* Image Counter */}
                {images.length > 1 && (
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-1.5 rounded-full text-xs font-medium">
                    {previewIndex + 1} / {images.length}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </PageTransition>
  );
};

export default ReturnRequestForm;
