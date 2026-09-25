import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiMessageCircle,
  FiSend,
  FiUser,
  FiSearch,
  FiArrowLeft,
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
import Badge from "../../../shared/components/Badge";
import { useVendorAuthStore } from "../store/vendorAuthStore";
import toast from "react-hot-toast";
import { getChatBlockMessage, preflightCheckMessage } from "../../../shared/utils/chatModerationMessages";
import {
  getVendorChatThreads,
  getVendorChatMessages,
  sendVendorChatMessage,
  markVendorChatRead,
  reportVendorChat,
  toggleBlockVendorChat,
  toggleMuteVendorChat,
} from "../services/vendorService";

const Chat = () => {
  const { vendor } = useVendorAuthStore();
  const [searchParams] = useSearchParams();
  const targetThreadId = searchParams.get("threadId");
  const targetRequestId = searchParams.get("requestId");

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [warningBanner, setWarningBanner] = useState(null);
  const [preflightWarning, setPreflightWarning] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("OFF_PLATFORM_SOLICITATION");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);
  const vendorId = vendor?.id || vendor?._id;

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

  const fetchThreads = useCallback(async () => {
    if (!vendorId) return;
    setIsLoadingChats(true);
    try {
      const res = await getVendorChatThreads();
      const data = res?.data ?? res;
      setChats(Array.isArray(data) ? data : []);
    } catch {
      setChats([]);
    } finally {
      setIsLoadingChats(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Auto-select chat when navigating with threadId or requestId
  useEffect(() => {
    if (chats.length > 0 && !selectedChat) {
      let target = null;
      if (targetThreadId) {
        target = chats.find((c) => String(c._id) === String(targetThreadId));
      }
      if (!target && targetRequestId) {
        target = chats.find((c) => String(c.productRequestId) === String(targetRequestId));
      }
      if (target) {
        handleSelectChat(target);
      }
    }
  }, [chats, targetThreadId, targetRequestId, selectedChat]);

  useEffect(() => {
    if (!selectedChat?._id) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await getVendorChatMessages(selectedChat._id);
        const data = res?.data ?? res;
        setMessages(Array.isArray(data) ? data : []);
      } catch {
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedChat?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setChats((prev) =>
      prev.map((c) =>
        c._id === chat._id ? { ...c, unreadCount: 0, status: "active" } : c
      )
    );
    try {
      await markVendorChatRead(chat._id);
    } catch {
      // global toast handled by api.js
    }
  };

  const handleSendMessage = async () => {
    const message = newMessage.trim();
    if (!message || !selectedChat?._id || isSending) return;

    // Client-side preflight check
    const localWarn = preflightCheckMessage(message);
    if (localWarn) {
      setPreflightWarning(localWarn);
      toast.error(localWarn);
      return;
    }

    setIsSending(true);
    try {
      const res = await sendVendorChatMessage(selectedChat._id, message);
      const created = (res?.data ?? res) || null;

      if (created) {
        setMessages((prev) => [...prev, created]);
        setWarningBanner(null);
        setPreflightWarning(null);
      }

      setNewMessage("");
      const nowIso = new Date().toISOString();
      setChats((prev) =>
        prev.map((c) =>
          c._id === selectedChat._id
            ? {
                ...c,
                lastMessage: message,
                lastActivity: created?.time || nowIso,
                unreadCount: 0,
              }
            : c
        )
      );
      setSelectedChat((prev) =>
        prev
          ? {
              ...prev,
              lastMessage: message,
              lastActivity: created?.time || nowIso,
              unreadCount: 0,
            }
          : prev
      );
    } catch (err) {
      // Handle moderation block specifically
      const errData = err?.response?.data;
      if (errData?.code === 'MESSAGE_BLOCKED') {
        const warning = getChatBlockMessage(errData?.category);
        setWarningBanner(warning);
        toast.error(warning, {
          duration: 6000,
          style: { maxWidth: '360px', borderRadius: '12px' },
        });
      } else {
        toast.error(errData?.message || 'Failed to send message.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedChat?._id) return;
    try {
      setSubmittingAction(true);
      setShowMenu(false);
      const res = await toggleBlockVendorChat(selectedChat._id, {
        reason: selectedChat.isBlocked ? undefined : "Blocked by vendor",
      });
      const data = res?.data?.data || res?.data;
      const newBlocked = data?.isBlocked ?? !selectedChat.isBlocked;
      setSelectedChat((prev) => ({ ...prev, isBlocked: newBlocked }));
      setChats((prev) =>
        prev.map((c) => (c._id === selectedChat._id ? { ...c, isBlocked: newBlocked } : c))
      );
      toast.success(newBlocked ? "Customer blocked." : "Customer unblocked.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update block status.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleToggleMute = async () => {
    if (!selectedChat?._id) return;
    try {
      setSubmittingAction(true);
      setShowMenu(false);
      const res = await toggleMuteVendorChat(selectedChat._id);
      const data = res?.data?.data || res?.data;
      const newMuted = data?.vendorMuted ?? !selectedChat.vendorMuted;
      setSelectedChat((prev) => ({ ...prev, vendorMuted: newMuted }));
      setChats((prev) =>
        prev.map((c) => (c._id === selectedChat._id ? { ...c, vendorMuted: newMuted } : c))
      );
      toast.success(newMuted ? "Notifications muted." : "Notifications unmuted.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update notification settings.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportReason || !selectedChat?._id) return;
    try {
      setSubmittingAction(true);
      await reportVendorChat(selectedChat._id, {
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

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredChats = useMemo(
    () =>
      chats.filter((chat) => {
        const orderText = String(chat.orderDisplayId || "").toLowerCase();
        const requestText = String(chat.productRequestId || "").toLowerCase();
        const customerText = String(chat.customerName || "").toLowerCase();
        const matchesSearch =
          !searchQuery ||
          customerText.includes(searchQuery.toLowerCase()) ||
          orderText.includes(searchQuery.toLowerCase()) ||
          requestText.includes(searchQuery.toLowerCase());
        const matchesStatus =
          filterStatus === "all" || chat.status === filterStatus;
        return matchesSearch && matchesStatus;
      }),
    [chats, filterStatus, searchQuery]
  );

  const activeChats = chats.filter((c) => c.status === "active").length;
  const unreadCount = chats.reduce((sum, c) => sum + Number(c.unreadCount || 0), 0);

  if (!vendorId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to access chat</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Chat
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Communicate with customers and support
          </p>
        </div>
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <Badge variant="warning" className="text-sm">
              {unreadCount} Unread
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Chat List Panel */}
        <div className={`bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-white/5 flex flex-col min-w-0 ${
          selectedChat ? "hidden lg:flex" : "flex"
        }`}>
          <div className="p-4 border-b border-gray-200 dark:border-white/5">
            <div className="relative mb-3">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-white/10 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs sm:text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus("all")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  filterStatus === "all"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                All ({chats.length})
              </button>
              <button
                onClick={() => setFilterStatus("active")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  filterStatus === "active"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                Active ({activeChats})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[600px] scrollbar-admin">
            {isLoadingChats ? (
              <div className="p-8 text-center text-gray-500">Loading chats...</div>
            ) : filteredChats.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-white/5">
                {filteredChats.map((chat) => (
                  <div
                    key={chat._id}
                    onClick={() => handleSelectChat(chat)}
                    className={`p-3.5 sm:p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                      selectedChat?._id === chat._id
                        ? "bg-primary-50 dark:bg-primary-950/30 border-l-4 border-primary-600"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary-100 dark:bg-primary-950/50 rounded-full flex items-center justify-center flex-shrink-0">
                          <FiUser className="text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-xs sm:text-sm text-gray-800 dark:text-white truncate">
                            {chat.customerName}
                          </h3>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {chat.productRequestId ? (
                              <span className="text-indigo-600 font-semibold">📦 Req: {chat.productRequestId}</span>
                            ) : chat.orderDisplayId ? (
                              `Order: ${chat.orderDisplayId}`
                            ) : (
                              "Direct Customer Inquiry"
                            )}
                          </p>
                        </div>
                      </div>
                      {chat.unreadCount > 0 && (
                        <Badge variant="warning" className="text-[10px]">
                          {chat.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate mb-1">
                      {chat.lastMessage || "No messages yet"}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {chat.lastActivity
                        ? new Date(chat.lastActivity).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <FiMessageCircle className="text-4xl text-gray-400 mb-4" />
                <p className="text-gray-500">No chats found</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Conversation Panel */}
        {selectedChat ? (
          <div className="lg:col-span-2 bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-white/5 flex flex-col min-w-0">
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-white/5 bg-primary-50 dark:bg-primary-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg lg:hidden"
                    title="Back to chats"
                  >
                    <FiArrowLeft className="text-lg" />
                  </button>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                    <FiUser className="text-primary-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-xs sm:text-sm text-gray-800 dark:text-white truncate">
                      {selectedChat.customerName}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {selectedChat.productRequestId ? (
                        <span className="text-indigo-600 font-semibold">📦 Product Request: {selectedChat.productRequestId}</span>
                      ) : selectedChat.orderDisplayId ? (
                        `Order: ${selectedChat.orderDisplayId}`
                      ) : (
                        "Direct Customer Inquiry"
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant={selectedChat.status === "active" ? "success" : "info"}
                    className="text-xs"
                  >
                    {selectedChat.status === "active" ? "Active" : "Resolved"}
                  </Badge>
                  {selectedChat.vendorMuted && <FiBellOff className="text-gray-400 text-xs" title="Muted" />}

                  {/* Action Dropdown Menu */}
                  <div className="relative" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => setShowMenu((prev) => !prev)}
                      className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Chat options"
                    >
                      <FiMoreVertical className="text-base" />
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#222] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg py-1 z-30 text-xs text-gray-700 dark:text-gray-200">
                        <button
                          type="button"
                          onClick={handleToggleMute}
                          disabled={submittingAction}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2"
                        >
                          {selectedChat.vendorMuted ? <FiBell className="text-gray-500" /> : <FiBellOff className="text-gray-500" />}
                          <span>{selectedChat.vendorMuted ? "Unmute Notifications" : "Mute Notifications"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleBlock}
                          disabled={submittingAction}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 text-red-600"
                        >
                          <FiSlash />
                          <span>{selectedChat.isBlocked ? "Unblock Customer" : "Block Customer"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            setShowReportModal(true);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 text-amber-700 border-t border-gray-100 dark:border-white/10"
                        >
                          <FiFlag />
                          <span>Report Customer</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Blocked or Closed Notice Banner */}
            {selectedChat.isBlocked ? (
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
            ) : (selectedChat.status === "resolved" || selectedChat.status === "closed") ? (
              <div className="p-3 bg-gray-100 border-b border-gray-200 text-xs text-gray-700 flex items-center gap-2 px-4">
                <FiLock className="text-gray-500 flex-shrink-0" />
                <span>This conversation is closed as the order has concluded. Chat is read-only.</span>
              </div>
            ) : null}

            <div className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[500px]">
              {isLoadingMessages ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender === "vendor" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.sender === "vendor"
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      <p className="text-sm">{msg.message}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender === "vendor"
                            ? "text-primary-100"
                            : "text-gray-500"
                        }`}
                      >
                        {new Date(msg.time).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200">
              {/* Security Policy Reminder */}
              <div className="mb-2 px-3 py-1.5 bg-amber-50/90 border border-amber-200 rounded-lg flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
                <FiShield className="text-amber-600 flex-shrink-0 text-xs" />
                <span>Policy Reminder: Sharing phone numbers or requesting off-platform payments is strictly prohibited.</span>
              </div>

              {selectedChat.isBlocked || selectedChat.status === "resolved" || selectedChat.status === "closed" ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center text-xs text-gray-500 font-medium">
                  {selectedChat.isBlocked
                    ? "Unblock this customer from the options menu to send messages."
                    : "This conversation has concluded and is read-only."}
                </div>
              ) : (
                <>
                  {/* Real-time Preflight Warning */}
                  {preflightWarning && (
                    <div className="mb-2.5 p-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs flex items-center gap-1.5 shadow-xs">
                      <FiAlertTriangle className="text-amber-600 text-sm flex-shrink-0" />
                      <span className="font-semibold">{preflightWarning}</span>
                    </div>
                  )}

                  {/* Server Moderation Warning */}
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
                      onKeyDown={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isSending || !newMessage.trim()}
                      className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      <FiSend />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center p-12">
            <div className="text-center">
              <FiMessageCircle className="mx-auto text-4xl text-gray-400 mb-4" />
              <p className="text-gray-500">Select a chat to start conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#222] rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b dark:border-white/10 pb-3">
                <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold text-sm">
                  <FiFlag className="text-red-600" />
                  <span>Report Customer</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <FiX />
                </button>
              </div>

              <form onSubmit={handleSubmitReport} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Reason for report
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="OFF_PLATFORM_SOLICITATION">Off-platform contact or payment solicitation</option>
                    <option value="HARASSMENT">Harassment or abusive language</option>
                    <option value="FRAUD">Fraudulent inquiry or suspicious activity</option>
                    <option value="SPAM">Spam or irrelevant messages</option>
                    <option value="OTHER">Other violation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Additional details (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide details for our moderation team..."
                    className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-xl p-2.5 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
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
    </motion.div>
  );
};

export default Chat;
