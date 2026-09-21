import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiSend, FiUser, FiCheckCircle, FiStar, FiAlertTriangle, FiX, FiShield } from "react-icons/fi";
import { motion } from "framer-motion";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import api from "../../../shared/utils/api";
import socketService from "../../../shared/utils/socket";
import toast from "react-hot-toast";
import { useB2bStore } from "../../../shared/store/b2bStore";
import { getChatBlockMessage } from "../../../shared/utils/chatModerationMessages";

const CustomerVendorChat = () => {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [warningBanner, setWarningBanner] = useState(null);
  const chatEndRef = useRef(null);
  const isB2B = useB2bStore((state) => state.userRole === 'business_buyer');



  // Fetch thread details & message history
  useEffect(() => {
    let active = true;

    const loadChatData = async () => {
      try {
        setLoading(true);
        // We can find the thread in the user's threads list
        const threadsRes = await api.get("/user/chat/vendor/threads");
        const threadsData = threadsRes?.data?.data || threadsRes?.data || [];
        const currentThread = threadsData.find(t => t._id === threadId);

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
      // Avoid duplicates
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

    setSending(true);
    try {
      const res = await api.post(`/user/chat/vendor/threads/${threadId}/messages`, { message: text });
      const created = res?.data?.data || res?.data || res;
      if (created) {
        // Socket event will also be received, but update locally immediately to feel snappy
        setMessages((prev) => {
          if (prev.some((m) => m.id === created.id || m._id === created.id)) return prev;
          return [...prev, created];
        });
        setNewMessage("");
        setWarningBanner(null);
      }
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
        toast.error('Failed to send message.');
      }
    } finally {
      setSending(false);
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

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false} noPadding={true}>
        <div className="fixed inset-0 top-0 bottom-0 left-0 right-0 bg-gray-100 flex justify-center items-start p-0 sm:px-4 z-50 overflow-hidden h-[100dvh]">
          <div className="w-full max-w-2xl h-full h-[100dvh] flex flex-col bg-gray-50 sm:shadow-xl border-0 sm:border-x border-gray-200 overflow-hidden relative">
            {/* Header */}
            <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3 flex-shrink-0 sticky top-0 z-20 shadow-xs">
              <button
                onClick={() => {
                  if (window.history.state && window.history.state.idx > 0) {
                    navigate(-1);
                  } else {
                    navigate("/profile");
                  }
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiArrowLeft className="text-xl text-gray-700" />
              </button>
              
              {/* Vendor Details */}
              <div className="flex-1 flex items-center gap-2">
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
                <div>
                  <div className="flex items-center gap-1">
                    <h1 className="text-sm font-bold text-gray-800 line-clamp-1">
                      {vendorInfo.storeName || vendorInfo.name || "Store"}
                    </h1>
                    {vendorInfo.isVerified && <FiCheckCircle className="text-blue-500 text-xs" />}
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

            {/* Chat Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pb-4">
              <div className="text-center py-4">
                <span className="text-[10px] bg-gray-200 text-gray-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                  Pre-purchase Direct Enquiry Room
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

            {/* Reply Form */}
            <form
              onSubmit={handleSend}
              className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0 sticky bottom-0 z-20 shadow-md"
            >
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
                    setNewMessage(e.target.value);
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
          </div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default CustomerVendorChat;
