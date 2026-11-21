import { useState, useEffect } from 'react';
import { FiSearch, FiCheck, FiX, FiMessageSquare, FiTrash2 } from 'react-icons/fi';
import { motion } from 'framer-motion';
import DataTable from '../components/DataTable';
import ExportButton from '../components/ExportButton';
import Badge from '../../../shared/components/Badge';
import AnimatedSelect from '../components/AnimatedSelect';
import { formatDateTime } from '../utils/adminHelpers';
import { useReviewStore } from '../../../shared/store/reviewStore';
import toast from 'react-hot-toast';
import ReviewPhotos from '../../../shared/components/Product/ReviewPhotos';

const Reviews = () => {
  const { reviews, isLoading, fetchReviews, updateReviewStatus, deleteReview, pagination } = useReviewStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedReviewerType, setSelectedReviewerType] = useState('all');

  useEffect(() => {
    fetchReviews({
      search: searchQuery,
      status: selectedStatus === 'all' ? undefined : selectedStatus,
      reviewerType: selectedReviewerType === 'all' ? undefined : selectedReviewerType
    });
  }, [searchQuery, selectedStatus, selectedReviewerType, fetchReviews]);

  const handleApprove = async (id) => {
    await updateReviewStatus(id, 'approved');
  };

  const handleReject = async (id) => {
    await updateReviewStatus(id, 'pending'); // Or 'rejected' if supported
  };

  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (value) => <span className="text-[10px] font-mono text-gray-500">{value}</span>
    },
    {
      key: 'productName',
      label: 'Product',
      sortable: true,
    },
    {
      key: 'vendorName',
      label: 'Vendor',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="text-sm font-semibold text-gray-800">{value || '—'}</p>
          {row.vendorType === 'managed_shop' && (
            <p className="text-[10px] font-bold text-purple-600 uppercase">Admin-managed shop</p>
          )}
        </div>
      ),
    },
    {
      key: 'customerName',
      label: 'Customer / Business',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-semibold text-gray-800">{value}</p>
          <p className="text-xs text-gray-500">{row.customerEmail}</p>
          {row.reviewerType === 'B2B' && row.companyName && (
            <p className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1">
              🏢 {row.companyName}
              {row.verificationStatus === 'Approved' && (
                <span className="text-[9px] font-extrabold bg-indigo-50 text-indigo-700 px-1 rounded">✓ Verified</span>
              )}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'reviewerType',
      label: 'Review Type',
      sortable: true,
      render: (value) => (
        <span className="text-xs font-semibold text-gray-700">
          {value === 'B2B' ? 'Business Buyer Review' : 'Customer Review'}
        </span>
      ),
    },
    {
      key: 'buyerType',
      label: 'Buyer Type',
      sortable: true,
      render: (_, row) => (
        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
          row.reviewerType === 'B2B'
            ? 'bg-blue-50 text-blue-700 border border-blue-100'
            : 'bg-green-50 text-green-700 border border-green-100'
        }`}>
          {row.reviewerType === 'B2B' ? 'B2B' : 'B2C'}
        </span>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={i < value ? 'text-yellow-400' : 'text-gray-300'}>
              ★
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'comment',
      label: 'Review Content',
      sortable: false,
      render: (value) => <p className="max-w-xs truncate text-sm">{value}</p>,
    },
    {
      key: 'images',
      label: 'Photos',
      sortable: false,
      render: (value) =>
        Array.isArray(value) && value.length ? (
          <ReviewPhotos images={value} size='sm' />
        ) : (
          <span className='text-xs text-gray-400'>—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <Badge
          variant={
            value === 'approved'
              ? 'success'
              : value === 'pending'
                ? 'warning'
                : 'error'
          }
        >
          {value}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.status === 'pending' && (
            <>
              <button
                onClick={() => handleApprove(row.id)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Approve"
              >
                <FiCheck />
              </button>
            </>
          )}
          <button
            onClick={() => deleteReview(row.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <FiTrash2 />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Reviews</h1>
          <p className="text-gray-600">Manage product reviews and ratings</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 w-full">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reviews..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <AnimatedSelect
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'approved', label: 'Approved' },
              { value: 'pending', label: 'Pending' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            className="min-w-[140px]"
          />
          <AnimatedSelect
            value={selectedReviewerType}
            onChange={(e) => setSelectedReviewerType(e.target.value)}
            options={[
              { value: 'all', label: 'All Reviews' },
              { value: 'B2C', label: 'B2C Reviews' },
              { value: 'B2B', label: 'B2B Reviews' },
            ]}
            className="min-w-[140px]"
          />
          <ExportButton
            data={reviews}
            headers={[
              { label: 'ID', accessor: (row) => row.id },
              { label: 'Product', accessor: (row) => row.productName },
              { label: 'Vendor', accessor: (row) => row.vendorName || '' },
              { label: 'Customer', accessor: (row) => row.customerName },
              { label: 'Review Type', accessor: (row) => row.reviewerType === 'B2B' ? 'Business Buyer Review' : 'Customer Review' },
              { label: 'Buyer Type', accessor: (row) => row.reviewerType === 'B2B' ? 'B2B' : 'B2C' },
              { label: 'Company', accessor: (row) => row.companyName || '' },
              { label: 'Rating', accessor: (row) => row.rating },
              { label: 'Comment', accessor: (row) => row.comment },
              { label: 'Photos', accessor: (row) => (row.images || []).join(' ') },
              { label: 'Status', accessor: (row) => row.status },
            ]}
            filename="reviews"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <DataTable
          data={reviews}
          columns={columns}
          loading={isLoading}
          pagination={true}
          itemsPerPage={pagination.limit}
          totalItems={pagination.total}
        />
      </div>
    </motion.div>
  );
};

export default Reviews;

