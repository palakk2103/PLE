import { useState, useEffect, useCallback } from "react";
import {
  FiSearch,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiAlertTriangle,
  FiUser,
  FiShoppingBag,
  FiRefreshCw,
  FiFilter,
  FiMail,
  FiPhone,
  FiPackage,
  FiCalendar,
  FiMessageSquare,
  FiShield
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";

const AccountDeletionRequestsDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // 'all', 'customer', 'vendor'
  const [statusFilter, setStatusFilter] = useState("PENDING"); // 'all', 'PENDING', 'APPROVED', 'REJECTED'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Action Modals State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject'
  const [adminRemarks, setAdminRemarks] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        role: roleFilter !== "all" ? roleFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      };

      const res = await api.get("/admin/account-deletion-requests", { params });
      if (res?.data) {
        setRequests(res.data.requests || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
        }
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load deletion requests");
    } finally {
      setIsLoading(false);
    }
  }, [page, roleFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenActionModal = (request, type) => {
    setSelectedRequest(request);
    setActionType(type);
    setAdminRemarks(type === "approve" ? "Approved by Admin" : "");
  };

  const handleCloseActionModal = () => {
    setSelectedRequest(null);
    setActionType(null);
    setAdminRemarks("");
    setIsProcessingAction(false);
  };

  const handleConfirmAction = async () => {
    if (!selectedRequest || !actionType) return;

    if (actionType === "reject" && !adminRemarks.trim()) {
      toast.error("Please provide a reason for rejecting the deletion request.");
      return;
    }

    setIsProcessingAction(true);
    try {
      const endpoint = `/admin/account-deletion-requests/${selectedRequest._id}/${actionType}`;
      const payload = { adminRemarks: adminRemarks.trim() };

      const res = await api.post(endpoint, payload);
      toast.success(
        res?.message ||
          (actionType === "approve"
            ? "Account deletion approved and account closed successfully."
            : "Deletion request rejected successfully.")
      );

      handleCloseActionModal();
      await fetchRequests();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${actionType} deletion request`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center text-xl font-bold">
              <FiShield />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Account Deletion Requests</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Review and approve/reject account deletion requests submitted by customers and sellers
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchRequests}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors self-start md:self-auto disabled:opacity-50"
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => {
            setStatusFilter("PENDING");
            setPage(1);
          }}
          className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all shadow-xs ${
            statusFilter === "PENDING"
              ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-400"
              : "bg-white border-gray-200 hover:border-amber-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Review</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-base">
              <FiClock />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-950 mt-2">{counts.pending}</p>
          <p className="text-[11px] text-amber-700 mt-1">Requires admin verification</p>
        </div>

        <div
          onClick={() => {
            setStatusFilter("APPROVED");
            setPage(1);
          }}
          className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all shadow-xs ${
            statusFilter === "APPROVED"
              ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400"
              : "bg-white border-gray-200 hover:border-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Approved / Deleted</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-base">
              <FiCheckCircle />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-950 mt-2">{counts.approved}</p>
          <p className="text-[11px] text-emerald-700 mt-1">Accounts permanently closed</p>
        </div>

        <div
          onClick={() => {
            setStatusFilter("REJECTED");
            setPage(1);
          }}
          className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all shadow-xs ${
            statusFilter === "REJECTED"
              ? "bg-rose-50/70 border-rose-300 ring-2 ring-rose-400"
              : "bg-white border-gray-200 hover:border-rose-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Rejected Requests</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center text-base">
              <FiXCircle />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-950 mt-2">{counts.rejected}</p>
          <p className="text-[11px] text-rose-700 mt-1">Accounts kept active</p>
        </div>

        <div
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
          className={`cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all shadow-xs ${
            statusFilter === "all"
              ? "bg-gray-100 border-gray-300 ring-2 ring-gray-400"
              : "bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Total Submissions</span>
            <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center text-base">
              <FiFilter />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-2">{counts.total}</p>
          <p className="text-[11px] text-gray-500 mt-1">All historical requests</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Role Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
          {[
            { id: "all", label: "All Users" },
            { id: "customer", label: "Customers", icon: FiUser },
            { id: "vendor", label: "Vendors / Sellers", icon: FiShoppingBag },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setRoleFilter(tab.id);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  isActive ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {Icon && <Icon className="text-sm" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="Search by name, email, phone, store..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7B0A0A] focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 shrink-0">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#7B0A0A]"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved / Closed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs">
            <FiRefreshCw className="w-8 h-8 text-[#7B0A0A] animate-spin mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700">Loading deletion requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto text-xl">
              <FiCheckCircle />
            </div>
            <h3 className="font-bold text-gray-800 text-base">No Deletion Requests Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              There are currently no account deletion requests matching your chosen filters.
            </p>
          </div>
        ) : (
          requests.map((item) => {
            const isPending = item.status === "PENDING";
            const isApproved = item.status === "APPROVED";
            const isRejected = item.status === "REJECTED";
            const isCancelled = item.status === "CANCELLED";
            const activeOrders = item.metrics?.activeOrdersCount || 0;
            const totalProducts = item.metrics?.totalProductsCount || 0;

            return (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow p-5 space-y-4"
              >
                {/* Top Row: User & Role Badge & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                        item.role === "vendor"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {item.role === "vendor" ? <FiShoppingBag /> : <FiUser />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-gray-900 text-base">
                          {item.requesterInfo?.storeName
                            ? `${item.requesterInfo.storeName} (${item.requesterInfo.name})`
                            : item.requesterInfo?.name || "Unknown Requester"}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.role === "vendor"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {item.role === "vendor" ? "Vendor / Seller" : "Customer"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <FiMail className="text-gray-400" />
                          <span>{item.requesterInfo?.email || "No email"}</span>
                        </span>
                        {item.requesterInfo?.phone && (
                          <span className="flex items-center gap-1">
                            <FiPhone className="text-gray-400" />
                            <span>{item.requesterInfo.phone}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FiCalendar className="text-gray-400" />
                          <span>
                            Requested:{" "}
                            {new Date(item.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                        <FiClock />
                        <span>Pending Admin Review</span>
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <FiCheckCircle />
                        <span>Approved & Closed</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-300">
                        <FiXCircle />
                        <span>Declined by Admin</span>
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-300">
                        <span>Cancelled by User</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Content: Reason & Operational Safety Metrics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left 2 cols: Reason & Feedback */}
                  <div className="lg:col-span-2 bg-gray-50/80 rounded-xl p-3.5 border border-gray-150 space-y-2">
                    <div>
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                        Reason For Deletion:
                      </span>
                      <p className="text-sm font-bold text-gray-800 mt-0.5">{item.reason}</p>
                    </div>
                    {item.additionalFeedback && (
                      <div>
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                          Additional Feedback:
                        </span>
                        <p className="text-xs text-gray-600 mt-0.5 italic leading-relaxed">
                          "{item.additionalFeedback}"
                        </p>
                      </div>
                    )}

                    {/* Admin remarks if already reviewed */}
                    {(isApproved || isRejected) && item.adminRemarks && (
                      <div className="pt-2 border-t border-gray-200 text-xs">
                        <span className="font-bold text-gray-700">Admin Remarks: </span>
                        <span className={isApproved ? "text-emerald-700 font-medium" : "text-rose-700 font-medium"}>
                          {item.adminRemarks}
                        </span>
                        {item.reviewedBy?.name && (
                          <span className="text-gray-400 ml-1.5 font-normal">
                            (by {item.reviewedBy.name})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right 1 col: Operational Warning Metrics */}
                  <div className="bg-white rounded-xl p-3.5 border border-gray-200 flex flex-col justify-between space-y-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Live Account Risk Check:
                    </span>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Active / Ongoing Orders:</span>
                        <span
                          className={`font-black px-2 py-0.5 rounded-full ${
                            activeOrders > 0
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {activeOrders} Orders
                        </span>
                      </div>

                      {item.role === "vendor" && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Catalog Products:</span>
                          <span className="font-bold text-gray-800">{totalProducts} Products</span>
                        </div>
                      )}
                    </div>

                    {activeOrders > 0 && isPending && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 p-1.5 rounded-lg border border-red-200">
                        <FiAlertTriangle className="shrink-0" />
                        <span>Warning: User has {activeOrders} active order(s). Verify fulfillment first!</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row Actions for PENDING requests */}
                {isPending && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenActionModal(item, "reject")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl shadow-xs transition-colors"
                    >
                      <FiXCircle />
                      <span>Decline Request</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenActionModal(item, "approve")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
                    >
                      <FiCheckCircle />
                      <span>Approve & Close Account</span>
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      <AnimatePresence>
        {selectedRequest && actionType && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-gray-200 space-y-4 my-auto"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 ${
                    actionType === "approve"
                      ? "bg-red-100 text-red-600"
                      : "bg-rose-100 text-rose-600"
                  }`}
                >
                  {actionType === "approve" ? <FiTrash2 /> : <FiAlertTriangle />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {actionType === "approve"
                      ? "Confirm Account Deletion Approval"
                      : "Reject Account Deletion Request"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Target:{" "}
                    <strong>
                      {selectedRequest.requesterInfo?.storeName || selectedRequest.requesterInfo?.name}
                    </strong>{" "}
                    ({selectedRequest.requesterInfo?.email})
                  </p>
                </div>
              </div>

              {actionType === "approve" ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 space-y-1">
                  <p className="font-bold">⚠️ Warning: Irreversible Action</p>
                  <p className="leading-relaxed">
                    Approving this request will immediately deactivate the user/vendor account, invalidate their login sessions, unlist their products (if seller), and send an account closure notification.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                  <p>
                    The account will remain active. The reason entered below will be displayed to the user/vendor and sent via email/notification.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  {actionType === "approve"
                    ? "Admin Remarks (Optional)"
                    : "Rejection Reason (Required) *"}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    actionType === "approve"
                      ? "e.g., Verified no active disputes or settlements pending."
                      : "e.g., Cannot process deletion because you have 2 pending active orders."
                  }
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7B0A0A] text-xs sm:text-sm bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={handleConfirmAction}
                  className={`flex-1 py-3 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                    actionType === "approve"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {isProcessingAction ? (
                    <FiRefreshCw className="animate-spin text-sm" />
                  ) : actionType === "approve" ? (
                    <FiCheckCircle />
                  ) : (
                    <FiXCircle />
                  )}
                  <span>
                    {isProcessingAction
                      ? "Processing..."
                      : actionType === "approve"
                      ? "Approve & Delete"
                      : "Confirm Rejection"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isProcessingAction}
                  onClick={handleCloseActionModal}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm transition-colors text-center"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountDeletionRequestsDashboard;
