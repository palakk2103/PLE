import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessBuyer } from '../../hooks/useBusinessBuyer';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFileText, FiPackage, FiClock, FiCheckCircle, FiXCircle, FiAlertCircle, FiSearch, FiFilter, FiEye, FiDownload, FiX } from 'react-icons/fi';
import { formatPrice } from '../../../../shared/utils/helpers';
import toast from 'react-hot-toast';
import api from '../../../../shared/utils/api';

export const B2BMyEnquiries = () => {
  const { isBusiness, stockRequests, updateStockRequestStatus } = useBusinessBuyer();
  const [activeTab, setActiveTab] = useState('rfq'); // 'rfq' or 'stock'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchRFQs = async () => {
    if (!isBusiness) return;
    try {
      setLoading(true);
      const res = await api.get('/user/rfq');
      const payload = res?.data ?? res;
      setQuotations(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error(error);
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRFQs();
  }, [isBusiness]);

  if (!isBusiness) return null;

  const getStatusColor = (status) => {
    if (!status) return 'bg-amber-50 text-amber-700 border-amber-200';
    switch (status.toLowerCase()) {
      case 'approved':
      case 'converted to order':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'seller responded':
      case 'negotiating':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'pending':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStatusIcon = (status) => {
    if (!status) return <FiClock className="w-4 h-4" />;
    switch (status.toLowerCase()) {
      case 'approved':
      case 'converted to order':
        return <FiCheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <FiXCircle className="w-4 h-4" />;
      case 'seller responded':
      case 'negotiating':
        return <FiEye className="w-4 h-4" />;
      case 'pending':
      default:
        return <FiClock className="w-4 h-4" />;
    }
  };

  const filteredRFQs = (Array.isArray(quotations) ? quotations : []).filter(q => {
    if (!q) return false;
    const pName = q.productId?.name || q.productName || '';
    const rId = q.rfqId || q.id || '';
    const qStatus = q.status || 'Pending';
    const matchesSearch = pName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          rId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || qStatus.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const filteredStockRequests = stockRequests.filter(s => {
    const matchesSearch = s.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const handleDownloadInvoice = (enquiry) => {
    toast.success(`Downloading invoice for ${enquiry.rfqId || enquiry.id}...`);
  };

  const handleViewDetails = (enquiry) => {
    if (activeTab === 'rfq') {
      navigate(`/rfq/${enquiry._id || enquiry.id}`);
    } else {
      setSelectedEnquiry(enquiry);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiFileText className="text-primary-600 text-xl" />
          <h3 className="font-extrabold text-gray-800 text-base">My Enquiries</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-bold">
            Total: {quotations.length + stockRequests.length}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => {
            setActiveTab('rfq');
            setStatusFilter('all');
            setSearchQuery('');
          }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'rfq'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <FiFileText className="w-4 h-4" />
          <span>Bulk Requests (RFQ)</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'rfq' ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>
            {quotations.length}
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab('stock');
            setStatusFilter('all');
            setSearchQuery('');
          }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'stock'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <FiPackage className="w-4 h-4" />
          <span>Stock Requests</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'stock' ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>
            {stockRequests.length}
          </span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search enquiries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium bg-white focus:border-primary-500 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="seller responded">Seller Responded</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* RFQ List */}
      {activeTab === 'rfq' && (
        <div className="space-y-3">
          {filteredRFQs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-gray-400">
              <FiFileText className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm font-medium">No RFQs found</p>
              <p className="text-xs mt-1">Start by requesting quotes from product pages</p>
            </div>
          ) : (
            filteredRFQs.map((rfq) => {
              const rfqDbId = rfq._id || rfq.id;
              const rfqDisplayId = rfq.rfqId || rfq.id;
              const prodName = rfq.productId?.name || rfq.productName || 'Product';
              const prodUnit = rfq.productId?.unit || rfq.unit || 'units';
              const rfqDate = rfq.createdAt 
                ? new Date(rfq.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : rfq.date;
              const latestSellerOffer = rfq.timeline && [...rfq.timeline].reverse().find(t => t.senderType === 'seller');
              const quotedPrice = rfq.quotedPrice || (latestSellerOffer ? latestSellerOffer.price : null);

              return (
                <motion.div
                  key={rfqDbId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getStatusColor(rfq.status)}`}>
                        {getStatusIcon(rfq.status)}
                        {rfq.status}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">{rfqDisplayId}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{rfqDate}</span>
                  </div>

                  <div className="mb-3">
                    <h4 className="font-bold text-gray-900 text-sm mb-1">{prodName}</h4>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span className="font-medium">Qty: {rfq.quantity} {prodUnit}s</span>
                      <span className="font-medium">Target: {formatPrice(rfq.targetPrice)}/unit</span>
                    </div>
                  </div>

                  {quotedPrice && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide block">
                            Seller Quoted Price
                          </span>
                          <span className="text-base font-black text-emerald-700">
                            {formatPrice(quotedPrice)}
                          </span>
                          <span className="text-xs text-emerald-600"> / unit</span>
                        </div>
                        <button
                          onClick={() => navigate(`/rfq/${rfqDbId}`)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm"
                        >
                          <FiEye className="w-3.5 h-3.5" />
                          <span>View Quote</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {rfq.requirementDetails && (
                    <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 mb-3">
                      <span className="font-semibold text-gray-700">Notes:</span> {rfq.requirementDetails}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleViewDetails(rfq)}
                      className="flex-1 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <FiEye className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>
                    {rfq.status === 'Approved' && (
                      <button
                        onClick={() => handleDownloadInvoice(rfq)}
                        className="flex-1 py-2 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                      >
                        <FiDownload className="w-3.5 h-3.5" />
                        <span>Invoice</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Stock Requests List */}
      {activeTab === 'stock' && (
        <div className="space-y-3">
          {filteredStockRequests.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-gray-400">
              <FiPackage className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm font-medium">No stock requests found</p>
              <p className="text-xs mt-1">Request stock for low/out-of-stock products</p>
            </div>
          ) : (
            filteredStockRequests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{request.id}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">{request.date}</span>
                </div>

                <div className="mb-3">
                  <h4 className="font-bold text-gray-900 text-sm mb-1">{request.productName}</h4>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span className="font-medium">Required: {request.requiredQuantity} {request.unit}s</span>
                    {request.budgetRange && (
                      <span className="font-medium">Budget: {request.budgetRange}</span>
                    )}
                  </div>
                </div>

                {request.expectedDeliveryDate && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                    <FiClock className="w-3.5 h-3.5" />
                    <span>Expected by: {new Date(request.expectedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}

                {request.notes && (
                  <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 mb-3">
                    <span className="font-semibold text-gray-700">Notes:</span> {request.notes}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleViewDetails(request)}
                    className="flex-1 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  >
                    <FiEye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </button>
                  {request.status === 'Seller Responded' && (
                    <button
                      onClick={() => toast.success('Added to cart!')}
                      className="flex-1 py-2 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <FiCheckCircle className="w-3.5 h-3.5" />
                      <span>Order Now</span>
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Details Modal */}
      <AnimatePresence>
        {selectedEnquiry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEnquiry(null)}
              className="absolute inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative z-10"
            >
              <div className="bg-primary-600 px-6 py-4 flex items-center justify-between text-white">
                <h3 className="font-bold text-lg">Enquiry Details</h3>
                <button
                  onClick={() => setSelectedEnquiry(null)}
                  className="text-primary-100 hover:text-white hover:bg-primary-700/50 p-1.5 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                    Enquiry ID
                  </span>
                  <p className="font-mono font-bold text-gray-900">{selectedEnquiry.id}</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                    Product
                  </span>
                  <p className="font-bold text-gray-900">{selectedEnquiry.productName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                      Date
                    </span>
                    <p className="font-semibold text-gray-800">{selectedEnquiry.date}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                      Status
                    </span>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(selectedEnquiry.status)}`}>
                      {getStatusIcon(selectedEnquiry.status)}
                      {selectedEnquiry.status}
                    </div>
                  </div>
                </div>
                {activeTab === 'rfq' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                          Quantity
                        </span>
                        <p className="font-semibold text-gray-800">{selectedEnquiry.quantity} {selectedEnquiry.unit}s</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                          Target Price
                        </span>
                        <p className="font-semibold text-gray-800">{formatPrice(selectedEnquiry.targetPrice)}/unit</p>
                      </div>
                    </div>
                    {selectedEnquiry.quotedPrice && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block mb-2">
                          Quoted Price
                        </span>
                        <p className="text-2xl font-black text-emerald-700">
                          {formatPrice(selectedEnquiry.quotedPrice)}
                        </p>
                        <span className="text-sm text-emerald-600"> / unit</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                          Required Quantity
                        </span>
                        <p className="font-semibold text-gray-800">{selectedEnquiry.requiredQuantity} {selectedEnquiry.unit}s</p>
                      </div>
                      {selectedEnquiry.budgetRange && (
                        <div>
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                            Budget Range
                          </span>
                          <p className="font-semibold text-gray-800">{selectedEnquiry.budgetRange}</p>
                        </div>
                      )}
                    </div>
                    {selectedEnquiry.expectedDeliveryDate && (
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                          Expected Delivery
                        </span>
                        <p className="font-semibold text-gray-800">
                          {new Date(selectedEnquiry.expectedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {selectedEnquiry.notes && (
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                      Notes
                    </span>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedEnquiry.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default B2BMyEnquiries;
