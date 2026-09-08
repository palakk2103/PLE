import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiEye, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { motion } from "framer-motion";
import DataTable from "../../components/DataTable";
import ConfirmModal from "../../components/ConfirmModal";
import { useB2BUserStore } from "../../store/b2bUserStore";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";
import { FiDownload } from "react-icons/fi";

const PendingB2BApprovals = () => {
  const navigate = useNavigate();
  const { b2bUsers, updateB2BUserStatus, initialize } = useB2BUserStore();

  const [platformTemplate, setPlatformTemplate] = useState(null);

  useEffect(() => {
    initialize();
    api.get('/agreement-template/active')
      .then(res => {
        const template = res?.data?.data || res?.data || res;
        if (template && (template.url || template._id)) {
          setPlatformTemplate(template);
        }
      })
      .catch(err => console.warn('Failed to load platform template for comparison', err));
  }, [initialize]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserForDetails, setSelectedUserForDetails] = useState(null);
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null, // 'approve', 'reject'
    userId: null,
    companyName: null,
  });
  const [rejectReason, setRejectReason] = useState("");

  const pendingUsers = useMemo(() => {
    let filtered = b2bUsers.filter((u) => u.verificationStatus === "Pending Verification");

    if (searchQuery) {
      filtered = filtered.filter(
        (user) =>
          user.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.businessEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.gstNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [b2bUsers, searchQuery]);

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
      key: "createdAt",
      label: "Registration Date",
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-700">
          {new Date(value).toLocaleDateString()}
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActionModal({
                isOpen: true,
                type: "approve",
                userId: row.id || row._id,
                companyName: row.companyName,
              });
            }}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Approve User">
            <FiCheckCircle />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActionModal({
                isOpen: true,
                type: "reject",
                userId: row.id || row._id,
                companyName: row.companyName,
              });
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Reject User">
            <FiXCircle />
          </button>
        </div>
      ),
    },
  ];

  const handleApprove = async () => {
    const success = await updateB2BUserStatus(actionModal.userId, "approved");
    if (success) {
      toast.success("B2B User approved successfully");
      setActionModal({
        isOpen: false,
        type: null,
        userId: null,
        companyName: null,
      });
    } else {
      toast.error("Failed to approve user");
    }
  };

  const handleReject = async () => {
    const success = await updateB2BUserStatus(
      actionModal.userId,
      "rejected",
      rejectReason.trim()
    );
    if (success) {
      toast.success("B2B User registration rejected");
      setActionModal({
        isOpen: false,
        type: null,
        userId: null,
        companyName: null,
      });
      setRejectReason("");
    } else {
      toast.error("Failed to reject user");
    }
  };

  const getModalContent = () => {
    if (actionModal.type === "approve") {
      return {
        title: "Approve B2B User?",
        message: `Are you sure you want to approve "${actionModal.companyName}"? They will receive an email and be able to log in.`,
        confirmText: "Approve",
        onConfirm: handleApprove,
        type: "success",
      };
    } else if (actionModal.type === "reject") {
        return {
          title: "Reject Registration?",
          message: `Are you sure you want to reject "${actionModal.companyName}"?`,
          confirmText: "Reject",
          onConfirm: handleReject,
          type: "danger",
          customContent: (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Rejection Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Provide a reason for rejection..."
              />
            </div>
          ),
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
            Pending B2B Approvals
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Review and approve pending B2B user registrations
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pending users by company, email, or GST..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
            />
          </div>
        </div>

        {pendingUsers.length > 0 ? (
          <DataTable
            data={pendingUsers}
            columns={columns}
            pagination={true}
            itemsPerPage={10}
            onRowClick={(row) => {}}
          />
        ) : (
          <div className="text-center py-12">
            <FiCheckCircle className="text-4xl text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No pending approvals</p>
            <p className="text-sm text-gray-400">
              All B2B user registrations have been reviewed
            </p>
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
            setRejectReason("");
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
              <h2 className="text-xl font-bold text-gray-800">B2B Registration Details</h2>
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

              <div>
                <h3 className="text-sm font-semibold uppercase text-blue-600 mb-3 tracking-wider">Acceptance & Execution Agreement</h3>
                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Upload Status</p>
                    {selectedUserForDetails.acceptanceExecutionDocument?.url ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full mt-1">
                        ✓ Signed PDF Uploaded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full mt-1">
                        ✗ Not Uploaded
                      </span>
                    )}
                  </div>
                  {selectedUserForDetails.acceptanceExecutionDocument?.url && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">File Name</p>
                        <p className="text-sm font-semibold text-gray-850 truncate">{selectedUserForDetails.acceptanceExecutionDocument.fileName || 'Signed_Agreement.pdf'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Uploaded Date</p>
                        <p className="text-sm font-semibold text-gray-850">
                          {selectedUserForDetails.acceptanceExecutionDocument.uploadedAt ? new Date(selectedUserForDetails.acceptanceExecutionDocument.uploadedAt).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      <div className="flex gap-2 pt-1.5">
                        <a 
                          href={selectedUserForDetails.acceptanceExecutionDocument.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg border border-blue-100 transition-colors"
                        >
                          <FiEye /> View Signed PDF
                        </a>
                        <a 
                          href={selectedUserForDetails.acceptanceExecutionDocument.url} 
                          download={selectedUserForDetails.acceptanceExecutionDocument.fileName || 'Signed_Agreement.pdf'} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg border border-gray-200 transition-colors"
                        >
                          <FiDownload /> Download Signed PDF
                        </a>
                      </div>
                    </>
                  )}
                  {platformTemplate && (
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs text-gray-500 font-medium mb-1.5">Comparison Template</p>
                      <a 
                        href={platformTemplate.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-100 transition-colors"
                      >
                        <FiDownload /> View Platform Template for Comparison
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <div>
                  <span className="text-xs text-gray-500 font-medium mr-2">Status:</span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                    Pending Approval
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setActionModal({
                        isOpen: true,
                        type: "reject",
                        userId: selectedUserForDetails.id || selectedUserForDetails._id,
                        companyName: selectedUserForDetails.companyName,
                      });
                      setSelectedUserForDetails(null);
                    }} 
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-semibold text-sm transition-all"
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => {
                      setActionModal({
                        isOpen: true,
                        type: "approve",
                        userId: selectedUserForDetails.id || selectedUserForDetails._id,
                        companyName: selectedUserForDetails.companyName,
                      });
                      setSelectedUserForDetails(null);
                    }} 
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-all"
                  >
                    Approve
                  </button>
                  <button onClick={() => setSelectedUserForDetails(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-all">Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default PendingB2BApprovals;
