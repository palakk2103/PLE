import { useState, useEffect } from "react";
import { FiSearch, FiEye, FiMessageSquare, FiSend, FiX, FiCheck, FiPlus } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useSupportStore } from "../../../shared/store/supportStore";
import Badge from "../../../shared/components/Badge";
import toast from "react-hot-toast";

const DeliverySupport = () => {
  const { tickets, isLoading, fetchTickets, addReply, updateTicketStatus, createTicket } = useSupportStore();

  // New-ticket form
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("Delivery Issue");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return;
    setCreating(true);
    const created = await createTicket({ subject: newSubject.trim(), description: newDescription.trim(), category: newCategory });
    setCreating(false);
    if (created) {
      setShowNew(false);
      setNewSubject("");
      setNewDescription("");
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");

  // Only filter delivery related support tickets
  useEffect(() => {
    fetchTickets({
      search: searchQuery
    });
  }, [searchQuery, fetchTickets]);

  // The server only returns this delivery partner's own tickets
  const deliveryTickets = tickets;

  const handleViewTicket = async (ticketRow) => {
    setSelectedTicket(ticketRow);
    const updated = await useSupportStore.getState().fetchTicketById(ticketRow.id);
    if (updated) setSelectedTicket(updated);
  };

  const handleReply = async () => {
    const message = replyMessage.trim();
    if (!message) return;
    const updated = await addReply(selectedTicket.id, message, "delivery");
    if (updated) {
      setReplyMessage("");
      setSelectedTicket(updated);
    }
  };

  const handleStatusChange = async (newStatus) => {
    const success = await updateTicketStatus(selectedTicket.id, newStatus, `Delivery Boy updated status to ${newStatus.replace('_', ' ')}`);
    if (success) {
      const updated = await useSupportStore.getState().fetchTicketById(selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: "error",
      in_progress: "warning",
      waiting_for_user: "info",
      resolved: "success",
      closed: "default",
    };
    return colors[status] || "default";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-lg mx-auto p-4 pb-20"
    >
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FiMessageSquare className="text-primary-600" /> Delivery Support
          </h1>
          <p className="text-xs text-gray-500">Raise a problem with PLE support (payouts, orders, app issues) and follow the replies.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-xl text-xs font-semibold shadow-sm"
        >
          <FiPlus /> New ticket
        </button>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-end sm:items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3">
            <h3 className="font-bold text-gray-800">Raise a support ticket</h3>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject"
              required
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs"
            >
              <option>Delivery Issue</option>
              <option>Payout / Earnings</option>
              <option>App / Technical</option>
              <option>Other</option>
            </select>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe the problem"
              required
              rows={5}
              maxLength={5000}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 bg-gray-100 rounded-xl text-xs">Cancel</button>
              <button type="submit" disabled={creating} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-xs disabled:opacity-60">
                {creating ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search delivery issues..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs shadow-sm"
        />
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-center text-xs text-gray-500 animate-pulse py-6">Loading issues...</p>
        ) : deliveryTickets.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-dashed text-center">
            <p className="text-xs text-gray-500">You have not raised any support tickets yet.</p>
          </div>
        ) : (
          deliveryTickets.map((t) => (
            <div
              key={t.id}
              onClick={() => handleViewTicket(t)}
              className="p-4 bg-white rounded-2xl border border-gray-150 shadow-sm hover:border-primary-300 transition-all cursor-pointer space-y-3"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-800">#{t.id}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border`}><Badge variant={getStatusColor(t.status)}>{t.status}</Badge></span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-800">{t.subject}</h4>
                <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">{t.description}</p>
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-400 pt-2 border-t">
                <span>{t.category}</span>
                <span>{new Date(t.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail & Chat Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="fixed inset-0 bg-black/50 z-[10000]"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed left-0 right-0 bottom-0 max-h-[85vh] bg-white rounded-t-3xl shadow-xl z-[10000] p-6 flex flex-col pointer-events-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b flex-shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">#{selectedTicket.id} - {selectedTicket.subject}</h3>
                  <p className="text-[10px] text-gray-500">Customer: {selectedTicket.customer?.name}</p>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
                {/* Status Badges */}
                <div className="flex gap-2">
                  <span className={`text-[10px] font-bold`}><Badge variant={getStatusColor(selectedTicket.status)}>{selectedTicket.status}</Badge></span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-semibold">{selectedTicket.category}</span>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border text-[11px] text-gray-700 whitespace-pre-wrap">
                  {selectedTicket.description}
                </div>

                {/* Message history */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-gray-400 block">SUPPORT LOG</span>
                  <div className="space-y-3">
                    {selectedTicket.messages?.map((msg, idx) => {
                      const isDelivery = msg.senderType === 'delivery';
                      return (
                        <div key={idx} className={`flex flex-col ${isDelivery ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] ${
                            isDelivery ? 'bg-primary-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none border'
                          }`}>
                            {msg.message}
                          </div>
                          <span className="text-[8px] text-gray-450 mt-0.5 px-1">
                            {msg.senderType.toUpperCase()} | {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Reply / Status updates */}
              {selectedTicket.status !== "closed" && (
                <div className="pt-3 border-t flex flex-col gap-3 flex-shrink-0">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusChange("in_progress")}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                        selectedTicket.status === 'in_progress' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      In Progress
                    </button>
                    <button
                      onClick={() => handleStatusChange("resolved")}
                      className="flex-1 py-1.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                    >
                      <FiCheck /> Mark Resolved
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type delivery update message..."
                      className="w-full pl-4 pr-12 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                    />
                    <button
                      onClick={handleReply}
                      disabled={!replyMessage.trim() || isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      <FiSend className="text-xs" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DeliverySupport;
