import { useState, useEffect, useMemo } from 'react';
import {
  FiPlus,
  FiSearch,
  FiTrash2,
  FiEdit,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiUser,
  FiPackage,
  FiAlertCircle,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useCategoryStore } from '../../../../shared/store/categoryStore';
import CategoryForm from '../../components/Categories/CategoryForm';
import CategoryTree from '../../components/Categories/CategoryTree';
import LucideIcon from '../../../../shared/components/LucideIcon';
import ExportButton from '../../components/ExportButton';
import Pagination from '../../components/Pagination';
import AnimatedSelect from '../../components/AnimatedSelect';
import Badge from '../../../../shared/components/Badge';
import toast from 'react-hot-toast';

const ManageCategories = () => {
  const {
    categories,
    initialize,
    deleteCategory,
    reviewCategory,
  } = useCategoryStore();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [parentCategoryId, setParentCategoryId] = useState(null);
  const [viewMode, setViewMode] = useState('tree');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Rejection modal state
  const [rejectingCategory, setRejectingCategory] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  const pendingCount = useMemo(() => {
    return categories.filter((c) => c.status === 'pending').length;
  }, [categories]);

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      // Tab filter
      if (activeTab === 'pending' && category.status !== 'pending') return false;
      if (
        activeTab === 'approved' &&
        category.status !== 'approved' &&
        category.status !== undefined
      )
        return false;
      if (activeTab === 'rejected' && category.status !== 'rejected') return false;

      // Search filter
      const matchesSearch =
        !searchQuery ||
        category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (category.description &&
          category.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (category.requestedBy?.storeName &&
          category.requestedBy.storeName
            .toLowerCase()
            .includes(searchQuery.toLowerCase()));

      // Status dropdown filter (when on 'all' tab)
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && category.isActive) ||
        (selectedStatus === 'inactive' && !category.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [categories, activeTab, searchQuery, selectedStatus]);

  // Pagination for list view
  const paginatedCategories = useMemo(() => {
    if (viewMode !== 'list') return filteredCategories;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCategories.slice(startIndex, endIndex);
  }, [filteredCategories, currentPage, itemsPerPage, viewMode]);

  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, activeTab]);

  const handleCreate = () => {
    setEditingCategory(null);
    setParentCategoryId(null);
    setShowForm(true);
  };

  const handleAddSubcategory = (parentId) => {
    setEditingCategory(null);
    setParentCategoryId(parentId);
    setShowForm(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setParentCategoryId(null);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      deleteCategory(id);
      toast.success('Category deleted');
    }
  };

  const handleApproveCategory = async (category) => {
    if (
      window.confirm(
        `Approve category "${category.name}"? All products linked to this category will automatically go live.`
      )
    ) {
      setIsSubmittingReview(true);
      try {
        await reviewCategory(category.id || category._id, {
          status: 'approved',
          autoActivateProducts: true,
        });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to approve category');
      } finally {
        setIsSubmittingReview(false);
      }
    }
  };

  const handleOpenRejectModal = (category) => {
    setRejectingCategory(category);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingCategory) return;
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await reviewCategory(rejectingCategory.id || rejectingCategory._id, {
        status: 'rejected',
        reason: rejectionReason.trim(),
        autoActivateProducts: false,
      });
      setRejectingCategory(null);
      setRejectionReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject category');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCategory(null);
    setParentCategoryId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">Manage Categories</h1>
          <p className="text-sm text-gray-600">Review vendor category requests and manage catalog structure</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 gradient-green text-white rounded-lg hover:shadow-glow-green transition-all font-semibold text-sm shadow-sm"
        >
          <FiPlus />
          <span>Add Category</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'All Categories', count: categories.length },
          { id: 'pending', label: 'Pending Requests', count: pendingCount, highlight: pendingCount > 0 },
          { id: 'approved', label: 'Approved', count: categories.filter((c) => c.status === 'approved' || !c.status).length },
          { id: 'rejected', label: 'Rejected', count: categories.filter((c) => c.status === 'rejected').length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-3 sm:px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                tab.highlight
                  ? 'bg-amber-500 text-white font-bold animate-pulse'
                  : activeTab === tab.id
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="relative flex-1 w-full">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by category name, description, or requesting vendor..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          {activeTab === 'all' && (
            <AnimatedSelect
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              className="w-full sm:w-auto min-w-[140px]"
            />
          )}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                viewMode === 'tree'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              List View
            </button>
          </div>

          <div className="w-full sm:w-auto">
            <ExportButton
              data={filteredCategories}
              headers={[
                { label: 'ID', accessor: (row) => row.id || row._id },
                { label: 'Name', accessor: (row) => row.name },
                { label: 'Parent Category', accessor: (row) => row.parentId?.name || '' },
                { label: 'Status', accessor: (row) => row.status || (row.isActive ? 'approved' : 'inactive') },
                { label: 'Requested By', accessor: (row) => row.requestedBy?.storeName || 'Admin' },
              ]}
              filename="categories"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <FiPackage className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No categories found in this view</p>
            {activeTab === 'pending' && (
              <p className="text-xs text-gray-400 mt-1">All vendor category requests have been reviewed!</p>
            )}
          </div>
        ) : viewMode === 'tree' && activeTab === 'all' ? (
          <CategoryTree
            categories={filteredCategories}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddSubcategory={handleAddSubcategory}
          />
        ) : (
          /* Cards / List View with Approval Action Bar */
          <div className="space-y-3">
            {paginatedCategories.map((category) => {
              const isPending = category.status === 'pending';
              const isRejected = category.status === 'rejected';

              return (
                <div
                  key={category.id || category._id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPending
                      ? 'bg-amber-50/50 border-amber-200 shadow-sm'
                      : isRejected
                      ? 'bg-red-50/30 border-red-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Icon / Image & Info */}
                    <div className="flex items-start gap-3.5">
                      {category.image ? (
                        <img
                          src={category.image}
                          alt={category.name}
                          className="w-12 h-12 object-cover rounded-xl border border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-500 flex-shrink-0">
                          <LucideIcon name={category.icon || 'Package'} size={24} />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 text-base">{category.name}</h3>
                          {category.parentId && (
                            <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-medium">
                              Subcategory of: {typeof category.parentId === 'object' ? category.parentId?.name : category.parentId}
                            </span>
                          )}
                          {isPending && (
                            <Badge variant="warning" className="text-[11px] flex items-center gap-1">
                              <FiClock size={12} /> Pending Admin Review
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="danger" className="text-[11px] flex items-center gap-1">
                              <FiXCircle size={12} /> Rejected
                            </Badge>
                          )}
                          {category.status === 'approved' && (
                            <Badge variant="success" className="text-[11px] flex items-center gap-1">
                              <FiCheckCircle size={12} /> Approved
                            </Badge>
                          )}
                        </div>

                        {category.description && (
                          <p className="text-xs text-gray-600 line-clamp-2">{category.description}</p>
                        )}

                        {/* Requester / Product Count details */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap pt-1">
                          {category.requestedBy && (
                            <span className="flex items-center gap-1.5 text-amber-900 font-medium">
                              <FiUser size={13} className="text-amber-600" />
                              Requested by: {category.requestedBy.storeName || category.requestedBy.name || 'Vendor'}
                            </span>
                          )}
                          {category.productCount !== undefined && (
                            <span className="flex items-center gap-1">
                              <FiPackage size={13} />
                              {category.productCount} Linked Products
                            </span>
                          )}
                          <span>GST Rate: {category.gstRate || 18}%</span>
                        </div>

                        {/* Rejection Note */}
                        {isRejected && category.rejectionReason && (
                          <div className="mt-2 text-xs bg-red-100/70 border border-red-200 text-red-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
                            <FiAlertCircle size={14} className="flex-shrink-0" />
                            <span>Reason: {category.rejectionReason}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                      {isPending ? (
                        <>
                          <button
                            onClick={() => handleApproveCategory(category)}
                            disabled={isSubmittingReview}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            <FiCheckCircle size={14} />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleOpenRejectModal(category)}
                            disabled={isSubmittingReview}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-all"
                          >
                            <FiXCircle size={14} />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : null}

                      <button
                        onClick={() => handleEdit(category)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors title='Edit'"
                      >
                        <FiEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(category.id || category._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors title='Delete'"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredCategories.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              className="mt-4"
            />
          </div>
        )}
      </div>

      {/* Reject Category Modal */}
      <AnimatePresence>
        {rejectingCategory && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-600">
                <FiAlertCircle size={24} />
                <h3 className="text-lg font-bold text-gray-900">Reject Category Request</h3>
              </div>
              <p className="text-sm text-gray-600">
                Are you sure you want to reject the category request for{' '}
                <strong className="text-gray-900">"{rejectingCategory.name}"</strong>?
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Similar category already exists under Electronics, Inappropriate category name, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingCategory(null)}
                  disabled={isSubmittingReview}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={isSubmittingReview}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-sm"
                >
                  {isSubmittingReview ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Create/Edit Form Modal */}
      {showForm && (
        <CategoryForm
          category={editingCategory}
          parentId={parentCategoryId}
          onClose={handleFormClose}
          onSave={() => {
            initialize();
            handleFormClose();
          }}
        />
      )}
    </motion.div>
  );
};

export default ManageCategories;
