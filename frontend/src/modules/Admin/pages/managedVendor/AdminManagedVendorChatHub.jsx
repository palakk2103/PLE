import React, { useState, useEffect, useRef } from "react";
import {
  FiMessageSquare,
  FiSend,
  FiUser,
  FiSearch,
  FiShoppingBag,
  FiCheckCircle,
  FiRefreshCw,
  FiClock,
  FiShield
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../../../shared/utils/api";
import socketService from "../../../../shared/utils/socket";
import toast from "react-hot-toast";

const AdminManagedVendorChatHub = () => {
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch threads
  const fetchThreads = async () => {
    try {
      setLoadingThreads(true);
      const res = await api.get("/admin/managed-vendor-chat/threads");
      const payload = res?.data?.data || res?.data || [];
      const threadList = Array.isArray(payload) ? payload : [];
      setThreads(threadList);

      if (threadList.length > 0 && !selectedThread) {
        setSelectedThread(threadList[0]);
      }
    } catch (err) {
      console.error("Failed to load managed vendor chat threads:", err);
      toast.error("Failed to load conversations.");
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  // Fetch messages when selected thread changes
  useEffect(() => {
    if (!selectedThread?._id) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await api.get(
          `/admin/managed-vendor-chat/threads/${selectedThread._id}/messages`
        );
        const payload = res?.data?.data || res?.data || [];
        setMessages(Array.isArray(payload) ? payload : []);
      } catch (err) {
        console.error("Failed to fetch messages:", err);
        toast.error("Failed to load message history.");
        setLoadingMessages(false);
        return;
      } finally {
        setLoadingMessages(false);
      }

      // Mark read in background
      try {
        await api.patch(
          `/admin/managed-vendor-chat/threads/${selectedThread._id}/read`
        );
        setThreads((prev) =>
          prev.map((t) =>
            t._id === selectedThread._id ? { ...t, unreadCountAdmin: 0 } : t
          )
        );
      } catch (err) {
        console.warn("Failed to mark managed vendor chat as read:", err);
      }
    };

    fetchMessages();
  }, [selectedThread?._id]);

  // Real-time WebSockets setup
  useEffect(() => {
    const socket = socketService.connect();
    if (!socket) return;

    socket.emit("join_admin_room");

    if (selectedThread?._id) {
      socket.emit("join_chat_room", selectedThread._id);
    }

    const handleNewMessage = (msg) => {
      if (selectedThread?._id && msg.threadId === selectedThread._id) {
        setMessages((prev) => {
          const newId = String(msg.id || msg._id || "");
          const exists = prev.some((m) => {
            const existingId = String(m.id || m._id || "");
            if (existingId && newId && existingId === newId) return true;
            return (
              m.senderType === msg.senderType &&
              m.message?.trim() === msg.message?.trim() &&
              Math.abs(new Date(m.createdAt || 0) - new Date(msg.createdAt || 0)) < 5000
            );
          });
          if (exists) return prev;
          return [...prev, msg];
        });
      }

      // Update thread list preview & unread badge
      setThreads((prev) =>
        prev.map((t) => {
          if (t._id === msg.threadId) {
            const isCurrentActive = selectedThread?._id === t._id;
            return {
              ...t,
              lastMessage: msg.message,
              lastSenderType: msg.senderType,
              lastActivity: msg.createdAt || new Date().toISOString(),
              unreadCountAdmin:
                !isCurrentActive && msg.senderType === "managed_vendor"
                  ? (t.unreadCountAdmin || 0) + 1
                  : 0,
            };
          }
          return t;
        })
      );
    };

    const handleNotification = (notif) => {
      if (selectedThread?._id !== notif.threadId) {
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? "animate-enter" : "animate-leave"
              } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4`}
            >
              <div className="flex-1 w-0 flex items-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold mr-3">
                  <FiUser className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    New message from {notif.senderName || "Managed Vendor"}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 truncate">
                    {notif.message}
                  </p>
                </div>
              </div>
            </div>
          ),
          { duration: 4000 }
        );
      }
    };

    socket.on("new_admin_managed_vendor_message", handleNewMessage);
    socket.on("admin_chat_notification", handleNotification);

    return () => {
      if (selectedThread?._id) {
        socket.emit("leave_chat_room", selectedThread._id);
      }
      socket.off("new_admin_managed_vendor_message", handleNewMessage);
      socket.off("admin_chat_notification", handleNotification);
    };
  }, [selectedThread?._id]);

  // Send message handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedThread?._id || sending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setSending(true);

    try {
      const res = await api.post(
        `/admin/managed-vendor-chat/threads/${selectedThread._id}/messages`,
        { message: messageText }
      );
      const sentMsg = res?.data?.data || res?.data;

      if (sentMsg) {
        setMessages((prev) => {
          const sentId = String(sentMsg.id || sentMsg._id || "");
          const exists = prev.some((m) => {
            const existingId = String(m.id || m._id || "");
            if (existingId && sentId && existingId === sentId) return true;
            return (
              m.senderType === sentMsg.senderType &&
              m.message?.trim() === sentMsg.message?.trim() &&
              Math.abs(new Date(m.createdAt || 0) - new Date(sentMsg.createdAt || 0)) < 5000
            );
          });
          if (exists) return prev;
          return [...prev, sentMsg];
        });
        setThreads((prev) =>
          prev.map((t) =>
            t._id === selectedThread._id
              ? {
                  ...t,
                  lastMessage: messageText,
                  lastSenderType: "admin",
                  lastActivity: new Date().toISOString(),
                }
              : t
          )
        );
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Failed to send message.");
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  // Filter threads by search query
  const filteredThreads = threads.filter((t) => {
    const vendorName = t.managedVendorId?.name || "";
    const company = t.managedVendorId?.companyName || "";
    const username = t.managedVendorId?.username || "";
    const query = searchQuery.toLowerCase();
    return (
      vendorName.toLowerCase().includes(query) ||
      company.toLowerCase().includes(query) ||
      username.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FiMessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Managed Vendor Conversations</h1>
            <p className="text-sm text-gray-500">
              Direct real-time communication & support hub with your managed vendors
            </p>
          </div>
        </div>
        <button
          onClick={fetchThreads}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-xl text-sm font-medium transition-colors border border-gray-200"
        >
          <FiRefreshCw className={`w-4 h-4 ${loadingThreads ? "animate-spin" : ""}`} />
          Refresh Conversations
        </button>
      </div>

      {/* Main Chat Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-[700px]">
        {/* Left Sidebar: Threads List */}
        <div className="lg:col-span-4 border-r border-gray-100 flex flex-col h-full bg-gray-50/50">
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-100 bg-white">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by vendor, username or shop..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loadingThreads ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                <FiRefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                <span className="text-xs">Loading conversations...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                <FiShoppingBag className="w-8 h-8 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">No managed vendors found</p>
                <p className="text-xs text-gray-400">Created managed vendors will appear here automatically.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedThread?._id === thread._id;
                const vendor = thread.managedVendorId || {};
                const hasUnread = (thread.unreadCountAdmin || 0) > 0;

                return (
                  <motion.div
                    key={thread._id}
                    onClick={() => setSelectedThread(thread)}
                    whileHover={{ backgroundColor: isSelected ? "#ecfdf5" : "#f9fafb" }}
                    className={`p-4 cursor-pointer transition-colors relative flex items-start gap-3 ${
                      isSelected
                        ? "bg-emerald-50/80 border-l-4 border-emerald-500"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm">
                      {vendor.name ? vendor.name.charAt(0).toUpperCase() : "V"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {vendor.name || vendor.username || "Managed Vendor"}
                        </h4>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {thread.lastActivity
                            ? new Date(thread.lastActivity).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-gray-500 truncate flex-1">
                          {thread.lastSenderType === "admin" ? "You: " : ""}
                          {thread.lastMessage || "No messages yet"}
                        </p>

                        {hasUnread && (
                          <span className="px-2 py-0.5 bg-emerald-500 text-white text-[11px] font-bold rounded-full shadow-sm">
                            {thread.unreadCountAdmin}
                          </span>
                        )}
                      </div>

                      {vendor.companyName && (
                        <p className="text-[10px] text-emerald-700 font-medium mt-1 truncate">
                          🏢 {vendor.companyName}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Window */}
        <div className="lg:col-span-8 flex flex-col h-full bg-white">
          {selectedThread ? (
            <>
              {/* Active Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                    {selectedThread.managedVendorId?.name
                      ? selectedThread.managedVendorId.name.charAt(0).toUpperCase()
                      : "V"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-base">
                        {selectedThread.managedVendorId?.name ||
                          selectedThread.managedVendorId?.username ||
                          "Managed Vendor"}
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
                        <FiCheckCircle className="w-3 h-3" /> Managed Vendor
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Username: @{selectedThread.managedVendorId?.username || "vendor"}{" "}
                      {selectedThread.managedVendorId?.email
                        ? `• ${selectedThread.managedVendorId.email}`
                        : ""}
                    </p>
                  </div>
                </div>

                {selectedThread.managedVendorId?.phone && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
                    📞 {selectedThread.managedVendorId.phone}
                  </span>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30 space-y-4">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                    <FiRefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                    <span className="text-xs">Loading message thread...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <FiMessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Start the conversation</p>
                    <p className="text-xs text-gray-400">
                      Send a message to reach out to this managed vendor directly.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isAdmin = msg.senderType === "admin";
                    return (
                      <div
                        key={msg.id || msg._id || idx}
                        className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-semibold text-gray-500">
                            {isAdmin ? "You (Admin)" : msg.senderName || "Managed Vendor"}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div
                          className={`max-w-[75%] p-3.5 rounded-2xl text-sm shadow-xs ${
                            isAdmin
                              ? "bg-emerald-600 text-white rounded-tr-none"
                              : "bg-white text-gray-800 border border-gray-200/80 rounded-tl-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-gray-100 bg-white flex items-center gap-3"
              >
                <input
                  type="text"
                  placeholder="Type your message to managed vendor..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                >
                  <FiSend className="w-4 h-4" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <FiMessageSquare className="w-12 h-12 text-gray-300" />
              <p className="text-base font-medium text-gray-700">Select a Managed Vendor</p>
              <p className="text-xs text-gray-400">
                Choose a vendor from the sidebar to view conversation history and send messages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminManagedVendorChatHub;
