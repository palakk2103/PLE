import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  FiMessageSquare,
  FiSend,
  FiUser,
  FiSearch,
  FiShoppingBag,
  FiCheckCircle,
  FiRefreshCw,
  FiClock,
  FiShield,
  FiBriefcase,
  FiArrowLeft,
  FiFilter,
  FiInbox,
  FiFileText,
  FiTag,
  FiAlertCircle
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../../../shared/utils/api";
import socketService from "../../../../shared/utils/socket";
import toast from "react-hot-toast";

const CATEGORY_CONFIG = {
  all: {
    title: "All Chats & Communications",
    subtitle: "Centralized view of all customer, vendor, and B2B conversations across the platform",
    icon: FiMessageSquare,
    badgeColor: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  customer: {
    title: "Customer Chats",
    subtitle: "Conversations between retail customers and marketplace sellers",
    icon: FiUser,
    badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
  },
  vendor: {
    title: "Vendor Chats",
    subtitle: "Overview of conversations involving marketplace vendors and shops",
    icon: FiBriefcase,
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  b2b: {
    title: "B2B Marketplace Chats",
    subtitle: "Wholesale enquiries and conversations between corporate B2B buyers and vendors",
    icon: FiShoppingBag,
    badgeColor: "bg-purple-100 text-purple-700 border-purple-200",
  },
};

const AdminChatHub = ({ category: defaultCategoryProp = "all" }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlThreadId = searchParams.get("threadId");

  // Effective category (supports override via prop or tab)
  const [activeCategory, setActiveCategory] = useState(defaultCategoryProp);

  useEffect(() => {
    setActiveCategory(defaultCategoryProp);
  }, [defaultCategoryProp]);

  // States
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusCounts, setStatusCounts] = useState({ all: 0, active: 0, resolved: 0 });
  const [stats, setStats] = useState({ all: 0, customer: 0, b2b: 0, vendor: 0, unreadTotal: 0 });

  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isMobileListOpen, setIsMobileListOpen] = useState(true);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch stats once
  const fetchStats = async () => {
    try {
      const res = await api.get("/admin/chat-hub/stats");
      const data = res?.data?.data || res?.data || {};
      setStats(data);
    } catch (err) {
      console.warn("Failed to load chat stats:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch threads when category, statusFilter, or search changes
  const fetchThreads = useCallback(async (autoSelectId = null) => {
    try {
      setLoadingThreads(true);
      const res = await api.get("/admin/chat-hub/threads", {
        params: {
          category: activeCategory,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
        },
      });

      const payload = res?.data?.data?.threads || res?.data?.data || [];
      const threadList = Array.isArray(payload) ? payload : [];
      setThreads(threadList);

      if (res?.data?.data?.statusCounts) {
        setStatusCounts(res.data.data.statusCounts);
      }

      // Auto select first thread or target thread
      const targetId = autoSelectId || urlThreadId;
      if (threadList.length > 0) {
        let matched = threadList.find((t) => t._id === targetId);
        if (!matched) matched = threadList[0];
        setSelectedThread(matched);
      } else {
        setSelectedThread(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load chat threads:", err);
      toast.error("Failed to load conversation list.");
    } finally {
      setLoadingThreads(false);
    }
  }, [activeCategory, statusFilter, searchQuery, urlThreadId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Load messages when selectedThread changes
  useEffect(() => {
    if (!selectedThread?._id) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await api.get(`/admin/chat-hub/threads/${selectedThread._id}/messages`);
        const payload = res?.data?.data?.messages || res?.data?.data || [];
        setMessages(Array.isArray(payload) ? payload : []);
      } catch (err) {
        console.error("Failed to load messages:", err);
        toast.error("Failed to load message history.");
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }

      // Mark read on server
      try {
        await api.patch(`/admin/chat-hub/threads/${selectedThread._id}/read`);
        setThreads((prev) =>
          prev.map((t) => (t._id === selectedThread._id ? { ...t, unreadCount: 0 } : t))
        );
      } catch (err) {
        console.warn("Failed to mark chat as read:", err);
      }
    };

    fetchMessages();
  }, [selectedThread?._id]);

  // Socket.io Real-time connection
  useEffect(() => {
    if (!selectedThread?._id) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit("join_chat_room", selectedThread._id);

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id || m._id === msg.id)) return prev;
        return [...prev, msg];
      });

      // Update last message in thread list
      setThreads((prev) =>
        prev.map((t) =>
          t._id === selectedThread._id
            ? { ...t, lastMessage: msg.message, lastActivity: msg.time || new Date() }
            : t
        )
      );
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.emit("leave_chat_room", selectedThread._id);
      socket.off("new_message", handleNewMessage);
    };
  }, [selectedThread?._id]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !selectedThread?._id || sending) return;

    setSending(true);
    try {
      const res = await api.post(`/admin/chat-hub/threads/${selectedThread._id}/messages`, {
        message: text,
      });
      const sentMsg = res?.data?.data || res?.data;

      setMessages((prev) => [...prev, sentMsg]);
      setNewMessage("");

      // Update thread in list
      setThreads((prev) =>
        prev.map((t) =>
          t._id === selectedThread._id
            ? { ...t, lastMessage: text, lastActivity: new Date() }
            : t
        )
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error(err?.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const currentConfig = CATEGORY_CONFIG[activeCategory] || CATEGORY_CONFIG.all;
  const CategoryIcon = currentConfig.icon;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0">
            <CategoryIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
                {currentConfig.title}
              </h1>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${currentConfig.badgeColor}`}>
                {statusCounts.all > 0 ? statusCounts.all : threads.length} {((statusCounts.all || threads.length) === 1) ? "Conversation" : "Conversations"}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              {currentConfig.subtitle}
            </p>
          </div>
        </div>

        {/* Category Tabs (if in centralized or flexible mode) */}
        {defaultCategoryProp === "all" && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {[
              { id: "all", label: "All Chats", count: stats.all },
              { id: "customer", label: "Customer Chats", count: stats.customer },
              { id: "b2b", label: "B2B Chats", count: stats.b2b },
              { id: "vendor", label: "Vendor Chats", count: stats.vendor },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveCategory(tab.id);
                  setSelectedThread(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === tab.id
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeCategory === tab.id ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-700"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Chat Hub Layout */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden h-[calc(100vh-210px)] min-h-[550px] flex">
        {/* Left Sidebar: Conversation Threads */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col flex-shrink-0 bg-slate-50/50 ${
            !isMobileListOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search & Filter Bar */}
          <div className="p-3.5 border-b border-slate-200 bg-white space-y-2.5">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search user, store, order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto text-xs">
                {["all", "active", "resolved"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-all flex items-center gap-1.5 ${
                      statusFilter === st
                        ? "bg-slate-800 text-white shadow-xs"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <span>{st}</span>
                    {typeof statusCounts[st] === "number" && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                        statusFilter === st ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
                      }`}>
                        {statusCounts[st]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchThreads()}
                title="Refresh Conversations"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <FiRefreshCw className={`w-3.5 h-3.5 ${loadingThreads ? "animate-spin text-indigo-600" : ""}`} />
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingThreads && threads.length === 0 ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-7 w-7 border-2 border-indigo-600 border-t-transparent" />
                <p className="text-xs text-slate-400 mt-2 font-medium">Loading conversations...</p>
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <FiInbox className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  No {statusFilter !== "all" ? statusFilter : ""} conversations found
                </p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {searchQuery
                    ? `No chats matching "${searchQuery}"`
                    : statusFilter === "resolved" && statusCounts.active > 0
                    ? `All ${statusCounts.active} conversations are currently Active.`
                    : `No chats in the ${activeCategory} module.`}
                </p>
                {statusFilter !== "all" && statusCounts.active > 0 && (
                  <button
                    onClick={() => setStatusFilter("active")}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all shadow-xs"
                  >
                    View Active Chats ({statusCounts.active})
                  </button>
                )}
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = selectedThread?._id === thread._id;
                const customer = thread.customerUserId;
                const vendor = thread.vendorId;
                const isB2B = thread.classification?.isB2B;

                return (
                  <div
                    key={thread._id}
                    onClick={() => {
                      setSelectedThread(thread);
                      setIsMobileListOpen(false);
                    }}
                    className={`p-3.5 cursor-pointer transition-all border-l-4 ${
                      isSelected
                        ? "bg-white border-l-indigo-600 shadow-xs"
                        : "border-l-transparent hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          isB2B ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {isB2B ? "B2B" : "CU"}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-800 truncate">
                            {thread.customerName || customer?.name || "Customer"}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                            <span>↔</span>
                            <span className="font-medium text-slate-700">
                              {vendor?.storeName || vendor?.name || "Store"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[10px] text-slate-400">
                          {thread.lastActivity
                            ? new Date(thread.lastActivity).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : ""}
                        </span>
                        {thread.unreadCount > 0 && (
                          <span className="mt-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {isB2B ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded border border-purple-200">
                          🏢 {thread.classification?.companyName || "B2B Buyer"}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200">
                          Retail Customer
                        </span>
                      )}

                      {thread.orderDisplayId && (
                        <span className="text-[10px] font-medium px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                          #{thread.orderDisplayId}
                        </span>
                      )}

                      {thread.productRequestId && (
                        <span className="text-[10px] font-medium px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded border border-amber-200">
                          RFQ: {thread.productRequestId}
                        </span>
                      )}
                    </div>

                    {/* Last message snippet */}
                    <p className="text-xs text-slate-500 truncate mt-1">
                      {thread.lastMessage || "No messages yet"}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Chat Window */}
        <div
          className={`flex-1 flex flex-col bg-white min-w-0 ${
            isMobileListOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedThread ? (
            <>
              {/* Chat Window Header */}
              <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setIsMobileListOpen(true)}
                    className="md:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    <FiArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-800 truncate">
                        {selectedThread.customerName || selectedThread.customerUserId?.name || "Customer"}
                      </h3>
                      <span className="text-xs text-slate-400">↔</span>
                      <span className="text-sm font-semibold text-indigo-700 truncate">
                        {selectedThread.vendorId?.storeName || selectedThread.vendorId?.name || "Store"}
                      </span>

                      {selectedThread.classification?.isB2B ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          B2B: {selectedThread.classification?.companyName || "Corporate"}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                          Direct Customer
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 truncate">
                      <span>Email: {selectedThread.customerEmail || selectedThread.customerUserId?.email || "N/A"}</span>
                      {selectedThread.orderDisplayId && (
                        <span>
                          Order: <strong className="text-slate-700">#{selectedThread.orderDisplayId}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize border ${
                    selectedThread.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}>
                    {selectedThread.status || "active"}
                  </span>
                </div>
              </div>

              {/* Messages History List */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/70">
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-48">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FiMessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium">No messages in this conversation yet</p>
                    <p className="text-xs">Type a response below to communicate as Admin/Support</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isVendor = msg.sender === "vendor";
                    const isCustomer = msg.sender === "customer";
                    const isSystem = msg.sender === "system" || msg.sender === "admin";

                    return (
                      <motion.div
                        key={msg.id || msg._id || idx}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-col ${
                          isSystem
                            ? "items-center"
                            : isVendor
                            ? "items-start"
                            : "items-end"
                        }`}
                      >
                        {isSystem ? (
                          <div className="max-w-md bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3.5 py-2 text-xs shadow-xs text-center my-1">
                            <span className="font-bold text-[10px] uppercase tracking-wider block text-amber-700 mb-0.5">
                              Admin / Platform Notice
                            </span>
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                            <span className="text-[10px] text-amber-600/70 mt-1 block">
                              {msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-xs ${
                              isCustomer
                                ? "bg-indigo-600 text-white rounded-tr-none"
                                : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                isCustomer ? "text-indigo-200" : "text-emerald-700"
                              }`}>
                                {isCustomer ? "Customer" : "Vendor"}
                              </span>
                            </div>
                            <p className="text-xs md:text-sm whitespace-pre-wrap leading-relaxed break-words">
                              {msg.message}
                            </p>
                            <span className={`text-[10px] block text-right mt-1 ${
                              isCustomer ? "text-indigo-200" : "text-slate-400"
                            }`}>
                              {msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Footer */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type an administrative message or support reply..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                    className="flex-1 px-4 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-100 flex-shrink-0"
                  >
                    <FiSend className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <CategoryIcon className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Select a conversation</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Choose a conversation from the sidebar to inspect participant messages, order details, and send replies.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminChatHub;
