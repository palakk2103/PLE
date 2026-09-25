import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../shared/utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch,
  FiEye,
  FiMessageSquare,
  FiInbox,
  FiX,
  FiCheckCircle,
  FiXCircle,
  FiHelpCircle,
  FiMessageCircle,
  FiAlertCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const ProductEnquiries = () => {
  const [enquiries, setEnquiries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  
  const [responseText, setResponseText] = useState('');

  const fetchEnquiries = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/vendor/enquiries');
      const data = response?.data || response;
      if (Array.isArray(data)) {
        setEnquiries(data);
      } else if (response?.success || response?.statusCode === 200) {
        setEnquiries(response.data || []);
      } else if (data && Array.isArray(data.data)) {
        setEnquiries(data.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch enquiries.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Submitted':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Under Review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Need More Information':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Seller Responded':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Closed':
        return 'bg-gray-150 text-gray-700 border-gray-300';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-250';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((enq) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        enq.id.toLowerCase().includes(q) ||
        enq.productName.toLowerCase().includes(q) ||
        enq.userName.toLowerCase().includes(q) ||
        enq.subject.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || enq.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || enq.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [enquiries, searchQuery, statusFilter, priorityFilter]);

  const handleReply = async (e, status) => {
    e.preventDefault();
    if (!responseText.trim()) {
      toast.error('Response content cannot be empty.');
      return;
    }
    
    try {
      const response = await api.put(`/vendor/enquiries/${selectedEnquiry.id}/reply`, {
        status,
        responseText
      });
      const data = response?.data || response;
      const isSuccess = response?.success || response?.statusCode === 200 || data?.success;
      if (isSuccess) {
        toast.success(`Response sent successfully! Status updated to: ${status}`);
        setResponseText('');
        fetchEnquiries(); // Refresh list
        
        // Merge only updated fields to preserve populated fields like productName/userName
        const freshDoc = data.data || data;
        setSelectedEnquiry((prev) => ({
          ...prev,
          status: freshDoc.status || prev.status,
          sellerResponse: freshDoc.sellerResponse || prev.sellerResponse,
          timeline: freshDoc.timeline || prev.timeline,
        }));
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to send reply.');
    }
  };

  const handleStatusChange = async (status, noteText) => {
    try {
      const response = await api.put(`/vendor/enquiries/${selectedEnquiry.id}/reply`, {
        status,
        responseText: noteText // backend handles note text when status is passed
      });
      const data = response?.data || response;
      const isSuccess = response?.success || response?.statusCode === 200 || data?.success;
      if (isSuccess) {
        toast.success(`Enquiry status updated to ${status}`);
        fetchEnquiries(); // Refresh list
        
        // Merge only updated fields to preserve populated fields like productName/userName
        const freshDoc = data.data || data;
        setSelectedEnquiry((prev) => ({
          ...prev,
          status: freshDoc.status || prev.status,
          sellerResponse: freshDoc.sellerResponse || prev.sellerResponse,
          timeline: freshDoc.timeline || prev.timeline,
        }));
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6 text-sm"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <FiMessageSquare className="text-[#C07A3D]" /> Product Enquiries Management
        </h1>
        <p className="text-xs text-gray-500">
          Respond to questions from B2B and B2C users regarding existing products.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex flex-col sm:flex-row flex-wrap items-center gap-3">
        <div className="relative flex-1 w-full min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, product, buyer, subject..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 text-xs font-semibold"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold bg-white focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="Under Review">Under Review</option>
          <option value="Need More Information">Need More Information</option>
          <option value="Seller Responded">Seller Responded</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold bg-white focus:outline-none"
        >
          <option value="all">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </div>

      {/* Enquiries list table */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500 font-semibold">Loading enquiries...</p>
        </div>
      ) : filteredEnquiries.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center">
          <FiInbox className="mx-auto text-4xl text-gray-300 mb-3" />
          <p className="text-gray-500 text-base font-semibold">No product enquiries found</p>
          <p className="text-gray-400 text-xs mt-1">Product enquiries from buyer detail pages will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto scrollbar-admin">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <th className="p-4">Enquiry ID</th>
                  <th className="p-4">Product</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Subject & Question</th>
                  <th className="p-4 text-center">Priority</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredEnquiries.map((enq) => (
                  <tr
                    key={enq.id}
                    className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedEnquiry(enq);
                      setResponseText('');
                    }}
                  >
                    <td className="p-4 font-mono font-bold text-gray-900 select-all">{enq.id}</td>
                    <td className="p-4 font-bold text-gray-800">{enq.productName}</td>
                    <td className="p-4">
                      <p className="font-semibold text-gray-800">{enq.userName}</p>
                      <p className="text-[10px] text-gray-400">{enq.userEmail}</p>
                    </td>
                    <td className="p-4 max-w-xs truncate">
                      <p className="font-bold text-gray-800">{enq.subject}</p>
                      <p className="text-gray-500 truncate mt-0.5">{enq.question}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityColor(enq.priority)}`}>
                        {enq.priority}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(enq.status)}`}>
                        {enq.status}
                      </span>
                    </td>
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedEnquiry(enq);
                          setResponseText('');
                        }}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[11px]"
                      >
                        <FiEye /> View & Reply
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide drawer for Enquiry Details */}
      <AnimatePresence>
        {selectedEnquiry && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEnquiry(null)}
              className="fixed inset-0 bg-black z-50"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-white shadow-2xl z-50 flex flex-col h-full border-l border-gray-200"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-gray-500">{selectedEnquiry.id}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(selectedEnquiry.status)}`}>
                      {selectedEnquiry.status}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-gray-900 mt-1 truncate max-w-[320px]">
                    {selectedEnquiry.productName}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedEnquiry(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Scroll Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* User Info */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150 space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Buyer Contact Details
                  </span>
                  {selectedEnquiry.id.includes('b2b') || selectedEnquiry.userId?.includes('b2b') || selectedEnquiry.companyName ? (
                    <>
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Company Name</p>
                        <p className="font-bold text-gray-800">{selectedEnquiry.companyName || 'Apex General Enterprises'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Requested By</p>
                        <p className="font-bold text-gray-800">{selectedEnquiry.userName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Employee Name</p>
                        <p className="font-bold text-gray-800">{selectedEnquiry.userName}</p>
                      </div>
                    </>
                  ) : (
                    <p className="font-bold text-gray-800">{selectedEnquiry.userName}</p>
                  )}
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
                    <p className="text-xs text-gray-500 font-semibold">{selectedEnquiry.userEmail}</p>
                  </div>
                </div>

                {/* Question Details */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Product Question
                  </span>
                  <div className="border border-gray-150 rounded-xl p-4 bg-white space-y-2">
                    <h4 className="font-bold text-gray-900">Subject: {selectedEnquiry.subject}</h4>
                    <p className="text-gray-700 leading-relaxed font-semibold">{selectedEnquiry.question}</p>
                    {selectedEnquiry.attachment && (
                      <div className="text-[11px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md inline-block">
                        📎 Attachment: {selectedEnquiry.attachment}
                      </div>
                    )}
                  </div>
                </div>

                {/* Seller Response History */}
                {selectedEnquiry.sellerResponse && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Current Response
                    </span>
                    <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-4">
                      <p className="text-indigo-900 font-semibold leading-relaxed">
                        {selectedEnquiry.sellerResponse}
                      </p>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Activity History
                  </span>
                  <div className="border border-gray-150 rounded-2xl p-4 bg-gray-50/50 space-y-4">
                    {selectedEnquiry.timeline.map((item, index) => (
                      <div key={index} className="flex gap-3 text-xs">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary-500 ring-4 ring-primary-50" />
                          {index < selectedEnquiry.timeline.length - 1 && (
                            <div className="w-0.5 h-10 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-850">{item.status}</span>
                            <span className="text-[10px] text-gray-400 font-bold">
                              {new Date(item.date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-gray-650 mt-1 font-semibold">{item.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {selectedEnquiry.status !== 'Closed' && selectedEnquiry.status !== 'Resolved' && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        Respond to enquiry
                      </label>
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Type your response to the buyer..."
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-250 focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium bg-white"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleReply(e, 'Seller Responded')}
                        className="flex-1 py-2 px-3 bg-[#C07A3D] hover:bg-[#A8662F] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <FiMessageCircle /> Reply
                      </button>
                      <button
                        onClick={(e) => handleReply(e, 'Need More Information')}
                        className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <FiHelpCircle /> Need Info
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleStatusChange('Resolved', 'Marked resolved by Seller.')}
                        className="py-2 px-3 border border-emerald-250 hover:bg-emerald-50 text-emerald-600 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <FiCheckCircle /> Mark Resolved
                      </button>
                      <button
                        onClick={() => handleStatusChange('Closed', 'Enquiry closed by Seller.')}
                        className="py-2 px-3 border border-red-250 hover:bg-red-50 text-red-600 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <FiXCircle /> Close Enquiry
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

export default ProductEnquiries;
