import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiArrowLeft, 
  FiFileText, 
  FiCalendar, 
  FiMessageSquare, 
  FiClock, 
  FiCheckCircle, 
  FiDownload, 
  FiSend, 
  FiBriefcase, 
  FiUser, 
  FiCheck, 
  FiXCircle,
  FiPaperclip,
  FiTrendingUp,
  FiAward,
  FiPhone,
  FiMail,
  FiShield,
  FiStar,
  FiPackage,
  FiAlertTriangle,
  FiX
} from 'react-icons/fi';
import api from '../../../shared/utils/api';
import toast from 'react-hot-toast';
import Badge from '../../../shared/components/Badge';
import { formatPrice } from '../../../shared/utils/helpers';
import socketService from '../../../shared/utils/socket';
import { useB2BAdminStore } from '../../B2BAdmin/store/b2bAdminStore';
import { getChatBlockMessage } from '../../../shared/utils/chatModerationMessages';

const RFQDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isDirectRFQ = location.pathname.includes('/direct-rfqs/');
  const initialTab = searchParams.get('tab') || 'details';
  
  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);

  const { adminProfile } = useB2BAdminStore();
  const isEmployee = adminProfile?.isEmployee || adminProfile?.role === 'b2bEmployee';
  
  // Discussion state
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [warningBanner, setWarningBanner] = useState(null);
  const chatEndRef = useRef(null);

  // Custom Confirmation Modal state
  const [modalConfig, setModalConfig] = useState(null); // { type: 'approve' | 'renegotiate', reason: '' }

  const fetchRfqDetail = async () => {
    try {
      setLoading(true);
      const url = isDirectRFQ ? `/b2b-user/employee/direct-rfq/${id}` : `/b2b-user/admin/rfq/${id}`;
      const res = await api.get(url);
      if (res && res.data) {
        if (isDirectRFQ) {
          // Normalize DirectRFQ to look like standard RFQ for the UI
          const data = res.data;
          data.rfqId = data.directRfqId;
          data.negotiationMessages = data.messages || [];
          setRfq(data);
        } else {
          setRfq(res.data);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load RFQ detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRfqDetail();

    const socket = socketService.getSocket();
    if (socket && id) {
      socket.emit("join_rfq_room", id);
      
      const handleNewMessage = (data) => {
        if (String(data.rfqId) === String(id)) {
          setRfq((prev) => {
            if (!prev) return prev;
            const exists = prev.negotiationMessages?.some((m) => String(m._id) === String(data.message._id));
            if (exists) return prev;
            return {
              ...prev,
              negotiationMessages: [...(prev.negotiationMessages || []), data.message]
            };
          });
          scrollToBottom();
        }
      };

      const handleStatusUpdate = (data) => {
        if (String(data.rfqId) === String(id)) {
          fetchRfqDetail();
          toast.success(`RFQ Status updated to: ${data.status}`);
        }
      };

      // Depending on backend emits
      socket.on("new_internal_message", handleNewMessage);
      socket.on("new_vendor_message", handleNewMessage);
      socket.on("new_message", handleNewMessage); // from directRfq
      socket.on("status_update", handleStatusUpdate);
    }

    return () => {
      if (socket && id) {
        socket.emit("leave_rfq_room", id);
        socket.off("new_internal_message");
        socket.off("new_vendor_message");
        socket.off("new_message");
        socket.off("status_update");
      }
    };
  }, [id]);

  useEffect(() => {
    if (activeTab === 'discussion') {
      scrollToBottom();
    }
  }, [activeTab, rfq?.negotiationMessages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      setSending(true);
      const url = isDirectRFQ 
        ? `/b2b-user/employee/direct-rfq/${id}/message` 
        : `/b2b-user/admin/rfq/${id}/message`;
        
      const res = await api.post(url, {
        message,
        attachments,
        isInternalNote
      });
      if (res && (res.success || res.data)) {
        setMessage('');
        setAttachments([]);
        setIsInternalNote(false);
        setWarningBanner(null);
        // Refresh details to load messages
        const detailRes = await api.get(isDirectRFQ ? `/b2b-user/employee/direct-rfq/${id}` : `/b2b-user/admin/rfq/${id}`);
        if (detailRes && detailRes.data) {
          if (isDirectRFQ) {
            const data = detailRes.data;
            data.rfqId = data.directRfqId;
            data.negotiationMessages = data.messages || [];
            setRfq(data);
          } else {
            setRfq(detailRes.data);
          }
        }
      }
    } catch (error) {
      const errData = error?.response?.data;
      if (errData?.code === 'MESSAGE_BLOCKED') {
        const warning = getChatBlockMessage(errData?.category);
        setWarningBanner(warning);
        toast.error(warning, {
          duration: 6000,
          style: { maxWidth: '360px', borderRadius: '12px' },
        });
      } else {
        toast.error(errData?.message || 'Failed to send message');
      }
    } finally {
      setSending(false);
    }
  };

  const handleConfirmQuotation = async () => {
    try {
      const res = await api.post(`/b2b-user/admin/rfq/${id}/confirm-quote`);
      if (res.success || res.data) {
        toast.success('Purchase Order Generated Successfully!');
        fetchRfqDetail();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to confirm quote');
    }
  };

  const handleEmployeeAccept = async () => {
    const defaultPrice = rfq?.finalAgreedPrice || rfq?.targetPrice || 0;
    const priceStr = prompt("Please enter the locked unit price (in ₹) to submit for B2B Admin approval:", defaultPrice);
    if (priceStr === null) return;
    const price = Number(priceStr);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price.");
      return;
    }

    try {
      setSending(true);
      const res = await api.post(`/b2b-user/employee/direct-rfq/${id}/message`, {
        action: 'accept',
        priceOffer: price,
        message: `I accept the quotation at ₹${price} per unit and submit it for B2B Admin approval.`
      });
      if (res.success || res.data) {
        toast.success("Locked price and submitted to B2B Admin!");
        fetchRfqDetail();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit for approval");
    } finally {
      setSending(false);
    }
  };

  const [approvingPO, setApprovingPO] = useState(false);

  const handleApprove = () => {
    setModalConfig({ type: 'approve', reason: '' });
  };

  const handleRequestRenegotiation = () => {
    setModalConfig({ type: 'renegotiate', reason: '' });
  };

  const handleModalConfirm = async () => {
    if (!modalConfig) return;
    const { type, reason } = modalConfig;

    if (type === 'approve') {
      try {
        setApprovingPO(true);
        setModalConfig(null); // Close modal
        const res = await api.post(`/b2b-user/admin/rfq/${id}/approve`);
        if (res.success || res.data) {
          toast.success('✅ Purchase Order Generated Successfully! Check Purchase Orders section.');
          fetchRfqDetail();
        } else {
          toast.error('Approval failed. Please try again.');
        }
      } catch (error) {
        console.error('Approve PO error:', error);
        toast.error(error.response?.data?.message || 'Failed to generate Purchase Order. Please check backend logs.');
      } finally {
        setApprovingPO(false);
      }
    } else if (type === 'renegotiate') {
      if (!reason.trim()) {
        toast.error("Notes/Instructions are required for re-negotiation.");
        return;
      }
      try {
        setModalConfig(null); // Close modal
        const res = await api.post(`/b2b-user/admin/rfq/${id}/request-renegotiation`, { message: reason });
        if (res.success || res.data) {
          toast.success('Re-negotiation request submitted to Super Admin.');
          fetchRfqDetail();
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to request re-negotiation');
      }
    }
  };

  const handleReject = async () => {
    const reason = prompt("Please enter the reason for rejection:");
    if (reason === null) return;
    try {
      const res = await api.post(`/b2b-user/admin/rfq/${id}/reject`, { notes: reason });
      if (res.success || res.data) {
        toast.success('Recommendation rejected and sent back to Super Admin.');
        fetchRfqDetail();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject');
    }
  };

  const getStatusVariant = (status) => {
    const map = {
      'Draft': 'default',
      'Submitted': 'warning',
      'Under Review': 'info',
      'Under Super Admin Review': 'info',
      'Negotiation In Progress': 'info',
      'Approved': 'success',
      'Sent To Vendors': 'success',
      'Quotation Received': 'info',
      'Quotations Received': 'info',
      'Quotation Review': 'info',
      'Vendor Evaluation': 'info',
      'Vendor Negotiation': 'warning',
      'Vendor Selected': 'success',
      'Awaiting B2B Confirmation': 'warning',
      'Awaiting B2B Approval': 'warning',
      'Purchase Order Generated': 'success',
      'Completed': 'success',
      'Rejected': 'danger'
    };
    return map[status] || 'default';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-xl h-10 w-10 border-t-2 border-b-2 border-[#D71920]"></div>
      </div>
    );
  }

  if (!rfq || Object.keys(rfq).length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-gray-800">RFQ not found</h2>
        <button
          onClick={() => navigate('/b2b-dashboard/rfqs')}
          className="mt-4 px-4 py-2 bg-[#D71920] text-white rounded-xl text-sm font-semibold"
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1250px] mx-auto pb-16"
    >
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between pb-2">
        <button
          onClick={() => navigate('/b2b-dashboard/rfqs')}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <FiArrowLeft strokeWidth={2.5} /> Back to Sourcing Center
        </button>

        <span className="text-xs font-bold font-mono text-gray-800 bg-gray-100 px-3 py-1 rounded-lg">
          RFQ ID: {rfq.rfqId}
        </span>
      </div>

      {/* Main Banner */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              {rfq.productId?.name || rfq.customProductName}
            </span>
            <Badge variant={getStatusVariant(rfq.status)}>{rfq.status}</Badge>
            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
              {rfq.priority} Priority
            </span>
          </div>
          <p className="text-xs text-gray-400 font-semibold">
            Category: <b className="text-gray-700">{rfq.category || 'General'}</b> • Created on {rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric'
            }) : 'N/A'}
            • Created By: <b className="text-[#C07A3D]">
              {isDirectRFQ 
                ? (rfq.employeeId?.name || 'Employee')
                : (rfq.createdByAdminId?.name || rfq.createdByEmployeeId?.name || 'B2B Admin')
              }
            </b>
          </p>
          {isDirectRFQ && rfq.vendorId && (
            <p className="text-[11px] text-[#C07A3D] font-black flex items-center gap-1.5 pt-1">
              <FiUser className="w-3.5 h-3.5" /> Target Vendor: {rfq.vendorId.storeName || rfq.vendorId.name} ({rfq.vendorId.email})
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          {!isEmployee && ['Awaiting B2B Approval', 'Vendor Selected', 'Approved', 'Pending Admin Approval', 'Vendor Accepted'].includes(rfq.status) && (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                onClick={handleApprove}
                disabled={approvingPO}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                {approvingPO ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <FiCheckCircle className="w-4 h-4" />
                )}
                {approvingPO ? 'Generating PO...' : 'Approve & Issue PO'}
              </button>
              <button
                onClick={handleRequestRenegotiation}
                className="py-2.5 px-4 bg-[#D71920] hover:bg-[#B51218] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <FiClock className="w-4 h-4" /> Request Re-Negotiation
              </button>
              <button
                onClick={handleReject}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <FiXCircle className="w-4 h-4" /> Reject Recommendation
              </button>
            </div>
          )}

          {isEmployee && isDirectRFQ && ['Pending Vendor', 'Negotiating', 'Vendor Accepted'].includes(rfq.status) && (
            <button
              onClick={handleEmployeeAccept}
              disabled={sending}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg"
            >
              <FiCheckCircle className="w-4 h-4" /> Lock Price & Request PO
            </button>
          )}

          {rfq.attachment && (
            <a
              href={rfq.attachment}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-gray-200"
            >
              <FiDownload className="w-4 h-4" /> Download Specs
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-px">
        {[
          { key: 'details', name: 'RFQ Specifications', icon: FiFileText },
          { 
            key: 'quotations', 
            name: ['Awaiting B2B Approval', 'Vendor Selected', 'Approved', 'Purchase Order Generated', 'Completed'].includes(rfq.status) 
              ? 'Recommended Vendor Bid' 
              : 'Sourcing Status', 
            icon: FiAward,
            actionRequired: ['Awaiting B2B Approval', 'Vendor Selected', 'Approved'].includes(rfq.status)
          },
          { key: 'discussion', name: isDirectRFQ ? 'Vendor Discussion Thread' : 'Super Admin Discussion Thread', icon: FiMessageSquare }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                isActive 
                  ? 'border-[#C07A3D] text-[#C07A3D]' 
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
              {tab.actionRequired && (
                <span className="ml-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" title="Action Required" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'details' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Specifications</h3>
                <div className="p-4 bg-gray-50 rounded-2xl text-xs sm:text-sm text-gray-700 leading-relaxed font-semibold border-l-4 border-[#C07A3D]">
                  {rfq.requirementDetails || 'No technical specifications provided.'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Requested Line Item</h3>
                  <div className="p-4 border border-gray-150 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Item Name:</span>
                      <span className="font-bold text-gray-800">{rfq.productId?.name || rfq.customProductName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Target rate per unit:</span>
                      <span className="font-bold text-gray-800">{formatPrice(rfq.targetPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Required Quantity:</span>
                      <span className="font-bold text-gray-800">{(rfq.quantity || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Logistics & Standards</h3>
                  <div className="p-4 border border-gray-150 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Expected Delivery:</span>
                      <span className="font-bold text-gray-800">
                        {rfq.expectedDeliveryDate ? new Date(rfq.expectedDeliveryDate).toLocaleDateString() : 'Flexible'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Quality standards:</span>
                      <span className="font-bold text-gray-800">{rfq.qualityStandards || 'Standard Certification'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Payment terms:</span>
                      <span className="font-bold text-gray-800">{rfq.termsConditions || 'NET 30 Days'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quotations' && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
              {['Awaiting B2B Approval', 'Vendor Selected', 'Approved', 'Purchase Order Generated', 'Completed'].includes(rfq.status) && rfq.quotations && rfq.quotations.length > 0 ? (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#C07A3D] uppercase tracking-wider flex items-center gap-2">
                        <FiAward className="w-5 h-5" /> Super Admin Recommended Vendor
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Super Admin ne sabse best quotation evaluate karke neeche ke vendor ko final select kiya hai.
                        <span className="font-bold text-gray-700"> Approve karke Purchase Order generate karein.</span>
                      </p>
                    </div>
                    <span className="shrink-0 px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1">
                      <FiStar className="w-3 h-3" /> Best Match
                    </span>
                  </div>

                  {/* Vendor Identity Card */}
                  <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                        <span className="text-white text-lg font-black">
                          {(rfq.quotations[0].vendorName || 'V').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-gray-900 leading-tight">{rfq.quotations[0].vendorName}</h4>
                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Selected Vendor Partner</p>
                      </div>
                    </div>

                    {/* Pricing Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-0.5">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">Unit Price</span>
                        <span className="text-sm font-extrabold text-gray-900">{formatPrice(rfq.quotations[0].unitPrice)}</span>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-emerald-200 space-y-0.5">
                        <span className="text-[9px] text-emerald-600 font-bold uppercase block">Total Price</span>
                        <span className="text-sm font-extrabold text-emerald-700">{formatPrice(rfq.quotations[0].totalPrice)}</span>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-0.5">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">Delivery Time</span>
                        <span className="text-sm font-extrabold text-gray-900">{rfq.quotations[0].deliveryTime || 'TBD'}</span>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-0.5">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">Warranty</span>
                        <span className="text-sm font-extrabold text-gray-900">{rfq.quotations[0].warranty || 'Standard'}</span>
                      </div>
                    </div>

                    {/* Tax & Extra Details */}
                    {(rfq.quotations[0].taxDetails || rfq.quotations[0].additionalNotes) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {rfq.quotations[0].taxDetails && (
                          <div className="bg-white rounded-xl p-3 border border-gray-100">
                            <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Tax / GST Details</span>
                            <span className="text-xs font-semibold text-gray-700">{rfq.quotations[0].taxDetails}</span>
                          </div>
                        )}
                        {rfq.quotations[0].additionalNotes && (
                          <div className="bg-white rounded-xl p-3 border border-gray-100">
                            <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Negotiation Summary</span>
                            <p className="text-xs font-semibold text-gray-700 leading-relaxed">{rfq.quotations[0].additionalNotes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Price Comparison with target */}
                    {rfq.targetPrice && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
                        <FiTrendingUp className={`w-4 h-4 shrink-0 ${rfq.quotations[0].totalPrice <= rfq.targetPrice * rfq.quantity ? 'text-emerald-600' : 'text-amber-600'}`} />
                        <div className="text-xs">
                          <span className="font-bold text-gray-700">Your Target Budget: </span>
                          <span className="font-extrabold text-gray-900">{formatPrice(rfq.targetPrice * (rfq.quantity || 1))}</span>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="font-bold text-gray-700">Vendor Quoted: </span>
                          <span className={`font-extrabold ${rfq.quotations[0].totalPrice <= rfq.targetPrice * (rfq.quantity || 1) ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {formatPrice(rfq.quotations[0].totalPrice)}
                          </span>
                          {rfq.quotations[0].totalPrice <= rfq.targetPrice * (rfq.quantity || 1) ? (
                            <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓ Within Budget</span>
                          ) : (
                            <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">↑ Above Budget</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Only for actionable statuses */}
                  {['Awaiting B2B Approval', 'Vendor Selected', 'Approved'].includes(rfq.status) && (
                    <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <FiShield className="w-4 h-4 text-amber-600" />
                        <p className="text-xs font-bold text-amber-800">B2B Admin Action Required — Please review the vendor recommendation above and take action:</p>
                      </div>
                      <div className="flex flex-wrap gap-3 justify-end">
                        <button
                          onClick={handleApprove}
                          className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
                        >
                          <FiCheckCircle className="w-4 h-4" /> ✅ Approve & Generate Purchase Order
                        </button>
                        <button
                          onClick={handleRequestRenegotiation}
                          className="py-2.5 px-4 bg-[#D71920] hover:bg-[#B51218] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                          <FiClock className="w-4 h-4" /> 🔄 Request Re-Negotiation
                        </button>
                        <button
                          onClick={handleReject}
                          className="py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                          <FiXCircle className="w-4 h-4" /> ❌ Decline Proposal
                        </button>
                      </div>
                    </div>
                  )}

                  {/* If PO already generated */}
                  {['Purchase Order Generated', 'Completed'].includes(rfq.status) && (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <FiCheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-extrabold text-emerald-800">Purchase Order Generated!</p>
                        <p className="text-xs text-emerald-600 mt-0.5">PO has been created. Go to <strong>Purchase Orders</strong> menu in the left sidebar to view and download.</p>
                      </div>
                      <button
                        onClick={() => navigate('/b2b-dashboard/purchase-orders')}
                        className="ml-auto shrink-0 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                      >
                        View PO →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-450 border border-dashed border-gray-250 rounded-2xl space-y-2">
                  <FiClock className="w-10 h-10 mx-auto text-[#C07A3D] animate-spin" />
                  <h3 className="font-extrabold text-sm text-gray-800">Sourcing Campaign Active</h3>
                  <p className="text-xs text-gray-500 max-w-[340px] mx-auto leading-relaxed">
                    Vendor quotations are currently being captured, compared, and negotiated by the Super Admin.
                    Specific bid details and vendor names are hidden to protect commercial confidentiality.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'discussion' && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[520px] overflow-hidden">
              {/* Messages feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {rfq.negotiationMessages && rfq.negotiationMessages.length > 0 ? (
                  rfq.negotiationMessages.map((msg, i) => {
                    const isSelf = msg.senderType?.toLowerCase() === 'b2badmin' || msg.senderType?.toLowerCase() === 'b2bemployee' || msg.senderType === 'Employee';
                    const isInternal = msg.isInternalNote;

                    return (
                      <div key={i} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl p-4 text-xs font-semibold ${
                          isInternal 
                            ? 'bg-amber-50 border border-amber-200 text-amber-955'
                            : isSelf
                              ? 'bg-[#C07A3D] text-white rounded-tr-none'
                              : 'bg-gray-100 text-gray-800 rounded-tl-none'
                        }`}>
                          <div className="flex items-center justify-between gap-4 mb-1 border-b border-black/5 pb-1">
                            <span className="text-[10px] font-black uppercase">
                              {msg.senderName} ({msg.senderType})
                            </span>
                            {isInternal && (
                              <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded font-bold uppercase">
                                Internal Note
                              </span>
                            )}
                          </div>
                          <p className="leading-relaxed font-medium">{msg.message}</p>
                          {msg.priceOffer && (
                            <div className={`mt-2 px-2 py-1 rounded-lg text-[10px] font-black ${
                              isSelf ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              💰 Price Offer: {formatPrice(msg.priceOffer)}
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-gray-400 font-bold mt-1">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 text-gray-400 font-bold">
                    No discussion threads yet. Type a message below to start negotiating with the {isDirectRFQ ? 'Vendor' : 'Super Admin'}.
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-150 bg-gray-50 flex flex-col gap-2.5">
                {isDirectRFQ && (
                  <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
                    <FiShield className="text-amber-600 flex-shrink-0 text-xs" />
                    <span>Platform Policy: Direct payments or sharing personal phone numbers with vendors is prohibited.</span>
                  </div>
                )}

                {warningBanner && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs flex items-start justify-between gap-2 shadow-xs animate-pulse">
                    <div className="flex items-start gap-1.5">
                      <FiAlertTriangle className="text-red-600 text-sm mt-0.5 flex-shrink-0" />
                      <span className="font-medium leading-relaxed">{warningBanner}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWarningBanner(null)}
                      className="text-red-500 hover:text-red-800 p-0.5 flex-shrink-0"
                    >
                      <FiX className="text-xs" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <textarea
                    rows={1}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (warningBanner) setWarningBanner(null);
                    }}
                    placeholder={isDirectRFQ ? "Enter message for Vendor..." : "Enter message for Super Admin..."}
                    className="flex-1 bg-white border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#D71920] font-medium resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="p-3 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
                  >
                    <FiSend className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-500">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-gray-300 text-[#D71920] focus:ring-[#D71920]"
                    />
                    <span>Post as Internal Note (Visible to company staff only)</span>
                  </label>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Timeline & Sourcing Logs */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <FiClock className="text-[#C07A3D]" /> Audit Approval Log
            </h3>

            <div className="space-y-5 text-xs max-h-[420px] overflow-y-auto pr-1 scrollbar-nano">
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
                        <span className="font-bold text-gray-800 text-sm leading-none">{log.action}</span>
                        <span className="text-[9px] text-gray-400">
                          {log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short'
                          }) : 'N/A'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-450 mt-0.5">By: {log.updaterType}</p>
                      {log.notes && (
                        <p className="text-gray-500 mt-1 font-medium bg-gray-50 p-2 rounded-xl border border-gray-100">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-400 font-semibold">
                  No log records present.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Custom Confirmation Modal */}
      {modalConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                modalConfig.type === 'approve' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {modalConfig.type === 'approve' ? <FiCheckCircle className="w-5 h-5" /> : <FiClock className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-base">
                  {modalConfig.type === 'approve' ? 'Approve & Issue PO' : 'Request Re-Negotiation'}
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  RFQ Reference: {rfq?.rfqId}
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-600 font-semibold leading-relaxed">
              {modalConfig.type === 'approve' ? (
                'Are you sure you want to approve this vendor recommendation and generate the official Purchase Order? This action will finalize the transaction.'
              ) : (
                <div className="space-y-3">
                  <p>Please enter specific instructions or feedback for the Super Admin/Vendor to guide the re-negotiation:</p>
                  <textarea
                    rows={4}
                    value={modalConfig.reason}
                    onChange={(e) => setModalConfig({ ...modalConfig, reason: e.target.value })}
                    placeholder="E.g., Target price needs to be reduced by 5%, or request 15 days faster delivery time..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#C07A3D] font-semibold text-gray-700 placeholder-gray-400 resize-none"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setModalConfig(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={modalConfig.type === 'renegotiate' && !modalConfig.reason.trim()}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-sm ${
                  modalConfig.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#C07A3D] hover:bg-[#A9662E] disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default RFQDetail;
