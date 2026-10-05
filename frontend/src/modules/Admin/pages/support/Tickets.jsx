import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FiSearch, FiEye, FiMessageSquare, FiSend, FiX, FiCheckCircle, FiAlertCircle, FiTrendingUp } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import DataTable from '../../components/DataTable';
import Badge from '../../../../shared/components/Badge';
import AnimatedSelect from '../../components/AnimatedSelect';
import { useSupportStore } from '../../../../shared/store/supportStore';

const Tickets = () => {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');
  const { tickets, isLoading, fetchTickets, addReply, updateTicketStatus, pagination } = useSupportStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');

  useEffect(() => {
    fetchTickets({
      search: searchQuery,
      status: statusFilter === 'all' ? undefined : statusFilter
    });
  }, [searchQuery, statusFilter, fetchTickets]);

  const handleViewTicket = async (ticketRow) => {
    setSelectedTicket(ticketRow);
    const id = ticketRow.ticketNumber || ticketRow.id || ticketRow._id;
    const updated = await useSupportStore.getState().fetchTicketById(id);
    if (updated) setSelectedTicket(updated);
  };

  const handleReply = async () => {
    const message = replyMessage.trim();
    if (!message || !selectedTicket) return;
    const id = selectedTicket.ticketNumber || selectedTicket.id || selectedTicket._id;
    const updated = await addReply(id, message, 'admin');
    if (updated) {
      setReplyMessage('');
      const refreshed = await useSupportStore.getState().fetchTicketById(id);
      setSelectedTicket(refreshed || updated);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket) return;
    const id = selectedTicket.ticketNumber || selectedTicket.id || selectedTicket._id;
    const success = await updateTicketStatus(id, newStatus);
    if (success) {
      const updated = await useSupportStore.getState().fetchTicketById(id);
      if (updated) setSelectedTicket(updated);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    const id = selectedTicket.ticketNumber || selectedTicket.id || selectedTicket._id;
    const success = await updateTicketStatus(id, 'closed', 'Admin closed this support ticket.');
    if (success) {
      const updated = await useSupportStore.getState().fetchTicketById(id);
      if (updated) setSelectedTicket(updated);
    }
  };


  const getStatusColor = (status) => {
    const colors = {
      open: 'error',
      in_progress: 'warning',
      waiting_for_user: 'info',
      resolved: 'success',
      closed: 'default',
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  // Dashboard Stats Calculations
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    waitingForUser: tickets.filter(t => t.status === 'waiting_for_user').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length
  };

  const columns = [
    {
      key: 'id',
      label: 'Ticket ID',
      sortable: true,
      render: (value, row) => (
        <span className="font-semibold text-gray-800 text-xs">
          {row.ticketNumber || value || row._id}
        </span>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortable: false,
      render: (_, row) => (
        <div>
          <p className="font-medium text-xs">{row.customer?.name || 'Anonymous'}</p>
          <p className="text-[10px] text-gray-500">{row.customer?.email}</p>
        </div>
      )
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (value) => <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-semibold text-gray-600">{value}</span>
    },
    {
      key: 'subject',
      label: 'Subject',
      sortable: false,
      render: (value) => <p className="text-xs font-semibold text-gray-800 max-w-xs truncate">{value}</p>,
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (value) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getPriorityColor(value)}`}>
          {value?.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <Badge variant={getStatusColor(value)}>{value?.replace('_', ' ') || 'unknown'}</Badge>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <button
          onClick={() => handleViewTicket(row)}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <FiEye className="text-sm" />
        </button>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto p-4"
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Customer Support Center</h1>
        <p className="text-sm text-gray-500">Monitor and manage all support tickets submitted by customers.</p>
      </div>

      {/* Dashboard Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Tickets', count: stats.total, color: 'border-blue-500 bg-blue-50 text-blue-700' },
          { label: 'Open', count: stats.open, color: 'border-red-500 bg-red-50 text-red-700' },
          { label: 'In Progress', count: stats.inProgress, color: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
          { label: 'Waiting User', count: stats.waitingForUser, color: 'border-purple-500 bg-purple-50 text-purple-700' },
          { label: 'Resolved', count: stats.resolved, color: 'border-green-500 bg-green-50 text-green-700' },
          { label: 'Closed', count: stats.closed, color: 'border-gray-500 bg-gray-50 text-gray-700' }
        ].map((c, i) => (
          <div key={i} className={`p-3.5 rounded-xl border-l-4 shadow-sm bg-white border border-gray-150 flex flex-col justify-between`}>
            <span className="text-[11px] text-gray-500 font-semibold">{c.label}</span>
            <span className="text-xl font-bold text-gray-800 mt-1">{c.count}</span>
          </div>
        ))}
      </div>


      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-150">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <AnimatedSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'waiting_for_user', label: 'Waiting For User' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
            className="min-w-[140px]"
          />
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-150">
        <DataTable
          data={tickets}
          columns={columns}
          pagination={true}
          itemsPerPage={pagination.limit || 10}
        />
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="fixed inset-0 bg-black/50 z-[10000]"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto pointer-events-auto flex flex-col"
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b flex-shrink-0">
                  <div>
                    <h3 className="text-base font-bold text-gray-805">#{selectedTicket.id} - {selectedTicket.subject}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">User: {selectedTicket.customer?.name} ({selectedTicket.customer?.email})</p>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  >
                    <FiX className="text-lg" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl text-xs">
                    <div>
                      <p className="text-gray-400 font-semibold">Category</p>
                      <p className="font-semibold text-gray-850 mt-0.5">{selectedTicket.category}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Priority</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${getPriorityColor(selectedTicket.priority)}`}>
                        {selectedTicket.priority?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Status</p>
                      <span className="inline-block mt-0.5">
                        <Badge variant={getStatusColor(selectedTicket.status)}>
                          {selectedTicket.status?.replace('_', ' ') || 'unknown'}
                        </Badge>
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-400 font-semibold">Created</p>
                      <p className="font-semibold text-gray-805 mt-0.5">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-gray-400 block mb-1">ISSUE DESCRIPTION</span>
                    <div className="bg-gray-50 p-3 rounded-lg border text-xs text-gray-700 whitespace-pre-wrap">
                      {selectedTicket.description}
                    </div>
                    {selectedTicket.screenshot && (
                      <div className="mt-2">
                        <img src={selectedTicket.screenshot} alt="Screenshot" className="max-h-40 rounded border object-contain" />
                      </div>
                    )}
                  </div>

                  {/* Message History */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <FiMessageSquare /> Messages History
                    </h4>
                    <div className="space-y-3">
                      {selectedTicket.messages?.map((msg, idx) => {
                        const isAdmin = msg.senderType === 'admin';
                        return (
                          <div key={idx} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                              isAdmin ? 'bg-primary-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none border'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.message}</p>
                              {msg.attachment && (
                                <div className="mt-2 pt-1 border-t border-black/10">
                                  <img src={msg.attachment} alt="Attachment" className="max-h-40 rounded object-contain" />
                                </div>
                              )}
                              {Array.isArray(msg.attachments) && msg.attachments.map((att, aIdx) => (
                                <div key={aIdx} className="mt-2 pt-1 border-t border-black/10">
                                  <img src={att} alt={`Attachment ${aIdx + 1}`} className="max-h-40 rounded object-contain" />
                                </div>
                              ))}
                            </div>
                            <span className="text-[9px] text-gray-400 mt-0.5">
                              {msg.senderType.toUpperCase()} | {new Date(msg.createdAt).toLocaleTimeString()}
                            </span>
                          </div>

                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Reply & Status Change Section */}
                {selectedTicket.status !== 'closed' && (
                  <div className="mt-4 pt-3 border-t flex flex-col gap-3 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-400 mb-1">CHANGE STATUS</label>
                        <select
                          value={selectedTicket.status}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="waiting_for_user">Waiting For User</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <button
                        onClick={handleCloseTicket}
                        className="h-10 px-4 mt-4 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-all border border-red-200 flex items-center justify-center gap-1"
                      >
                        Close Ticket
                      </button>
                    </div>

                    <div className="relative">
                      <textarea
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your response as Support Agent..."
                        className="w-full pl-4 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs resize-none"
                        rows="2"
                      />
                      <button
                        onClick={handleReply}
                        disabled={!replyMessage.trim() || isLoading}
                        className="absolute right-2 bottom-2 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        <FiSend />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Tickets;
