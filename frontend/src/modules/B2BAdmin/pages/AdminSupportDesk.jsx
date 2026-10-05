import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiHelpCircle,
  FiSend,
  FiPlus,
  FiMessageSquare,
  FiPaperclip,
  FiSearch,
  FiRefreshCw,
  FiClock,
  FiAlertCircle,
  FiCheckCircle,
  FiShield,
  FiFileText,
  FiInbox,
  FiX,
  FiCheck,
  FiPhoneCall,
  FiMail,
  FiInfo
} from 'react-icons/fi';
import { useSupportStore } from '../../../shared/store/supportStore';
import toast from 'react-hot-toast';

const B2B_CATEGORIES = [
  'Order Issue',
  'Delivery & Logistics Delay',
  'Defective / Damaged Goods',
  'RFQ & Bulk Sourcing',
  'Payment & Wallet Dispute',
  'Invoices & GST Filing',
  'Technical Support',
  'Other Inquiries'
];

const AdminSupportDesk = () => {
  const { tickets = [], isLoading, fetchTickets, fetchTicketById, createTicket, addReply } = useSupportStore();

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Reply state
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachment, setReplyAttachment] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);
  const chatEndRef = useRef(null);

  // New Ticket Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    subject: '',
    category: 'Order Issue',
    priority: 'medium',
    description: '',
    screenshot: null
  });

  // Initial load
  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async (autoSelectFirst = true) => {
    try {
      const data = await fetchTickets();
      if (Array.isArray(data) && data.length > 0 && autoSelectFirst && !selectedTicketId) {
        const first = data[0];
        const tid = first.ticketNumber || first.id || first._id;
        setSelectedTicketId(tid);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Sync active ticket details when selection changes
  useEffect(() => {
    if (!selectedTicketId) {
      setActiveTicket(null);
      return;
    }
    let isMounted = true;
    const loadSelected = async () => {
      setLoadingTicket(true);
      try {
        const full = await fetchTicketById(selectedTicketId);
        if (isMounted) {
          setActiveTicket(full);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingTicket(false);
      }
    };
    loadSelected();

    // Auto-refresh the selected ticket conversation every 8 seconds
    const interval = setInterval(async () => {
      try {
        const fresh = await fetchTicketById(selectedTicketId);
        if (isMounted && fresh) {
          setActiveTicket(fresh);
        }
      } catch {
        // silent polling catch
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedTicketId, fetchTicketById]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTicket?.messages]);

  // Filtered ticket list
  const filteredTickets = useMemo(() => {
    const list = Array.isArray(tickets) ? tickets : [];
    return list.filter((t) => {
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.ticketNumber?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [tickets, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const list = Array.isArray(tickets) ? tickets : [];
    return {
      total: list.length,
      open: list.filter((t) => t.status === 'open').length,
      inProgress: list.filter((t) => t.status === 'in_progress').length,
      waiting: list.filter((t) => t.status === 'waiting_for_user').length,
      resolved: list.filter((t) => t.status === 'resolved' || t.status === 'closed').length
    };
  }, [tickets]);

  // Handle send message to admin
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = replyMessage.trim();
    if (!text && !replyAttachment) return;
    if (!selectedTicketId) return;

    setSendingReply(true);
    try {
      const updated = await addReply(selectedTicketId, text || 'Attached file', 'user', replyAttachment);
      if (updated) {
        setActiveTicket(updated);
        setReplyMessage('');
        setReplyAttachment(null);
        toast.success('Message sent to Platform Admin');
        fetchTickets();
      }
    } catch (err) {
      toast.error('Failed to send message. Please try again.');
      console.error(err);
    } finally {
      setSendingReply(false);
    }
  };

  // Handle attachment change
  const handleAttachmentChange = (e, target = 'reply') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      toast.error('File size must be under 2.5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (target === 'reply') {
        setReplyAttachment(reader.result);
      } else {
        setNewTicketForm((prev) => ({ ...prev, screenshot: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Create Ticket submit
  const handleCreateTicketSubmit = async (e) => {
    e.preventDefault();
    if (!newTicketForm.subject.trim()) {
      toast.error('Please enter a ticket subject');
      return;
    }
    if (!newTicketForm.description.trim()) {
      toast.error('Please provide a description of the issue');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const created = await createTicket({
        subject: newTicketForm.subject.trim(),
        category: newTicketForm.category,
        priority: newTicketForm.priority,
        description: newTicketForm.description.trim(),
        screenshot: newTicketForm.screenshot
      });

      if (created) {
        toast.success(`Ticket ${created.ticketNumber || created.id} raised successfully!`);
        setShowCreateModal(false);
        setNewTicketForm({
          subject: '',
          category: 'Order Issue',
          priority: 'medium',
          description: '',
          screenshot: null
        });
        const freshList = await fetchTickets();
        const newId = created.ticketNumber || created.id || created._id;
        if (newId) setSelectedTicketId(newId);
      }
    } catch (err) {
      toast.error('Failed to create ticket. Please try again.');
      console.error(err);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">Open</span>;
      case 'in_progress':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">In Progress</span>;
      case 'waiting_for_user':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Awaiting Reply</span>;
      case 'resolved':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Resolved</span>;
      case 'closed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">Closed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">{status || 'Open'}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-500/15 text-red-500">Urgent</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/15 text-amber-500">Normal</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/15 text-blue-400">Low</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#181818] via-[#221010] to-[#181818] border border-white/[0.08] rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Direct Platform Admin Help Desk
              </span>
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
              <FiShield className="text-[#D71920]" />
              B2B Priority Support Desk
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-xl">
              Connect directly with PLE Platform Executives regarding delivery delays, order defects, RFQ sourcing queries, bulk invoicing, and business account assistance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => loadTickets(false)}
              className="p-3 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 rounded-2xl border border-white/10 transition-colors"
              title="Refresh Tickets"
            >
              <FiRefreshCw className={`text-base ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-3 bg-[#D71920] hover:bg-[#B51218] text-white font-extrabold text-xs sm:text-sm rounded-2xl transition-all shadow-lg shadow-red-900/30 flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <FiPlus className="text-base" />
              <span>Raise New Support Ticket</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.08]">
          <div className="bg-black/30 rounded-2xl p-3 border border-white/[0.04]">
            <span className="text-[11px] text-gray-400 block font-medium">All Tickets</span>
            <span className="text-lg font-black text-white">{stats.total}</span>
          </div>
          <div className="bg-black/30 rounded-2xl p-3 border border-white/[0.04]">
            <span className="text-[11px] text-amber-400 block font-medium">Open / Under Review</span>
            <span className="text-lg font-black text-amber-400">{stats.open}</span>
          </div>
          <div className="bg-black/30 rounded-2xl p-3 border border-white/[0.04]">
            <span className="text-[11px] text-blue-400 block font-medium">In Progress</span>
            <span className="text-lg font-black text-blue-400">{stats.inProgress}</span>
          </div>
          <div className="bg-black/30 rounded-2xl p-3 border border-white/[0.04]">
            <span className="text-[11px] text-emerald-400 block font-medium">Resolved & Closed</span>
            <span className="text-lg font-black text-emerald-400">{stats.resolved}</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Tickets List */}
        <div className="lg:col-span-4 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm flex flex-col overflow-hidden max-h-[750px]">
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-gray-150 dark:border-white/10 space-y-3 bg-gray-50/50 dark:bg-[#181818]">
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-3 text-gray-400 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, subject..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#D71920]"
              />
            </div>
            {/* Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide text-[11px]">
              {['all', 'open', 'in_progress', 'resolved'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg font-bold capitalize transition-colors shrink-0 ${
                    statusFilter === s
                      ? 'bg-[#D71920] text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-white/[0.06] p-2 space-y-1">
            {isLoading && tickets.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">Loading support conversations...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="py-16 text-center px-4">
                <FiInbox className="text-3xl mx-auto text-gray-400 mb-2" />
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">No support tickets found</p>
                <p className="text-[11px] text-gray-400 mt-1">Have an issue? Raise a ticket to chat with Admin.</p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const tid = t.ticketNumber || t.id || t._id;
                const isSelected = selectedTicketId === tid;
                const lastMsg = t.messages?.[t.messages.length - 1]?.message || t.description;

                return (
                  <button
                    key={tid}
                    onClick={() => setSelectedTicketId(tid)}
                    className={`w-full text-left p-3.5 rounded-2xl transition-all flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-[#D71920]/10 dark:bg-[#D71920]/15 border border-[#D71920]/30 shadow-xs'
                        : 'hover:bg-gray-50 dark:hover:bg-white/[0.03] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-black text-gray-500 dark:text-gray-400">
                        {t.ticketNumber || tid}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {getPriorityBadge(t.priority)}
                        {getStatusBadge(t.status)}
                      </div>
                    </div>

                    <h4 className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1">
                      {t.subject}
                    </h4>

                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                      {lastMsg}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-white/5">
                      <span className="font-medium text-gray-600 dark:text-gray-400">{t.category || 'General'}</span>
                      <span>{new Date(t.updatedAt || t.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Live Chat & Ticket Inspection Workspace */}
        <div className="lg:col-span-8 bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-3xl shadow-sm flex flex-col overflow-hidden max-h-[750px]">
          {activeTicket ? (
            <>
              {/* Workspace Header */}
              <div className="p-4 sm:p-5 border-b border-gray-150 dark:border-white/10 bg-gray-50/50 dark:bg-[#181818] flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-gray-400">
                      {activeTicket.ticketNumber || activeTicket.id}
                    </span>
                    <span className="text-gray-300 dark:text-white/20">•</span>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      {activeTicket.category}
                    </span>
                    {getStatusBadge(activeTicket.status)}
                  </div>
                  <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white truncate">
                    {activeTicket.subject}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-gray-400 hidden sm:inline-block">
                    Direct Admin Line
                  </span>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                    <FiShield className="text-sm" />
                  </div>
                </div>
              </div>

              {/* Status Tracker Banner */}
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <FiInfo className="shrink-0" />
                  Ticket Status: <strong className="uppercase">{activeTicket.status?.replace('_', ' ')}</strong>
                </span>
                <span className="text-[10px] text-gray-400">
                  Created {new Date(activeTicket.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Chat Thread Messages */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-50/30 dark:bg-[#0c0c0c]">
                {/* Initial Description Card */}
                {activeTicket.description && (
                  <div className="bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-xs">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Initial Request / Description
                    </span>
                    <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {activeTicket.description}
                    </p>
                    {activeTicket.screenshot && (
                      <div className="mt-3">
                        <span className="text-[10px] text-gray-400 block mb-1 font-semibold">Attached Screenshot:</span>
                        <img
                          src={activeTicket.screenshot}
                          alt="Screenshot"
                          className="max-h-48 rounded-xl border border-gray-200 dark:border-white/10 object-contain bg-black/10"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Messages Loop */}
                {activeTicket.messages?.map((msg, idx) => {
                  const isAdmin = msg.senderType === 'admin';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-semibold text-gray-400">
                        {isAdmin ? (
                          <>
                            <FiShield className="text-emerald-500" />
                            <span className="text-emerald-500 font-bold">PLE Support Executive</span>
                          </>
                        ) : (
                          <>
                            <span>You (B2B Admin)</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-xs text-xs leading-relaxed ${
                          isAdmin
                            ? 'bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-100 rounded-tl-none'
                            : 'bg-[#D71920] text-white rounded-tr-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap font-medium">{msg.message}</p>

                        {(msg.attachment || (msg.attachments && msg.attachments[0])) && (
                          <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10">
                            <img
                              src={msg.attachment || msg.attachments[0]}
                              alt="Attachment"
                              className="max-h-48 rounded-lg object-contain bg-black/20"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              {activeTicket.status === 'closed' ? (
                <div className="p-4 bg-gray-100 dark:bg-[#181818] border-t border-gray-200 dark:border-white/10 text-center text-xs text-gray-500">
                  This ticket has been marked as <strong>Closed</strong>. If you require further help, please raise a new ticket.
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 sm:p-4 border-t border-gray-150 dark:border-white/10 bg-white dark:bg-[#161616] space-y-2"
                >
                  {replyAttachment && (
                    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-white/5 rounded-xl w-fit">
                      <img src={replyAttachment} alt="Preview" className="w-10 h-10 object-cover rounded-lg" />
                      <span className="text-[10px] text-gray-500">Image attached</span>
                      <button
                        type="button"
                        onClick={() => setReplyAttachment(null)}
                        className="p-1 hover:text-red-500 text-gray-400"
                      >
                        <FiX />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer transition-colors shrink-0">
                      <FiPaperclip className="text-base" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleAttachmentChange(e, 'reply')}
                      />
                    </label>

                    <input
                      type="text"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your message to Platform Support Admin..."
                      className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D71920] text-xs text-gray-900 dark:text-white placeholder-gray-400"
                    />

                    <button
                      type="submit"
                      disabled={(!replyMessage.trim() && !replyAttachment) || sendingReply}
                      className="px-4 py-2.5 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                    >
                      <FiSend className="text-xs" />
                      <span>{sendingReply ? 'Sending...' : 'Send'}</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-[#0e0e0e]">
              <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-[#D71920] flex items-center justify-center mb-4">
                <FiMessageSquare className="text-2xl" />
              </div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                No Support Conversation Selected
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mt-1 mb-5">
                Select an existing ticket from the left panel to review message history and chat directly with Admin, or create a new support ticket.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-[#D71920] hover:bg-[#B51218] text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                Raise New Ticket
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Direct Contact Cards Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <FiPhoneCall className="text-xl" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">Direct B2B Hotline</h4>
            <p className="text-[11px] text-gray-500">Available Mon-Sat 9:00 AM – 7:00 PM IST</p>
            <a href="tel:9513164326" className="text-xs font-black text-[#D71920] hover:underline mt-0.5 inline-block">
              +91 9513164326
            </a>
          </div>
        </div>

        <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <FiMail className="text-xl" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">Enterprise Escalation Email</h4>
            <p className="text-[11px] text-gray-500">For contract disputes and legal documentation</p>
            <a href="mailto:peoplesleagueofelectronics@gmail.com" className="text-xs font-black text-[#D71920] hover:underline mt-0.5 inline-block">
              peoplesleagueofelectronics@gmail.com
            </a>
          </div>
        </div>
      </div>

      {/* Create New Support Ticket Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#181818] border border-gray-200 dark:border-white/10 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden"
            >
              <div className="p-5 bg-gradient-to-r from-[#181818] to-[#251010] text-white flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <FiShield className="text-[#D71920] text-lg" />
                  <div>
                    <h3 className="font-black text-base">Raise B2B Support Ticket</h3>
                    <p className="text-[11px] text-gray-400">Direct message to PLE Platform Executives</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              <form onSubmit={handleCreateTicketSubmit} className="p-5 sm:p-6 space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Subject / Issue Summary *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTicketForm.subject}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
                    placeholder="e.g. Delayed shipment on Order #OD8492 or Defective unit in batch"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#D71920]"
                  />
                </div>

                {/* Category & Urgency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Issue Category *
                    </label>
                    <select
                      value={newTicketForm.category}
                      onChange={(e) => setNewTicketForm({ ...newTicketForm, category: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#D71920]"
                    >
                      {B2B_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Urgency / Priority *
                    </label>
                    <select
                      value={newTicketForm.priority}
                      onChange={(e) => setNewTicketForm({ ...newTicketForm, priority: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#D71920]"
                    >
                      <option value="low">Low - Routine Query</option>
                      <option value="medium">Medium - Standard Operational</option>
                      <option value="high">High - Urgent / Blocked Workflow</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Detailed Description *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newTicketForm.description}
                    onChange={(e) => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
                    placeholder="Provide full details, order numbers, invoice dates, or specific defect reports..."
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#D71920]"
                  />
                </div>

                {/* Screenshot Upload */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Attach Screenshot / Document Image (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1.5">
                      <FiPaperclip />
                      <span>Choose File</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleAttachmentChange(e, 'modal')}
                      />
                    </label>
                    {newTicketForm.screenshot && (
                      <div className="flex items-center gap-2">
                        <img src={newTicketForm.screenshot} alt="Preview" className="w-8 h-8 rounded-lg object-cover" />
                        <span className="text-[10px] text-emerald-500 font-semibold">File Attached</span>
                        <button
                          type="button"
                          onClick={() => setNewTicketForm({ ...newTicketForm, screenshot: null })}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-gray-150 dark:border-white/10 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTicket}
                    className="px-5 py-2.5 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <FiCheck />
                    <span>{isSubmittingTicket ? 'Submitting...' : 'Submit Ticket'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminSupportDesk;
