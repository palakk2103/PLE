import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiEye, FiUserX, FiCheckCircle, FiTrash2, FiPower } from "react-icons/fi";
import { motion } from "framer-motion";
import DataTable from "../../components/DataTable";
import ConfirmModal from "../../components/ConfirmModal";
import { useB2BUserStore } from "../../store/b2bUserStore";
import toast from "react-hot-toast";
import ApplicationConversation from "../../components/b2b/ApplicationConversation";

const ManageB2BUsers = () => {
  const navigate = useNavigate();
  const { b2bUsers, updateB2BUserStatus, deleteB2BUser, initialize } = useB2BUserStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserForDetails, setSelectedUserForDetails] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null,
    userId: null,
    companyName: null,
  });
  const [reason, setReason] = useState("");

  const filteredUsers = useMemo(() => {
    let filtered = b2bUsers.filter(u => u.verificationStatus !== "Pending Verification");

    if (filterStatus !== "all") {
      const mappedFilter = filterStatus === 'approved' ? 'Approved' : 'Rejected';
      filtered = filtered.filter((u) => u.verificationStatus === mappedFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (user) =>
          user.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.businessEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.gstNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [b2bUsers, searchQuery, filterStatus]);

  const columns = [
    {
      key: "companyName",
      label: "Company Name",
      sortable: true,
      render: (value, row) => (
        <div>
          <span className="font-medium text-gray-800">{value}</span>
          <p className="text-xs text-gray-500">{row.companyType}</p>
        </div>
      ),
    },
    {
      key: "businessEmail",
      label: "Business Email",
      sortable: true,
      render: (value) => <span className="text-sm text-gray-700">{value}</span>,
    },
    {
      key: "adminInfo",
      label: "Admin Details",
      sortable: false,
      render: (_, row) => (
        <div>
          <span className="font-medium text-gray-800">{row.admin?.adminName || "N/A"}</span>
          <p className="text-xs text-gray-500">{row.admin?.adminEmail}</p>
          <p className="text-xs text-gray-500">{row.admin?.adminPhone}</p>
        </div>
      ),
    },
    {
      key: "employeeCount",
      label: "Employees",
      sortable: true,
      render: (value) => (
        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-blue-800 bg-blue-100 rounded-full">{value || 0}</span>
      ),
    },
    {
      key: "gstNumber",
      label: "GST Number",
      sortable: true,
      render: (value) => <span className="text-sm text-gray-700 uppercase">{value}</span>,
    },
    {
      key: "verificationStatus",
      label: "Status",
      sortable: true,
      render: (value) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            value === "Approved"
              ? "bg-green-100 text-green-700"
              : value === "Rejected"
              ? "bg-red-100 text-red-700"
              : "bg-gray-100 text-gray-700"
          }`}>
          {value}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUserForDetails(row);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Details">
            <FiEye />
          </button>

          {row.verificationStatus === "Approved" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActionModal({
                  isOpen: true,
                  type: row.status === "Inactive" ? "activate" : "deactivate",
                  userId: row.id || row._id,
                  companyName: row.companyName,
                });
              }}
              data-testid="toggle-company-access"
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${row.status === "Inactive" ? "text-green-700 bg-green-50 hover:bg-green-100" : "text-amber-700 bg-amber-50 hover:bg-amber-100"}`}
              title={row.status === "Inactive" ? "Reactivate company" : "Deactivate company (can be undone)"}>
              <FiPower /> {row.status === "Inactive" ? "Reactivate" : "Deactivate"}
            </button>
          )}

          {row.verificationStatus === "Approved" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActionModal({
                  isOpen: true,
                  type: "suspend",
                  userId: row.id || row._id,
                  companyName: row.companyName,
                });
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Suspend User">
              <FiUserX />
            </button>
          ) : row.verificationStatus === "Rejected" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActionModal({
                  isOpen: true,
                  type: "delete",
                  userId: row.id || row._id,
                  companyName: row.companyName,
                });
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete User Permanently">
              <FiTrash2 />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const handleAction = async () => {
    if (actionModal.type === "delete") {
      const success = await deleteB2BUser(actionModal.userId);
      if (success) {
        toast.success(`B2B User permanently deleted`);
      } else {
        toast.error(`Failed to delete user`);
      }
    } else if (actionModal.type === "deactivate" || actionModal.type === "activate") {
      const next = actionModal.type === "deactivate" ? "inactive" : "active";
      const success = await updateB2BUserStatus(actionModal.userId, next, reason.trim());
      if (success) {
        toast.success(next === "inactive" ? "Company deactivated. The company admin has been emailed." : "Company reactivated.");
      } else {
        toast.error("Failed to update company access");
      }
    } else {
      const status = actionModal.type === "approve" ? "approved" : "rejected"; // We map suspend to rejected or a new status
      const success = await updateB2BUserStatus(actionModal.userId, status, reason.trim());
      if (success) {
        toast.success(`B2B User ${status} successfully`);
      } else {
        toast.error(`Failed to update user`);
      }
    }

    setActionModal({
      isOpen: false,
      type: null,
      userId: null,
      companyName: null,
    });
    setReason("");
  };

  const getModalContent = () => {
    if (actionModal.type === "approve") {
      return {
        title: "Approve B2B User?",
        message: `Are you sure you want to approve "${actionModal.companyName}"?`,
        confirmText: "Approve",
        onConfirm: handleAction,
        type: "success",
      };
    } else if (actionModal.type === "suspend") {
        return {
          title: "Suspend / Reject User?",
          message: `Are you sure you want to suspend/reject "${actionModal.companyName}"?`,
          confirmText: "Suspend",
          onConfirm: handleAction,
          type: "danger",
          customContent: (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Provide a reason..."
              />
            </div>
          ),
        };
    } else if (actionModal.type === "deactivate") {
        return {
          title: "Deactivate company?",
          message: `"${actionModal.companyName}" and its employees will be signed out and cannot sign in until you reactivate it.`,
          confirmText: "Deactivate",
          onConfirm: handleAction,
          type: "warning",
          customContent: (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Reason (emailed to and shown to the company admin)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Reason" />
            </div>
          ),
        };
    } else if (actionModal.type === "activate") {
        return {
          title: "Reactivate company?",
          message: `"${actionModal.companyName}" will be able to sign in again.`,
          confirmText: "Reactivate",
          onConfirm: handleAction,
          type: "success",
        };
    } else if (actionModal.type === "delete") {
        return {
          title: "Delete User Permanently?",
          message: `Are you sure you want to permanently delete "${actionModal.companyName}"? This action cannot be undone.`,
          confirmText: "Delete",
          onConfirm: handleAction,
          type: "danger",
        };
    }
    return null;
  };

  const modalContent = getModalContent();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Manage B2B Users
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            View and manage all approved B2B users
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-6 border-b border-gray-200">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company, email, or GST..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 min-w-[150px]">
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected / Suspended</option>
          </select>
        </div>

        {filteredUsers.length > 0 ? (
          <DataTable
            data={filteredUsers}
            columns={columns}
            pagination={true}
            itemsPerPage={10}
            onRowClick={(row) => {}}
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            No B2B users found matching your criteria.
          </div>
        )}
      </div>

      {modalContent && (
        <ConfirmModal
          isOpen={actionModal.isOpen}
          onClose={() => {
            setActionModal({
              isOpen: false,
              type: null,
              userId: null,
              companyName: null,
            });
            setReason("");
          }}
          onConfirm={modalContent.onConfirm}
          title={modalContent.title}
          message={modalContent.message}
          confirmText={modalContent.confirmText}
          cancelText="Cancel"
          type={modalContent.type}
          customContent={modalContent.customContent}
        />
      )}

      {selectedUserForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">B2B User Details</h2>
              <button onClick={() => setSelectedUserForDetails(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold uppercase text-blue-600 mb-3 tracking-wider">Company Information</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Company Name</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedUserForDetails.companyName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Company Type</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedUserForDetails.companyType || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">GST Number</p>
                    <p className="text-sm font-semibold text-gray-800 uppercase">{selectedUserForDetails.gstNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Website</p>
                    {selectedUserForDetails.website ? (
                      <a href={selectedUserForDetails.website} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 hover:underline">{selectedUserForDetails.website}</a>
                    ) : (
                      <p className="text-sm font-semibold text-gray-800">N/A</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Business Email</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedUserForDetails.businessEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Business Phone</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedUserForDetails.businessPhone || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 font-medium">Company Address</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedUserForDetails.companyAddress || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase text-blue-600 mb-3 tracking-wider">Admin Information</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Admin Name</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedUserForDetails.admin?.adminName || selectedUserForDetails.admin?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Admin Email</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedUserForDetails.admin?.adminEmail || selectedUserForDetails.admin?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Admin Phone</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedUserForDetails.admin?.adminPhone || selectedUserForDetails.admin?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Total Employees</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedUserForDetails.employeeCount ?? 0}</p>
                  </div>
                </div>
              </div>

              <ApplicationConversation companyId={selectedUserForDetails._id || selectedUserForDetails.id} />
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <div>
                  <span className="text-xs text-gray-500 font-medium mr-2">Verification Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedUserForDetails.verificationStatus === 'Approved' ? 'bg-green-100 text-green-700' : selectedUserForDetails.verificationStatus === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {selectedUserForDetails.verificationStatus || 'Pending'}
                  </span>
                </div>
                <button onClick={() => setSelectedUserForDetails(null)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ManageB2BUsers;
