import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiX, FiSend, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../../../shared/utils/api';
import { formatPrice } from '../../../../shared/utils/helpers';

/**
 * Customer "Request Quote" form. The backend decides whether the RFQ goes to PLE (admin-owned
 * product) or the selling vendor, so nothing about the recipient is sent from here.
 */
export const ConsumerRFQModal = ({ isOpen, onClose, product }) => {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [expectedPrice, setExpectedPrice] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !product) return null;
  const maxQty = Number(product.stockQuantity) > 0 ? Number(product.stockQuantity) : undefined;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/user/consumer-rfq', {
        productId: product.id || product._id,
        quantity: Number(quantity),
        ...(expectedPrice ? { expectedPrice: Number(expectedPrice) } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      toast.success('Quotation request sent! You will be notified when you get a reply.');
      onClose();
      navigate(`/consumer-rfqs/${res.data._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-xl px-4 py-2.5 font-semibold text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto" role="dialog" aria-label="Request a quotation">
        <div className="sticky top-0 bg-gradient-to-r from-[#AE020B] to-[#7B0A0A] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2"><FiFileText /><h3 className="font-bold text-lg">Request a Quotation</h3></div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-red-700/50"><FiX /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <p className="font-bold text-gray-900 line-clamp-2">{product.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">Listed at {formatPrice(product.price)} / {product.unit || 'unit'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Quantity</label>
              <input type="number" min="1" step="1" max={maxQty} required value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Expected price / unit (₹)</label>
              <input type="number" min="0.01" step="0.01" placeholder="Optional" value={expectedPrice} onChange={(e) => setExpectedPrice(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Additional requirements</label>
            <textarea rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Delivery timeline, special requirements..." className={`${inputCls} font-normal text-sm`} />
            <p className="text-[11px] text-gray-400 mt-1">Please don't share phone numbers, emails or payment details.</p>
          </div>
          <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-[#7B0A0A] hover:bg-[#AE020B] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <FiSend /> {submitting ? 'Sending...' : 'Send request'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default ConsumerRFQModal;
