import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiFilter, FiDollarSign } from 'react-icons/fi';
import { motion } from 'framer-motion';
import MobileLayout from "../components/Layout/MobileLayout";
import { useReturnStore } from '../../../shared/store/returnStore';
import PageTransition from '../../../shared/components/PageTransition';
import { formatPrice } from '../../../shared/utils/helpers';
import LazyImage from '../../../shared/components/LazyImage';

const Returns = () => {
  const navigate = useNavigate();
  const { returnRequests, fetchReturnRequests, isLoading } = useReturnStore();
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchRequests = async () => {
      await fetchReturnRequests();
    };
    fetchRequests();

    const handleRealTimeUpdate = () => {
      if (active) {
        fetchRequests();
      }
    };
    window.addEventListener('return-status-updated', handleRealTimeUpdate);

    return () => {
      active = false;
      window.removeEventListener('return-status-updated', handleRealTimeUpdate);
    };
  }, [fetchReturnRequests]);

  const filteredReturns = useMemo(() => {
    if (selectedStatus === 'all') return returnRequests;
    return returnRequests.filter((req) => req.status.toLowerCase().replace(' ', '_') === selectedStatus);
  }, [selectedStatus, returnRequests]);

  const statusOptions = [
    { value: 'all', label: 'All Returns' },
    { value: 'request_submitted', label: 'Request Submitted' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'pickup_scheduled', label: 'Pickup Scheduled' },
    { value: 'picked_up', label: 'Picked Up' },
    { value: 'refund_initiated', label: 'Refund Initiated' },
    { value: 'refund_completed', label: 'Refund Completed' }
  ];

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        <div className="w-full pb-24">
          {/* Header */}
          <div className="px-4 py-4 bg-white border-b border-gray-200 sticky top-1 z-30 flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiArrowLeft className="text-xl text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-800">My Returns</h1>
              <p className="text-sm text-gray-600">
                {filteredReturns.length} {filteredReturns.length === 1 ? 'request' : 'requests'}
              </p>
            </div>
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="p-2 glass-card rounded-xl hover:bg-white/80 transition-colors"
            >
              <FiFilter className="text-gray-600 text-lg" />
            </button>
          </div>

          {/* Filter Options */}
          {showFilter && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedStatus(option.value);
                    setShowFilter(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-semibold text-xs whitespace-nowrap transition-all ${
                    selectedStatus === option.value
                      ? 'bg-[#7B0A0A] text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {/* List of Returns */}
          <div className="px-4 py-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-sm">Loading return requests...</p>
              </div>
            ) : filteredReturns.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 p-6">
                <div className="text-5xl text-gray-300 mb-3">🔄</div>
                <h3 className="text-base font-bold text-gray-800 mb-1">No return requests</h3>
                <p className="text-xs text-gray-500 mb-4">
                  {selectedStatus === 'all'
                    ? "You haven't requested any returns yet"
                    : `No returns in this category`}
                </p>
                <button
                  onClick={() => navigate('/orders')}
                  className="bg-[#7B0A0A] hover:bg-[#AE020B] text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-colors"
                >
                  View My Orders
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReturns.map((req, index) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(`/returns/${req.id}`)}
                    className="glass-card rounded-2xl p-4 bg-white shadow-sm border border-gray-100 hover:border-red-200 transition-all cursor-pointer space-y-3"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                      <div>
                        <span className="text-[10px] text-gray-400 font-semibold block">Return ID</span>
                        <span className="text-xs font-bold text-gray-800 break-all">{req.returnId || req.id}</span>
                        <span className="text-[10px] text-gray-500 font-medium block mt-0.5">
                          Order ID: <span className="font-bold text-[#7B0A0A]">#{req.orderId}</span>
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        req.status === 'Rejected' ? 'bg-red-50 text-red-700' :
                        req.status === 'Refund Completed' ? 'bg-green-50 text-green-700' :
                        'bg-red-50 text-[#7B0A0A]'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="flex gap-3 items-center">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                        <LazyImage
                          src={req.items?.[0]?.image || 'https://via.placeholder.com/100x100?text=Product'}
                          alt={req.items?.[0]?.name || 'Product'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 text-xs truncate">
                          {req.items?.[0]?.name || 'Unknown Product'}
                          {req.items?.length > 1 && ` + ${req.items.length - 1} more`}
                        </h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Qty: {req.items?.[0]?.quantity || 1}
                          {req.items?.length > 1 && ` (+${req.items.length - 1} more)`}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Requested on {new Date(req.requestDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-xs">
                      <span className="text-gray-500 font-medium flex items-center gap-0.5">
                        <FiDollarSign className="text-gray-400" />
                        Refund Amount:
                      </span>
                      <span className="font-bold text-[#7B0A0A]">{formatPrice(req.refundAmount || 0)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default Returns;
