import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiSend,
  FiUser,
  FiCheckCircle,
  FiStar,
  FiAlertTriangle,
  FiX,
  FiShield,
  FiMoreVertical,
  FiSlash,
  FiBellOff,
  FiBell,
  FiFlag,
  FiLock,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import api from "../../../shared/utils/api";
import socketService from "../../../shared/utils/socket";
import toast from "react-hot-toast";
import { useB2bStore } from "../../../shared/store/b2bStore";
import { getChatBlockMessage, preflightCheckMessage } from "../../../shared/utils/chatModerationMessages";

const CustomerVendorChat = () => {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [warningBanner, setWarningBanner] = useState(null);
  const [preflightWarning, setPreflightWarning] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("OFF_PLATFORM_SOLICITATION");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const chatEndRef = useRef(null);
  const menuRef = useRef(null);
  const isB2B = useB2bStore((state) => state.userRole === "business_buyer");

  // Close header menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch thread details & message history
  useEffect(() => {
    let active = true;

    const loadChatData = async () => {
      try {
        setLoading(true);
        // We can find the thread in the user's threads list
        const threadsRes = await api.get("/user/chat/vendor/threads");
        const threadsData = threadsRes?.data?.data || threadsRes?.data || [];
        const currentThread = threadsData.find((t) => t._id === threadId);

        if (!currentThread) {
          toast.error("Chat thread not found.");
          navigate("/home");
          return;
        }

        if (active) {
          setThread(currentThread);
        }

        const messagesRes = await api.get(`/user/chat/vendor/threads/${threadId}/messages`);
        const messagesData = messagesRes?.data?.data || messagesRes?.data || [];
        if (active) {
          setMessages(messagesData);
        }
      } catch (err) {
        console.error("Failed to load chat data:", err);
        toast.error("Failed to load conversation history.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadChatData();

    return () => {
      active = false;
    };
  }, [threadId, navigate]);

  // Connect to Socket.io and join thread room
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit("join_chat_room", threadId);

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id || m._id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.emit("leave_chat_room", threadId);
      socket.off("new_message", handleNewMessage);
    };
  }, [threadId]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || sending) return;

    // Client-side preflight check
    const localWarn = preflightCheckMessage(text);
    if (localWarn) {
      setPreflightWarning(localWarn);
      toast.error(localWarn);
      return;
    }

    setSending(true);
    try {
      const res = await api.post(`/user/chat/vendor/threads/${threadId}/messages`, { message: text });
      const created = res?.data?.data || res?.data || res;
      if (created) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === created.id || m._id === created.id)) return prev;
          return [...prev, created];
        });
        setNewMessage("");
        setWarningBanner(null);
        setPreflightWarning(null);
      }
    } catch (err) {
      const errData = err?.response?.data;
      if (errData?.code === "MESSAGE_BLOCKED") {
        const warning = getChatBlockMessage(errData?.category);
        setWarningBanner(warning);
        toast.error(warning, {
          duration: 6000,
          style: { maxWidth: "360px", borderRadius: "12px" },
        });
      } else {
        toast.error(errData?.message || "Failed to send message.");
      }
    } finally {
      setSending(false);
    }
  };

  const handleToggleBlock = async () => {
    try {
      setSubmittingAction(true);
      setShowMenu(false);
      const res = await api.post(`/user/chat/vendor/threads/${threadId}/block`, {
        reason: thread?.isBlocked ? undefined : "Blocked by buyer",
      });
      const data = res?.data?.data || res?.data;
      const newBlockedState = data?.isBlocked ?? !thread?.isBlocked;
      setThread((prev) => ({ ...prev, isBlocked: newBlockedState }));
      toast.success(newBlockedState ? "Store blocked." : "Store unblocked.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update block status.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleToggleMute = async () => {
    try {
      setSubmittingAction(true);
      setShowMenu(false);
      const res = await api.post(`/user/chat/vendor/threads/${threadId}/mute`);
      const data = res?.data?.data || res?.data;
      const newMuted = data?.customerMuted ?? !thread?.customerMuted;
      setThread((prev) => ({ ...prev, customerMuted: newMuted }));
      toast.success(newMuted ? "Notifications muted." : "Notifications unmuted.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update notification settings.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportReason) return;
    try {
      setSubmittingAction(true);
      await api.post(`/user/chat/vendor/threads/${threadId}/report`, {
        reason: reportReason,
        details: reportDetails.trim(),
      });
      toast.success("Report submitted to moderation team. Thank you.");
      setShowReportModal(false);
      setReportDetails("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit report.");
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <MobileLayout showBottomNav={true} showCartBar={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500 animate-pulse">Loading conversation...</p>
        </div>
      </MobileLayout>
    );
  }

  const vendorInfo = thread?.vendorId || {};
  const isClosed = thread?.status === "resolved" || thread?.status === "closed";
  const isBlocked = !!thread?.isBlocked;
  const isMuted = !!thread?.customerMuted;

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false} noPadding={true}>
        <div className="fixed inset-0 top-0 bottom-0 left-0 right-0 bg-gray-100 flex justify-center items-start p-0 sm:px-4 z-50 overflow-hidden h-[100dvh]">
          <div className="w-full max-w-2xl h-full h-[100dvh] flex flex-col bg-gray-50 sm:shadow-xl border-0 sm:border-x border-gray-200 overflow-hidden relative">
            {/* Header */}
            <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between gap-3 flex-shrink-0 sticky top-0 z-20 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => {
                    if (window.history.state && window.history.state.idx > 0) {
                      navigate(-1);
                    } else {
                      navigate("/profile");
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                >
                  <FiArrowLeft className="text-xl text-gray-700" />
                </button>

                {/* Vendor Details */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                    {vendorInfo.storeLogo ? (
                      <img
                        src={vendorInfo.storeLogo}
                        alt={vendorInfo.storeName || vendorInfo.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary-100 text-primary-600 font-bold text-sm">
                        <FiUser />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <h1 className="text-sm font-bold text-gray-800 truncate">
                        {vendorInfo.storeName || vendorInfo.name || "Store"}
                      </h1>
                      {vendorInfo.isVerified && <FiCheckCircle className="text-blue-500 text-xs flex-shrink-0" />}
                      {isMuted && <FiBellOff className="text-gray-400 text-xs flex-shrink-0" title="Muted" />}
                    </div>
                    {vendorInfo.rating ? (
                      <div className="flex items-center gap-0.5 text-xs text-gray-500">
                        <FiStar className="text-yellow-400 fill-yellow-400 text-[10px]" />
                        <span>{vendorInfo.rating} Store Rating</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Official Seller Store</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Menu Button */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowMenu((prev) => !prev)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Chat options"
                >
                  <FiMoreVertical className="text-lg" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-30 text-xs text-gray-700">
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      disabled={submittingAction}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                      {isMuted ? <FiBell className="text-gray-500" /> : <FiBellOff className="text-gray-500" />}
                      <span>{isMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleBlock}
                      disabled={submittingAction}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-red-600"
                    >
                      <FiSlash />
                      <span>{isBlocked ? "Unblock Store" : "Block Store"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setShowReportModal(true);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-amber-700 border-t border-gray-100"
                    >
                      <FiFlag />
                      <span>Report Store / Chat</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Blocked or Closed Notice Banner */}
            {isBlocked ? (
              <div className="p-3 bg-red-50 border-b border-red-200 text-xs text-red-800 flex items-center justify-between px-4">
                <div className="flex items-center gap-1.5 font-medium">
                  <FiSlash className="text-red-600 flex-shrink-0" />
                  <span>This conversation is blocked. Messages cannot be sent.</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleBlock}
                  disabled={submittingAction}
                  className="font-bold underline text-red-700 hover:text-red-900"
                >
                  Unblock
                </button>
              </div>
            ) : isClosed ? (
              <div className="p-3 bg-gray-100 border-b border-gray-200 text-xs text-gray-700 flex items-center gap-2 px-4">
                <FiLock className="text-gray-500 flex-shrink-0" />
                <span>This conversation is closed as the inquiry or order has concluded. Chat is read-only.</span>
              </div>
            ) : null}

            {/* Chat Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pb-4">
              <div className="text-center py-2">
                <span className="text-[10px] bg-gray-200 text-gray-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                  Direct Store Inquiry Room
                </span>
              </div>

              {messages.map((msg, idx) => {
                const isCustomer = msg.sender === "customer";
                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col ${isCustomer ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3.5 rounded-2xl text-sm shadow-xs ${
                        isCustomer
                          ? "bg-[#7B0A0A] text-white rounded-br-none"
                          : "bg-white border border-gray-150 text-gray-800 rounded-bl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    </div>
                    <span className="text-[9px] text-gray-400 mt-1 px-1">
                      {new Date(msg.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Safety Reminder */}
            <div className="bg-amber-50/90 border-t border-b border-amber-200/60 px-4 py-1.5 flex items-center justify-center gap-1.5 text-[11px] text-amber-800 font-medium flex-shrink-0">
              <FiShield className="text-amber-600 flex-shrink-0 text-xs" />
              <span>Safety Tip: Never share phone numbers or make direct payments outside the app.</span>
            </div>

            {/* Reply Form or Disabled Banner */}
            {isBlocked || isClosed ? (
              <div className="bg-gray-100 border-t border-gray-200 px-4 py-3 flex-shrink-0 text-center text-xs text-gray-500 font-medium">
                {isBlocked
                  ? "Unblock this store from the top-right menu to send messages."
                  : "This chat thread is resolved and read-only."}
              </div>
            ) : (
              <form
                onSubmit={handleSend}
                className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0 sticky bottom-0 z-20 shadow-md"
              >
                {/* Real-time Preflight Warning */}
                {preflightWarning && (
                  <div className="mb-2.5 p-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs flex items-center gap-1.5 shadow-xs">
                    <FiAlertTriangle className="text-amber-600 text-sm flex-shrink-0" />
                    <span className="font-semibold">{preflightWarning}</span>
                  </div>
                )}

                {/* Server-side Moderation Rejection Banner */}
                {warningBanner && (
                  <div className="mb-2.5 p-2.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs flex items-start justify-between gap-2 shadow-xs animate-pulse">
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

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewMessage(val);
                      const warn = preflightCheckMessage(val);
                      setPreflightWarning(warn);
                      if (warningBanner) setWarningBanner(null);
                    }}
                    placeholder="Ask about stock, sizes, custom orders..."
                    className="flex-1 bg-gray-50 border border-gray-250 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="w-10 h-10 bg-[#7B0A0A] hover:bg-[#AE020B] text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <FiSend className="text-base" />
                  </button>
                </div>
              </form>
            )}

            {/* Report Modal */}
            <AnimatePresence>
              {showReportModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                        <FiFlag className="text-red-600" />
                        <span>Report Conversation</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowReportModal(false)}
                        className="text-gray-400 hover:text-gray-700"
                      >
                        <FiX />
                      </button>
                    </div>

                    <form onSubmit={handleSubmitReport} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Reason for report
                        </label>
                        <select
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <option value="OFF_PLATFORM_SOLICITATION">Asking to chat or pay off-platform</option>
                          <option value="HARASSMENT">Inappropriate or abusive language</option>
                          <option value="FRAUD">Suspected scam or fake product</option>
                          <option value="SPAM">Spam or unwanted advertising</option>
                          <option value="OTHER">Other safety or policy concern</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Additional details (optional)
                        </label>
                        <textarea
                          rows={3}
                          value={reportDetails}
                          onChange={(e) => setReportDetails(e.target.value)}
                          placeholder="Provide context for our safety team..."
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowReportModal(false)}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingAction}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-50"
                        >
                          {submittingAction ? "Submitting..." : "Submit Report"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default CustomerVendorChat;
