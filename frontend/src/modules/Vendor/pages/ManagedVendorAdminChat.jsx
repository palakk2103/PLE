import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiMessageSquare,
  FiSend,
  FiShield,
  FiRefreshCw,
  FiCheckCircle,
  FiClock,
  FiUsers
} from "react-icons/fi";
import { motion } from "framer-motion";
import api from "../../../shared/utils/api";
import socketService from "../../../shared/utils/socket";
import toast from "react-hot-toast";

const ManagedVendorAdminChat = () => {
  const navigate = useNavigate();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch thread and messages
  const loadChatData = async () => {
    try {
      setLoading(true);
      const threadRes = await api.get("/vendor/admin-chat/thread");
      const threadData = threadRes?.data?.data || threadRes?.data;
      setThread(threadData);

      if (threadData?._id) {
        const msgRes = await api.get("/vendor/admin-chat/messages");
        const msgData = msgRes?.data?.data || msgRes?.data || [];
        setMessages(Array.isArray(msgData) ? msgData : []);

        // Mark read
        await api.patch("/vendor/admin-chat/read");
      }
    } catch (err) {
      console.error("Failed to load admin chat:", err);
      toast.error("Failed to load chat with Admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChatData();
  }, []);

  // WebSockets setup
  useEffect(() => {
    const socket = socketService.connect();
    if (!socket) return;

    if (thread?._id) {
      socket.emit("join_chat_room", thread._id);
    }

    const handleNewMessage = (msg) => {
      if (thread?._id && msg.threadId === thread._id) {
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
    };

    const handleNotification = (notif) => {
      if (notif.senderName === "Admin") {
        toast.success(`New message from Admin: ${notif.message}`, {
          icon: "💬",
        });
      }
    };

    socket.on("new_admin_managed_vendor_message", handleNewMessage);
    socket.on("managed_vendor_chat_notification", handleNotification);

    return () => {
      if (thread?._id) {
        socket.emit("leave_chat_room", thread._id);
      }
      socket.off("new_admin_managed_vendor_message", handleNewMessage);
      socket.off("managed_vendor_chat_notification", handleNotification);
    };
  }, [thread?._id]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setSending(true);

    try {
      const res = await api.post("/vendor/admin-chat/messages", {
        message: messageText,
      });
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
      }
    } catch (err) {
      console.error("Failed to send message to admin:", err);
      toast.error("Failed to send message.");
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-[#1A1A1A] p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl flex-shrink-0">
            <FiShield className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">Admin Support & Conversation</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
              Direct line to communicate with Admin regarding catalog, orders, or support
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigate("/vendor/chat")}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 rounded-xl text-xs sm:text-sm font-semibold transition-colors border border-emerald-200 dark:border-emerald-800"
            title="Open chats with customers / buyers"
          >
            <FiUsers className="w-4 h-4" />
            <span>Customer Chats</span>
          </button>
          <button
            onClick={loadChatData}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl text-xs sm:text-sm font-medium transition-colors border border-gray-200 dark:border-white/10"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden h-[550px] sm:h-[650px] flex flex-col min-w-0">
        {/* Chat Title / Admin Status */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-base">Platform Admin</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
                  <FiCheckCircle className="w-3 h-3" /> Official Support
                </span>
              </div>
              <p className="text-xs text-gray-500">Real-time messaging</p>
            </div>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <FiRefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <span className="text-xs">Connecting to conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FiMessageSquare className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-gray-600">No previous messages</p>
              <p className="text-xs text-gray-400">
                Type a message below to connect with the Admin directly.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isVendorSender = msg.senderType === "managed_vendor";
              return (
                <div
                  key={msg.id || msg._id || idx}
                  className={`flex flex-col ${isVendorSender ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-semibold text-gray-500">
                      {isVendorSender ? "You" : "Admin"}
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
                      isVendorSender
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

        {/* Input Form */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-gray-100 bg-white flex items-center gap-3"
        >
          <input
            type="text"
            placeholder="Type your message to Admin..."
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
      </div>
    </div>
  );
};

export default ManagedVendorAdminChat;
