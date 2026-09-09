import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiArrowLeft, FiPlus, FiInbox, FiChevronRight, FiCalendar, FiClock } from "react-icons/fi";
import { motion } from "framer-motion";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import api from "../../../shared/utils/api";

const ProductRequestHistory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isB2B = location.pathname.startsWith("/b2b-dashboard");
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("All");
  const [activeType, setActiveType] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchRequests();
  }, [activeStatus, activeType, currentPage]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 10
      };
      if (activeStatus !== "All") params.status = activeStatus;
      if (activeType !== "All") params.type = activeType;

      const response = await api.get('/user/product-requests', { params });
      if (response.success || response.statusCode === 200) {
        const dataPayload = response.data;
        const rawRequests = Array.isArray(dataPayload) 
          ? dataPayload 
          : (dataPayload?.requests || []);
        
        const formatted = rawRequests.map(r => ({
          ...r,
          id: r.requestId,
          date: r.createdAt
        }));
        setRequests(formatted);

        if (dataPayload?.pagination) {
          setTotalPages(dataPayload.pagination.pages || 1);
        } else {
          setTotalPages(1);
        }
      }
    } catch (error) {
      console.error("Failed to fetch product requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    const map = {
      Submitted: "bg-blue-50 text-blue-700 border-blue-200",
      "Under Review": "bg-yellow-50 text-yellow-750 border-yellow-200",
      "Vendor Sourcing": "bg-purple-50 text-purple-700 border-purple-250",
      "Vendor Window Open": "bg-orange-50 text-orange-700 border-orange-200 animate-pulse",
      "Vendor Accepted": "bg-blue-50 text-blue-700 border-blue-200",
      "Quotation Submitted": "bg-indigo-50 text-indigo-700 border-indigo-200 font-black",
      "Quotation Approved": "bg-emerald-50 text-emerald-700 border-emerald-250 font-black",
      "Final Proposal": "bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse",
      Confirmed: "bg-emerald-50 text-emerald-700 border-emerald-250 font-black",
      Accepted: "bg-green-50 text-green-700 border-green-200",
      Completed: "bg-emerald-50 text-emerald-700 border-emerald-250 font-black",
      Rejected: "bg-red-50 text-red-700 border-red-200",
      "Vendor Window Expired": "bg-red-50 text-red-700 border-red-200",
      "Fulfillment Window Expired": "bg-red-50 text-red-700 border-red-200"
    };
    return map[status] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  const getDetailPath = (reqId) => {
    return isB2B ? `/b2b-dashboard/product-requests/${reqId}` : `/product-requests/${reqId}`;
  };

  const getCreatePath = () => {
    return isB2B ? `/b2b-dashboard/product-requests/new` : `/product-requests/new`;
  };

  const content = (
    <div className={`w-full max-w-4xl mx-auto min-h-screen px-4 py-6 ${isB2B ? 'bg-white rounded-3xl border border-gray-150 p-6 shadow-sm' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {!isB2B && (
            <button
              onClick={() => {
                if (window.history.state && window.history.state.idx > 0) {
                  navigate(-1);
                } else {
                  navigate("/profile");
                }
              }}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm border border-gray-200"
            >
              <FiArrowLeft className="text-xl text-gray-700" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-gray-800">Product Sourcing Requests</h1>
            <p className="text-xs text-gray-500">Track and manage custom or bulk product requests</p>
          </div>
        </div>

        <button
          onClick={() => navigate(getCreatePath())}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold rounded-xl text-xs shadow-md transition-all shrink-0"
        >
          <FiPlus className="text-lg" />
          <span>New Request</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status:</span>
          <select 
            value={activeStatus} 
            onChange={(e) => { setActiveStatus(e.target.value); setCurrentPage(1); }}
            className="text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 font-bold text-gray-700 focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Vendor Window Open">Vendor Window Open</option>
            <option value="Vendor Accepted">Vendor Accepted</option>
            <option value="Quotation Submitted">Quotation Received</option>
            <option value="Quotation Approved">Quotation Approved</option>
            <option value="Under Review">Under Review</option>
            <option value="Vendor Sourcing">Vendor Sourcing</option>
            <option value="Final Proposal">Proposal Ready</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Rejected">Rejected</option>
            <option value="Vendor Window Expired">Window Expired</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type:</span>
          <select 
            value={activeType} 
            onChange={(e) => { setActiveType(e.target.value); setCurrentPage(1); }}
            className="text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 font-bold text-gray-700 focus:outline-none"
          >
            <option value="All">All Types</option>
            <option value="GENERAL">General Requests</option>
            <option value="SHOP_SPECIFIC">Shop Requests</option>
          </select>
        </div>
      </div>

      {/* List or Empty State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-650 mb-4"></div>
          <p className="text-gray-500 font-semibold">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm text-center max-w-md mx-auto my-12">
          <FiInbox className="mx-auto text-6xl text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-800">No requests found</h3>
          <p className="text-sm text-gray-500 mt-1 mb-6">
            You haven't requested any custom or unavailable products yet.
          </p>
          <button
            onClick={() => navigate(getCreatePath())}
            className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white font-bold rounded-xl text-sm shadow-md transition-all"
          >
            Create Request
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req, idx) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => navigate(getDetailPath(req.id))}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-4 min-w-0">
                {req.image ? (
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center shrink-0 border border-gray-150">
                    <img src={req.image} alt={req.productName} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 text-indigo-600 font-bold text-lg">
                    {req.productName?.charAt(0).toUpperCase() || "P"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs text-gray-400 font-mono">{req.id}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${getStatusStyle(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-gray-800 text-base truncate group-hover:text-indigo-600 transition-colors">
                    {req.productName}
                  </h3>
                  {req.requestType === 'SHOP_SPECIFIC' && req.targetEntityId && (
                    <div className="mt-1 flex items-center gap-1.5 bg-gray-50 border border-gray-150 rounded-lg px-2 py-0.5 w-fit">
                      <span className="text-[10px] font-bold text-indigo-700">
                        Shop: {req.targetEntityId.storeName || req.targetEntityId.name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <FiCalendar />
                      {new Date(req.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <FiClock />
                      Qty: {req.quantity}
                    </span>
                    <span>
                      Budget: ₹{req.expectedBudget}
                    </span>
                  </div>
                </div>
              </div>
              <FiChevronRight className="text-gray-400 group-hover:text-gray-600 transition-colors text-xl shrink-0" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 disabled:opacity-50 transition-all hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-xs font-semibold text-gray-650">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 disabled:opacity-50 transition-all hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  if (isB2B) {
    return <PageTransition>{content}</PageTransition>;
  }

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        {content}
      </MobileLayout>
    </PageTransition>
  );
};

export default ProductRequestHistory;
