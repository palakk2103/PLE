import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiArrowLeft,
  FiFileText,
  FiMessageSquare,
  FiSend,
  FiUser,
  FiCalendar,
  FiDollarSign,
  FiPackage,
  FiCheckCircle,
  FiAlertTriangle,
  FiShield,
  FiX,
  FiLock,
} from "react-icons/fi";
import api from "../../../../shared/utils/api";
import toast from "react-hot-toast";
import Badge from "../../../../shared/components/Badge";
import socketService from "../../../../shared/utils/socket";
import { getChatBlockMessage, preflightCheckMessage } from "../../../../shared/utils/chatModerationMessages";

const VendorDirectRFQDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "details";

  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);

  const [message, setMessage] = useState("");
  const [priceOffer, setPriceOffer] = useState("");
  const [sending, setSending] = useState(false);
  const [warningBanner, setWarningBanner] = useState(null);
  const [preflightWarning, setPreflightWarning] = useState(null);
  const chatEndRef = useRef(null);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/vendor/direct-rfq/${id}`);
      const data = res?.data ?? res;
      setRfq(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Direct RFQ detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();

    const socket = socketService.getSocket();
    if (socket && id) {
      socket.emit("join_rfq_room", id);

      const handleNewMessage = (data) => {
        if (String(data.rfqId) === String(id)) {
          setRfq((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: [...(prev.messages || []), data.message],
            };
          });
          scrollToBottom();
        }
      };

      socket.on("new_message", handleNewMessage);

      return () => {
        socket.emit("leave_rfq_room", id);
        socket.off("new_message", handleNewMessage);
      };
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "chat") {
      scrollToBottom();
    }
  }, [activeTab, rfq?.messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Real-time preflight check on text
    const localWarn = preflightCheckMessage(message.trim());
    if (localWarn) {
      setPreflightWarning(localWarn);
      toast.error(localWarn);
      return;
    }

    const body = { message: message.trim() };

    // Price offer validation (anti-solicitation & sanity check)
    if (priceOffer !== "" && priceOffer !== null && priceOffer !== undefined) {
      const cleanDigits = String(priceOffer).replace(/\D/g, "");
      if ((cleanDigits.length === 10 && /^[6-9]/.test(cleanDigits)) || cleanDigits.length > 10) {
        toast.error("Invalid price offer: Amount cannot be a phone number or contact code.");
        return;
      }
      const numOffer = Number(priceOffer);
      if (isNaN(numOffer) || numOffer <= 0 || numOffer > 100000000) {
        toast.error("Price offer must be a valid amount between ₹1 and ₹10,00,00,000.");
        return;
      }
      body.priceOffer = numOffer;
    }

    try {
      setSending(true);
      await api.post(`/vendor/direct-rfq/${id}/message`, body);
      setMessage("");
      setPriceOffer("");
      setWarningBanner(null);
      setPreflightWarning(null);
      await fetchDetail();
    } catch (err) {
      const errData = err?.response?.data;
      if (errData?.code === 'MESSAGE_BLOCKED') {
        const warning = getChatBlockMessage(errData?.category);
        setWarningBanner(warning);
        toast.error(warning, {
          duration: 6000,
          style: { maxWidth: '360px', borderRadius: '12px' },
        });
      } else {
        toast.error(errData?.message || "Failed to send message");
      }
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (actionType) => {
    try {
      setSending(true);
      await api.post(`/vendor/direct-rfq/${id}/message`, {
        action: actionType,
        message: actionType === 'accept' ? 'I accept this RFQ.' : 'I reject this RFQ.',
      });
      toast.success(`RFQ ${actionType === 'accept' ? 'Accepted' : 'Rejected'} successfully`);
      await fetchDetail();
    } catch (err) {
      toast.error(`Failed to ${actionType} RFQ`);
    } finally {
      setSending(false);
    }
  };

  const getStatusVariant = (status) => {
    const map = {
      "Pending Vendor": "warning",
      Negotiating: "info",
      "Vendor Accepted": "success",
      "Pending Admin Approval": "info",
      "PO Generated": "success",
      Rejected: "danger",
    };
    return map[status] || "default";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-xl h-10 w-10 border-t-2 border-b-2 border-[#C07A3D]"></div>
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-gray-800">
          Direct RFQ not found
        </h2>
        <button
          onClick={() => navigate("/vendor/direct-rfqs")}
          className="mt-4 px-4 py-2 bg-[#C07A3D] text-white rounded-xl text-sm font-semibold"
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
      {/* Breadcrumb */}
      <div className="flex items-center justify-between pb-2">
        <button
          onClick={() => navigate("/vendor/direct-rfqs")}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <FiArrowLeft strokeWidth={2.5} /> Back to Direct RFQs
        </button>
        <span className="text-xs font-bold font-mono text-gray-800 bg-gray-100 px-3 py-1 rounded-lg">
          {rfq.directRfqId}
        </span>
      </div>

      {/* Banner */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            {rfq.customProductName || rfq.productId?.name || "Product"}
          </span>
          <Badge variant={getStatusVariant(rfq.status)}>{rfq.status}</Badge>
        </div>
        <p className="text-xs text-gray-400 font-semibold">
          Category: <b className="text-gray-700">{rfq.category || "General"}</b>{" "}
          • Created on{" "}
          {rfq.createdAt
            ? new Date(rfq.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
            : "N/A"}
        </p>
        {rfq.employeeId && (
          <p className="text-[11px] text-[#C07A3D] font-black flex items-center gap-1.5 pt-1">
            <FiUser className="w-3.5 h-3.5" /> From Employee:{" "}
            {rfq.employeeId.name} ({rfq.employeeId.email})
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-px">
        {[
          { key: "details", name: "RFQ Specifications", icon: FiFileText },
          {
            key: "chat",
            name: "Employee Chat",
            icon: FiMessageSquare,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${isActive
                ? "border-[#C07A3D] text-[#C07A3D]"
                : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {activeTab === "details" && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
              {/* Specifications */}
              {rfq.requirementDetails && (
                <div>
                  <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-2">
                    Specifications
                  </h3>
                  <div className="bg-gray-50 border-l-4 border-[#C07A3D] p-4 rounded-r-xl text-xs text-gray-700 font-medium leading-relaxed">
                    {rfq.requirementDetails}
                  </div>
                </div>
              )}

              {/* Line Item */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-3">
                    Requested Line Item
                  </h3>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Item Name:</span>
                      <span className="font-bold text-gray-800">
                        {rfq.customProductName ||
                          rfq.productId?.name ||
                          "Product"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">
                        Target rate per unit:
                      </span>
                      <span className="font-bold text-gray-800">
                        ₹{rfq.targetPrice?.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Required Quantity:</span>
                      <span className="font-bold text-gray-800">
                        {rfq.quantity}
                      </span>
                    </div>
                    {rfq.finalAgreedPrice && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-emerald-600 font-bold">
                          Agreed Price:
                        </span>
                        <span className="font-black text-emerald-700">
                          ₹{rfq.finalAgreedPrice?.toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-3">
                    Delivery Details
                  </h3>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Expected Delivery:</span>
                      <span className="font-bold text-gray-800">
                        {rfq.expectedDeliveryDate
                          ? new Date(
                            rfq.expectedDeliveryDate
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                          : "Flexible"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Category:</span>
                      <span className="font-bold text-gray-800">
                        {rfq.category || "General"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {rfq.attachment && (
                <div>
                  <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-2">
                    Attached Documents
                  </h3>
                  <a
                    href={rfq.attachment}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#C07A3D] font-bold hover:underline"
                  >
                    📎 View Attachment
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === "chat" && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[520px] overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {rfq.messages && rfq.messages.length > 0 ? (
                  rfq.messages.map((msg, i) => {
                    const isSelf = msg.senderType === "Vendor";
                    return (
                      <div
                        key={i}
                        className={`flex flex-col ${isSelf ? "items-end" : "items-start"
                          }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl p-4 text-xs font-semibold ${isSelf
                            ? "bg-[#C07A3D] text-white rounded-tr-none"
                            : "bg-gray-100 text-gray-800 rounded-tl-none"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1 border-b border-black/5 pb-1">
                            <span className="text-[10px] font-black uppercase">
                              {msg.senderName} ({msg.senderType})
                            </span>
                          </div>
                          <p className="leading-relaxed font-medium">
                            {msg.message}
                          </p>
                          {msg.priceOffer && (
                            <div
                              className={`mt-2 px-2 py-1 rounded-lg text-[10px] font-black ${isSelf
                                ? "bg-white/20 text-white"
                                : "bg-emerald-100 text-emerald-800"
                                }`}
                            >
                              💰 Price Offer: ₹
                              {msg.priceOffer.toLocaleString("en-IN")}
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] text-gray-400 font-bold mt-1">
                          {msg.createdAt
                            ? new Date(msg.createdAt).toLocaleTimeString(
                              "en-IN",
                              { hour: "2-digit", minute: "2-digit" }
                            )
                            : "N/A"}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 text-gray-400 font-bold">
                    No messages yet. Start negotiating with the Employee.
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              {['PO Generated', 'Rejected'].includes(rfq?.status) ? (
                <div className="p-4 border-t border-gray-150 bg-gray-50 flex items-center justify-center gap-2 text-xs text-gray-500 font-medium">
                  <FiLock className="text-gray-400" />
                  <span>This RFQ discussion is {rfq.status.toLowerCase()} and closed for further messages.</span>
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-gray-150 bg-gray-50 flex flex-col gap-2.5"
                >
                  {/* Security Reminder */}
                  <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
                    <FiShield className="text-amber-600 flex-shrink-0 text-xs" />
                    <span>Platform Policy: Direct payments or sharing phone numbers is strictly prohibited.</span>
                  </div>

                  {/* Real-time Preflight Warning */}
                  {preflightWarning && (
                    <div className="p-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs flex items-center gap-1.5 shadow-xs">
                      <FiAlertTriangle className="text-amber-600 text-sm flex-shrink-0" />
                      <span className="font-semibold">{preflightWarning}</span>
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
                        const val = e.target.value;
                        setMessage(val);
                        const warn = preflightCheckMessage(val);
                        setPreflightWarning(warn);
                        if (warningBanner) setWarningBanner(null);
                      }}
                      placeholder="Enter message for Employee..."
                      className="flex-1 bg-white border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#C07A3D] font-medium resize-none"
                    />
                    <input
                      type="number"
                      value={priceOffer}
                      onChange={(e) => setPriceOffer(e.target.value)}
                      placeholder="₹ Price offer"
                      className="w-28 bg-white border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#C07A3D] font-medium"
                    />
                    <button
                      type="submit"
                      disabled={sending || !message.trim()}
                      className="p-3 bg-[#C07A3D] hover:bg-[#A9662E] text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
                    >
                      <FiSend className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <FiPackage className="text-[#C07A3D]" /> Quick Summary
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <Badge variant={getStatusVariant(rfq.status)}>
                  {rfq.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quantity</span>
                <span className="font-bold text-gray-800">{rfq.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Target Price</span>
                <span className="font-bold text-gray-800">
                  ₹{rfq.targetPrice?.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Value</span>
                <span className="font-black text-gray-900">
                  ₹
                  {(
                    (rfq.finalAgreedPrice || rfq.targetPrice) * rfq.quantity
                  ).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Messages</span>
                <span className="font-bold text-gray-800">
                  {rfq.messages?.length || 0}
                </span>
              </div>
            </div>

            {/* Vendor Actions */}
            {["Pending Vendor", "Negotiating"].includes(rfq.status) && (
              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => handleAction('accept')}
                  disabled={sending}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  Accept RFQ
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={sending}
                  className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VendorDirectRFQDetail;
