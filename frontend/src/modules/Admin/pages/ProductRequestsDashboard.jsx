import { useState, useEffect } from "react";
import { FiSearch, FiLayers, FiAlertCircle, FiCheckCircle, FiXCircle, FiTrendingUp, FiSettings, FiEdit, FiTrash2, FiActivity, FiUser, FiInfo, FiSend, FiEye, FiMaximize2, FiMail, FiPhone, FiCalendar, FiPackage, FiDollarSign, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";

const ProductRequestsDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All"); // All, General, PLE Shop
  
  // Status modification state
  const [selectedReq, setSelectedReq] = useState(null);
  const [nextStatus, setNextStatus] = useState("");
  const [adminComment, setAdminComment] = useState("");

  // Full Details View state
  const [viewingDetailsReq, setViewingDetailsReq] = useState(null);

  // Detailed Sourcing Workspace state
  const [sourcingReq, setSourcingReq] = useState(null);
  const [sourcingData, setSourcingData] = useState(null);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [sourcingMode, setSourcingMode] = useState("PLE_SHOP"); // PLE_SHOP, VENDOR, SPLIT

  // Proposal Submission state
  const [proposalReq, setProposalReq] = useState(null);
  const [proposalData, setProposalData] = useState({
    pleQuantity: 0,
    vendors: [],
    finalPrice: "",
    estimatedDelivery: "",
    notes: ""
  });

  // Vendor Window state
  const [vendorWindowReq, setVendorWindowReq] = useState(null);
  const [vendorWindowNote, setVendorWindowNote] = useState("");
  const [vendorWindowDays, setVendorWindowDays] = useState(14);
  const [isOpeningWindow, setIsOpeningWindow] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/product-requests');
      if (response.success || response.statusCode === 200) {
        const payload = response.data;
        const list = Array.isArray(payload) ? payload : (payload?.requests || []);
        setRequests(list);
      }
    } catch (error) {
      console.error("Failed to fetch product requests:", error);
      toast.error("Failed to fetch requests.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStats = () => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === "Submitted" || r.status === "Under Review" || r.status === "Vendor Sourcing" || r.status === "PLE Sourcing").length;
    const accepted = requests.filter((r) => r.status === "Accepted" || r.status === "Confirmed" || r.status === "Completed" || r.status === "Product Added").length;
    const rejected = requests.filter((r) => r.status === "Rejected").length;
    return { total, pending, accepted, rejected };
  };

  const handleStatusChangeClick = (req, status) => {
    setSelectedReq(req);
    setNextStatus(status);
    setAdminComment(
      status === "Under Review" ? "Your request is currently being reviewed by our sourcing team." :
      status === "Accepted" ? "Sourcing options found. Request accepted and sellers notified." :
      status === "Rejected" ? "Sorry, we are unable to source this product model at the moment." :
      status === "Product Added" ? "Great news! The product has been successfully added to our catalog." :
      ""
    );
  };

  const submitStatusChange = async () => {
    try {
      const response = await api.put(`/admin/product-requests/${selectedReq.id}/status`, {
        status: nextStatus,
        comment: adminComment
      });
      if (response.success || response.statusCode === 200) {
        toast.success(`Updated request status to ${nextStatus}`);
        loadRequests();
        setSelectedReq(null);
        if (viewingDetailsReq && viewingDetailsReq.id === selectedReq.id) {
          setViewingDetailsReq(null);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    }
  };

  const handleOpenSourcingWorkspace = async (req) => {
    setSourcingReq(req);
    setSourcingMode(req.fulfillmentType && req.fulfillmentType !== "NONE" ? req.fulfillmentType : "PLE_SHOP");
    setSelectedVendors(req.assignedVendors?.map(v => v.vendorId) || []);
    try {
      const response = await api.get(`/admin/product-requests/${req.id}/sourcing-check`);
      if (response.success || response.statusCode === 200) {
        setSourcingData(response.data);
      }
    } catch (error) {
      toast.error("Failed to load live sourcing inventory.");
    }
  };

  const submitSourcingAssignment = async () => {
    try {
      const response = await api.post(`/admin/product-requests/${sourcingReq.id}/assign-sourcing`, {
        fulfillmentType: sourcingMode,
        vendors: selectedVendors.map(id => ({ vendorId: id }))
      });
      if (response.success || response.statusCode === 200) {
        toast.success("Sourcing strategy assigned successfully!");
        loadRequests();
        setSourcingReq(null);
        setSourcingData(null);
      }
    } catch (err) {
      toast.error("Failed to assign sourcing targets.");
    }
  };

  const handleOpenProposalWorkspace = (req) => {
    setProposalReq(req);
    // Auto fill with existing responses if available
    const responsiveVendors = req.assignedVendors
      ?.filter(v => v.status === "RESPONDED")
      ?.map(v => ({
        vendorId: v.vendorId,
        quantity: req.quantity,
        price: v.offeredPrice
      })) || [];

    setProposalData({
      pleQuantity: req.fulfillmentType === "PLE_SHOP" || req.fulfillmentType === "SPLIT" ? req.quantity : 0,
      vendors: responsiveVendors,
      finalPrice: responsiveVendors[0]?.price || req.expectedBudget || "",
      estimatedDelivery: "",
      notes: ""
    });
  };

  const submitFinalProposal = async () => {
    if (!proposalData.finalPrice) {
      toast.error("Please enter a final proposed price");
      return;
    }
    try {
      const response = await api.post(`/admin/product-requests/${proposalReq.id}/select-fulfillment`, proposalData);
      if (response.success || response.statusCode === 200) {
        toast.success("Final proposal dispatched to B2B buyer!");
        loadRequests();
        setProposalReq(null);
      }
    } catch (err) {
      toast.error("Failed to submit proposal");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this request record?")) {
      try {
        const response = await api.delete(`/admin/product-requests/${id}`);
        if (response.success || response.statusCode === 200) {
          toast.success("Request record deleted.");
          loadRequests();
          if (viewingDetailsReq && viewingDetailsReq.id === id) {
            setViewingDetailsReq(null);
          }
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete request');
      }
    }
  };

  const handleOpenVendorWindow = async () => {
    if (!vendorWindowReq) return;
    setIsOpeningWindow(true);
    try {
      const response = await api.post(`/admin/product-requests/${vendorWindowReq.id || vendorWindowReq.requestId}/open-vendor-window`, {
        windowDays: Number(vendorWindowDays) || 14,
        note: vendorWindowNote || undefined
      });
      if (response.success || response.statusCode === 200) {
        toast.success(`✅ Vendor window opened! All approved vendors notified. Window closes in ${vendorWindowDays} days.`);
        loadRequests();
        setVendorWindowReq(null);
        setVendorWindowNote("");
        setVendorWindowDays(14);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to open vendor window.");
    } finally {
      setIsOpeningWindow(false);
    }
  };

  const handleSelectVendorQuotation = async (req, quotationIndex) => {
    try {
      const response = await api.post(`/admin/product-requests/${req.id || req.requestId}/select-vendor-quotation`, {
        quotationIndex
      });
      if (response.success || response.statusCode === 200) {
        toast.success("Vendor quotation selected as final proposal. Buyer notified!");
        loadRequests();
      }
    } catch (err) {
      toast.error(err?.message || "Failed to select quotation.");
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


  const stats = getStats();

  const filteredRequests = requests.filter((r) => {
    const matchesSearch = (
      r.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (!matchesSearch) return false;

    if (filterType === "General") {
      return r.requestType === "GENERAL";
    }
    if (filterType === "PLE Shop") {
      return (
        r.requestType === "SHOP_SPECIFIC" &&
        (r.targetEntityType === "ManagedShop" || 
         r.targetEntityId?.name === "PLE Shop" || 
         r.targetEntityId?.storeName === "PLE Shop" || 
         String(r.targetEntityId) === "1" ||
         r.targetEntityName === "PLE Shop")
      );
    }
    return true;
  });

  const getStatusBadge = (status) => {
    const style =
      status === "Submitted" ? "bg-blue-50 text-blue-700 border-blue-200" :
      status === "Under Review" ? "bg-yellow-50 text-yellow-800 border-yellow-250" :
      status === "Vendor Sourcing" ? "bg-purple-50 text-purple-700 border-purple-200" :
      status === "PLE Sourcing" ? "bg-teal-50 text-teal-700 border-teal-200" :
      status === "Final Proposal" ? "bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse" :
      status === "Confirmed" ? "bg-emerald-50 text-emerald-700 border-emerald-250 font-black" :
      status === "Accepted" ? "bg-green-50 text-green-700 border-green-200" :
      status === "Rejected" ? "bg-red-50 text-red-700 border-red-200" :
      // Vendor Window statuses
      status === "Vendor Window Open" ? "bg-orange-50 text-orange-700 border-orange-300 animate-pulse" :
      status === "Vendor Accepted" ? "bg-indigo-50 text-indigo-700 border-indigo-300" :
      status === "Vendor Fulfillment" ? "bg-violet-50 text-violet-700 border-violet-300" :
      status === "Vendor Released" ? "bg-amber-50 text-amber-700 border-amber-300" :
      status === "Quotation Submitted" ? "bg-cyan-50 text-cyan-700 border-cyan-300 animate-pulse" :
      status === "Negotiation" ? "bg-pink-50 text-pink-700 border-pink-300" :
      status === "Customer Approved" ? "bg-lime-50 text-lime-700 border-lime-300" :
      status === "Expired" ? "bg-gray-50 text-gray-500 border-gray-300" :
      "bg-emerald-50 text-emerald-700 border-emerald-200";

    return (
      <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${style}`}>
        {status}
      </span>
    );
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-black text-gray-800 mb-2">B2B Product Sourcing Workspace</h1>
        <p className="text-sm text-gray-500">Manage buyer custom product requests, check PLE inventory, find vendors, assign RFQs, and submit final proposals</p>
      </div>

      {/* Analytics Cards */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Requests", value: stats.total, icon: FiLayers, color: "text-blue-600 bg-blue-50" },
            { label: "Active Sourcing", value: stats.pending, icon: FiAlertCircle, color: "text-amber-600 bg-amber-50" },
            { label: "Accepted / Confirmed", value: stats.accepted, icon: FiCheckCircle, color: "text-emerald-600 bg-emerald-50" },
            { label: "Rejected Requests", value: stats.rejected, icon: FiXCircle, color: "text-red-650 bg-red-50" },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-gray-150 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{card.label}</span>
                <h2 className="text-3xl font-black text-gray-800 mt-1">{card.value}</h2>
              </div>
              <div className={`p-4 rounded-2xl ${card.color}`}>
                <card.icon className="text-2xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Requests table control */}
      <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="font-extrabold text-gray-800 text-lg">All B2B Procurement Requests</h3>
            {/* Filter Tabs */}
            <div className="flex gap-2 mt-2">
              {["All", "General", "PLE Shop"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all border ${
                    filterType === type
                      ? "bg-indigo-600 text-white border-indigo-650"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {type === "All" ? "All Requests" : type === "General" ? "Marketplace Sourcing" : "PLE Shop Requests"}
                </button>
              ))}
            </div>
          </div>
          
          <div className="relative w-full sm:max-w-xs shrink-0">
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

        {/* Desktop Table View */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-500 font-semibold">Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FiLayers className="mx-auto text-4xl mb-2" />
              <span>No requests found matching criteria.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-bold uppercase">
                  <th className="p-4">Request Details</th>
                  <th className="p-4">Specifications</th>
                  <th className="p-4">Sourcing Strategy</th>
                  <th className="p-4">Sourcing Options</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Manage</th>
                  <th className="p-4 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {req.image ? (
                          <div 
                            onClick={() => setViewingDetailsReq(req)}
                            className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 shrink-0 border border-gray-150 cursor-pointer hover:opacity-80 transition-opacity"
                            title="Click to view full image & details"
                          >
                            <img src={req.image} alt={req.productName} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div 
                            onClick={() => setViewingDetailsReq(req)}
                            className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 text-indigo-600 font-bold text-sm cursor-pointer hover:bg-indigo-100 transition-colors"
                          >
                            {req.productName?.charAt(0).toUpperCase() || "P"}
                          </div>
                        )}
                        <div>
                          <h4 
                            onClick={() => setViewingDetailsReq(req)}
                            className="font-extrabold text-gray-800 hover:text-indigo-600 cursor-pointer transition-colors"
                          >
                            {req.productName}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                            <span>{req.id}</span>
                            {req.userId?.name && (
                              <span className="font-sans font-bold text-gray-600">
                                • {req.userId.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-gray-500">
                      <div>Category: <strong className="text-gray-700">{req.category}</strong></div>
                      <div>Requested Qty: <strong className="text-gray-700">{req.quantity}</strong></div>
                      <div>Budget: <strong className="text-gray-700">₹{req.expectedBudget}</strong></div>
                      {req.description && (
                        <div className="text-[11px] text-gray-400 line-clamp-1 italic mt-0.5">
                          "{req.description}"
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {req.acceptedVendorId ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
                          🔒 Vendor Locked
                        </span>
                      ) : (req.windowStatus === "OPEN" || req.windowStatus === "REOPENED" || req.status === "Vendor Window Open") ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-black border border-orange-200">
                          🏪 Window Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                          {!req.fulfillmentType || req.fulfillmentType === "NONE" ? "Unassigned" : req.fulfillmentType.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      {req.acceptedVendorId ? (
                        <div className="bg-blue-50/80 p-2 rounded-xl border border-blue-150 space-y-1">
                          <div className="font-black text-blue-900 text-xs flex items-center gap-1">
                            <span>🏪</span>
                            <span>{req.acceptedVendorId.storeName || req.acceptedVendorId.name || req.acceptedVendorId.companyName || "Assigned Vendor"}</span>
                          </div>
                          {req.acceptedVendorId.phone && (
                            <div className="text-[11px] text-gray-600 font-mono flex items-center gap-1">
                              <span>📞</span>
                              <span>{req.acceptedVendorId.phone}</span>
                            </div>
                          )}
                          {req.vendorFulfillmentExpiresAt && (
                            <div className="text-[10px] text-indigo-700 font-bold bg-white px-2 py-0.5 rounded border border-indigo-100 inline-block">
                              ⏳ Quote due: {formatCountdown(req.vendorFulfillmentExpiresAt)}
                            </div>
                          )}
                        </div>
                      ) : (req.windowStatus === "OPEN" || req.windowStatus === "REOPENED" || req.status === "Vendor Window Open") ? (
                        <div className="text-orange-600 font-bold text-xs bg-orange-50/50 p-2 rounded-xl border border-orange-150">
                          <div>Window Live (14-Day)</div>
                          {req.windowExpiresAt && (
                            <div className="text-[10px] text-orange-500 font-normal">{formatCountdown(req.windowExpiresAt)}</div>
                          )}
                        </div>
                      ) : req.assignedVendors && req.assignedVendors.length > 0 ? (
                        <div className="text-indigo-650 font-bold">
                          {req.assignedVendors.filter(v => v.status === "RESPONDED").length} / {req.assignedVendors.length} bids responded
                        </div>
                      ) : (
                        <span className="text-gray-400">No vendors assigned</span>
                      )}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(req.status)}
                      {req.acceptedVendorId && (
                        <div className="mt-1 text-[11px] font-black text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-150 inline-block">
                          Assigned: {req.acceptedVendorId.storeName || req.acceptedVendorId.name}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5 items-center max-w-[200px] mx-auto">
                        <button
                          onClick={() => setViewingDetailsReq(req)}
                          className="w-full px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1"
                        >
                          <FiEye className="text-xs" />
                          <span>Full Details</span>
                        </button>

                        <button
                          onClick={() => handleOpenSourcingWorkspace(req)}
                          className="w-full px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1 border border-blue-200"
                        >
                          🏪 Check PLE Stock
                        </button>

                        {/* Vendor Window — prominent primary button when window not yet opened */}
                        {(!req.windowStatus || req.windowStatus === "NONE" || req.windowStatus === "CLOSED" || req.windowStatus === "EXPIRED") && (
                          <button
                            onClick={() => setVendorWindowReq(req)}
                            className="w-full px-3 py-1.5 bg-orange-600 text-white hover:bg-orange-700 font-extrabold text-xs rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm"
                          >
                            🏪 Open Vendor Window
                          </button>
                        )}

                        {/* Vendor Window info — when window is active */}
                        {req.windowStatus && req.windowStatus !== "NONE" && req.windowStatus !== "CLOSED" && (
                          <div className={`w-full px-2 py-1.5 rounded-lg text-[11px] font-extrabold text-center border ${
                            req.windowStatus === "OPEN" || req.windowStatus === "REOPENED" ? "bg-orange-50 text-orange-700 border-orange-200" :
                            req.windowStatus === "VENDOR_LOCKED" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                            "bg-gray-50 text-gray-500 border-gray-200"
                          }`}>
                            🕐 {req.windowStatus === "OPEN" ? "Window Open" : req.windowStatus === "REOPENED" ? "Window Reopened" : req.windowStatus === "VENDOR_LOCKED" ? "Vendor Locked" : req.windowStatus}
                          </div>
                        )}

                        {/* Quotation actions */}
                        {req.vendorQuotations && req.vendorQuotations.length > 0 && req.status === "Quotation Submitted" && (
                          <button
                            onClick={() => handleSelectVendorQuotation(req, 0)}
                            className="w-full px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold text-xs rounded-lg transition-all shadow-sm"
                          >
                            ✅ Select Quotation
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(req.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-block"
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Full Request Details Modal */}
      <AnimatePresence>
        {viewingDetailsReq && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-3xl w-full border border-gray-100 space-y-6 my-8 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-indigo-600 font-mono font-black">{viewingDetailsReq.id}</span>
                    {getStatusBadge(viewingDetailsReq.status)}
                  </div>
                  <h2 className="text-2xl font-black text-gray-850">{viewingDetailsReq.productName}</h2>
                </div>
                <button
                  onClick={() => setViewingDetailsReq(null)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              {/* Reference Image (If Uploaded) */}
              {viewingDetailsReq.image && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Buyer Uploaded Reference Image</label>
                  <div className="relative rounded-2xl overflow-hidden border border-gray-200 max-h-80 bg-gray-50 flex items-center justify-center">
                    <img
                      src={viewingDetailsReq.image}
                      alt={viewingDetailsReq.productName}
                      className="max-h-80 w-full object-contain"
                    />
                    <a
                      href={viewingDetailsReq.image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 bg-black/75 hover:bg-black text-white text-xs px-3.5 py-2 rounded-xl font-bold backdrop-blur-sm transition-colors flex items-center gap-1.5 shadow"
                    >
                      <FiMaximize2 />
                      <span>Open Full High-Res Image</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Comprehensive Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-150 text-xs">
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Category</span>
                  <strong className="text-gray-850 font-bold text-sm">{viewingDetailsReq.category}</strong>
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
                  <span className="text-gray-400 font-medium block mb-0.5">Sourcing Channel</span>
                  <strong className="text-gray-800 font-bold">
                    {viewingDetailsReq.requestType === 'SHOP_SPECIFIC' ? 'Direct Shop Request' : 'Marketplace Sourcing'}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Target Entity</span>
                  <strong className="text-gray-800 font-bold">
                    {viewingDetailsReq.targetEntityId?.storeName || viewingDetailsReq.targetEntityId?.name || (viewingDetailsReq.requestType === 'SHOP_SPECIFIC' ? 'Direct Store' : 'All Vendors')}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block mb-0.5">Submission Date</span>
                  <strong className="text-gray-800 font-bold">{new Date(viewingDetailsReq.date).toLocaleString()}</strong>
                </div>
              </div>

              {/* Full Description & Requirements */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Full Specifications & Requirements (Filled by Buyer)</label>
                <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">
                  {viewingDetailsReq.description || "No specific detailed description provided by buyer."}
                </div>
              </div>

              {/* Buyer Information Section */}
              {viewingDetailsReq.userId && (
                <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-150">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Buyer Account Details</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <FiUser className="text-gray-400 shrink-0 text-base" />
                      <div>
                        <span className="text-gray-400 block text-[10px]">Name</span>
                        <strong className="text-gray-800 font-bold">{viewingDetailsReq.userId.name || "N/A"}</strong>
                      </div>
                    </div>
                    {viewingDetailsReq.userId.email && (
                      <div className="flex items-center gap-2">
                        <FiMail className="text-gray-400 shrink-0 text-base" />
                        <div>
                          <span className="text-gray-400 block text-[10px]">Email</span>
                          <strong className="text-gray-800 font-bold">{viewingDetailsReq.userId.email}</strong>
                        </div>
                      </div>
                    )}
                    {viewingDetailsReq.userId.phone && (
                      <div className="flex items-center gap-2">
                        <FiPhone className="text-gray-400 shrink-0 text-base" />
                        <div>
                          <span className="text-gray-400 block text-[10px]">Phone</span>
                          <strong className="text-gray-800 font-bold">{viewingDetailsReq.userId.phone}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vendor Window Assigned Partner Card */}
              {viewingDetailsReq.acceptedVendorId && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-blue-900 text-sm flex items-center gap-1.5">
                      <span>🏪</span>
                      <span>Assigned Vendor Partner: {viewingDetailsReq.acceptedVendorId.storeName || viewingDetailsReq.acceptedVendorId.name || viewingDetailsReq.acceptedVendorId.companyName}</span>
                    </span>
                    {viewingDetailsReq.vendorFulfillmentExpiresAt && (
                      <span className="font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-full border border-indigo-200 shadow-xs">
                        Quote due: {formatCountdown(viewingDetailsReq.vendorFulfillmentExpiresAt)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-gray-750 font-medium">
                    <div>Store: <strong className="text-gray-900">{viewingDetailsReq.acceptedVendorId.storeName || "N/A"}</strong></div>
                    <div>Phone: <strong className="text-gray-900">{viewingDetailsReq.acceptedVendorId.phone || "N/A"}</strong></div>
                    <div>Email: <strong className="text-gray-900">{viewingDetailsReq.acceptedVendorId.email || "N/A"}</strong></div>
                  </div>
                </div>
              )}

              {/* Sourcing Strategy & Vendor Bids Overview */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Sourcing Bids ({viewingDetailsReq.assignedVendors?.length || 0})</label>
                {viewingDetailsReq.assignedVendors && viewingDetailsReq.assignedVendors.length > 0 ? (
                  <div className="border border-gray-150 rounded-2xl overflow-hidden max-h-48 overflow-y-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold uppercase">
                        <tr>
                          <th className="p-3">Vendor</th>
                          <th className="p-3">Bid Status</th>
                          <th className="p-3 text-right">Offered Price</th>
                          <th className="p-3 text-right">Delivery Days</th>
                          <th className="p-3">Comments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-650">
                        {viewingDetailsReq.assignedVendors.map((v, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="p-3 font-bold text-gray-800">{v.vendorName || "Assigned Vendor"}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                v.status === "RESPONDED" ? "bg-green-50 text-green-700" :
                                v.status === "UNAVAILABLE" ? "bg-red-50 text-red-700" :
                                "bg-yellow-50 text-yellow-750"
                              }`}>
                                {v.status}
                              </span>
                            </td>
                            <td className="p-3 text-right font-extrabold text-gray-850">₹{v.offeredPrice || "N/A"}</td>
                            <td className="p-3 text-right">{v.deliveryTimeline ? `${v.deliveryTimeline} days` : "N/A"}</td>
                            <td className="p-3 text-gray-500">{v.message || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-400 italic border border-gray-100">
                    No vendors assigned yet. Open the Vendor Window to allow eligible vendors to bid and submit quotations.
                  </div>
                )}
              </div>

              {/* ─── Vendor Extension Activity Card ─────────────────────────────── */}
              {viewingDetailsReq.extensionRequest && viewingDetailsReq.extensionRequest.status !== 'NONE' && (
                <div className={`p-4 rounded-2xl border text-xs space-y-3 ${
                  viewingDetailsReq.extensionRequest.status === 'PENDING'
                    ? 'bg-amber-50 border-amber-200'
                    : viewingDetailsReq.extensionRequest.status === 'APPROVED'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-black text-sm flex items-center gap-1.5 ${
                      viewingDetailsReq.extensionRequest.status === 'PENDING' ? 'text-amber-800' :
                      viewingDetailsReq.extensionRequest.status === 'APPROVED' ? 'text-emerald-800' :
                      'text-red-800'
                    }`}>
                      <span>
                        {viewingDetailsReq.extensionRequest.status === 'PENDING' ? '⏳' :
                         viewingDetailsReq.extensionRequest.status === 'APPROVED' ? '✅' : '❌'}
                      </span>
                      <span>Vendor Extension Request</span>
                    </span>
                    <span className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase ${
                      viewingDetailsReq.extensionRequest.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                      viewingDetailsReq.extensionRequest.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                      'bg-red-100 text-red-800'
                    }`}>{viewingDetailsReq.extensionRequest.status}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-700">
                    <div className="bg-white/70 p-2 rounded-xl border border-black/5">
                      <span className="text-gray-400 block mb-0.5 text-[10px]">Requested Days</span>
                      <strong className="font-extrabold">{viewingDetailsReq.extensionRequest.requestedDays} day(s)</strong>
                    </div>
                    <div className="bg-white/70 p-2 rounded-xl border border-black/5">
                      <span className="text-gray-400 block mb-0.5 text-[10px]">Current Deadline</span>
                      <strong className="font-extrabold">
                        {viewingDetailsReq.extensionRequest.currentDeadline
                          ? new Date(viewingDetailsReq.extensionRequest.currentDeadline).toLocaleDateString()
                          : '—'}
                      </strong>
                    </div>
                    <div className="bg-white/70 p-2 rounded-xl border border-black/5">
                      <span className="text-gray-400 block mb-0.5 text-[10px]">Proposed Deadline</span>
                      <strong className="font-extrabold text-amber-700">
                        {viewingDetailsReq.extensionRequest.proposedDeadline
                          ? new Date(viewingDetailsReq.extensionRequest.proposedDeadline).toLocaleDateString()
                          : '—'}
                      </strong>
                    </div>
                    <div className="bg-white/70 p-2 rounded-xl border border-black/5">
                      <span className="text-gray-400 block mb-0.5 text-[10px]">Active Deadline</span>
                      <strong className={`font-extrabold ${viewingDetailsReq.extensionRequest.status === 'APPROVED' ? 'text-emerald-700' : 'text-gray-800'}`}>
                        {viewingDetailsReq.vendorFulfillmentExpiresAt
                          ? new Date(viewingDetailsReq.vendorFulfillmentExpiresAt).toLocaleDateString()
                          : '—'}
                      </strong>
                    </div>
                  </div>
                  {viewingDetailsReq.extensionRequest.reason && (
                    <div className="bg-white/60 p-2.5 rounded-xl border border-black/5">
                      <span className="text-gray-400 block mb-1 font-bold uppercase text-[10px] tracking-wider">Vendor's Reason</span>
                      <p className="text-gray-800 font-medium">{viewingDetailsReq.extensionRequest.reason}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-gray-600">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Requested On</span>
                      <strong>{viewingDetailsReq.extensionRequest.requestedAt ? new Date(viewingDetailsReq.extensionRequest.requestedAt).toLocaleString() : '—'}</strong>
                    </div>
                    {viewingDetailsReq.extensionRequest.respondedAt && (
                      <div>
                        <span className="text-gray-400 block text-[10px]">Customer Responded</span>
                        <strong>{new Date(viewingDetailsReq.extensionRequest.respondedAt).toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                  {viewingDetailsReq.extensionRequest.status === 'PENDING' && (
                    <p className="text-[11px] text-amber-700 bg-amber-100 px-3 py-2 rounded-xl font-medium">
                      ℹ️ Awaiting customer decision. The expiry cron is paused for this request while extension is pending.
                    </p>
                  )}
                </div>
              )}

              {/* Extension History */}
              {viewingDetailsReq.extensionHistory && viewingDetailsReq.extensionHistory.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Extension History ({viewingDetailsReq.extensionHistory.length})</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {viewingDetailsReq.extensionHistory.map((ext, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
                        ext.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
                      }`}>
                        <div>
                          <span className={`font-black text-[10px] uppercase ${ext.status === 'APPROVED' ? 'text-emerald-700' : 'text-red-600'}`}>
                            {ext.status === 'APPROVED' ? '✅ Approved' : '❌ Rejected'}
                          </span>
                          <span className="text-gray-500 ml-2">+{ext.requestedDays} day(s)</span>
                          {ext.reason && <p className="text-gray-500 text-[10px] mt-0.5 truncate max-w-xs">{ext.reason}</p>}
                        </div>
                        <div className="text-right text-gray-400 shrink-0 text-[10px]">
                          {ext.requestedAt ? new Date(ext.requestedAt).toLocaleDateString() : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions Footer */}
              <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const r = viewingDetailsReq;
                    setViewingDetailsReq(null);
                    handleOpenSourcingWorkspace(r);
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow flex items-center gap-1.5"
                >
                  🏪 Check PLE Stock
                </button>
                {(!viewingDetailsReq.windowStatus || viewingDetailsReq.windowStatus === "NONE" || viewingDetailsReq.windowStatus === "CLOSED" || viewingDetailsReq.windowStatus === "EXPIRED") && (
                  <button
                    onClick={() => {
                      const r = viewingDetailsReq;
                      setViewingDetailsReq(null);
                      setVendorWindowReq(r);
                    }}
                    className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs transition-colors shadow flex items-center gap-1.5"
                  >
                    🏪 Open Vendor Window
                  </button>
                )}
                {viewingDetailsReq.vendorQuotations && viewingDetailsReq.vendorQuotations.length > 0 && viewingDetailsReq.status === "Quotation Submitted" && (
                  <button
                    onClick={() => {
                      const r = viewingDetailsReq;
                      setViewingDetailsReq(null);
                      handleSelectVendorQuotation(r, 0);
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow flex items-center gap-1.5"
                  >
                    ✅ Select Quotation
                  </button>
                )}
                <button
                  onClick={() => {
                    const r = viewingDetailsReq;
                    handleStatusChangeClick(r, "Under Review");
                  }}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded-xl text-xs transition-colors"
                >
                  Change Status
                </button>
                <button
                  onClick={() => setViewingDetailsReq(null)}
                  className="ml-auto px-6 py-2.5 bg-gray-150 hover:bg-gray-250 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PLE Shop Inventory Check Modal */}
      <AnimatePresence>
        {sourcingReq && sourcingData && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-gray-150 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏪</span>
                  <div>
                    <h3 className="text-lg font-black text-gray-800">PLE Shop Stock Check</h3>
                    <p className="text-xs text-gray-500">
                      <strong>{sourcingReq.productName}</strong> · Required: <strong>{sourcingReq.quantity} units</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setSourcingReq(null); setSourcingData(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              {/* Stock Status Box */}
              <div className={`p-4 rounded-2xl border ${
                sourcingData.pleAvailability.status === "AVAILABLE"
                  ? "bg-emerald-50 border-emerald-200"
                  : sourcingData.pleAvailability.status === "PARTIAL"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"
              } space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600">Inventory Status</span>
                  <span className={`px-2.5 py-1 rounded-full font-black text-xs ${
                    sourcingData.pleAvailability.status === "AVAILABLE"
                      ? "bg-emerald-600 text-white"
                      : sourcingData.pleAvailability.status === "PARTIAL"
                      ? "bg-amber-600 text-white"
                      : "bg-red-600 text-white"
                  }`}>
                    {sourcingData.pleAvailability.status === "AVAILABLE" ? "✅ In Stock" : sourcingData.pleAvailability.status === "PARTIAL" ? "⚠️ Partial Stock" : "❌ Out of Stock"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-black/5">
                    <div className="text-[11px] text-gray-500 font-semibold">Available</div>
                    <div className="text-lg font-black text-gray-900">{sourcingData.pleAvailability.availableQuantity}</div>
                    <div className="text-[10px] text-gray-400">units</div>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-black/5">
                    <div className="text-[11px] text-gray-500 font-semibold">Required</div>
                    <div className="text-lg font-black text-gray-900">{sourcingData.pleAvailability.requiredQuantity || sourcingReq.quantity}</div>
                    <div className="text-[10px] text-gray-400">units</div>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-black/5">
                    <div className="text-[11px] text-gray-500 font-semibold">Shortfall</div>
                    <div className={`text-lg font-black ${sourcingData.pleAvailability.shortfall > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {sourcingData.pleAvailability.shortfall}
                    </div>
                    <div className="text-[10px] text-gray-400">units</div>
                  </div>
                </div>
              </div>

              {/* Explanatory Context & Actions */}
              {sourcingData.pleAvailability.status === "AVAILABLE" ? (
                <div className="space-y-3">
                  <p className="text-xs text-emerald-800 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                    🎉 <strong>In Stock!</strong> Your PLE Shop has sufficient inventory to fulfill this request directly.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        const response = await api.post(`/admin/product-requests/${sourcingReq.id}/assign-sourcing`, {
                          fulfillmentType: "PLE_SHOP",
                          vendors: []
                        });
                        if (response.success || response.statusCode === 200) {
                          toast.success("Assigned to PLE Shop fulfillment!");
                          loadRequests();
                          setSourcingReq(null);
                          setSourcingData(null);
                        }
                      } catch (err) {
                        toast.error("Failed to assign fulfillment");
                      }
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    ⚡ Fulfill Directly from PLE Shop
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-amber-850 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                    ⚠️ <strong>Stock not available in PLE Shop.</strong> Open the <strong>Vendor Window</strong> to broadcast this request to marketplace vendors for bidding.
                  </p>
                  <button
                    onClick={() => {
                      const r = sourcingReq;
                      setSourcingReq(null);
                      setSourcingData(null);
                      setVendorWindowReq(r);
                    }}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    🏪 Open Vendor Window for Vendors
                  </button>
                </div>
              )}

              <div className="pt-1 text-center">
                <button
                  onClick={() => { setSourcingReq(null); setSourcingData(null); }}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Select Fulfillment & Proposal workspace */}
      <AnimatePresence>
        {proposalReq && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-2xl w-full border border-gray-100 space-y-6"
            >
              <div>
                <h3 className="text-xl font-black text-gray-800">Final Procurement Proposal</h3>
                <p className="text-xs text-gray-500">Prepare fulfillment price and estimate for buyer request: <strong>{proposalReq.productName}</strong></p>
              </div>

              {/* Vendor bids comparison */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">Compare Vendor Responses</label>
                <div className="border border-gray-150 rounded-2xl overflow-hidden max-h-40 overflow-y-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold uppercase">
                      <tr>
                        <th className="p-3">Vendor</th>
                        <th className="p-3">Bid Status</th>
                        <th className="p-3 text-right">Offered Price</th>
                        <th className="p-3 text-right">Available Qty</th>
                        <th className="p-3 text-right">Estimate Timeline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-650">
                      {proposalReq.assignedVendors?.map((v, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="p-3 font-bold">{v.vendorName || "Associated Vendor"}</td>
                          <td className="p-3 uppercase font-extrabold">{v.status}</td>
                          <td className="p-3 text-right font-bold text-gray-805">₹{v.offeredPrice || "N/A"}</td>
                          <td className="p-3 text-right">{v.availableQuantity || "N/A"}</td>
                          <td className="p-3 text-right">{v.deliveryTimeline ? `${v.deliveryTimeline} days` : "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Proposed Selling Price (₹) *</label>
                  <input
                    type="number"
                    value={proposalData.finalPrice}
                    onChange={(e) => setProposalData({ ...proposalData, finalPrice: Number(e.target.value) })}
                    placeholder="E.g. 4500"
                    className="w-full px-3 py-2 rounded-xl border border-gray-250 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Estimated Delivery Date</label>
                  <input
                    type="date"
                    value={proposalData.estimatedDelivery}
                    onChange={(e) => setProposalData({ ...proposalData, estimatedDelivery: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-250 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Admin Sourcing Notes</label>
                  <textarea
                    rows={2}
                    value={proposalData.notes}
                    onChange={(e) => setProposalData({ ...proposalData, notes: e.target.value })}
                    placeholder="Warranty options, shipping details, or split distribution..."
                    className="w-full p-3 rounded-xl border border-gray-250 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={submitFinalProposal}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-2xl text-sm transition-colors shadow flex items-center justify-center gap-1"
                >
                  <FiSend />
                  <span>Send Proposal to Buyer</span>
                </button>
                <button
                  onClick={() => setProposalReq(null)}
                  className="flex-1 py-3 bg-gray-150 hover:bg-gray-250 text-gray-700 font-bold rounded-2xl text-sm transition-colors text-center"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Comment Modal */}
      <AnimatePresence>
        {selectedReq && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-gray-100 space-y-4"
            >
              <h3 className="text-lg font-bold text-gray-800">Change Sourcing Status</h3>
              <p className="text-xs text-gray-500">
                Updating status of: <strong>{selectedReq.productName}</strong> to <strong className="text-indigo-600">{nextStatus}</strong>
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Timeline Comment for Buyer *</label>
                  <textarea
                    rows={3}
                    placeholder="Enter message for buyer update timeline..."
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={submitStatusChange}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-2xl text-sm transition-colors shadow"
                  >
                    Confirm Change
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

      {/* ─── Vendor Window Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {vendorWindowReq && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-800">🏪 Open Vendor Window</h2>
                  <p className="text-xs text-gray-500 mt-1">Broadcast this request to all approved vendors. First to accept wins the exclusive fulfillment window.</p>
                </div>
                <button onClick={() => setVendorWindowReq(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                  <FiX />
                </button>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-1">
                <div className="font-extrabold text-gray-800 text-sm">{vendorWindowReq.productName}</div>
                <div className="text-xs text-gray-500">ID: {vendorWindowReq.id || vendorWindowReq.requestId} · Qty: {vendorWindowReq.quantity} · Budget: ₹{vendorWindowReq.expectedBudget}</div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Window Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={vendorWindowDays}
                    onChange={(e) => setVendorWindowDays(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Vendors can accept for this many days. Recommended: 14 days.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Note for Vendors (optional)</label>
                  <textarea
                    rows={3}
                    value={vendorWindowNote}
                    onChange={(e) => setVendorWindowNote(e.target.value)}
                    placeholder="Any special requirements, specifications, or instructions..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-700">
                <strong>How it works:</strong> All approved vendors will see this request and receive a notification. The first vendor to click "Accept" will lock in the request for 7 days to submit a quotation. If they release or their window expires, others can accept.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleOpenVendorWindow}
                  disabled={isOpeningWindow}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-2xl text-sm transition-colors disabled:opacity-60"
                >
                  {isOpeningWindow ? "Opening..." : `🚀 Open Window (${vendorWindowDays} days)`}
                </button>
                <button
                  onClick={() => { setVendorWindowReq(null); setVendorWindowNote(""); setVendorWindowDays(14); }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-colors"
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
};

export default ProductRequestsDashboard;


