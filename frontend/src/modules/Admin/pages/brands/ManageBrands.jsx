import { useState, useEffect, useMemo } from "react";
import {
  FiPlus,
  FiSearch,
  FiEdit,
  FiTrash2,
  FiEye,
  FiEyeOff,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiUser,
  FiAlertCircle,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useBrandStore } from "../../../../shared/store/brandStore";
import BrandForm from "../../components/Brands/BrandForm";
import DataTable from "../../components/DataTable";
import ExportButton from "../../components/ExportButton";
import ConfirmModal from "../../components/ConfirmModal";
import AnimatedSelect from "../../components/AnimatedSelect";
import Badge from "../../../../shared/components/Badge";
import toast from "react-hot-toast";

const ManageBrands = () => {
  const { brands, initialize, deleteBrand, toggleBrandStatus, reviewBrand } = useBrandStore();
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'pending' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });

  // Rejection modal state
  const [rejectingBrand, setRejectingBrand] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  const pendingCount = useMemo(() => {
    return brands.filter((b) => b.status === "pending").length;
  }, [brands]);

  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      // Tab filter
      if (activeTab === "pending" && brand.status !== "pending") return false;
      if (
        activeTab === "approved" &&
        brand.status !== "approved" &&
        brand.status !== undefined
      )
        return false;
      if (activeTab === "rejected" && brand.status !== "rejected") return false;

      // Status filter
      if (selectedStatus === "active" && !brand.isActive) return false;
      if (selectedStatus === "inactive" && brand.isActive) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = brand.name?.toLowerCase().includes(query);
        const matchesDesc = brand.description?.toLowerCase().includes(query);
        const matchesVendor = brand.requestedBy?.storeName?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesVendor) return false;
      }

      return true;
    });
  }, [brands, activeTab, selectedStatus, searchQuery]);

  const handleCreate = () => {
    setEditingBrand(null);
    setShowForm(true);
  };

  const handleEdit = (brand) => {
    setEditingBrand(brand);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setDeleteModal({ isOpen: true, id });
  };

  const confirmDelete = () => {
    deleteBrand(deleteModal.id);
    setDeleteModal({ isOpen: false, id: null });
  };

  const handleApproveBrand = async (brand) => {
    try {
      setIsSubmittingReview(true);
      await reviewBrand(brand.id || brand._id, {
        status: "approved",
        autoActivateProducts: true,
      });
      await initialize();
    } catch (err) {
      // error handled in store
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleOpenRejectModal = (brand) => {
    setRejectingBrand(brand);
    setRejectionReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    try {
      setIsSubmittingReview(true);
      await reviewBrand(rejectingBrand.id || rejectingBrand._id, {
        status: "rejected",
        reason: rejectionReason,
        autoActivateProducts: false,
      });
      setRejectingBrand(null);
      setRejectionReason("");
      await initialize();
    } catch (err) {
      // error handled in store
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Brand Name",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          {row.logo ? (
            <img
              src={row.logo}
              alt={value}
              className="w-10 h-10 object-cover rounded-lg border border-gray-100 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-500 border border-gray-200">
              {value?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-semibold text-gray-800 flex items-center gap-2">
              {value}
              {row.status === "pending" && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full animate-pulse border border-amber-300">
                  New Request
                </span>
              )}
            </div>
            {row.requestedBy && (
              <div className="text-xs text-indigo-600 flex items-center gap-1 mt-0.5">
                <FiUser className="text-[10px]" />
                <span>Requested by: {row.requestedBy.storeName || "Vendor"}</span>
              </div>
            )}
            {row.rejectionReason && (
              <p className="text-xs text-red-500 mt-0.5">
                Rejected: {row.rejectionReason}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Approval",
      sortable: true,
      render: (_, row) => {
        if (row.status === "pending") {
          return <Badge variant="warning">Pending Review</Badge>;
        }
        if (row.status === "rejected") {
          return <Badge variant="danger">Rejected</Badge>;
        }
        return <Badge variant="success">Approved</Badge>;
      },
    },
    {
      key: "isActive",
      label: "Visibility",
      sortable: true,
      render: (value) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            value ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
          }`}
        >
          {value ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1.5">
          {row.status === "pending" ? (
            <>
              <button
                onClick={() => handleApproveBrand(row)}
                disabled={isSubmittingReview}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                title="Approve Brand"
              >
                <FiCheckCircle className="text-sm" />
                <span>Approve</span>
              </button>
              <button
                onClick={() => handleOpenRejectModal(row)}
                disabled={isSubmittingReview}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-semibold transition-all"
                title="Reject Brand"
              >
                <FiXCircle className="text-sm" />
                <span>Reject</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => toggleBrandStatus(row.id || row._id)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title={row.isActive ? "Deactivate" : "Activate"}
              >
                {row.isActive ? <FiEyeOff /> : <FiEye />}
              </button>
              <button
                onClick={() => handleEdit(row)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit Brand"
              >
                <FiEdit />
              </button>
              <button
                onClick={() => handleDelete(row.id || row._id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Brand"
              >
                <FiTrash2 />
              </button>
            </>
          )}
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
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">
            Manage Brands
          </h1>
          <p className="text-sm text-gray-600">
            View, approve, and manage product brands across all vendors
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 gradient-green text-white rounded-lg hover:shadow-glow-green transition-all font-semibold text-sm"
        >
          <FiPlus />
          <span>Add Brand</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("all")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "all"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <span>All Brands</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
            {brands.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "pending"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <FiClock />
          <span>Pending Requests</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("approved")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "approved"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <FiCheckCircle />
          <span>Approved</span>
        </button>

        <button
          onClick={() => setActiveTab("rejected")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "rejected"
              ? "border-red-600 text-red-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <FiXCircle />
          <span>Rejected</span>
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="relative flex-1 w-full">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brands or vendor..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <AnimatedSelect
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: "all", label: "All Visibility" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            className="w-full sm:w-auto min-w-[140px]"
          />
        </div>

        <div className="mt-4 flex justify-start sm:justify-end">
          <ExportButton
            data={filteredBrands}
            headers={[
              { label: "ID", accessor: (row) => row.id || row._id },
              { label: "Name", accessor: (row) => row.name },
              {
                label: "Status",
                accessor: (row) => (row.isActive ? "Active" : "Inactive"),
              },
              { label: "Approval", accessor: (row) => row.status || "approved" },
            ]}
            filename="brands"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <DataTable
          data={filteredBrands}
          columns={columns}
          pagination={true}
          itemsPerPage={10}
        />
      </div>

      {showForm && (
        <BrandForm
          brand={editingBrand}
          onClose={() => {
            setShowForm(false);
            setEditingBrand(null);
          }}
          onSave={() => {
            initialize();
            setShowForm(false);
            setEditingBrand(null);
          }}
        />
      )}

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectingBrand && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-gray-100"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="p-3 bg-red-50 rounded-full">
                  <FiAlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Reject Brand Request
                  </h3>
                  <p className="text-xs text-gray-500">
                    Brand: {rejectingBrand.name}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide a clear explanation for the vendor (e.g., Duplicate brand, invalid brand name, trademark violation)..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingBrand(null);
                      setRejectionReason("");
                    }}
                    className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReject}
                    disabled={isSubmittingReview || !rejectionReason.trim()}
                    className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    {isSubmittingReview ? "Rejecting..." : "Confirm Rejection"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Delete Brand?"
        message="Are you sure you want to delete this brand? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </motion.div>
  );
};

export default ManageBrands;
