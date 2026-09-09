import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiInbox, FiCheck, FiX, FiInfo, FiEye, FiUser, FiMail, FiPhone, FiCalendar, FiPackage, FiDollarSign, FiTag, FiMaximize2, FiMessageSquare } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";
import { useVendorAuthStore } from "../store/vendorAuthStore";

const VendorProductRequests = () => {
  const navigate = useNavigate();
  const { vendor } = useVendorAuthStore();
  const vendorId = vendor?._id || vendor?.id || "";
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all", "pending", "responded"
  const [filterType, setFilterType] = useState("All"); // All, General, Direct
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [selectedReq, setSelectedReq] = useState(null);
  const [modalType, setModalType] = useState(""); // "supply", "need_info", "quotation", "release"
  const [modalData, setModalData] = useState({ price: "", days: "", comment: "" });
  
  // Full details view modal
  const [viewingDetailsReq, setViewingDetailsReq] = useState(null);

  // Vendor Window state
  const [quotationData, setQuotationData] = useState({ unitPrice: "", totalPrice: "", deliveryEstimate: "", additionalTerms: "", notes: "" });
  const [isAccepting, setIsAccepting] = useState(false);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  const [showReleaseModal, setShowReleaseModal] = useState(null);

  // Extension Request state
  const [showExtensionModal, setShowExtensionModal] = useState(null); // req object or null
  const [extensionDays, setExtensionDays] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [activeTab, filterType, currentPage]);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 10
      };
      if (activeTab === "pending") params.status = "Pending";
      if (activeTab === "responded") params.status = "Seller Responded";
      // "open_windows" tab has no status filter — backend returns window requests via visibility filter
      if (filterType !== "All") params.type = filterType;

      const response = await api.get('/vendor/product-requests', { params });
      if (response.success || response.statusCode === 200) {
        const dataPayload = response.data;
        const rawRequests = dataPayload?.requests || [];
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
      console.error(error);
      toast.error("Failed to load requests.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (req, type) => {
    setSelectedReq(req);
    setModalType(type);
    setModalData({ price: "", days: "", comment: "" });
  };

  const submitAction = async () => {
    if (modalType === "supply") {
      if (!modalData.price || Number(modalData.price) <= 0) {
        toast.error("Please enter a valid price");
        return;
      }
      if (!modalData.days || Number(modalData.days) <= 0) {
        toast.error("Please enter valid delivery days");
        return;
      }
    } else {
      if (!modalData.comment.trim()) {
        toast.error("Please enter information request comments");
        return;
      }
    }

    try {
      const payload = {
        responseType: modalType === "supply" ? "Can Supply" : "Need Info",
        offeredPrice: modalType === "supply" ? Number(modalData.price) : undefined,
        deliveryTimeline: modalType === "supply" ? Number(modalData.days) : undefined,
        message: modalData.comment || (modalType === "supply" ? "We can fulfill this product request." : "")
      };

      const response = await api.put(`/vendor/product-requests/${selectedReq.id}/respond`, payload);
      if (response.success || response.statusCode === 200) {
        toast.success("Response submitted successfully!");
        loadRequests();
        setSelectedReq(null);
        if (viewingDetailsReq && viewingDetailsReq.id === selectedReq.id) {
          setViewingDetailsReq(null);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to submit response.");
    }
  };

  const handleCannotSupply = async (req) => {
    try {
      const payload = {
        responseType: "Need Info",
        message: "We are unable to fulfill this request at this moment."
      };
      const response = await api.put(`/vendor/product-requests/${req.id}/respond`, payload);
      if (response.success || response.statusCode === 200) {
        toast.success("Response submitted successfully!");
        loadRequests();
        if (viewingDetailsReq && viewingDetailsReq.id === req.id) {
          setViewingDetailsReq(null);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit response.");
    }
  };

  const handleAcceptVendorWindow = async (req) => {
    setIsAccepting(true);
    try {
      const response = await api.post(`/vendor/product-requests/${req.requestId || req.id}/accept-window`, {});
      if (response.success || response.statusCode === 200) {
        toast.success("✅ Request accepted! You have 7 days to submit a quotation.");
        loadRequests();
      }
    } catch (err) {
      toast.error(err?.message || "Failed to accept request. Another vendor may have accepted first.");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSubmitQuotation = async (req) => {
    if (!quotationData.unitPrice || !quotationData.totalPrice) {
      toast.error("Unit price and total price are required.");
      return;
    }
    setIsSubmittingQuote(true);
    try {
      const response = await api.post(`/vendor/product-requests/${req.requestId || req.id}/submit-quotation`, {
        unitPrice: Number(quotationData.unitPrice),
        totalPrice: Number(quotationData.totalPrice),
        deliveryEstimate: quotationData.deliveryEstimate,
        additionalTerms: quotationData.additionalTerms,
        notes: quotationData.notes
      });
      if (response.success || response.statusCode === 200) {
        toast.success("Quotation submitted! Customer and Admin have been notified.");
        loadRequests();
        setSelectedReq(null);
        setModalType("");
        setQuotationData({ unitPrice: "", totalPrice: "", deliveryEstimate: "", additionalTerms: "", notes: "" });
      }
    } catch (err) {
      toast.error(err?.message || "Failed to submit quotation.");
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const handleReleaseRequest = async () => {
    if (!showReleaseModal) return;
    setIsReleasing(true);
    try {
      const response = await api.post(`/vendor/product-requests/${showReleaseModal.requestId || showReleaseModal.id}/release`, {
        reason: releaseReason || "Vendor unable to fulfill the request."
      });
      if (response.success || response.statusCode === 200) {
        toast.success("Request released. Other vendors can now accept.");
        loadRequests();
        setShowReleaseModal(null);
        setReleaseReason("");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to release request.");
    } finally {
      setIsReleasing(false);
    }
  };

  const handleRequestExtension = async () => {
    if (!showExtensionModal) return;
    const parsedDays = parseInt(extensionDays, 10);
    if (!parsedDays || parsedDays < 1 || parsedDays > 30) {
      toast.error("Please enter a number of days between 1 and 30.");
      return;
    }
    if (!extensionReason.trim()) {
      toast.error("Please provide a reason for the extension request.");
      return;
    }
    setIsSubmittingExtension(true);
    try {
      const response = await api.post(
        `/vendor/product-requests/${showExtensionModal.requestId || showExtensionModal.id}/request-extension`,
        { additionalDays: parsedDays, reason: extensionReason.trim() }
      );
      if (response.success || response.statusCode === 200) {
        toast.success("✅ Extension request submitted! Customer has been notified.");
        loadRequests();
        setShowExtensionModal(null);
        setExtensionDays("");
        setExtensionReason("");
        if (viewingDetailsReq && (viewingDetailsReq.id === showExtensionModal.id || viewingDetailsReq.requestId === showExtensionModal.requestId)) {
          setViewingDetailsReq(null);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err?.message || "Failed to submit extension request.");
    } finally {
      setIsSubmittingExtension(false);
    }
  };

  const handleStartChatWithBuyer = async (req) => {
    const reqId = req.requestId || req.id;
    try {
      const res = await api.post(`/vendor/product-requests/${reqId}/chat/initiate`);
      const thread = res?.data;
      const threadId = thread?._id;
      toast.success("Opening chat with customer...");
      if (threadId) {
        navigate(`/vendor/chat?threadId=${threadId}&requestId=${reqId}`);
      } else {
        navigate(`/vendor/chat?requestId=${reqId}`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err?.message || "Navigating to chat...");
      navigate(`/vendor/chat?requestId=${reqId}`);
    }
  };

  const formatCountdown = (expiresAt) => {
    if (!expiresAt) return "—";
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h remaining`;
  };


  const filteredRequests = requests.filter((r) => {
    const matchSearch =
      r.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;

    if (filterType === "General" && r.requestType !== "GENERAL") return false;
    if (filterType === "Direct" && r.requestType !== "SHOP_SPECIFIC") return false;

    const isAcceptedByMe = String(r.acceptedVendorId?._id || r.acceptedVendorId) === String(vendorId);

    const hasVendorResponded = r.sellerResponses?.some((s) => String(s.sellerId) === String(vendorId)) ||
      r.assignedVendors?.some((v) => String(v.vendorId) === String(vendorId) && v.status === "RESPONDED") ||
      (r.windowStatus === 'VENDOR_LOCKED' && isAcceptedByMe);

    if (activeTab === "pending") {
      if (isAcceptedByMe) return true;
      return !hasVendorResponded && r.status !== "Rejected" && r.status !== "Product Added" && r.status !== "Confirmed" && r.status !== "Completed";
    }
    if (activeTab === "responded") {
      return hasVendorResponded;
    }
    if (activeTab === "open_windows") {
      return r.windowStatus === 'OPEN' || r.windowStatus === 'REOPENED' || isAcceptedByMe;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-gray-800 mb-2">Buyer Product Requests</h1>
        <p className="text-sm text-gray-500">Respond to custom product requests from buyers on the marketplace</p>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex bg-gray-100 rounded-xl p-1 w-full sm:w-auto overflow-x-auto">
            {["all", "pending", "responded", "open_windows"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold capitalize rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "open_windows" ? "🏪 Open Windows" : `${tab} Requests`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:max-w-xs">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search requests..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>

        {/* Sourcing Channel Filter */}
        <div className="flex gap-2 border-t border-gray-100 pt-3">
          {["All", "General", "Direct"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-all border ${
                filterType === type
                  ? "bg-indigo-600 text-white border-indigo-650"
                  : "bg-gray-50 text-gray-500 border-gray-250 hover:bg-gray-100"
              }`}
            >
              {type === "All" ? "All Channels" : type === "General" ? "Marketplace Requests" : "Direct Requests"}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <FiInbox className="mx-auto text-5xl text-gray-300 mb-3" />
          <p className="text-gray-500 font-bold">No product requests found</p>
          <p className="text-xs text-gray-450 mt-1">Check back later for new requests</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((req) => {
            const myResponse = req.sellerResponses?.find((s) => String(s.sellerId) === String(vendorId));
            const targetStoreName = req.targetEntityId?.storeName || req.targetEntityId?.name || "Direct Store";
            const acceptedId = req.acceptedVendorId?._id ? String(req.acceptedVendorId._id) : String(req.acceptedVendorId || "");
            const isAcceptedByMe = Boolean(vendorId && acceptedId === String(vendorId));

            return (
              <motion.div
                key={req.id}
                layout
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  {/* Top bar: Request ID, Status badge, and View Details Button */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs text-gray-400 font-mono font-bold">{req.id}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border ${
                        req.status === "Submitted" ? "bg-blue-50 text-blue-700 border-blue-100" :
                        req.status === "Under Review" ? "bg-yellow-50 text-yellow-750 border-yellow-100" :
                        "bg-purple-50 text-purple-700 border-purple-100"
                      }`}>
                        {req.status}
                      </span>
                      <button
                        onClick={() => setViewingDetailsReq(req)}
                        className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        title="View Full Product Request Details"
                      >
                        <FiEye className="text-sm" />
                        <span className="hidden sm:inline">Details</span>
                      </button>
                    </div>
                  </div>

                  {/* Image & Product Title */}
                  <div className="flex items-start gap-3 mb-3">
                    {req.image ? (
                      <div 
                        onClick={() => setViewingDetailsReq(req)}
                        className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <img src={req.image} alt={req.productName} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 text-indigo-600 font-extrabold text-base">
                        {req.productName?.charAt(0).toUpperCase() || "P"}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-extrabold text-gray-850 text-base leading-tight mb-1">{req.productName}</h3>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-bold">
                          {req.category}
                        </span>
                        {req.requestType === 'SHOP_SPECIFIC' ? (
                          <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                            🏪 Direct: {targetStoreName}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full font-bold border border-gray-200">
                            🌐 Marketplace Request
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary Details Box */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <FiPackage className="text-indigo-500 shrink-0" />
                      <span>Qty: <strong className="text-gray-800">{req.quantity}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FiDollarSign className="text-emerald-500 shrink-0" />
                      <span>Budget: <strong className="text-emerald-700 font-bold">₹{req.expectedBudget}</strong></span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-gray-500">
                        <FiCalendar className="text-gray-400 shrink-0" />
                        {new Date(req.date).toLocaleDateString()}
                      </span>
                      {req.userId?.name && (
                        <span className="flex items-center gap-1 font-bold text-gray-700">
                          <FiUser className="text-gray-400 shrink-0" />
                          {req.userId.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Requirements preview with Expand button */}
                  {req.description && (
                    <div className="mb-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Specifications:</p>
                      <p className="text-xs text-gray-650 line-clamp-2 bg-gray-50/50 p-2.5 rounded-lg border border-gray-100 font-medium">
                        {req.description}
                      </p>
                    </div>
                  )}
                </div>

                  {/* Vendor Window — Accept Banner */}
                  {(req.windowStatus === 'OPEN' || req.windowStatus === 'REOPENED') &&
                   !isAcceptedByMe && (
                    <div className="mb-3 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-orange-700 text-sm">🏪 Vendor Window Open</span>
                        <span className="text-orange-500 font-bold">{formatCountdown(req.windowExpiresAt)}</span>
                      </div>
                      <p className="text-orange-600">Be the first to accept and lock this request for 7 days!</p>
                    </div>
                  )}
                  {/* Vendor locked by another vendor */}
                  {req.windowStatus === 'VENDOR_LOCKED' && !isAcceptedByMe && (
                    <div className="mb-3 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-500 text-center font-bold">
                      🔒 This request is currently assigned to another vendor
                    </div>
                  )}
                  {/* My active fulfillment window */}
                  {(req.windowStatus === 'VENDOR_LOCKED' || req.status === 'Vendor Accepted') && isAcceptedByMe && (
                    <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-indigo-700">✅ You accepted this request</span>
                        <span className="text-indigo-500 font-bold">{formatCountdown(req.vendorFulfillmentExpiresAt)}</span>
                      </div>
                      <p className="text-indigo-600">Submit a quotation to the customer within your 7-day window.</p>

                      {/* Extension Status Badge */}
                      {req.extensionRequest?.status === 'PENDING' && (
                        <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                          <span className="text-amber-600 text-sm">⏳</span>
                          <div>
                            <p className="font-extrabold text-amber-700 text-[11px]">Extension Request Pending</p>
                            <p className="text-amber-600 text-[10px]">Awaiting customer approval for {req.extensionRequest.requestedDays} extra day(s)</p>
                          </div>
                        </div>
                      )}
                      {req.extensionRequest?.status === 'APPROVED' && (
                        <div className="mt-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                          <span className="text-emerald-600 text-sm">✅</span>
                          <div>
                            <p className="font-extrabold text-emerald-700 text-[11px]">Last Extension Approved</p>
                            <p className="text-emerald-600 text-[10px]">New deadline: {req.vendorFulfillmentExpiresAt ? new Date(req.vendorFulfillmentExpiresAt).toDateString() : '—'}</p>
                          </div>
                        </div>
                      )}
                      {req.extensionRequest?.status === 'REJECTED' && (
                        <div className="mt-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                          <span className="text-red-500 text-sm">❌</span>
                          <div>
                            <p className="font-extrabold text-red-700 text-[11px]">Extension Request Rejected</p>
                            <p className="text-red-500 text-[10px]">Original deadline applies. You may submit a new request.</p>
                          </div>
                        </div>
                      )}

                      {/* Direct Buyer Contact */}
                      {req.userId && (
                        <div className="mt-2 pt-2 border-t border-indigo-200/70 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-gray-800">
                            Buyer: {req.userId.name || "Customer"}
                          </span>
                          <div className="flex items-center gap-2">
                            {req.userId.phone && (
                              <a
                                href={`tel:${req.userId.phone}`}
                                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200 flex items-center gap-1 transition-colors"
                                title="Call Customer"
                              >
                                <FiPhone className="text-xs" />
                                <span>{req.userId.phone}</span>
                              </a>
                            )}
                            {req.userId.email && (
                              <a
                                href={`mailto:${req.userId.email}?subject=Regarding Product Request: ${encodeURIComponent(req.productName || '')}`}
                                className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 flex items-center gap-1 transition-colors"
                                title="Email Customer"
                              >
                                <FiMail className="text-xs" />
                                <span>Email</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* Card Action footer */}
                <div className="pt-3 border-t border-gray-100">
                  {/* Vendor Window: OPEN — show Accept button */}
                  {(req.windowStatus === 'OPEN' || req.windowStatus === 'REOPENED') &&
                   !isAcceptedByMe ? (
                    <button
                      onClick={() => handleAcceptVendorWindow(req)}
                      disabled={isAccepting}
                      className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isAccepting ? "Accepting..." : "🏪 Accept This Request"}
                    </button>
                  /* Vendor Window: LOCKED by ME — show Submit Quotation + Chat + Extension + Release */
                  ) : (req.windowStatus === 'VENDOR_LOCKED' || req.status === 'Vendor Accepted') && isAcceptedByMe ? (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => { setSelectedReq(req); setModalType("quotation"); }}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-sm transition-colors shadow-xs"
                      >
                        📋 Submit Quotation
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStartChatWithBuyer(req)}
                          className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold rounded-xl text-xs transition-colors border border-blue-200 flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <FiMessageSquare className="text-sm" />
                          <span>💬 Chat with Customer</span>
                        </button>
                        {/* Extension Request button — only when no PENDING request exists */}
                        {(!req.extensionRequest || req.extensionRequest.status === 'NONE' || req.extensionRequest.status === 'REJECTED' || req.extensionRequest.status === 'APPROVED') && (
                          <button
                            onClick={() => { setShowExtensionModal(req); setExtensionDays(""); setExtensionReason(""); }}
                            className="px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-xl text-xs transition-colors border border-amber-200 flex items-center gap-1"
                            title="Request extended fulfillment deadline"
                          >
                            <FiCalendar className="text-xs" />
                            <span>+Days</span>
                          </button>
                        )}
                        <button
                          onClick={() => setShowReleaseModal(req)}
                          className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs transition-colors border border-red-200"
                        >
                          Release
                        </button>
                      </div>
                    </div>
                  /* Normal flow — existing supply / need-info buttons */
                  ) : myResponse ? (
                    <div className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100 text-xs space-y-1">
                      <div className="flex items-center justify-between text-indigo-800 font-bold">
                        <span>Your Response: {myResponse.responseType}</span>
                        <span className="text-[10px] text-gray-400">{new Date(myResponse.date).toLocaleDateString()}</span>
                      </div>
                      {myResponse.message && <p className="text-gray-700 text-xs">{myResponse.message}</p>}
                      {myResponse.responseType === "Can Supply" && (
                        <div className="text-indigo-900 font-bold pt-1 text-xs">
                          Offered Price: ₹{myResponse.offeredPrice} | Delivery: {myResponse.deliveryTimeline} days
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleAction(req, "supply")}
                        className="flex-1 min-w-[85px] py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1 shadow-xs"
                      >
                        <FiCheck />
                        <span>Can Supply</span>
                      </button>
                      <button
                        onClick={() => handleCannotSupply(req)}
                        className="flex-1 min-w-[85px] py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1 shadow-xs"
                      >
                        <FiX />
                        <span>Cannot Supply</span>
                      </button>
                      <button
                        onClick={() => handleAction(req, "need_info")}
                        className="flex-1 min-w-[85px] py-2 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <FiInfo />
                        <span>Need Info</span>
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Full Request Details Modal */}
      <AnimatePresence>
        {viewingDetailsReq && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-2xl w-full border border-gray-100 space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-indigo-600 font-mono font-black">{viewingDetailsReq.id}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border ${
                      viewingDetailsReq.status === "Submitted" ? "bg-blue-50 text-blue-700 border-blue-100" :
                      viewingDetailsReq.status === "Under Review" ? "bg-yellow-50 text-yellow-750 border-yellow-100" :
                      "bg-purple-50 text-purple-700 border-purple-100"
                    }`}>
                      {viewingDetailsReq.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-gray-850">{viewingDetailsReq.productName}</h2>
                </div>
                <button
                  onClick={() => setViewingDetailsReq(null)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              {/* Reference Image (If Available) */}
              {viewingDetailsReq.image && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Reference Image Uploaded by Buyer</label>
                  <div className="relative rounded-2xl overflow-hidden border border-gray-200 max-h-72 bg-gray-50 flex items-center justify-center">
                    <img
                      src={viewingDetailsReq.image}
                      alt={viewingDetailsReq.productName}
                      className="max-h-72 w-full object-contain"
                    />
                    <a
                      href={viewingDetailsReq.image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 bg-black/70 hover:bg-black text-white text-xs px-3 py-1.5 rounded-xl font-bold backdrop-blur-sm transition-colors flex items-center gap-1"
                    >
                      <FiMaximize2 />
                      <span>View Full Image</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Grid Specifications */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-150 text-xs">
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Category</span>
                  <strong className="text-gray-800 font-bold text-sm">{viewingDetailsReq.category}</strong>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Quantity Required</span>
                  <strong className="text-indigo-600 font-black text-sm">{viewingDetailsReq.quantity} units</strong>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Expected Budget</span>
                  <strong className="text-emerald-600 font-black text-sm">₹{viewingDetailsReq.expectedBudget}</strong>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Request Type</span>
                  <strong className="text-gray-800 font-bold">
                    {viewingDetailsReq.requestType === 'SHOP_SPECIFIC' ? 'Direct Shop Request' : 'Marketplace Request'}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Target Store</span>
                  <strong className="text-gray-800 font-bold">
                    {viewingDetailsReq.targetEntityId?.storeName || viewingDetailsReq.targetEntityId?.name || (viewingDetailsReq.requestType === 'SHOP_SPECIFIC' ? 'Direct Shop' : 'All Marketplace Vendors')}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Submitted Date</span>
                  <strong className="text-gray-800 font-bold">{new Date(viewingDetailsReq.date).toLocaleDateString()}</strong>
                </div>
              </div>

              {/* Full Description & Specifications */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Full Requirements & Specifications</label>
                <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">
                  {viewingDetailsReq.description || "No specific detailed description provided by buyer."}
                </div>
              </div>

              {/* Buyer Contact Information */}
              {viewingDetailsReq.userId && (
                <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-150">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Buyer Information</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <FiUser className="text-gray-400 shrink-0" />
                      <span>Name: <strong className="text-gray-800">{viewingDetailsReq.userId.name || "Buyer"}</strong></span>
                    </div>
                    {viewingDetailsReq.userId.email && (
                      <div className="flex items-center gap-2">
                        <FiMail className="text-gray-400 shrink-0" />
                        <span>Email: <strong className="text-gray-800">{viewingDetailsReq.userId.email}</strong></span>
                      </div>
                    )}
                    {viewingDetailsReq.userId.phone && (
                      <div className="flex items-center gap-2">
                        <FiPhone className="text-gray-400 shrink-0" />
                        <span>Phone: <strong className="text-gray-800">{viewingDetailsReq.userId.phone}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Extension Request Status in Details Modal */}
              {viewingDetailsReq && (viewingDetailsReq.acceptedVendorId?._id ? String(viewingDetailsReq.acceptedVendorId._id) : String(viewingDetailsReq.acceptedVendorId || '')) === String(vendorId) && viewingDetailsReq.extensionRequest && viewingDetailsReq.extensionRequest.status !== 'NONE' && (
                <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  viewingDetailsReq.extensionRequest.status === 'PENDING' ? 'bg-amber-50 border-amber-200' :
                  viewingDetailsReq.extensionRequest.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-extrabold text-sm ${
                      viewingDetailsReq.extensionRequest.status === 'PENDING' ? 'text-amber-700' :
                      viewingDetailsReq.extensionRequest.status === 'APPROVED' ? 'text-emerald-700' :
                      'text-red-700'
                    }`}>
                      {viewingDetailsReq.extensionRequest.status === 'PENDING' ? '⏳ Extension Request Pending' :
                       viewingDetailsReq.extensionRequest.status === 'APPROVED' ? '✅ Last Extension Approved' :
                       '❌ Last Extension Rejected'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase ${
                      viewingDetailsReq.extensionRequest.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                      viewingDetailsReq.extensionRequest.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-red-100 text-red-800'
                    }`}>{viewingDetailsReq.extensionRequest.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-gray-700">
                    <div><span className="text-gray-400 block">Requested Days</span><strong>{viewingDetailsReq.extensionRequest.requestedDays} day(s)</strong></div>
                    <div><span className="text-gray-400 block">Current Deadline</span><strong>{viewingDetailsReq.extensionRequest.currentDeadline ? new Date(viewingDetailsReq.extensionRequest.currentDeadline).toDateString() : '—'}</strong></div>
                    <div><span className="text-gray-400 block">Proposed Deadline</span><strong>{viewingDetailsReq.extensionRequest.proposedDeadline ? new Date(viewingDetailsReq.extensionRequest.proposedDeadline).toDateString() : '—'}</strong></div>
                    <div><span className="text-gray-400 block">Requested On</span><strong>{viewingDetailsReq.extensionRequest.requestedAt ? new Date(viewingDetailsReq.extensionRequest.requestedAt).toLocaleDateString() : '—'}</strong></div>
                  </div>
                  {viewingDetailsReq.extensionRequest.reason && (
                    <div className="pt-1 border-t border-black/5">
                      <span className="text-gray-400 block mb-0.5">Reason Given</span>
                      <p className="text-gray-800 font-medium">{viewingDetailsReq.extensionRequest.reason}</p>
                    </div>
                  )}
                  {viewingDetailsReq.extensionRequest.respondedAt && (
                    <p className="text-[10px] text-gray-400 pt-0.5">Responded on: {new Date(viewingDetailsReq.extensionRequest.respondedAt).toLocaleString()}</p>
                  )}
                </div>
              )}

              {/* Action options in modal */}
              <div className="pt-3 border-t border-gray-100 flex gap-2">
                {Boolean(viewingDetailsReq.acceptedVendorId && (viewingDetailsReq.acceptedVendorId?._id ? String(viewingDetailsReq.acceptedVendorId._id) : String(viewingDetailsReq.acceptedVendorId)) === String(vendorId)) ? (
                  <>
                    <button
                      onClick={() => {
                        const r = viewingDetailsReq;
                        setViewingDetailsReq(null);
                        setSelectedReq(r);
                        setModalType("quotation");
                      }}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-sm transition-colors shadow flex items-center justify-center gap-1.5"
                    >
                      📋 Submit Quotation
                    </button>
                    {(!viewingDetailsReq.extensionRequest || viewingDetailsReq.extensionRequest.status === 'NONE' || viewingDetailsReq.extensionRequest.status === 'REJECTED' || viewingDetailsReq.extensionRequest.status === 'APPROVED') && (
                      <button
                        onClick={() => {
                          const r = viewingDetailsReq;
                          setViewingDetailsReq(null);
                          setShowExtensionModal(r);
                          setExtensionDays("");
                          setExtensionReason("");
                        }}
                        className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-sm transition-colors shadow flex items-center gap-1.5"
                      >
                        <FiCalendar />
                        <span>Request More Days</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const r = viewingDetailsReq;
                        setViewingDetailsReq(null);
                        handleStartChatWithBuyer(r);
                      }}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm transition-colors shadow flex items-center justify-center gap-1.5"
                    >
                      <FiMessageSquare />
                      <span>Chat with Customer</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        const reqToAct = viewingDetailsReq;
                        handleAction(reqToAct, "supply");
                      }}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl text-sm transition-colors shadow flex items-center justify-center gap-1.5"
                    >
                      <FiCheck />
                      <span>Offer Supply Proposal</span>
                    </button>
                    <button
                      onClick={() => {
                        const reqToAct = viewingDetailsReq;
                        handleAction(reqToAct, "need_info");
                      }}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-2xl text-sm transition-colors shadow flex items-center justify-center gap-1.5"
                    >
                      <FiInfo />
                      <span>Request Information</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViewingDetailsReq(null)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quotation Modal */}
      <AnimatePresence>
        {selectedReq && modalType === "quotation" && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-gray-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-lg font-black text-gray-900">Submit Quotation</h3>
                <button onClick={() => { setSelectedReq(null); setModalType(""); }} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
              </div>
              <p className="text-xs text-gray-500">
                For: <strong className="text-gray-800">{selectedReq.productName}</strong> | Qty: <span className="text-indigo-600 font-bold">{selectedReq.quantity} units</span> | Budget: ₹{selectedReq.expectedBudget || "N/A"}
              </p>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Unit Price (₹) *</label>
                    <input
                      type="number"
                      placeholder="Price per unit"
                      value={quotationData.unitPrice}
                      onChange={(e) => {
                        const unit = e.target.value;
                        const qty = selectedReq.quantity || 1;
                        setQuotationData({
                          ...quotationData,
                          unitPrice: unit,
                          totalPrice: unit ? (Number(unit) * qty).toString() : ""
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Total Price (₹) *</label>
                    <input
                      type="number"
                      placeholder="Total amount"
                      value={quotationData.totalPrice}
                      onChange={(e) => setQuotationData({ ...quotationData, totalPrice: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Delivery Estimate</label>
                  <input
                    type="text"
                    placeholder="e.g. 3-5 business days"
                    value={quotationData.deliveryEstimate}
                    onChange={(e) => setQuotationData({ ...quotationData, deliveryEstimate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Additional Terms / Warranty</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. 1-year brand warranty, free delivery included"
                    value={quotationData.additionalTerms}
                    onChange={(e) => setQuotationData({ ...quotationData, additionalTerms: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Notes to Customer & Admin</label>
                  <textarea
                    rows={2}
                    placeholder="Specifications or brand information..."
                    value={quotationData.notes}
                    onChange={(e) => setQuotationData({ ...quotationData, notes: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleSubmitQuotation(selectedReq)}
                    disabled={isSubmittingQuote}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-2xl text-sm transition-colors shadow disabled:opacity-50"
                  >
                    {isSubmittingQuote ? "Submitting..." : "Submit Quotation"}
                  </button>
                  <button
                    onClick={() => { setSelectedReq(null); setModalType(""); }}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Extension Request Modal */}
      <AnimatePresence>
        {showExtensionModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-gray-100 space-y-5"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <FiCalendar className="text-amber-500" />
                    Request Extended Days
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">For: <strong>{showExtensionModal.productName}</strong></p>
                </div>
                <button onClick={() => setShowExtensionModal(null)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
              </div>

              {/* Current Deadline Info */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Current Fulfillment Deadline</span>
                  <span className="font-extrabold text-indigo-700">
                    {showExtensionModal.vendorFulfillmentExpiresAt ? new Date(showExtensionModal.vendorFulfillmentExpiresAt).toDateString() : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Time Remaining</span>
                  <span className="font-bold text-indigo-600">{formatCountdown(showExtensionModal.vendorFulfillmentExpiresAt)}</span>
                </div>
                {extensionDays && parseInt(extensionDays) > 0 && showExtensionModal.vendorFulfillmentExpiresAt && (
                  <div className="flex justify-between pt-1 border-t border-indigo-200">
                    <span className="text-gray-500 font-medium">Proposed New Deadline</span>
                    <span className="font-extrabold text-amber-700">
                      {new Date(new Date(showExtensionModal.vendorFulfillmentExpiresAt).getTime() + parseInt(extensionDays) * 86400000).toDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Additional Days Requested <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    placeholder="1 – 30 days"
                    value={extensionDays}
                    onChange={(e) => setExtensionDays(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm font-semibold"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Maximum 30 additional days per request.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Reason for Extension <span className="text-red-500">*</span></label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Awaiting import clearance, supplier delay, custom manufacturing required..."
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    maxLength={500}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">{extensionReason.length}/500 characters</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                <strong>Note:</strong> The customer must approve this extension request before the new deadline takes effect. You will be notified of their decision.
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleRequestExtension}
                  disabled={isSubmittingExtension}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-sm transition-colors shadow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingExtension ? 'Submitting...' : '📅 Submit Extension Request'}
                </button>
                <button
                  onClick={() => { setShowExtensionModal(null); setExtensionDays(""); setExtensionReason(""); }}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Release Request Modal */}
      <AnimatePresence>
        {showReleaseModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-gray-100 space-y-4"
            >
              <h3 className="text-lg font-bold text-red-600">Release Product Request</h3>
              <p className="text-xs text-gray-600">
                Are you sure you want to release <strong>{showReleaseModal.productName}</strong>? The request will be reopened for other vendors to accept.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Releasing (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Stock unavailable, unable to meet timeline..."
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-red-500 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleReleaseRequest}
                  disabled={isReleasing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm transition-colors shadow disabled:opacity-50"
                >
                  {isReleasing ? "Releasing..." : "Confirm Release"}
                </button>
                <button
                  onClick={() => { setShowReleaseModal(null); setReleaseReason(""); }}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Standard Response Modal (Supply / Need Info) */}
      <AnimatePresence>
        {selectedReq && (modalType === "supply" || modalType === "need_info") && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-gray-100 space-y-4"
            >
              <h3 className="text-lg font-bold text-gray-800">
                {modalType === "supply" ? "Offer Fulfillment Proposal" : "Request Clarification"}
              </h3>
              <p className="text-xs text-gray-500">
                For request: <strong>{selectedReq.productName}</strong> ({selectedReq.id})
              </p>

              <div className="space-y-3">
                {modalType === "supply" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Your Price Offer (₹)</label>
                      <input
                        type="number"
                        placeholder="E.g. 4800"
                        value={modalData.price}
                        onChange={(e) => setModalData({ ...modalData, price: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Delivery Time (Days)</label>
                      <input
                        type="number"
                        placeholder="E.g. 5"
                        value={modalData.days}
                        onChange={(e) => setModalData({ ...modalData, days: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {modalType === "supply" ? "Comments (Optional)" : "Questions / Details Needed *"}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={modalType === "supply" ? "Details about warranty, brand, accessories..." : "What size, color preference, compatibility model are you looking for?"}
                    value={modalData.comment}
                    onChange={(e) => setModalData({ ...modalData, comment: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={submitAction}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-2xl text-sm transition-colors shadow"
                  >
                    Submit Response
                  </button>
                  <button
                    onClick={() => setSelectedReq(null)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-colors text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VendorProductRequests;

