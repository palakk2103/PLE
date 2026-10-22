import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiSearch, 
  FiPlus, 
  FiEye, 
  FiEdit3, 
  FiXCircle, 
  FiMessageCircle, 
  FiTrendingUp, 
  FiInbox, 
  FiCalendar, 
  FiDownload,
  FiRefreshCw
} from 'react-icons/fi';
import DataTable from '../../Admin/components/DataTable';
import ExportButton from '../../Admin/components/ExportButton';
import AnimatedSelect from '../../Admin/components/AnimatedSelect';
import Badge from '../../../shared/components/Badge';
import { formatPrice } from '../../../shared/utils/helpers';
import api from '../../../shared/utils/api';
import toast from 'react-hot-toast';
import socketService from '../../../shared/utils/socket';

const RFQs = () => {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const pollingRef = useRef(null);

  const fetchRFQs = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      // Fetch standard RFQs, Direct RFQs, and User RFQs
      const [standardRes, directRes, userRes] = await Promise.all([
        api.get('/b2b-user/admin/rfq').catch(() => ({ data: [] })),
        api.get('/b2b-user/employee/direct-rfq').catch(() => ({ data: [] })),
        api.get('/user/rfq').catch(() => ({ data: [] }))
      ]);
      
      let allRfqs = [];
      
      // 1. Standard RFQs
      let standardList = [];
      if (standardRes) {
        if (Array.isArray(standardRes)) {
          standardList = standardRes;
        } else if (Array.isArray(standardRes.data)) {
          standardList = standardRes.data;
        } else if (standardRes.data && Array.isArray(standardRes.data.rfqs)) {
          standardList = standardRes.data.rfqs;
        } else if (standardRes.data && Array.isArray(standardRes.data.data)) {
          standardList = standardRes.data.data;
        } else if (standardRes.data && standardRes.data.data && Array.isArray(standardRes.data.data.rfqs)) {
          standardList = standardRes.data.data.rfqs;
        }
      }
      const filteredStandard = Array.isArray(standardList) ? standardList.filter(r => !r.rfqId?.startsWith('DRFQ-')) : [];
      allRfqs = [...allRfqs, ...filteredStandard];

      // 2. Direct RFQs
      let directList = [];
      if (directRes) {
        if (Array.isArray(directRes)) {
          directList = directRes;
        } else if (Array.isArray(directRes.data)) {
          directList = directRes.data;
        } else if (directRes.data && Array.isArray(directRes.data.data)) {
          directList = directRes.data.data;
        }
      }
      const normalizedDirectRfqs = Array.isArray(directList) ? directList.map(drfq => ({
        ...drfq,
        isDirect: true,
        rfqId: drfq.directRfqId,
        customProductName: drfq.customProductName || 'Direct RFQ Product',
        category: 'Direct Sourcing',
        createdByAdminId: null, // Employee
        status: drfq.status,
        createdAt: drfq.createdAt,
        _id: drfq._id
      })) : [];
      allRfqs = [...allRfqs, ...normalizedDirectRfqs];

      // 3. User RFQs
      let userList = [];
      if (userRes) {
        if (Array.isArray(userRes)) {
          userList = userRes;
        } else if (Array.isArray(userRes.data)) {
          userList = userRes.data;
        } else if (userRes.data && Array.isArray(userRes.data.rfqs)) {
          userList = userRes.data.rfqs;
        } else if (userRes.data && Array.isArray(userRes.data.data)) {
          userList = userRes.data.data;
        } else if (userRes.data && userRes.data.data && Array.isArray(userRes.data.data.rfqs)) {
          userList = userRes.data.data.rfqs;
        }
      }
      const normalizedUserRfqs = Array.isArray(userList) ? userList.map(urfq => ({
        ...urfq,
        rfqId: urfq.rfqId || `RFQ-${urfq._id}`,
        customProductName: urfq.customProductName || urfq.productId?.name || 'Wholesale Request',
        category: urfq.category || 'General Sourcing',
        status: urfq.status || 'Pending',
        createdAt: urfq.createdAt,
        _id: urfq._id
      })) : [];
      
      const existingIds = new Set(allRfqs.map(r => String(r._id)));
      const uniqueUserRfqs = normalizedUserRfqs.filter(r => !existingIds.has(String(r._id)));
      allRfqs = [...allRfqs, ...uniqueUserRfqs];
 
      // Sort by creation date descending
      allRfqs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setRfqs(allRfqs);
    } catch (error) {
      console.error(error);
      if (!silent) toast.error('Failed to load RFQs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRFQs();

    // Real-time: listen for status_update events via socket
    const socket = socketService.getSocket();
    const handleStatusUpdate = (data) => {
      // Silently refresh the list when any RFQ status changes
      fetchRFQs(true);
    };
    if (socket) {
      socket.on('status_update', handleStatusUpdate);
      socket.on('rfq_status_changed', handleStatusUpdate);
    }

    // Fallback: poll every 30 seconds for status changes
    pollingRef.current = setInterval(() => {
      fetchRFQs(true);
    }, 30000);

    return () => {
      if (socket) {
        socket.off('status_update', handleStatusUpdate);
        socket.off('rfq_status_changed', handleStatusUpdate);
      }
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchRFQs]);

  const handleWithdraw = async (id) => {
    try {
      const res = await api.post(`/b2b-user/admin/rfq/${id}/withdraw`);
      if (res.success || res.data) {
        toast.success('RFQ successfully withdrawn to Draft');
        fetchRFQs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to withdraw RFQ');
    }
  };

  // Filtered RFQs
  const filteredRfqs = useMemo(() => {
    let filtered = rfqs;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.rfqId.toLowerCase().includes(q) ||
          (r.customProductName || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q) ||
          (r.productId?.name || '').toLowerCase().includes(q)
      );
    }

    // Status Filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((r) => {
        if (selectedStatus === 'PO Generated' || selectedStatus === 'Purchase Order Generated') {
          return r.status === 'PO Generated' || r.status === 'Purchase Order Generated';
        }
        return r.status === selectedStatus;
      });
    }

    // Date Filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter((r) => new Date(r.createdAt) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter((r) => new Date(r.createdAt) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter((r) => new Date(r.createdAt) >= filterDate);
          break;
        default:
          break;
      }
    }

    return filtered;
  }, [rfqs, searchQuery, selectedStatus, dateFilter]);

  const getStatusVariant = (status) => {
    const map = {
      'Draft': 'default',
      'Submitted': 'warning',
      'Under Review': 'info',
      'Under Super Admin Review': 'info',
      'Negotiation In Progress': 'info',
      'Approved': 'success',
      'Sent To Vendors': 'success',
      'Quotation Received': 'info',
      'Quotations Received': 'info',
      'Vendor Evaluation': 'info',
      'Vendor Negotiation': 'warning',
      'Vendor Selected': 'success',
      'Awaiting B2B Confirmation': 'warning',
      'Awaiting B2B Approval': 'warning',
      'Purchase Order Generated': 'success',
      'PO Generated': 'success',
      'Pending Admin Approval': 'warning',
      'Pending Vendor': 'warning',
      'Vendor Accepted': 'success',
      'Negotiating': 'info',
      'Completed': 'success',
      'Rejected': 'danger'
    };
    return map[status] || 'default';
  };

  const navigateToDetail = (row) => {
    const b2bToken = sessionStorage.getItem('b2bAdminToken') || localStorage.getItem('b2bAdminToken');
    if (row.isDirect) {
      navigate(`/b2b-dashboard/direct-rfqs/${row._id}`);
    } else if (b2bToken || row.companyId) {
      navigate(`/b2b-dashboard/rfqs/${row._id}`);
    } else {
      navigate(`/rfq/${row._id}`);
    }
  };

  const columns = [
    {
      key: 'rfqId',
      label: 'RFQ Number',
      sortable: true,
      render: (value) => <span className="font-mono font-bold text-gray-900">{value}</span>
    },
    {
      key: 'customProductName',
      label: 'RFQ Title / Product',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            {row.productId?.name || row.customProductName || 'Custom Request'}
            {row.isDirect && <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">Direct</span>}
          </p>
          <span className="text-[10px] text-gray-400 font-bold uppercase">{row.category || 'General'}</span>
        </div>
      )
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (value) => <span className="text-xs font-semibold text-gray-650">{value || 'N/A'}</span>
    },
    {
      key: 'createdByAdminId',
      label: 'Created By',
      sortable: true,
      render: (_, row) => {
        if (row.isDirect) {
          return (
            <span className="text-xs font-semibold text-gray-700">
              {row.employeeId?.name ? `${row.employeeId.name} (Employee)` : 'Employee'}
            </span>
          );
        }
        if (row.createdByAdminId) {
          return (
            <span className="text-xs font-semibold text-gray-750">
              {row.createdByAdminId?.name ? `${row.createdByAdminId.name} (Admin)` : 'B2B Admin'}
            </span>
          );
        }
        return (
          <span className="text-xs font-medium text-gray-650">
            {row.createdByEmployeeId?.name ? `${row.createdByEmployeeId.name} (Employee)` : 'Employee'}
          </span>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <Badge variant={getStatusVariant(value)}>{value}</Badge>
    },
    {
      key: 'quotations',
      label: 'Recommended Bid',
      sortable: true,
      render: (value, row) => {
        const hasRecommended = ['Awaiting B2B Approval', 'Vendor Selected', 'Purchase Order Generated', 'Completed'].includes(row.status);
        return (
          <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
            hasRecommended ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
          }`}>
            {hasRecommended ? 'Available' : 'Pending'}
          </span>
        );
      }
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      sortable: true,
      render: (value) => (
        <span className="text-xs text-gray-500 font-medium">
          {new Date(value).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigateToDetail(row)}
            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="View RFQ"
          >
            <FiEye className="w-4 h-4" />
          </button>
          
          {row.status === 'Draft' && (
            <button
              onClick={() => navigate(`/b2b-dashboard/rfqs/${row._id}?edit=true`)}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Edit Draft"
            >
              <FiEdit3 className="w-4 h-4" />
            </button>
          )}

          {['Submitted', 'Under Super Admin Review'].includes(row.status) && (
            <button
              onClick={() => handleWithdraw(row._id)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Withdraw RFQ"
            >
              <FiXCircle className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => navigate(row.isDirect ? `/b2b-dashboard/direct-rfqs/${row._id}` : `/b2b-dashboard/rfqs/${row._id}?tab=discussion`)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Discussion Panel"
          >
            <FiMessageCircle className="w-4 h-4" />
          </button>

          {row.status === 'Awaiting B2B Approval' && (
            <button
              onClick={() => navigate(`/b2b-dashboard/rfqs/${row._id}?tab=quotations`)}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors animate-pulse"
              title="Review Recommendation"
            >
              <FiTrendingUp className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <FiInbox className="text-[#C07A3D]" /> RFQ Sourcing Center
          </h1>
          <p className="text-sm text-gray-500">
            Submit Requests for Quotation, track vendor bids, and issue Purchase Orders.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => fetchRFQs(true)}
            disabled={refreshing}
            className="px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 text-xs font-bold"
            title="Refresh Status"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#D71920]' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => navigate('/b2b-dashboard/rfqs/new')}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-[#D71920] text-white rounded-xl hover:bg-[#B51218] transition-colors shadow-sm font-bold flex items-center justify-center gap-2 text-xs"
          >
            <FiPlus className="w-4 h-4" strokeWidth={2.5} /> Create RFQ
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="relative flex-1 w-full sm:min-w-[240px]">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search RFQs by Title, ID, Category..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D71920] text-sm transition-all"
            />
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold uppercase">Status:</span>
            <AnimatedSelect
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Draft', label: 'Draft' },
                { value: 'Submitted', label: 'Submitted' },
                { value: 'Under Review', label: 'Under Review' },
                { value: 'Sent To Vendors', label: 'Sent To Vendors' },
                { value: 'Quotations Received', label: 'Quotations Received' },
                { value: 'Vendor Evaluation', label: 'Vendor Evaluation' },
                { value: 'Vendor Negotiation', label: 'Vendor Negotiation' },
                { value: 'Vendor Selected', label: 'Vendor Selected' },
                { value: 'Awaiting B2B Approval', label: 'Awaiting Approval' },
                { value: 'Pending Admin Approval', label: 'Pending Admin Approval' },
                { value: 'Pending Vendor', label: 'Pending Vendor (Direct)' },
                { value: 'Negotiating', label: 'Negotiating (Direct)' },
                { value: 'Vendor Accepted', label: 'Vendor Accepted (Direct)' },
                { value: 'PO Generated', label: 'PO Generated' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Rejected', label: 'Rejected' }
              ]}
              className="w-full sm:w-auto min-w-[140px]"
            />
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold uppercase">Date:</span>
            <AnimatedSelect
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Time' },
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'Last 7 Days' },
                { value: 'month', label: 'Last 30 Days' }
              ]}
              className="w-full sm:w-auto min-w-[130px]"
            />
          </div>

          <div className="w-full sm:w-auto ml-auto">
            <ExportButton
              data={filteredRfqs}
              headers={[
                { label: 'RFQ Number', accessor: (row) => row.rfqId },
                { label: 'Title', accessor: (row) => row.productId?.name || row.customProductName },
                { label: 'Category', accessor: (row) => row.category },
                { label: 'Quantity', accessor: (row) => row.quantity },
                { label: 'Target Rate', accessor: (row) => row.targetPrice },
                { label: 'Status', accessor: (row) => row.status },
                { label: 'Bids Received', accessor: (row) => row.quotations?.length || 0 },
                { label: 'Created Date', accessor: (row) => row.createdAt }
              ]}
              filename="b2b_rfqs_list"
            />
          </div>
        </div>

        {/* DataTable */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 font-bold">Loading RFQs...</p>
          </div>
        ) : filteredRfqs.length > 0 ? (
          <DataTable
            data={filteredRfqs}
            columns={columns}
            pagination={true}
            itemsPerPage={10}
            onRowClick={(row) => navigateToDetail(row)}
          />
        ) : (
          <div className="text-center py-16 text-gray-450 border border-dashed border-gray-200 rounded-2xl">
            <FiInbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h3 className="font-extrabold text-sm text-gray-800">No RFQs Found</h3>
            <p className="text-xs text-gray-450 mt-1 max-w-[280px] mx-auto">
              Get started by creating a new Request for Quotation to source bids from platform vendors.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RFQs;
