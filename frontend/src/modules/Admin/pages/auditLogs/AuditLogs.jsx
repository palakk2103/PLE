import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiFileText,
  FiSearch,
  FiFilter,
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiEye,
  FiX,
  FiDownload,
  FiRefreshCw,
  FiUser
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getAuditLogs, getAuditLogFilters } from '../../services/adminService';

const MODULE_COLORS = {
  AUTH: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
  ACCOUNT_TEAM: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  ORDERS: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  PRODUCTS: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  CATALOG: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
  CUSTOMERS: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
  VENDORS: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  DELIVERY: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
  SETTINGS: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown options
  const [filterOptions, setFilterOptions] = useState({ modules: [], actions: [] });

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchFilters = async () => {
    try {
      const res = await getAuditLogFilters();
      const data = res?.data || res;
      setFilterOptions({
        modules: data?.modules || [],
        actions: data?.actions || []
      });
    } catch {
      // Non-blocking
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({
        page,
        limit,
        q: searchQuery || undefined,
        module: selectedModule !== 'all' ? selectedModule : undefined,
        action: selectedAction !== 'all' ? selectedAction : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        role: selectedRole !== 'all' ? selectedRole : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      const data = res?.data || res;
      setLogs(data?.logs || []);
      setTotal(data?.total || 0);
      setTotalPages(data?.totalPages || 1);
    } catch (err) {
      toast.error('Failed to retrieve audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, limit, selectedModule, selectedAction, selectedStatus, selectedRole, startDate, endDate]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLogs();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleExportCSV = () => {
    if (!logs.length) return toast.error('No logs to export');
    const headers = ['Timestamp', 'Actor Name', 'Identity ID', 'Role', 'Module', 'Action', 'Entity ID', 'Status', 'Description', 'IP Address'];
    const rows = logs.map(l => [
      new Date(l.createdAt).toISOString(),
      `"${l.actorName || ''}"`,
      `"${l.actorIdentityId || ''}"`,
      l.actorRole || '',
      l.module || '',
      l.action || '',
      `"${l.entityId || ''}"`,
      l.status || '',
      `"${(l.description || '').replace(/"/g, '""')}"`,
      l.ipAddress || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PLE_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit log CSV exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 p-5 rounded-2xl shadow-xs transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D71920] to-[#E53E3E] flex items-center justify-center text-white shadow-md">
            <FiFileText size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Activity & Audit Logs
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Server-side tamper-evident activity tracking for Super Admin security oversight
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLogs}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Refresh logs"
          >
            <FiRefreshCw size={14} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-[#D71920] hover:bg-[#B51218] text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2 active:scale-95"
          >
            <FiDownload size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl space-y-3 shadow-xs transition-colors">
        {/* Search Input */}
        <div className="relative">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Identity ID, Actor Name, Action, Entity ID, or Description..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] transition-colors"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* Module */}
          <select
            value={selectedModule}
            onChange={(e) => { setSelectedModule(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
          >
            <option value="all">All Modules</option>
            {filterOptions.modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Action */}
          <select
            value={selectedAction}
            onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
          >
            <option value="all">All Actions</option>
            {filterOptions.actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Role */}
          <select
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
          >
            <option value="all">All Roles</option>
            <option value="superadmin">Super Admin</option>
            <option value="account_team">Account Team</option>
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
          >
            <option value="all">All Status</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
            <option value="WARNING">Warning</option>
          </select>

          {/* Date Start */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
            placeholder="From Date"
          />

          {/* Date End */}
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#D71920] transition-colors"
            placeholder="To Date"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-[#121216] text-gray-600 dark:text-gray-400 uppercase font-bold text-[11px] tracking-wider border-b border-gray-200 dark:border-white/10">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Actor / Identity</th>
                <th className="py-3.5 px-4">Module</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-800 dark:text-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-500 dark:text-gray-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-500 dark:text-gray-400">
                    No audit records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const moduleColor = MODULE_COLORS[log.module] || 'bg-gray-100 dark:bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-500/30';
                  return (
                    <tr key={log._id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                        <div className="text-gray-900 dark:text-white font-medium">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-[10px]">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                      </td>

                      {/* Actor / Identity */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>{log.actorName || 'System'}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-mono text-[10px] text-[#D71920] font-bold">
                            {log.actorIdentityId || 'SUPER_ADMIN'}
                          </span>
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/5">
                            {log.actorRole}
                          </span>
                        </div>
                      </td>

                      {/* Module */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${moduleColor}`}>
                          {log.module}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 font-mono text-[11px] font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                        {log.action}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 max-w-xs truncate" title={log.description}>
                        <span className="text-gray-800 dark:text-white text-xs">{log.description}</span>
                        {log.entityId && (
                          <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate">
                            Target ID: {log.entityId}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                            <FiCheckCircle size={10} />
                            <span>SUCCESS</span>
                          </span>
                        ) : log.status === 'FAILURE' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/15 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-500/20">
                            <FiXCircle size={10} />
                            <span>FAILURE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/20">
                            <FiAlertTriangle size={10} />
                            <span>WARNING</span>
                          </span>
                        )}
                      </td>

                      {/* Details View */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-[#D71920] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                          title="View Audit Metadata"
                        >
                          <FiEye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-gray-50 dark:bg-[#121216] border-t border-gray-200 dark:border-white/10 text-xs text-gray-600 dark:text-gray-400">
          <div>
            Showing {logs.length} of {total} audit records
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white disabled:opacity-40 transition-colors shadow-2xs"
            >
              Previous
            </button>
            <span className="text-gray-900 dark:text-white font-mono px-2 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white disabled:opacity-40 transition-colors shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Metadata Detail Drawer / Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white dark:bg-[#16161A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden text-gray-800 dark:text-gray-100"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#121216]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#D71920]/10 text-[#D71920]">
                    <FiFileText size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">Audit Event Details</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{selectedLog._id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-admin text-xs">
                {/* Basic Details Grid */}
                <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-[#121216] p-4 rounded-xl border border-gray-200 dark:border-white/5 font-mono">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Timestamp:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Status:</span>
                    <span className={selectedLog.status === 'SUCCESS' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                      {selectedLog.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Actor Name:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{selectedLog.actorName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Identity ID:</span>
                    <span className="text-[#D71920] font-bold">{selectedLog.actorIdentityId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Module:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{selectedLog.module}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Action:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{selectedLog.action}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Client IP:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{selectedLog.ipAddress || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Entity ID:</span>
                    <span className="text-gray-900 dark:text-white font-medium">{selectedLog.entityId || 'None'}</span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
                    Event Description
                  </span>
                  <div className="p-3 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/5 rounded-xl text-gray-900 dark:text-white">
                    {selectedLog.description}
                  </div>
                </div>

                {/* User Agent */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
                    Client User Agent
                  </span>
                  <div className="p-3 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/5 rounded-xl text-gray-600 dark:text-gray-400 font-mono text-[11px] break-all">
                    {selectedLog.userAgent || 'Unknown'}
                  </div>
                </div>

                {/* Metadata JSON */}
                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
                    Sanitized Metadata Payload
                  </span>
                  <pre className="p-3 bg-gray-50 dark:bg-[#121216] border border-gray-200 dark:border-white/5 rounded-xl text-gray-800 dark:text-gray-200 font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#121216] flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2 bg-[#D71920] hover:bg-[#B51218] text-white rounded-xl font-semibold text-xs shadow-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuditLogs;
