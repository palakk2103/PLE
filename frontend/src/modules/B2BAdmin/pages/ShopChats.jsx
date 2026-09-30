import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMessageSquare, FiSend, FiUser, FiInbox, FiCheckCircle } from 'react-icons/fi';
import api from '../../../shared/utils/api';
import toast from 'react-hot-toast';
import socketService from '../../../shared/utils/socket';
import { getPlaceholderImage } from '../../../shared/utils/helpers';
import LazyImage from '../../../shared/components/LazyImage';

const ShopChats = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryThreadId = searchParams.get('threadId');

  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  const loadThreads = async (autoSelectId = null) => {
    try {
      setLoading(true);
      const res = await api.get('/user/chat/vendor/threads');
      const threadsData = res?.data?.data || res?.data || [];
      setThreads(threadsData);
      
      if (threadsData.length > 0) {
        let toSelect = threadsData[0];
        const targetId = autoSelectId || queryThreadId;
        if (targetId) {
          const found = threadsData.find(t => t._id === targetId);
          if (found) toSelect = found;
        }
        setSelectedThread(toSelect);
        if (toSelect) {
          await loadMessages(toSelect._id);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load shop conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (threadId) => {
    try {
      const res = await api.get(`/user/chat/vendor/threads/${threadId}/messages`);
      const messagesData = res?.data?.data || res?.data || [];
      setMessages(messagesData);
      
      // Mark as read
      await api.patch(`/user/chat/vendor/threads/${threadId}/read`).catch(() => {});
    } catch (error) {
      console.error(error);
      toast.error('Failed to load message history');
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  // Sync state if selectedThread changes
  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread._id);
      
      // Update query param
      setSearchParams({ threadId: selectedThread._id }, { replace: true });
    }
  }, [selectedThread?._id]);

  useEffect(() => {
    if (selectedThread) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Connect to socket
  useEffect(() => {
    const socket = socketService.getSocket();
    const threadId = selectedThread?._id;
    if (socket && threadId) {
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
    }
  }, [selectedThread?._id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || !selectedThread || sending) return;

    try {
      setSending(true);
      const res = await api.post(`/user/chat/vendor/threads/${selectedThread._id}/messages`, {
        message: text
      });
      const sentMsg = res?.data?.data || res?.data || res;
      setMessages((prev) => [...prev, sentMsg]);
      setMessageText('');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading && threads.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-xl h-10 w-10 border-t-2 border-b-2 border-[#D71920]"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1400px] mx-auto pb-12"
    >
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <FiMessageSquare className="text-[#D71920]" /> Shop Conversations
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">
          Direct messaging logs with registered vendor shops.
        </p>
      </div>

      {threads.length > 0 ? (
        <div className="bg-white dark:bg-[#121212] rounded-3xl border border-gray-150 dark:border-white/10 shadow-sm flex flex-col md:flex-row h-[650px] overflow-hidden">
          {/* Threads Sidebar */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-150 dark:border-white/10 flex flex-col bg-gray-50/50 dark:bg-[#161616] shrink-0 h-48 md:h-full">
            <div className="p-4 border-b border-gray-150 dark:border-white/10 bg-white dark:bg-[#141414] flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">Active Shops</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                {threads.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {threads.map((t) => {
                const isSelected = selectedThread?._id === t._id;
                const vendorName = t.vendorId?.storeName || t.vendorId?.name || 'Store';
                const lastMsg = t.lastMessage || 'Chat started';
                
                return (
                  <button
                    key={t._id}
                    onClick={() => setSelectedThread(t)}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 cursor-pointer ${
                      isSelected 
                        ? 'bg-[#D71920] text-white shadow-sm' 
                        : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-[#202020] p-0.5 overflow-hidden shadow-sm shrink-0 border border-gray-100 dark:border-white/10">
                      <LazyImage
                        src={t.vendorId?.storeLogo}
                        alt={vendorName}
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.target.src = getPlaceholderImage(40, 40, vendorName.charAt(0));
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-xs truncate flex items-center gap-1">
                          {vendorName}
                          {t.vendorId?.isVerified && (
                            <FiCheckCircle className={`text-[10px] shrink-0 ${isSelected ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`} />
                          )}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate w-full mt-0.5 ${
                        isSelected ? 'text-white/80' : 'text-gray-400 dark:text-gray-400'
                      }`}>
                        {lastMsg}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Workspace */}
          {selectedThread ? (
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#121212] overflow-hidden">
              {/* Active Header */}
              <div className="p-4 border-b border-gray-150 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-[#161616]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-[#202020] p-0.5 overflow-hidden shadow-sm shrink-0 border border-gray-100 dark:border-white/10">
                    <LazyImage
                      src={selectedThread.vendorId?.storeLogo}
                      alt={selectedThread.vendorId?.storeName || 'Store'}
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        e.target.src = getPlaceholderImage(40, 40, (selectedThread.vendorId?.storeName || 'S').charAt(0));
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-1.5">
                      {selectedThread.vendorId?.storeName || selectedThread.vendorId?.name || 'Store'}
                      {selectedThread.vendorId?.isVerified && (
                        <FiCheckCircle className="text-xs text-blue-500 dark:text-blue-400 animate-pulse" />
                      )}
                    </h3>
                    <p className="text-[10px] text-gray-400 dark:text-gray-400 font-bold uppercase tracking-wider">Direct Chat</p>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-50/30 dark:bg-[#0A0A0A]">
                {messages.map((msg, index) => {
                  const isCustomer = msg.sender === 'customer';
                  return (
                    <div 
                      key={msg._id || msg.id || index}
                      className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 shadow-sm ${
                        isCustomer 
                          ? 'bg-[#D71920] text-white rounded-tr-none' 
                          : 'bg-white dark:bg-[#1A1A1A] border border-gray-150 dark:border-white/10 text-gray-800 dark:text-gray-100 rounded-tl-none'
                      }`}>
                        <p className="text-xs leading-relaxed break-words font-medium">{msg.message}</p>
                        <span className={`text-[9px] block text-right mt-1 font-semibold ${
                          isCustomer ? 'text-white/75' : 'text-gray-400 dark:text-gray-400'
                        }`}>
                          {new Date(msg.time || msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-gray-150 dark:border-white/10 bg-white dark:bg-[#141414] flex gap-2 sm:gap-3 items-center">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D71920] text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || sending}
                  className="p-2.5 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <FiSend className="text-sm" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/20 dark:bg-[#121212] p-6 text-center">
              <FiMessageSquare className="text-4xl text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-xs text-gray-400 dark:text-gray-400 font-bold">Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#121212] rounded-3xl border border-gray-150 dark:border-white/10 p-12 text-center shadow-sm">
          <FiInbox className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">No Shop Conversations</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium max-w-sm mx-auto leading-relaxed">
            You haven't initiated chat with any store yet. Visit any vendor shop and click "Chat with Store" to start a conversation.
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default ShopChats;
