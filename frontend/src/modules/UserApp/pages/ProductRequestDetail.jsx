import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { 
  FiArrowLeft, FiCalendar, FiCheckCircle, FiInfo, FiTag, FiShoppingBag, 
  FiTruck, FiClock, FiAlertCircle, FiMessageSquare, FiXCircle, FiCheck, FiX, FiRefreshCw 
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import api from "../../../shared/utils/api";

const ProductRequestDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [changesMessage, setChangesMessage] = useState("");
  const isB2B = location.pathname.startsWith("/b2b-dashboard");

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(isB2B ? "/b2b-dashboard/product-requests" : "/product-requests", { replace: true });
    }
  };

  useEffect(() => {
    fetchRequestDetail();
  }, [id]);

  const fetchRequestDetail = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/user/product-requests/${id}`);
      if (response.success || response.statusCode === 200) {
        const reqData = response.data;
        const latestQuotation = reqData.vendorQuotation || (reqData.vendorQuotations && reqData.vendorQuotations.length > 0 ? reqData.vendorQuotations[reqData.vendorQuotations.length - 1] : null);
        setRequest({
          ...reqData,
          vendorQuotation: latestQuotation,
          id: reqData.requestId,
          date: reqData.createdAt
        });
      }
    } catch (error) {
      console.error("Failed to fetch request detail:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h remaining`;
  };

  // User Quotation Actions
  const handleApproveQuotation = async () => {
    if (!confirm("Are you sure you want to accept this quotation and generate an order?")) return;
    setIsActionLoading(true);
    try {
      const response = await api.post(`/user/product-requests/${request.requestId || id}/approve-quotation`);
      if (response.success || response.statusCode === 200) {
        toast.success("✅ Quotation approved! Your order has been placed.");
        fetchRequestDetail();
      }
    } catch (err) {
      toast.error(err?.message || "Failed to approve quotation.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectQuotation = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please enter a reason for rejecting the quotation.");
      return;
    }
    setIsActionLoading(true);
    try {
      const response = await api.post(`/user/product-requests/${request.requestId || id}/reject-quotation`, {
        reason: rejectReason
      });
      if (response.success || response.statusCode === 200) {
        toast.success("Quotation rejected. The request has been reopened for other vendors.");
        setShowRejectModal(false);
        setRejectReason("");
        fetchRequestDetail();
      }
    } catch (err) {
      toast.error(err?.message || "Failed to reject quotation.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!changesMessage.trim()) {
      toast.error("Please describe what changes you would like to request.");
      return;
    }
    setIsActionLoading(true);
    try {
      const response = await api.post(`/user/product-requests/${request.requestId || id}/request-changes`, {
        message: changesMessage
      });
      if (response.success || response.statusCode === 200) {
        toast.success("Change request sent to vendor!");
        setShowChangesModal(false);
        setChangesMessage("");
        fetchRequestDetail();
      }
    } catch (err) {
      toast.error(err?.message || "Failed to submit change request.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApproveExtension = async () => {
    if (!confirm("Approve the vendor's request for extended fulfillment time? This will update their active deadline.")) return;
    setIsActionLoading(true);
    try {
      const response = await api.post(`/user/product-requests/${request.requestId || id}/extension/approve`);
      if (response.success || response.statusCode === 200) {
        toast.success("✅ Extension approved! The vendor's deadline has been extended.");
        fetchRequestDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err?.message || "Failed to approve extension.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectExtension = async () => {
    if (!confirm("Reject this extension request? The vendor's original deadline will remain unchanged.")) return;
    setIsActionLoading(true);
    try {
      const response = await api.post(`/user/product-requests/${request.requestId || id}/extension/reject`);
      if (response.success || response.statusCode === 200) {
        toast.success("Extension rejected. Vendor has been notified.");
        fetchRequestDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err?.message || "Failed to reject extension.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmProposal = async () => {
    try {
      const response = await api.post(`/user/product-requests/${request.requestId}/confirm`);
      if (response.success || response.statusCode === 200) {
        toast.success("Proposal accepted! Order created successfully.");
        fetchRequestDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm proposal.");
    }
  };

  if (isLoading) {
    const loadingContent = (
      <div className="w-full max-w-4xl mx-auto min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium text-sm">Loading product request details...</p>
      </div>
    );
    return isB2B ? loadingContent : (
      <MobileLayout showBottomNav={false} showCartBar={false}>
        {loadingContent}
      </MobileLayout>
    );
  }

  if (!request) {
    const notFoundContent = (
      <div className={`w-full max-w-2xl mx-auto min-h-[60vh] flex items-center justify-center p-6 ${isB2B ? 'bg-white rounded-3xl border border-gray-100 p-8 shadow-sm my-6' : ''}`}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto text-2xl">
            <FiAlertCircle />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Request Not Found</h2>
          <p className="text-sm text-gray-500 max-w-sm">The product request <span className="font-semibold text-gray-700">"{id}"</span> could not be found or you do not have permission to view it.</p>
          <button
            onClick={handleBack}
            className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-[#7B0A0A] hover:bg-[#AE020B] text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
          >
            <FiArrowLeft />
            <span>Back to Product Requests</span>
          </button>
        </div>
      </div>
    );

    return isB2B ? notFoundContent : (
      <MobileLayout showBottomNav={true} showCartBar={true}>
        {notFoundContent}
      </MobileLayout>
    );
  }

  const isVendorWindowFlow = [
    'Vendor Window Open', 'Vendor Accepted', 'Quotation Submitted', 
    'Quotation Approved', 'Vendor Window Expired', 'Fulfillment Window Expired'
  ].includes(request.status) || Boolean(request.windowStatus);

  const timelineSteps = isVendorWindowFlow ? [
    { status: "Submitted", label: "Request Submitted" },
    { status: "Vendor Window Open", label: "Vendor Discovery Window" },
    { status: "Vendor Accepted", label: "Vendor Assigned" },
    { status: "Quotation Submitted", label: "Quotation Received" },
    { status: "Quotation Approved", label: "Quotation Approved" },
    { status: "Completed", label: "Order Fulfilled" }
  ] : [
    { status: "Submitted", label: "Request Submitted" },
    { status: "Under Review", label: "Under Review" },
    { status: "Vendor Sourcing", label: "Vendor Sourcing" },
    { status: "Final Proposal", label: "Proposal Received" },
    { status: "Confirmed", label: "Confirmed" }
  ];

  const getStepState = (stepName) => {
    if (request.status === "Rejected" || request.status === "Vendor Window Expired" || request.status === "Fulfillment Window Expired") {
      if (stepName === "Quotation Submitted" || stepName === "Final Proposal") return "rejected";
      if (stepName === "Quotation Approved" || stepName === "Confirmed" || stepName === "Completed") return "future";
      return "completed";
    }

    const order = isVendorWindowFlow
      ? ["Submitted", "Vendor Window Open", "Vendor Accepted", "Quotation Submitted", "Quotation Approved", "Completed"]
      : ["Submitted", "Under Review", "Vendor Sourcing", "Final Proposal", "Confirmed"];

    const currentIndex = order.indexOf(request.status);
    const stepIndex = order.indexOf(stepName);

    if (currentIndex >= stepIndex) return "completed";
    if (currentIndex === stepIndex - 1) return "active";
    return "future";
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

  const content = (
    <div className={`w-full pb-24 max-w-4xl mx-auto min-h-screen px-4 py-6 ${isB2B ? 'bg-white rounded-3xl border border-gray-150 p-6 shadow-sm mt-4' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm border border-gray-200"
        >
          <FiArrowLeft className="text-xl text-gray-700" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">{request.id}</span>
            <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${getStatusStyle(request.status)}`}>
              {request.status}
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-800 truncate">{request.productName}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details Panel */}
        <div className="lg:col-span-2 space-y-6">

          {/* Vendor Window Active Banners */}
          {(request.windowStatus === 'OPEN' || request.status === 'Vendor Window Open') && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-3xl p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-xl text-orange-600 text-lg shrink-0">🏪</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-orange-800 text-sm">Vendor Discovery Window Open</h3>
                    {request.windowExpiresAt && (
                      <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <FiClock className="shrink-0" />
                        {formatCountdown(request.windowExpiresAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-orange-700 mt-1">
                    Your request is actively broadcast to qualified marketplace vendors. Once a vendor accepts, they will have 7 days to provide a detailed pricing quotation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {(request.windowStatus === 'VENDOR_LOCKED' || request.status === 'Vendor Accepted') && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-xl text-blue-600 text-lg shrink-0">🤝</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-blue-800 text-sm">Vendor Locked & Preparing Quotation</h3>
                    {request.vendorFulfillmentExpiresAt && (
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <FiClock className="shrink-0" />
                        {formatCountdown(request.vendorFulfillmentExpiresAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-2">
                    <p className="text-xs text-blue-700">
                      A verified vendor has accepted your request. They are finalizing pricing, inventory, and delivery terms to submit a quotation for your review.
                    </p>
                    {request.chatThreadId && (
                      <button
                        onClick={() => navigate(`/chat/vendor/${request.chatThreadId}`)}
                        className="shrink-0 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <FiMessageSquare className="text-sm" />
                        <span>Chat with Vendor</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(request.windowStatus === 'EXPIRED' || request.status === 'Vendor Window Expired' || request.status === 'Fulfillment Window Expired') && (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-5 shadow-xs">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="text-red-500 text-xl shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-extrabold text-red-800 text-sm">Vendor Window Expired</h3>
                  <p className="text-xs text-red-600 mt-1">
                    The sourcing window concluded without a completed quotation. Admin can reopen the vendor window or provide an alternate fulfillment plan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Extension Request Card ── show whenever extensionRequest exists and status is not NONE ── */}
          {request.extensionRequest && request.extensionRequest.status !== 'NONE' && (
            <AnimatePresence mode="wait">
              <motion.div
                key={request.extensionRequest.status}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-3xl border p-5 shadow-xs ${
                  request.extensionRequest.status === 'PENDING'
                    ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
                    : request.extensionRequest.status === 'APPROVED'
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
                    : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl text-xl shrink-0 ${
                    request.extensionRequest.status === 'PENDING' ? 'bg-amber-100 text-amber-600' :
                    request.extensionRequest.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-red-100 text-red-500'
                  }`}>
                    {request.extensionRequest.status === 'PENDING' ? '⏳' :
                     request.extensionRequest.status === 'APPROVED' ? '✅' : '❌'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-extrabold text-sm ${
                        request.extensionRequest.status === 'PENDING' ? 'text-amber-800' :
                        request.extensionRequest.status === 'APPROVED' ? 'text-emerald-800' :
                        'text-red-800'
                      }`}>
                        {request.extensionRequest.status === 'PENDING'
                          ? 'Vendor Requesting Additional Fulfillment Time'
                          : request.extensionRequest.status === 'APPROVED'
                          ? 'Extension Approved — Deadline Extended'
                          : 'Extension Request — Rejected'}
                      </h3>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                        request.extensionRequest.status === 'PENDING' ? 'bg-amber-200 text-amber-800' :
                        request.extensionRequest.status === 'APPROVED' ? 'bg-emerald-200 text-emerald-800' :
                        'bg-red-200 text-red-800'
                      }`}>{request.extensionRequest.status}</span>
                    </div>
                    <p className={`text-xs mt-1 ${
                      request.extensionRequest.status === 'PENDING' ? 'text-amber-700' :
                      request.extensionRequest.status === 'APPROVED' ? 'text-emerald-700' :
                      'text-red-600'
                    }`}>
                      {request.extensionRequest.status === 'PENDING'
                        ? 'The vendor has requested more time to fulfill your request. Please review the details and respond.'
                        : request.extensionRequest.status === 'APPROVED'
                        ? 'You approved the vendor\'s extension request. The new active deadline is shown below.'
                        : 'You rejected this extension. The vendor must work within the original deadline.'}
                    </p>
                  </div>
                </div>

                {/* Extension Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="bg-white/70 rounded-xl p-3 border border-black/5">
                    <span className="text-gray-400 block mb-0.5">Additional Days Requested</span>
                    <strong className="text-gray-800 text-sm">{request.extensionRequest.requestedDays} day(s)</strong>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3 border border-black/5">
                    <span className="text-gray-400 block mb-0.5">Current Deadline</span>
                    <strong className="text-gray-800 text-sm">
                      {request.extensionRequest.currentDeadline
                        ? new Date(request.extensionRequest.currentDeadline).toDateString()
                        : '—'}
                    </strong>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3 border border-black/5">
                    <span className="text-gray-400 block mb-0.5">Proposed New Deadline</span>
                    <strong className={`text-sm ${
                      request.extensionRequest.status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {request.extensionRequest.proposedDeadline
                        ? new Date(request.extensionRequest.proposedDeadline).toDateString()
                        : '—'}
                    </strong>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3 border border-black/5">
                    <span className="text-gray-400 block mb-0.5">Requested On</span>
                    <strong className="text-gray-800 text-sm">
                      {request.extensionRequest.requestedAt
                        ? new Date(request.extensionRequest.requestedAt).toLocaleDateString()
                        : '—'}
                    </strong>
                  </div>
                </div>

                {/* Vendor's Reason */}
                {request.extensionRequest.reason && (
                  <div className="bg-white/60 rounded-xl p-3 border border-black/5 text-xs mb-4">
                    <span className="text-gray-400 block mb-1 font-bold uppercase tracking-wider text-[10px]">Vendor's Reason</span>
                    <p className="text-gray-800 leading-relaxed">{request.extensionRequest.reason}</p>
                  </div>
                )}

                {/* Active Deadline after approval */}
                {request.extensionRequest.status === 'APPROVED' && (
                  <div className="bg-emerald-100 border border-emerald-200 rounded-xl p-3 text-xs flex items-center justify-between">
                    <span className="font-bold text-emerald-700">New Active Fulfillment Deadline</span>
                    <span className="font-extrabold text-emerald-800 text-sm">
                      {request.vendorFulfillmentExpiresAt
                        ? new Date(request.vendorFulfillmentExpiresAt).toDateString()
                        : '—'}
                    </span>
                  </div>
                )}

                {/* CTA Buttons — only when PENDING */}
                {request.extensionRequest.status === 'PENDING' && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-amber-200/60">
                    <button
                      onClick={handleApproveExtension}
                      disabled={isActionLoading}
                      className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <FiCheck className="text-base" />
                      {isActionLoading ? 'Processing...' : 'Approve Extension'}
                    </button>
                    <button
                      onClick={handleRejectExtension}
                      disabled={isActionLoading}
                      className="flex-1 py-3.5 bg-white hover:bg-red-50 text-red-600 border-2 border-red-300 font-extrabold rounded-2xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <FiX className="text-base" />
                      {isActionLoading ? 'Processing...' : 'Reject Extension'}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Vendor Quotation Review Card */}
          {request.vendorQuotation?.unitPrice && (
            <div className="bg-white rounded-3xl p-6 border-2 border-indigo-200 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    Formal Vendor Quotation
                  </span>
                  <h3 className="text-lg font-black text-gray-900 mt-1">Pricing & Fulfillment Offer</h3>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  request.vendorQuotation.status === 'APPROVED' || request.vendorQuotation.status === 'Accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-250' :
                  request.vendorQuotation.status === 'REJECTED' || request.vendorQuotation.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-yellow-50 text-yellow-800 border-yellow-200'
                }`}>
                  {request.vendorQuotation.status || 'PENDING REVIEW'}
                </span>
              </div>

              {/* Quotation Pricing Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 text-xs">
                <div>
                  <span className="text-gray-500 block font-medium">Unit Price</span>
                  <strong className="text-gray-900 text-base font-black">₹{request.vendorQuotation.unitPrice}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block font-medium">Quantity</span>
                  <strong className="text-gray-900 text-base font-black">{request.quantity} units</strong>
                </div>
                <div>
                  <span className="text-indigo-600 block font-medium">Total Sourcing Cost</span>
                  <strong className="text-indigo-700 text-lg font-black">₹{request.vendorQuotation.totalPrice}</strong>
                </div>
                {request.vendorQuotation.deliveryEstimate && (
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-gray-500 block font-medium">Delivery Timeline</span>
                    <strong className="text-gray-800 font-bold">{request.vendorQuotation.deliveryEstimate}</strong>
                  </div>
                )}
              </div>

              {request.vendorQuotation.additionalTerms && (
                <div className="text-xs bg-gray-50 p-3 rounded-xl border border-gray-150">
                  <span className="font-bold text-gray-600 block mb-0.5">Warranty & Terms:</span>
                  <p className="text-gray-750">{request.vendorQuotation.additionalTerms}</p>
                </div>
              )}

              {request.vendorQuotation.notes && (
                <div className="text-xs bg-gray-50 p-3 rounded-xl border border-gray-150">
                  <span className="font-bold text-gray-600 block mb-0.5">Vendor Notes:</span>
                  <p className="text-gray-750">{request.vendorQuotation.notes}</p>
                </div>
              )}

              {/* Action Buttons for Buyer if Quotation is Submitted and Pending */}
              {request.status === "Quotation Submitted" && (request.vendorQuotation.status === "Pending" || request.vendorQuotation.status === "SUBMITTED" || !request.vendorQuotation.status) && (
                <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                  <button
                    onClick={handleApproveQuotation}
                    disabled={isActionLoading}
                    className="flex-1 min-w-[140px] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <FiCheck />
                    <span>Approve Quotation</span>
                  </button>
                  <button
                    onClick={() => setShowChangesModal(true)}
                    disabled={isActionLoading}
                    className="flex-1 min-w-[140px] py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-2xl text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <FiRefreshCw />
                    <span>Request Changes</span>
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={isActionLoading}
                    className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold rounded-2xl text-sm transition-all border border-red-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <FiX />
                    <span>Decline</span>
                  </button>
                </div>
              )}

              {/* Approved Confirmation */}
              {(request.status === "Quotation Approved" || request.status === "Customer Approved" || request.status === "Confirmed") && (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <FiCheckCircle className="text-emerald-600 text-lg shrink-0" />
                  <div>
                    <strong>Quotation Approved!</strong> A B2B procurement order has been created.
                    {request.associatedOrderId && (
                      <span className="ml-1 font-mono font-bold">Order ID: {request.associatedOrderId}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legacy Proposal Card (backward compatibility) */}
          {request.status === "Final Proposal" && request.selectedFulfillment && !request.vendorQuotation?.unitPrice && (
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white rounded-3xl p-6 border border-indigo-950 shadow-md space-y-4">
              <h3 className="text-lg font-black tracking-wide">Procurement Proposal Ready</h3>
              <div className="grid grid-cols-2 gap-4 text-sm bg-black/20 p-4 rounded-2xl">
                <div>
                  <span className="text-indigo-200 block text-xs">Proposed Price</span>
                  <span className="font-extrabold text-lg text-white">₹{request.selectedFulfillment.finalPrice}</span>
                </div>
                <div>
                  <span className="text-indigo-200 block text-xs">Estimated Delivery</span>
                  <span className="font-extrabold text-lg text-white">
                    {request.selectedFulfillment.estimatedDelivery 
                      ? new Date(request.selectedFulfillment.estimatedDelivery).toLocaleDateString()
                      : "3-5 Sourcing Days"}
                  </span>
                </div>
              </div>
              {request.selectedFulfillment.notes && (
                <p className="text-xs text-indigo-150 bg-indigo-950/40 p-3 rounded-xl border border-indigo-850">
                  <strong>Notes:</strong> {request.selectedFulfillment.notes}
                </p>
              )}
              <button
                onClick={handleConfirmProposal}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-750 text-white font-extrabold rounded-2xl text-sm transition-all shadow animate-pulse"
              >
                Accept Proposal & Checkout Order
              </button>
            </div>
          )}

          {/* Legacy Confirmed Card */}
          {request.status === "Confirmed" && !request.vendorQuotation?.unitPrice && (
            <div className="bg-emerald-50 text-emerald-800 rounded-3xl p-6 border border-emerald-150 shadow-sm space-y-2">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                ✅ Procurement Proposal Confirmed
              </h3>
              <p className="text-xs text-emerald-600">
                You accepted the sourcing proposal. A B2B procurement order has been generated.
              </p>
              {request.associatedOrderId && (
                <div className="pt-1 text-xs">
                  Associated Order ID: <span className="font-mono font-bold text-gray-700">{request.associatedOrderId}</span>
                </div>
              )}
            </div>
          )}

          {/* Product Request Details Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-800">Product Request Details</h3>
            
            {request.image && (
              <div className="rounded-2xl overflow-hidden border border-gray-200 aspect-video bg-gray-50 flex items-center justify-center p-2 mb-4">
                <img src={request.image} alt={request.productName} className="max-h-full max-w-full object-contain" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block font-medium">Category</span>
                <span className="font-bold text-gray-700">{request.category}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Quantity Requested</span>
                <span className="font-bold text-gray-700">{request.quantity} units</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Expected Budget</span>
                <span className="font-bold text-gray-700">₹{request.expectedBudget}</span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">Requested On</span>
                <span className="font-bold text-gray-700">{new Date(request.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <span className="text-gray-400 block font-medium text-xs mb-1">Description</span>
              <p className="text-gray-650 text-sm whitespace-pre-wrap">
                {request.description || "No description provided."}
              </p>
            </div>
          </div>
        </div>

        {/* Stepper / Timeline Tracker */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-fit">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Request Status Tracker</h3>
          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
            {timelineSteps.map((step) => {
              const state = getStepState(step.status);
              return (
                <div key={step.status} className="relative flex gap-3 text-sm">
                  <span className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    state === "completed" ? "bg-emerald-500 border-emerald-600 scale-110" :
                    state === "active" ? "bg-indigo-600 border-indigo-700 scale-110 animate-pulse" :
                    state === "rejected" ? "bg-red-500 border-red-600 scale-110" :
                    "bg-white border-gray-200"
                  }`} />
                  <div>
                    <h4 className={`font-bold transition-colors ${
                      state === "completed" ? "text-emerald-700" :
                      state === "active" ? "text-indigo-650" :
                      state === "rejected" ? "text-red-700" :
                      "text-gray-400"
                    }`}>
                      {step.label}
                    </h4>
                    {state === "completed" && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {request.timeline?.find((t) => t.status === step.status)?.comment || "Updated successfully."}
                      </p>
                    )}
                    {state === "rejected" && (
                      <p className="text-xs text-red-500 mt-0.5">
                        Window expired or declined.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reject Quotation Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-gray-100 space-y-4"
            >
              <h3 className="text-lg font-bold text-red-600">Decline Quotation</h3>
              <p className="text-xs text-gray-600">
                Are you sure you want to decline this quotation? The request will be reopened so another vendor can accept it.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Declining *</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Price too high, timeline too long..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-red-500 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleRejectQuotation}
                  disabled={isActionLoading}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm transition-colors shadow disabled:opacity-50"
                >
                  {isActionLoading ? "Submitting..." : "Confirm Decline"}
                </button>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Changes Modal */}
      <AnimatePresence>
        {showChangesModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-gray-100 space-y-4"
            >
              <h3 className="text-lg font-bold text-amber-700">Request Changes to Quotation</h3>
              <p className="text-xs text-gray-600">
                Let the vendor know what adjustments you need (e.g. lower quantity, modified delivery date, price negotiation).
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Feedback / Desired Changes *</label>
                <textarea
                  rows={4}
                  placeholder="e.g. Can you reduce unit price to ₹4,500 if we order 10 units? Can delivery be within 3 days?"
                  value={changesMessage}
                  onChange={(e) => setChangesMessage(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleRequestChanges}
                  disabled={isActionLoading}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-sm transition-colors shadow disabled:opacity-50"
                >
                  {isActionLoading ? "Sending..." : "Send Request to Vendor"}
                </button>
                <button
                  onClick={() => setShowChangesModal(false)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

export default ProductRequestDetail;

