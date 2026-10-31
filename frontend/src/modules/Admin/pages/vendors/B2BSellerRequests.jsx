import { useState, useEffect } from 'react';
import { 
  FiCheckCircle, 
  FiAlertCircle, 
  FiXCircle, 
  FiSearch, 
  FiEye, 
  FiExternalLink, 
  FiShield, 
  FiClock, 
  FiRefreshCw, 
  FiFilter, 
  FiFileText,
  FiX
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../../../shared/utils/api';

const B2BSellerRequests = () => {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, nonGst: 0 });
  const [statusFilter, setStatusFilter] = useState('pending');
  const [gstFilter, setGstFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Modal States
  const [selectedApp, setSelectedApp] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRemark, setRejectRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (gstFilter !== 'all') params.append('gstStatus', gstFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('page', page);
      params.append('limit', 15);

      const res = await api.get(`/admin/vendors/b2b-applications?${params.toString()}`);
      const data = res?.data ?? res;
      if (data) {
        setApplications(data.applications || []);
        setCounts(data.counts || { pending: 0, approved: 0, rejected: 0, nonGst: 0 });
        setTotalPages(data.pages || 1);
        setTotalItems(data.total || 0);
      }
    } catch (err) {
      toast.error('Failed to load B2B seller applications.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, gstFilter, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchApplications();
  };

  const handleApprove = async (appId) => {
    setActionLoading(true);
    const toastId = toast.loading('Approving B2B seller application...');
    try {
      await api.patch(`/admin/vendors/b2b-applications/${appId}/approve`);
      toast.success('B2B seller application approved successfully!', { id: toastId });
      setShowDetailModal(false);
      fetchApplications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve application', { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectRemark.trim()) {
      toast.error('Please enter a rejection remark.');
      return;
    }
    if (!selectedApp) return;

    setActionLoading(true);
    const toastId = toast.loading('Rejecting B2B application...');
    try {
      await api.patch(`/admin/vendors/b2b-applications/${selectedApp._id || selectedApp.id}/reject`, {
        remark: rejectRemark.trim(),
      });
      toast.success('B2B application rejected.', { id: toastId });
      setShowRejectModal(false);
      setShowDetailModal(false);
      setRejectRemark('');
      fetchApplications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject application', { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
            <FiCheckCircle className="text-green-600 text-xs" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            <FiXCircle className="text-red-600 text-xs" /> Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 animate-pulse">
            <FiClock className="text-yellow-600 text-xs" /> Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <FiShield className="text-primary-600" /> Vendor Applications
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review GST documents and approve third-party vendor permissions for wholesale B2B product sales.
          </p>
        </div>

        <button
          onClick={fetchApplications}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 shadow-sm transition-all self-start sm:self-auto"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => { setStatusFilter('pending'); setPage(1); }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'pending'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md'
              : 'bg-white text-gray-800 border-gray-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90">Pending Review</span>
            <FiClock className="text-lg opacity-80" />
          </div>
          <p className="text-2xl font-black mt-2">{counts.pending}</p>
        </div>

        <div 
          onClick={() => { setStatusFilter('approved'); setPage(1); }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'approved'
              ? 'bg-green-600 text-white border-green-700 shadow-md'
              : 'bg-white text-gray-800 border-gray-200 hover:border-green-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90">Approved</span>
            <FiCheckCircle className="text-lg opacity-80" />
          </div>
          <p className="text-2xl font-black mt-2">{counts.approved}</p>
        </div>

        <div 
          onClick={() => { setStatusFilter('rejected'); setPage(1); }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            statusFilter === 'rejected'
              ? 'bg-red-600 text-white border-red-700 shadow-md'
              : 'bg-white text-gray-800 border-gray-200 hover:border-red-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90">Rejected</span>
            <FiXCircle className="text-lg opacity-80" />
          </div>
          <p className="text-2xl font-black mt-2">{counts.rejected}</p>
        </div>

        <div 
          onClick={() => { setGstFilter(gstFilter === 'non_gst' ? 'all' : 'non_gst'); setPage(1); }}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            gstFilter === 'non_gst'
              ? 'bg-purple-600 text-white border-purple-700 shadow-md'
              : 'bg-white text-gray-800 border-gray-200 hover:border-purple-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90">Non-GST Sellers</span>
            <FiAlertCircle className="text-lg opacity-80" />
          </div>
          <p className="text-2xl font-black mt-2">{counts.nonGst}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Requests' },
              { id: 'pending', label: 'Pending Review', count: counts.pending },
              { id: 'approved', label: 'Approved', count: counts.approved },
              { id: 'rejected', label: 'Rejected', count: counts.rejected },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  statusFilter === tab.id
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-300 text-gray-800'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* GST Filter & Search */}
          <div className="flex items-center gap-3">
            <select
              value={gstFilter}
              onChange={(e) => { setGstFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Tax Types</option>
              <option value="gst_registered">GST Registered Only</option>
              <option value="non_gst">Non-GST Sellers Only</option>
            </select>

            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search vendor, GST..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <FiSearch className="absolute left-3 top-2.5 text-gray-400 text-xs" />
            </form>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-16 px-4">
            <FiShield className="mx-auto text-4xl text-gray-300 mb-2" />
            <h3 className="text-base font-bold text-gray-700">No B2B seller applications found</h3>
            <p className="text-xs text-gray-400 mt-1">
              There are no vendor applications matching the selected criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Vendor / Store</th>
                  <th className="py-3.5 px-4">Business Legal Name</th>
                  <th className="py-3.5 px-4">GST Status & Number</th>
                  <th className="py-3.5 px-4">GST Certificate</th>
                  <th className="py-3.5 px-4">Submitted Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {applications.map((app) => {
                  const isGst = app.b2bSellingGstStatus === 'gst_registered';
                  const certUrl = app.b2bSellingGstCertificate || app.gstCertificate;
                  const legalName = app.b2bSellingLegalName || app.businessName || app.name;
                  const gstNum = app.b2bSellingGstNumber || app.gstNumber;

                  return (
                    <tr key={app._id || app.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Vendor Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{app.storeName || app.name}</div>
                        <div className="text-[11px] text-gray-500">{app.email}</div>
                        {app.phone && <div className="text-[10px] text-gray-400">{app.phone}</div>}
                      </td>

                      {/* Legal Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-800">{legalName || '—'}</div>
                        {app.b2bSellingTradeName && (
                          <div className="text-[10px] text-gray-400">Trade: {app.b2bSellingTradeName}</div>
                        )}
                        {app.b2bSellingPan && (
                          <div className="text-[10px] font-mono text-gray-500">PAN: {app.b2bSellingPan}</div>
                        )}
                      </td>

                      {/* GST Status */}
                      <td className="py-3.5 px-4">
                        {isGst && gstNum ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-mono">
                              {gstNum}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <FiAlertCircle className="text-xs" /> Non-GST Seller
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Certificate */}
                      <td className="py-3.5 px-4">
                        {certUrl ? (
                          <a
                            href={certUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-semibold border border-primary-200 transition-colors"
                          >
                            <FiFileText /> View Doc <FiExternalLink className="text-[10px]" />
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">None</span>
                        )}
                      </td>

                      {/* Applied Date */}
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {app.b2bSellingAppliedAt 
                          ? new Date(app.b2bSellingAppliedAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(app.b2bSellingStatus)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setShowDetailModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                        >
                          <FiEye /> Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Showing {applications.length} of {totalItems} applications</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(prev => prev - 1)}
                className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 font-bold text-gray-800">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(prev => prev + 1)}
                className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review & Details Modal */}
      <AnimatePresence>
        {showDetailModal && selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 p-6 space-y-6"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                      Application Details
                    </span>
                    {getStatusBadge(selectedApp.b2bSellingStatus)}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mt-1">
                    {selectedApp.storeName || selectedApp.name}
                  </h3>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              {/* Vendor & Tax Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-gray-400 font-semibold block">Vendor Name</span>
                    <span className="font-bold text-gray-900">{selectedApp.name}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-gray-400 font-semibold block">Email Address</span>
                    <span className="font-bold text-gray-900">{selectedApp.email}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-gray-400 font-semibold block">Legal Entity Name</span>
                    <span className="font-bold text-gray-900">
                      {selectedApp.b2bSellingLegalName || selectedApp.businessName || '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-gray-400 font-semibold block">Trade Name</span>
                    <span className="font-bold text-gray-900">
                      {selectedApp.b2bSellingTradeName || selectedApp.storeName || '—'}
                    </span>
                  </div>
                </div>

                {/* GST Specific Information */}
                {selectedApp.b2bSellingGstStatus === 'gst_registered' ? (
                  <div className="p-4 bg-green-50/60 border border-green-200 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-green-900 uppercase tracking-wider">
                      GST & Tax Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500 block">GSTIN:</span>
                        <span className="font-bold font-mono text-sm text-green-800">
                          {selectedApp.b2bSellingGstNumber || selectedApp.gstNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">PAN Number:</span>
                        <span className="font-bold font-mono text-sm text-gray-800">
                          {selectedApp.b2bSellingPan || selectedApp.panNumber || '—'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500 block">Business Address:</span>
                        <span className="font-medium text-gray-800">
                          {[
                            selectedApp.b2bSellingAddress,
                            selectedApp.b2bSellingCity,
                            selectedApp.b2bSellingState,
                            selectedApp.b2bSellingPincode
                          ].filter(Boolean).join(', ') || 'Not specified'}
                        </span>
                      </div>
                    </div>

                    {/* Certificate Preview Link */}
                    <div className="pt-2 border-t border-green-200 flex items-center justify-between">
                      <span className="text-xs text-green-900 font-semibold">
                        GST Certificate Document:
                      </span>
                      {(selectedApp.b2bSellingGstCertificate || selectedApp.gstCertificate) ? (
                        <a
                          href={selectedApp.b2bSellingGstCertificate || selectedApp.gstCertificate}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                        >
                          <FiFileText /> View / Download Document <FiExternalLink />
                        </a>
                      ) : (
                        <span className="text-xs text-red-600 font-semibold">Not Uploaded</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                    <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                      <FiAlertCircle className="text-amber-600" /> Non-GST Seller Submission
                    </h4>
                    <p className="text-amber-800 leading-relaxed">
                      This vendor indicated that they do not possess a GST registration. In accordance with tax compliance rules, <strong>non-GST vendors cannot sell in the B2B wholesale marketplace</strong>.
                    </p>
                    {selectedApp.b2bSellingDeclaration && (
                      <div className="mt-2 p-2.5 bg-white rounded border border-amber-200 text-gray-700 font-normal">
                        <strong>Vendor Declaration:</strong> {selectedApp.b2bSellingDeclaration}
                      </div>
                    )}
                  </div>
                )}

                {/* Rejection History if any */}
                {selectedApp.b2bSellingRejectionReason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                    <strong>Previous Rejection Reason:</strong> {selectedApp.b2bSellingRejectionReason}
                  </div>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Close
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectRemark('');
                      setShowRejectModal(true);
                    }}
                    disabled={actionLoading}
                    className="w-full sm:w-auto px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors"
                  >
                    Reject Application
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprove(selectedApp._id || selectedApp.id)}
                    disabled={
                      actionLoading || 
                      selectedApp.b2bSellingGstStatus === 'non_gst' || 
                      !(selectedApp.b2bSellingGstNumber || selectedApp.gstNumber)
                    }
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md transition-all"
                  >
                    <FiCheckCircle /> Approve B2B Access
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Remarks Modal */}
      <AnimatePresence>
        {showRejectModal && selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
                  <FiXCircle /> Reject B2B Application
                </h3>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Rejection Reason / Remarks <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={rejectRemark}
                  onChange={(e) => setRejectRemark(e.target.value)}
                  placeholder="e.g. GST certificate document is illegible or name mismatch. Non-GST sellers are not eligible for wholesale selling."
                  className="w-full p-3 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  This remark will be sent via email and displayed in the vendor's dashboard.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionLoading || !rejectRemark.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow transition-all"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default B2BSellerRequests;
