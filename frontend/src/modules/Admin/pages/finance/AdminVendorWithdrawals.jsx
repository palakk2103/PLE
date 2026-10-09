import { useState, useEffect, useCallback } from "react";
import {
  FiArrowUpRight,
  FiSearch,
  FiCheck,
  FiX,
  FiDollarSign,
  FiCreditCard,
  FiClock,
  FiAlertCircle,
  FiEye,
  FiRefreshCw,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Badge from "../../../../shared/components/Badge";
import ExportButton from "../../components/ExportButton";
import AnimatedSelect from "../../components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";
import {
  getAdminWithdrawals,
  getAdminWithdrawalById,
  approveAdminWithdrawal,
  rejectAdminWithdrawal,
  recordAdminManualPayout,
} from "../../services/adminService";
import toast from "react-hot-toast";

const AdminVendorWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [withdrawalDetail, setWithdrawalDetail] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Forms state
  const [payoutForm, setPayoutForm] = useState({
    paymentMethod: "bank_transfer",
    utr: "",
    paidAmount: "",
    notes: "",
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const fetchWithdrawals = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await getAdminWithdrawals({
        page,
        limit: 20,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchTerm.trim() || undefined,
      });
      const data = res?.data ?? res;
      setWithdrawals(data?.withdrawals ?? []);
      setPagination(data?.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to fetch withdrawals");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchWithdrawals(1);
  }, [fetchWithdrawals]);

  const handleOpenDetail = async (item) => {
    setSelectedWithdrawal(item);
    setIsDetailModalOpen(true);
    try {
      const res = await getAdminWithdrawalById(item._id);
      setWithdrawalDetail(res?.data ?? res);
    } catch (err) {
      toast.error("Failed to load withdrawal details");
    }
  };

  const handleApprove = async (item) => {
    if (!window.confirm(`Are you sure you want to approve withdrawal request ${item.withdrawalId} for ${formatPrice(item.requestedAmount)}?`)) {
      return;
    }
    setIsSubmittingAction(true);
    try {
      await approveAdminWithdrawal(item._id);
      toast.success(`Withdrawal ${item.withdrawalId} approved!`);
      fetchWithdrawals(pagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to approve withdrawal");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleOpenReject = (item) => {
    setSelectedWithdrawal(item);
    setRejectionReason("");
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setIsSubmittingAction(true);
    try {
      await rejectAdminWithdrawal(selectedWithdrawal._id, { reason: rejectionReason.trim() });
      toast.success(`Withdrawal ${selectedWithdrawal.withdrawalId} rejected. Funds restored to seller.`);
      setIsRejectModalOpen(false);
      fetchWithdrawals(pagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reject withdrawal");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleOpenPayout = (item) => {
    setSelectedWithdrawal(item);
    setPayoutForm({
      paymentMethod: item.paymentMethod || "bank_transfer",
      utr: "",
      paidAmount: String(item.requestedAmount),
      notes: `Manual bank payout for ${item.withdrawalId}`,
    });
    setIsPayoutModalOpen(true);
  };

  const handleConfirmPayout = async (e) => {
    e.preventDefault();
    if (!payoutForm.utr.trim()) {
      toast.error("Please enter the bank UTR / Reference number.");
      return;
    }

    setIsSubmittingAction(true);
    try {
      await recordAdminManualPayout(selectedWithdrawal._id, {
        paymentMethod: payoutForm.paymentMethod,
        utr: payoutForm.utr.trim(),
        paidAmount: parseFloat(payoutForm.paidAmount) || selectedWithdrawal.requestedAmount,
        notes: payoutForm.notes,
      });
      toast.success(`Payout recorded! Settlement created with UTR: ${payoutForm.utr.trim()}`);
      setIsPayoutModalOpen(false);
      fetchWithdrawals(pagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to record manual payout");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Vendor Withdrawal Requests
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Review, approve, reject and record manual bank payouts (NEFT / IMPS / UPI) with UTR verification
          </p>
        </div>

        <button
          onClick={() => fetchWithdrawals(pagination.page)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Withdrawal ID or UTR..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <AnimatedSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "paid", label: "Paid" },
              { value: "rejected", label: "Rejected" },
            ]}
            className="min-w-[130px]"
          />

          <ExportButton
            data={withdrawals}
            headers={[
              { label: "Withdrawal ID", accessor: (r) => r.withdrawalId },
              { label: "Vendor", accessor: (r) => r.vendorId?.storeName || r.vendorId?.email },
              { label: "Amount", accessor: (r) => r.requestedAmount },
              { label: "Status", accessor: (r) => r.status },
              { label: "UTR", accessor: (r) => r.utr || "N/A" },
              { label: "Requested At", accessor: (r) => new Date(r.createdAt).toLocaleString() },
            ]}
            filename="vendor-withdrawals"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
        {isLoading && withdrawals.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500">
            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading withdrawal requests...
          </div>
        ) : withdrawals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-semibold">
                <tr>
                  <th className="p-3.5">Withdrawal ID</th>
                  <th className="p-3.5">Seller / Store</th>
                  <th className="p-3.5">Requested Amount</th>
                  <th className="p-3.5">Bank Destination</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">UTR / Ref</th>
                  <th className="p-3.5">Requested Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-800 dark:text-gray-200">
                {withdrawals.map((w) => (
                  <tr key={w._id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-purple-600 dark:text-purple-400">
                      {w.withdrawalId}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {w.vendorId?.storeName || "Vendor"}
                      </div>
                      <div className="text-[11px] text-gray-400">{w.vendorId?.email}</div>
                    </td>
                    <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                      {formatPrice(w.requestedAmount)}
                    </td>
                    <td className="p-3.5">
                      <div className="text-[11px]">
                        <span className="font-semibold block">{w.bankDetailsSnapshot?.bankName || "Bank"}</span>
                        <span className="text-gray-400 font-mono">
                          {w.bankDetailsSnapshot?.maskedAccountNumber || w.bankDetailsSnapshot?.upiId}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <Badge
                        variant={
                          w.status === "paid"
                            ? "success"
                            : w.status === "approved"
                            ? "info"
                            : w.status === "rejected"
                            ? "error"
                            : "warning"
                        }
                      >
                        {w.status?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">
                      {w.utr ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{w.utr}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-gray-500 whitespace-nowrap">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(w)}
                          title="View Details"
                          className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>

                        {w.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(w)}
                              disabled={isSubmittingAction}
                              title="Approve Request"
                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOpenReject(w)}
                              disabled={isSubmittingAction}
                              title="Reject Request"
                              className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {["pending", "approved"].includes(w.status) && (
                          <button
                            onClick={() => handleOpenPayout(w)}
                            disabled={isSubmittingAction}
                            title="Record Payout (UTR)"
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <FiCheck className="w-3 h-3" /> Payout
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-gray-500">
            <FiArrowUpRight className="text-3xl text-gray-400 mx-auto mb-2" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">No withdrawal requests found</p>
          </div>
        )}
      </div>

      {/* DETAIL MODAL (With full unmasked bank account info for Admin) */}
      <AnimatePresence>
        {isDetailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-purple-50/50 dark:bg-white/5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FiCreditCard className="text-purple-600" />
                  <span>Withdrawal Request {selectedWithdrawal?.withdrawalId}</span>
                </h3>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setWithdrawalDetail(null);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* Amount Header */}
                <div className="p-4 bg-purple-50/50 dark:bg-white/5 rounded-xl border border-purple-100 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-gray-500">Requested Amount:</span>
                    <p className="text-xl font-extrabold text-purple-700 dark:text-purple-300">
                      {formatPrice(selectedWithdrawal?.requestedAmount)}
                    </p>
                  </div>
                  <div>
                    <Badge variant={selectedWithdrawal?.status === "paid" ? "success" : "warning"}>
                      {selectedWithdrawal?.status?.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Seller & Bank Info */}
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                  <h4 className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Verified Bank Payout Destination
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300">
                    <div>
                      <span className="text-gray-400 block">Bank Name:</span>
                      <strong className="text-gray-800 dark:text-gray-100">
                        {withdrawalDetail?.vendorBankDetails?.bankName || selectedWithdrawal?.bankDetailsSnapshot?.bankName || "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Account Holder:</span>
                      <strong className="text-gray-800 dark:text-gray-100">
                        {withdrawalDetail?.vendorBankDetails?.accountName || selectedWithdrawal?.bankDetailsSnapshot?.accountName || "—"}
                      </strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 block">Account Number (Authorized Admin View):</span>
                      <span className="font-mono font-bold text-sm text-purple-700 dark:text-purple-300 bg-purple-100/50 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                        {withdrawalDetail?.vendorBankDetails?.accountNumber || selectedWithdrawal?.bankDetailsSnapshot?.maskedAccountNumber || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">IFSC Code:</span>
                      <span className="font-mono font-bold">
                        {withdrawalDetail?.vendorBankDetails?.ifscCode || selectedWithdrawal?.bankDetailsSnapshot?.ifscCode || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">UPI ID:</span>
                      <span className="font-mono">
                        {withdrawalDetail?.vendorBankDetails?.upiId || selectedWithdrawal?.bankDetailsSnapshot?.upiId || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vendor Contact */}
                <div className="text-gray-600 dark:text-gray-400 space-y-1">
                  <p><strong>Store:</strong> {selectedWithdrawal?.vendorId?.storeName}</p>
                  <p><strong>Email:</strong> {selectedWithdrawal?.vendorId?.email}</p>
                  {selectedWithdrawal?.vendorId?.phone && <p><strong>Phone:</strong> {selectedWithdrawal?.vendorId?.phone}</p>}
                  {selectedWithdrawal?.utr && (
                    <p className="text-emerald-600 font-bold"><strong>UTR Number:</strong> {selectedWithdrawal.utr}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECORD PAYOUT MODAL */}
      <AnimatePresence>
        {isPayoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-emerald-50/50 dark:bg-white/5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FiCheck className="text-emerald-600" />
                  <span>Record Manual Bank Payout</span>
                </h3>
                <button
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmPayout} className="p-6 space-y-4 text-xs">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <p className="text-emerald-800 dark:text-emerald-300 font-medium">
                    Paying <strong>{selectedWithdrawal?.vendorId?.storeName}</strong> an amount of{" "}
                    <strong>{formatPrice(selectedWithdrawal?.requestedAmount)}</strong>
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Bank Reference / UTR Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={payoutForm.utr}
                    onChange={(e) => setPayoutForm({ ...payoutForm, utr: e.target.value })}
                    placeholder="e.g. UTR20261007987654"
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl font-mono uppercase font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                    required
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Unique transaction reference from your bank portal.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={payoutForm.paymentMethod}
                      onChange={(e) => setPayoutForm({ ...payoutForm, paymentMethod: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none"
                    >
                      <option value="neft">NEFT</option>
                      <option value="imps">IMPS</option>
                      <option value="rtgs">RTGS</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Paid Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={payoutForm.paidAmount}
                      onChange={(e) => setPayoutForm({ ...payoutForm, paidAmount: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl font-bold focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Internal Notes
                  </label>
                  <textarea
                    value={payoutForm.notes}
                    onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl resize-none focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPayoutModalOpen(false)}
                    className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/20"
                  >
                    {isSubmittingAction ? "Processing..." : "Complete & Record Payout"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REJECT MODAL */}
      <AnimatePresence>
        {isRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-red-50/50 dark:bg-white/5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FiAlertCircle className="text-red-600" />
                  <span>Reject Withdrawal Request</span>
                </h3>
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmReject} className="p-6 space-y-4 text-xs">
                <p className="text-gray-600 dark:text-gray-300">
                  Rejecting this withdrawal will restore <strong>{formatPrice(selectedWithdrawal?.requestedAmount)}</strong> back to the seller&apos;s available wallet balance.
                </p>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Invalid bank account IFSC code, pending customer dispute..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-600/30"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRejectModalOpen(false)}
                    className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAction}
                    className="px-5 py-2 font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-lg shadow-red-600/20"
                  >
                    {isSubmittingAction ? "Rejecting..." : "Confirm Rejection"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminVendorWithdrawals;
