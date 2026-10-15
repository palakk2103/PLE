import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiUser,
  FiBriefcase,
  FiCalendar,
  FiDollarSign,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiShield,
  FiClock,
  FiFileText,
  FiMail,
  FiPhone,
  FiMapPin,
  FiCheck,
  FiPlus,
  FiMessageSquare,
  FiSend,
  FiAward,
  FiSearch
} from "react-icons/fi";
import { motion } from "framer-motion";
import Badge from "../../../../shared/components/Badge";
import { formatPrice } from "../../../../shared/utils/helpers";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";
import socketService from "../../../../shared/utils/socket";

const AdminRFQDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allVendors, setAllVendors] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState([]);
  
  // Discussion state
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  // Vendor Negotiation Chat Drawer
  const [activeNegotiationQuote, setActiveNegotiationQuote] = useState(null);
  const [adminVendorMessage, setAdminVendorMessage] = useState("");
  const [sendingAdminVendorMsg, setSendingAdminVendorMsg] = useState(false);

  // Vendor Search state
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');

  const filteredVendors = useMemo(() => {
    if (!vendorSearchQuery) return allVendors;
    const q = vendorSearchQuery.toLowerCase();
    return allVendors.filter(v => 
      (v.storeName || '').toLowerCase().includes(q) ||
      (v.name || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.phone || '').toLowerCase().includes(q)
    );
  }, [allVendors, vendorSearchQuery]);

  const fetchRfqDetail = async () => {
    try {
      setLoading(true);
      const [rfqRes, vendorRes] = await Promise.all([
        api.get(`/admin/rfq/${id}`),
        api.get('/admin/vendors')
      ]);

      if (rfqRes && rfqRes.data) {
        setRfq(rfqRes.data);
        if (rfqRes.data.assignedVendorIds) {
          setSelectedVendors(rfqRes.data.assignedVendorIds.map(v => v._id || v));
        }
      }
      if (vendorRes && vendorRes.data) {
        setAllVendors(vendorRes.data.vendors || vendorRes.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load RFQ detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchRfqDetail();
    }
  }, [id]);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (socket && id) {
      socket.emit("join_rfq_room", id);
      
      const handleNewMessage = (data) => {
        if (String(data.rfqId) === String(id)) {
          setRfq((prev) => {
            if (!prev) return prev;
            
            // Check if it's a vendor negotiation message
            if (data.vendorId) {
               // This is a message within a vendor quote
               const updatedQuotations = prev.quotations.map(q => {
                 if (String(q.vendorId) === String(data.vendorId) || String(q._id) === String(data.vendorId)) {
                   return {
                     ...q,
                     messages: [...(q.messages || []), data.message]
                   };
                 }
                 return q;
               });
               
               // If the active negotiation quote matches, we should update that too
               if (activeNegotiationQuote && (String(activeNegotiationQuote.vendorId) === String(data.vendorId) || String(activeNegotiationQuote._id) === String(data.vendorId))) {
                 setActiveNegotiationQuote(prev => ({
                   ...prev,
                   messages: [...(prev.messages || []), data.message]
                 }));
               }

               return {
                 ...prev,
                 quotations: updatedQuotations
               };
            }
            
            // Otherwise, it's an employee/admin negotiation message
            const exists = prev.negotiationMessages?.some((m) => String(m._id) === String(data.message._id));
            if (exists) return prev;
            return {
              ...prev,
              negotiationMessages: [...(prev.negotiationMessages || []), data.message]
            };
          });
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      };

      const handleStatusUpdate = (data) => {
        if (String(data.rfqId) === String(id)) {
          fetchRfqDetail();
        }
      };

      socket.on("new_internal_message", handleNewMessage);
      socket.on("new_admin_message", handleNewMessage);
      socket.on("new_vendor_message", handleNewMessage);
      socket.on("new_message", handleNewMessage);
      socket.on("status_update", handleStatusUpdate);
    }

    return () => {
      if (socket && id) {
        socket.emit("leave_rfq_room", id);
        socket.off("new_internal_message");
        socket.off("new_admin_message");
        socket.off("new_vendor_message");
        socket.off("new_message");
        socket.off("status_update");
      }
    };
  }, [id, activeNegotiationQuote]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rfq?.negotiationMessages]);

  const handleUpdateStatus = async (newStatus, notes = "") => {
    try {
      const res = await api.post(`/admin/rfq/${id}/status`, { status: newStatus, notes });
      if (res.success || res.data) {
        toast.success(`RFQ is now ${newStatus}`);
        fetchRfqDetail();
      }
    } catch (error) {
      toast.error("Failed to update RFQ status");
    }
  };

  const handleAssignVendors = async () => {
    if (selectedVendors.length === 0) {
      toast.error("Please select at least one vendor.");
      return;
    }

    try {
      setAssigning(true);
      const res = await api.post(`/admin/rfq/${id}/assign-vendors`, { vendorIds: selectedVendors });
      if (res.success || res.data) {
        toast.success("Vendors successfully assigned and RFQ dispatched!");
        fetchRfqDetail();
      }
    } catch (error) {
      toast.error("Failed to assign vendors");
    } finally {
      setAssigning(false);
    }
  };

  const handleSelectVendorQuote = async (vendorId) => {
    try {
      const res = await api.post(`/admin/rfq/${id}/select-vendor`, { vendorId });
      if (res.success || res.data) {
        toast.success("Vendor quotation selected! Sourcing marked as Vendor Selected.");
        fetchRfqDetail();
      }
    } catch (error) {
      toast.error("Failed to select vendor quotation");
    }
  };

  const handleSubmitB2BApproval = async () => {
    try {
      const res = await api.post(`/admin/rfq/${id}/submit-b2b-approval`);
      if (res.success || res.data) {
        toast.success("Sourcing recommended vendor successfully sent to B2B Admin for final approval!");
        fetchRfqDetail();
      }
    } catch (error) {
      toast.error("Failed to submit for B2B approval");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      setSending(true);
      const res = await api.post(`/admin/rfq/${id}/message`, {
        message,
        attachments: [],
        isInternalNote: false
      });
      if (res && (res.success || res.data)) {
        setMessage('');
        fetchRfqDetail();
      }
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleSendAdminVendorMessage = async (e) => {
    e.preventDefault();
    if (!adminVendorMessage.trim() || !activeNegotiationQuote) return;

    try {
      setSendingAdminVendorMsg(true);
      const res = await api.post(`/admin/rfq/${id}/vendor/${activeNegotiationQuote.vendorId}/message`, {
        message: adminVendorMessage.trim()
      });
      if (res && (res.success || res.data)) {
        setAdminVendorMessage('');
        await fetchRfqDetail();
      }
    } catch (error) {
      toast.error("Failed to send message to vendor");
    } finally {
      setSendingAdminVendorMsg(false);
    }
  };

  const handleVendorCheckboxChange = (vendorId) => {
    setSelectedVendors(prev => {
      if (prev.includes(vendorId)) {
        return prev.filter(id => id !== vendorId);
      } else {
        return [...prev, vendorId];
      }
    });
  };

  // Compare quotations to highlight best options
  const quoteHighlights = useMemo(() => {
    if (!rfq?.quotations || rfq.quotations.length === 0) return null;
    
    let lowestQuote = rfq.quotations[0];
    let fastestQuote = rfq.quotations[0];

    rfq.quotations.forEach(q => {
      if (q.totalPrice < lowestQuote.totalPrice) lowestQuote = q;
      
      const qDays = parseInt(q.deliveryTime) || 999;
      const fDays = parseInt(fastestQuote.deliveryTime) || 999;
      if (qDays < fDays) fastestQuote = q;
    });

    return {
      lowestVendorId: lowestQuote.vendorId,
      fastestVendorId: fastestQuote.vendorId
    };
  }, [rfq?.quotations]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 font-semibold">Loading RFQ details...</p>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-gray-800">RFQ not found</h2>
        <button
          onClick={() => navigate("/ple-ops-desk/b2b-enquiries/all")}
          className="mt-4 px-4 py-2 bg-[#C07A3D] text-white rounded-xl text-sm font-semibold"
        >
          Back to RFQs
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1350px] mx-auto pb-12"
    >
      {/* Navigation Header */}
      <div className="flex items-center justify-between pb-2">
        <button
          onClick={() => navigate("/ple-ops-desk/b2b-enquiries/all")}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <FiArrowLeft strokeWidth={2.5} /> Back to RFQ Management
        </button>
        <span className="text-xs font-bold font-mono text-gray-850 bg-gray-100 px-3 py-1 rounded-lg">
          RFQ Reference: {rfq.rfqId}
        </span>
      </div>

      {/* Main Banner */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
              {rfq.productId?.name || rfq.customProductName}
            </span>
            <Badge variant="warning">{rfq.status}</Badge>
            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-250">
              {rfq.priority} Priority
            </span>
          </div>
          <p className="text-xs text-gray-500 font-semibold">
            Company: <b className="text-gray-800">{rfq.companyName}</b> • Submitted on {new Date(rfq.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric"
            })}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          {rfq.status === 'Submitted' && (
            <button
              onClick={() => handleUpdateStatus("Under Review", "Super Admin started review.")}
              className="flex-1 md:flex-none py-2.5 px-4 bg-[#C07A3D] hover:bg-[#A9662E] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FiCheckCircle className="w-4 h-4" /> Start Review
            </button>
          )}

          {['Submitted', 'Under Review', 'Under Super Admin Review'].includes(rfq.status) && (
            <button
              onClick={() => handleUpdateStatus("Approved", "Super Admin approved the request.")}
              className="flex-1 md:flex-none py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FiCheckCircle className="w-4 h-4" /> Approve RFQ
            </button>
          )}

          {['Submitted', 'Under Review', 'Under Super Admin Review', 'Approved'].includes(rfq.status) && (
            <button
              onClick={() => handleUpdateStatus("Rejected", "Super Admin rejected the request.")}
              className="flex-1 md:flex-none py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FiXCircle className="w-4 h-4" /> Reject RFQ
            </button>
          )}

          {['Approved', 'Under Review', 'Sent To Vendors', 'Quotations Received', 'Vendor Evaluation', 'Vendor Negotiation'].includes(rfq.status) && (
            <button
              onClick={handleAssignVendors}
              disabled={assigning}
              className="flex-1 md:flex-none py-2.5 px-4 bg-[#C07A3D] hover:bg-[#A9662E] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <FiBriefcase className="w-4 h-4" /> {assigning ? 'Dispatching...' : 'Dispatch Sourcing campaign'}
            </button>
          )}

          {['Sent To Vendors', 'Quotations Received'].includes(rfq.status) && (
            <button
              onClick={() => handleUpdateStatus("Vendor Evaluation", "Super Admin started evaluating quotations.")}
              className="flex-1 md:flex-none py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FiCheckCircle className="w-4 h-4" /> Begin Evaluation
            </button>
          )}

          {['Vendor Evaluation', 'Quotations Received'].includes(rfq.status) && (
            <button
              onClick={() => handleUpdateStatus("Vendor Negotiation", "Super Admin started negotiations with vendors.")}
              className="flex-1 md:flex-none py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FiMessageSquare className="w-4 h-4" /> Start Negotiation
            </button>
          )}

          {rfq.status === 'Vendor Selected' && (
            <button
              onClick={handleSubmitB2BApproval}
              className="flex-1 md:flex-none py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <FiCheckCircle className="w-4 h-4" /> Submit for B2B Approval
            </button>
          )}

          {rfq.status === 'Awaiting B2B Approval' && (
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3.5 py-2 rounded-xl border border-gray-200">
              Awaiting B2B Admin Approval
            </span>
          )}
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Specifications & Quotations (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* RFQ technical details */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FiFileText className="text-[#C07A3D]" /> Sourcing Specifications & Parameters
            </h3>
            <div className="p-4 bg-gray-50 rounded-2xl text-xs sm:text-sm text-gray-700 font-semibold border-l-4 border-[#C07A3D]">
              {rfq.requirementDetails || 'No specifications provided.'}
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs pt-2">
              <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-xl">
                <span className="text-gray-400 block font-bold uppercase text-[9px] mb-1">Target Rate</span>
                <span className="font-extrabold text-gray-900 text-sm">{formatPrice(rfq.targetPrice)} / unit</span>
              </div>
              <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-xl">
                <span className="text-gray-400 block font-bold uppercase text-[9px] mb-1">Quantity Requested</span>
                <span className="font-extrabold text-gray-900 text-sm">{rfq.quantity.toLocaleString()} units</span>
              </div>
            </div>
          </div>
          {/* Sourcing Vendor Assigner */}
          {['Approved', 'Under Review', 'Sent To Vendors', 'Quotations Received', 'Vendor Evaluation', 'Vendor Negotiation'].includes(rfq.status) && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <FiBriefcase className="text-[#C07A3D]" /> Vendor Sourcing Assignments
                </h3>
              </div>

              {/* Vendor Search Bar */}
              <div className="relative">
                <FiSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  value={vendorSearchQuery}
                  onChange={(e) => setVendorSearchQuery(e.target.value)}
                  placeholder="Search vendors by store name, email or phone..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D] text-xs font-semibold text-gray-700 placeholder-gray-400 transition-all"
                />
                {vendorSearchQuery && (
                  <button 
                    onClick={() => setVendorSearchQuery('')}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2.5 p-1 text-xs">
                {filteredVendors.length > 0 ? (
                  filteredVendors.map((vendor) => {
                    const isChecked = selectedVendors.includes(vendor._id);
                    return (
                      <label
                        key={vendor._id}
                        className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-all ${
                          isChecked ? 'border-[#C07A3D] bg-[#C07A3D]/5 shadow-sm' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleVendorCheckboxChange(vendor._id)}
                            className="rounded text-[#C07A3D] focus:ring-[#C07A3D] border-gray-300 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-gray-800 text-sm">{vendor.storeName || vendor.name}</span>
                            <span className="text-[10px] text-gray-400 font-medium block mt-0.5">{vendor.email}</span>
                          </div>
                        </div>
                        {vendor.phone && (
                          <span className="text-[10px] text-gray-500 font-bold bg-gray-55/60 px-2 py-1 rounded-lg">{vendor.phone}</span>
                        )}
                      </label>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-gray-400 font-bold">
                    No vendors found matching your search.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quotations comparison table */}
          {rfq.quotations && rfq.quotations.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <FiAward className="text-[#C07A3D]" /> Sourced Vendor Quotations Comparison
              </h3>

              <div className="border border-gray-150 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-650">
                      <th className="p-4">Vendor</th>
                      <th className="p-4 text-right">Unit Price</th>
                      <th className="p-4 text-right">Total Price</th>
                      <th className="p-4">Delivery Time</th>
                      <th className="p-4">Warranty</th>
                      <th className="p-4">Quotation Highlight</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfq.quotations.map((q, idx) => {
                      const isLowest = quoteHighlights && quoteHighlights.lowestVendorId === q.vendorId;
                      const isFastest = quoteHighlights && quoteHighlights.fastestVendorId === q.vendorId;
                      const isSelected = q.status === 'Selected';

                      return (
                        <tr key={idx} className={`border-b border-gray-100 last:border-none hover:bg-gray-50/50 ${
                          isSelected ? 'bg-emerald-50/30' : ''
                        }`}>
                          <td className="p-4">
                            <span className="font-bold text-gray-900 block">{q.vendorName}</span>
                          </td>
                          <td className="p-4 text-right font-bold text-gray-900">{formatPrice(q.unitPrice)}</td>
                          <td className="p-4 text-right font-extrabold text-gray-900">{formatPrice(q.totalPrice)}</td>
                          <td className="p-4 font-semibold text-gray-650">{q.deliveryTime}</td>
                          <td className="p-4 font-semibold text-gray-650">{q.warranty || 'N/A'}</td>
                          <td className="p-4 space-x-1.5">
                            {isLowest && (
                              <span className="bg-emerald-100 text-emerald-800 font-black text-[9px] uppercase px-1.5 py-0.5 rounded">
                                Lowest Price
                              </span>
                            )}
                            {isFastest && (
                              <span className="bg-blue-100 text-blue-800 font-black text-[9px] uppercase px-1.5 py-0.5 rounded">
                                Fastest Delivery
                              </span>
                            )}
                            {isSelected && (
                              <span className="bg-purple-100 text-purple-800 font-black text-[9px] uppercase px-1.5 py-0.5 rounded animate-pulse">
                                Chosen Quote
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col sm:flex-row gap-1.5 justify-center items-center">
                              <button
                                onClick={() => setActiveNegotiationQuote(q)}
                                className="py-1 px-2.5 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap"
                              >
                                <FiMessageSquare className="w-3 h-3" /> Negotiate
                              </button>
                              
                              {['Sent To Vendors', 'Quotations Received', 'Vendor Evaluation', 'Vendor Negotiation'].includes(rfq.status) && (
                                <button
                                  onClick={() => handleSelectVendorQuote(q.vendorId)}
                                  className="py-1 px-2.5 bg-[#C07A3D] hover:bg-[#A9662E] text-white rounded text-[10px] font-bold transition-all shadow-sm whitespace-nowrap"
                                >
                                  Select Quote
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Activity timeline & Chat Box (1/3 width) */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <FiClock className="text-[#C07A3D]" /> RFQ Event Timeline
            </h3>

            <div className="space-y-5 text-xs max-h-[380px] overflow-y-auto pr-2">
              {rfq.approvalHistory && rfq.approvalHistory.length > 0 ? (
                rfq.approvalHistory.map((log, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white ring-4 ring-gray-50">
                        <FiCheck className="w-2 h-2 text-gray-500" />
                      </div>
                      {i < rfq.approvalHistory.length - 1 && (
                        <div className="w-0.5 h-12 bg-gray-150 mt-1.5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-850 text-sm leading-none">{log.action}</span>
                        <span className="text-[9px] text-gray-400">
                          {new Date(log.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-450 mt-0.5">By: {log.updaterType}</p>
                      {log.notes && (
                        <p className="text-gray-550 mt-1 font-semibold bg-gray-50 p-2 rounded-xl border border-gray-100">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-400 font-bold">
                  No timeline records.
                </div>
              )}
            </div>
          </div>

          {/* Real-time Discussion Panel */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[400px] overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <FiMessageSquare className="text-[#C07A3D]" /> Procurement Discussions Panel
              </h3>
              <span className="text-[10px] text-gray-400 font-bold">Participants: Super Admin, B2B Admin</span>
            </div>

            {/* Chat Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {rfq.negotiationMessages && rfq.negotiationMessages.length > 0 ? (
                rfq.negotiationMessages.map((msg, i) => {
                  const isSelf = msg.senderType === 'SuperAdmin';
                  return (
                    <div key={i} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-3 text-xs font-semibold ${
                        isSelf
                          ? 'bg-[#C07A3D] text-white rounded-tr-none'
                          : 'bg-gray-100 text-gray-800 rounded-tl-none'
                      }`}>
                        <div className="flex items-center gap-2 mb-1 border-b border-black/5 pb-1 font-black text-[9px] uppercase">
                          {msg.senderName} ({msg.senderType})
                        </div>
                        <p className="leading-relaxed font-medium">{msg.message}</p>
                      </div>
                      <span className="text-[9px] text-gray-400 font-bold mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16 text-gray-400 font-bold">
                  No discussion history. Send a message below to coordinate details with B2B company admin.
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-150 bg-gray-50 flex items-center gap-2">
              <textarea
                rows={1}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type message for B2B Admin..."
                className="flex-1 bg-white border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#C07A3D] font-medium resize-none"
              />
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="p-3 bg-[#C07A3D] hover:bg-[#A9662E] text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                <FiSend className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Vendor Negotiation Drawer */}
      {activeNegotiationQuote && (() => {
        const currentQuote = rfq?.quotations?.find(q => String(q.vendorId) === String(activeNegotiationQuote.vendorId));
        const messages = currentQuote?.messages || [];
        
        return (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/45 backdrop-blur-xs transition-opacity"
              onClick={() => setActiveNegotiationQuote(null)}
            />
            
            {/* Drawer Container */}
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10">
              {/* Header */}
              <div className="p-4 border-b border-gray-150 bg-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-gray-850 text-sm flex items-center gap-1.5">
                    <FiMessageSquare className="text-[#C07A3D]" /> Chat with {activeNegotiationQuote.vendorName}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                    RFQ Reference: {rfq.rfqId}
                  </p>
                </div>
                <button 
                  onClick={() => setActiveNegotiationQuote(null)}
                  className="p-1.5 hover:bg-gray-250 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <FiXCircle className="w-5 h-5" />
                </button>
              </div>
              
              {/* Quotation Summary Card */}
              <div className="p-4 bg-amber-50/50 border-b border-amber-100/50 text-xs space-y-1">
                <div className="flex justify-between font-bold text-gray-800">
                  <span>Submitted Quote:</span>
                  <span className="text-[#C07A3D]">{formatPrice(activeNegotiationQuote.totalPrice)}</span>
                </div>
                <div className="text-[10px] text-gray-550 font-semibold flex justify-between">
                  <span>Unit Price: {formatPrice(activeNegotiationQuote.unitPrice)}</span>
                  <span>Delivery: {activeNegotiationQuote.deliveryTime}</span>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30 flex flex-col">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-[11px] font-bold">
                    No messages with this vendor yet. Start the negotiation below.
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isSelf = msg.senderType === 'SuperAdmin';
                    return (
                      <div
                        key={index}
                        className={`flex flex-col max-w-[85%] ${
                          isSelf ? "self-end items-end" : "self-start items-start"
                        }`}
                      >
                        <span className="text-[9px] text-gray-400 mb-0.5 px-1 font-semibold">
                          {msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div
                          className={`p-3 rounded-2xl text-xs font-semibold shadow-sm leading-relaxed ${
                            isSelf
                              ? "bg-[#C07A3D] text-white rounded-tr-none"
                              : "bg-white text-gray-800 border border-gray-250 rounded-tl-none"
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Send message form */}
              <form
                onSubmit={handleSendAdminVendorMessage}
                className="p-3 border-t border-gray-200 bg-white flex gap-2"
              >
                <input
                  type="text"
                  value={adminVendorMessage}
                  onChange={(e) => setAdminVendorMessage(e.target.value)}
                  placeholder="Type negotiation message..."
                  disabled={sendingAdminVendorMsg}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C07A3D] focus:border-[#C07A3D] disabled:opacity-50 font-semibold"
                />
                <button
                  type="submit"
                  disabled={sendingAdminVendorMsg || !adminVendorMessage.trim()}
                  className="px-3 py-2 bg-[#C07A3D] text-white text-xs font-bold rounded-lg hover:bg-[#A9662E] transition-all disabled:opacity-50 shadow-sm flex items-center justify-center min-w-[60px]"
                >
                  {sendingAdminVendorMsg ? "Sending" : "Send"}
                </button>
              </form>
            </div>
          </div>
        );
      })()}
    </motion.div>
  );
};

export default AdminRFQDetail;
