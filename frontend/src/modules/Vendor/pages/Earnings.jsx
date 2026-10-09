import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiDollarSign,
  FiTrendingUp,
  FiClock,
  FiCheckCircle,
  FiFileText,
  FiCreditCard,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiRefreshCw,
  FiAlertCircle,
  FiLock,
  FiFilter,
} from "react-icons/fi";
import { motion } from "framer-motion";
import Badge from "../../../shared/components/Badge";
import ExportButton from "../../Admin/components/ExportButton";
import AnimatedSelect from "../../Admin/components/AnimatedSelect";
import { formatPrice } from "../../../shared/utils/helpers";
import { useVendorAuthStore } from "../store/vendorAuthStore";
import {
  getVendorEarnings,
  getVendorWallet,
  getVendorTransactions,
  getVendorWithdrawals,
} from "../services/vendorService";
import RequestWithdrawalModal from "../components/finance/RequestWithdrawalModal";
import BankDetailsModal from "../components/finance/BankDetailsModal";

const Earnings = ({ defaultTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { vendor } = useVendorAuthStore();

  const getActiveTabFromUrl = useCallback(() => {
    if (defaultTab) return defaultTab;
    const path = location.pathname;
    if (path.includes("/wallet")) return "wallet";
    if (path.includes("/withdrawals")) return "withdrawals";
    if (path.includes("/transactions")) return "transactions";
    if (path.includes("/settlements") || path.includes("/settlement-history")) return "settlements";
    if (path.includes("/commission-history")) return "commission";
    return "overview";
  }, [defaultTab, location.pathname]);

  const [activeTab, setActiveTab] = useState(getActiveTabFromUrl());
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedTxType, setSelectedTxType] = useState("all");
  const [selectedWithdrawalStatus, setSelectedWithdrawalStatus] = useState("all");

  // Data states
  const [commissions, setCommissions] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [earningsSummary, setEarningsSummary] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(false);

  // Modals
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  useEffect(() => {
    setActiveTab(getActiveTabFromUrl());
  }, [getActiveTabFromUrl]);

  const vendorId = vendor?.id || vendor?._id;

  const fetchAllData = useCallback(async () => {
    if (!vendorId) return;
    setIsLoading(true);
    try {
      const [earningsRes, walletRes, txRes, wdRes] = await Promise.allSettled([
        getVendorEarnings(),
        getVendorWallet(),
        getVendorTransactions(),
        getVendorWithdrawals(),
      ]);

      if (earningsRes.status === "fulfilled") {
        const d = earningsRes.value?.data ?? earningsRes.value;
        setCommissions(d?.commissions ?? []);
        setSettlements(d?.settlements ?? []);
        setEarningsSummary(d?.summary ?? null);
      }

      if (walletRes.status === "fulfilled") {
        const d = walletRes.value?.data ?? walletRes.value;
        setWalletData(d ?? null);
      }

      if (txRes.status === "fulfilled") {
        const d = txRes.value?.data ?? txRes.value;
        setTransactions(d?.transactions ?? []);
      }

      if (wdRes.status === "fulfilled") {
        const d = wdRes.value?.data ?? wdRes.value;
        setWithdrawals(d?.withdrawals ?? []);
      }
    } catch {
      // toast handled by api
    } finally {
      setIsLoading(false);
      setIsRefreshingWallet(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleRefresh = async () => {
    setIsRefreshingWallet(true);
    await fetchAllData();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "overview") navigate("/vendor/earnings/overview");
    else if (tab === "wallet") navigate("/vendor/earnings/wallet");
    else if (tab === "withdrawals") navigate("/vendor/earnings/withdrawals");
    else if (tab === "transactions") navigate("/vendor/earnings/transactions");
    else if (tab === "settlements") navigate("/vendor/earnings/settlements");
    else if (tab === "commission") navigate("/vendor/earnings/commission-history");
  };

  const filteredCommissions = useMemo(() => {
    if (selectedStatus === "all") return commissions;
    return commissions.filter((c) => (c.effectiveStatus || c.status) === selectedStatus);
  }, [commissions, selectedStatus]);

  const filteredTransactions = useMemo(() => {
    if (selectedTxType === "all") return transactions;
    return transactions.filter((t) => t.type === selectedTxType);
  }, [transactions, selectedTxType]);

  const filteredWithdrawals = useMemo(() => {
    if (selectedWithdrawalStatus === "all") return withdrawals;
    return withdrawals.filter((w) => w.status === selectedWithdrawalStatus);
  }, [withdrawals, selectedWithdrawalStatus]);

  if (!vendorId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to view earnings</p>
      </div>
    );
  }

  const wallet = walletData?.wallet || {};
  const settings = walletData?.settings || {};
  const bankMasked = walletData?.bankDetailsMasked || {};
  const hasBank = walletData?.bankDetailsConfigured;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Finance & Earnings
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your wallet balances, track withdrawal requests, clearance periods, and ledger entries
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshingWallet}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${isRefreshingWallet ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setIsBankModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
          >
            <FiCreditCard className="w-3.5 h-3.5 text-purple-600" />
            <span>Bank Details</span>
          </button>
          <button
            onClick={() => setIsWithdrawModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
          >
            <FiArrowUpRight className="w-4 h-4" />
            <span>Request Withdrawal</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm border border-gray-200 dark:border-white/5 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-white/5 overflow-x-auto scrollbar-admin">
          <div className="flex -mx-1 px-3 min-w-max">
            <button
              onClick={() => handleTabChange("overview")}
              className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === "overview"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <FiDollarSign className="w-4 h-4" />
              <span>Earnings Overview</span>
            </button>
            <button
              onClick={() => handleTabChange("wallet")}
              className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === "wallet"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <FiCreditCard className="w-4 h-4" />
              <span>Wallet</span>
            </button>
            <button
              onClick={() => handleTabChange("withdrawals")}
              className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === "withdrawals"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <FiArrowUpRight className="w-4 h-4" />
              <span>Withdrawals</span>
              {walletData?.pendingWithdrawalsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">
                  {walletData.pendingWithdrawalsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange("transactions")}
              className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === "transactions"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <FiFileText className="w-4 h-4" />
              <span>Transactions</span>
            </button>
            <button
              onClick={() => handleTabChange("settlements")}
              className={`flex items-center gap-2 px-4 py-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === "settlements"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <FiCheckCircle className="w-4 h-4" />
              <span>Settlements</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {isLoading && !walletData ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-gray-500">Loading financial records...</p>
            </div>
          ) : (
            <>
              {/* ─── TAB: WALLET or OVERVIEW WALLET CARDS ─── */}
              {(activeTab === "overview" || activeTab === "wallet") && (
                <div className="space-y-6 mb-6">
                  {/* Ledger Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Available */}
                    <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          Available Balance
                        </span>
                        <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                          <FiCheckCircle className="w-4 h-4" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                        {formatPrice(wallet.available ?? 0)}
                      </p>
                      <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400/80 mt-1">
                        Cleared & ready for withdrawal
                      </p>
                    </div>

                    {/* On Hold */}
                    <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                          On Hold (Clearance)
                        </span>
                        <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
                          <FiClock className="w-4 h-4" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-amber-700 dark:text-amber-400">
                        {formatPrice(wallet.onHold ?? 0)}
                      </p>
                      <p className="text-[11px] text-amber-600/90 dark:text-amber-400/80 mt-1">
                        {settings.clearanceDays || 7}-day return window
                      </p>
                    </div>

                    {/* Reserved */}
                    <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
                          Under Processing
                        </span>
                        <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                          <FiArrowUpRight className="w-4 h-4" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-blue-700 dark:text-blue-400">
                        {formatPrice(wallet.reserved ?? 0)}
                      </p>
                      <p className="text-[11px] text-blue-600/90 dark:text-blue-400/80 mt-1">
                        Withdrawal requested
                      </p>
                    </div>

                    {/* Withdrawn */}
                    <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-purple-800 dark:text-purple-300">
                          Total Paid Out
                        </span>
                        <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
                          <FiDollarSign className="w-4 h-4" />
                        </div>
                      </div>
                      <p className="text-2xl font-black text-purple-700 dark:text-purple-400">
                        {formatPrice(wallet.withdrawn ?? 0)}
                      </p>
                      <p className="text-[11px] text-purple-600/90 dark:text-purple-400/80 mt-1">
                        Settled to bank account
                      </p>
                    </div>
                  </div>

                  {/* Bank & Policy Banner */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200/80 dark:border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-purple-600/10 text-purple-600 rounded-xl flex-shrink-0">
                        <FiLock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                          Payout Details & Clearance Policy
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {hasBank ? (
                            <>
                              Configured for: <strong>{bankMasked.bankName || "Bank"}</strong> (
                              {bankMasked.maskedAccountNumber || bankMasked.upiId})
                            </>
                          ) : (
                            <span className="text-amber-600 font-semibold">
                              No bank account configured. Please add bank details to receive payouts.
                            </span>
                          )}
                          {" • "}Clearance period: <strong>{settings.clearanceDays || 7} days</strong> post-delivery • Min. withdrawal: <strong>{formatPrice(settings.minWithdrawalAmount || 500)}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <button
                        onClick={() => setIsBankModalOpen(true)}
                        className="px-3.5 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 rounded-xl transition-colors whitespace-nowrap"
                      >
                        {hasBank ? "Edit Bank Details" : "Setup Bank Details"}
                      </button>
                      <button
                        onClick={() => setIsWithdrawModalOpen(true)}
                        disabled={!hasBank || (wallet.available ?? 0) < (settings.minWithdrawalAmount ?? 500)}
                        className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap"
                      >
                        Withdraw Now
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── TAB: WITHDRAWALS ─── */}
              {activeTab === "withdrawals" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        Withdrawal Requests
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        History of requested payouts and bank transfer tracking
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AnimatedSelect
                        value={selectedWithdrawalStatus}
                        onChange={(e) => setSelectedWithdrawalStatus(e.target.value)}
                        options={[
                          { value: "all", label: "All Statuses" },
                          { value: "pending", label: "Pending" },
                          { value: "approved", label: "Approved" },
                          { value: "paid", label: "Paid" },
                          { value: "rejected", label: "Rejected" },
                        ]}
                        className="min-w-[130px]"
                      />
                      <button
                        onClick={() => setIsWithdrawModalOpen(true)}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer"
                      >
                        + New Request
                      </button>
                    </div>
                  </div>

                  {filteredWithdrawals.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-semibold">
                          <tr>
                            <th className="p-3.5">Withdrawal ID</th>
                            <th className="p-3.5">Requested Date</th>
                            <th className="p-3.5">Amount</th>
                            <th className="p-3.5">Destination</th>
                            <th className="p-3.5">Status</th>
                            <th className="p-3.5">Reference / UTR</th>
                            <th className="p-3.5">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-800 dark:text-gray-200">
                          {filteredWithdrawals.map((w) => (
                            <tr key={w._id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                              <td className="p-3.5 font-mono font-bold text-purple-600 dark:text-purple-400">
                                {w.withdrawalId}
                              </td>
                              <td className="p-3.5 text-gray-500">
                                {new Date(w.createdAt).toLocaleDateString()}
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
                              <td className="p-3.5 text-gray-500 max-w-[200px] truncate">
                                {w.rejectionReason ? (
                                  <span className="text-red-500">Rejected: {w.rejectionReason}</span>
                                ) : (
                                  w.adminNotes || w.vendorNotes || "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 rounded-xl bg-gray-50/50 dark:bg-white/5">
                      <FiArrowUpRight className="text-3xl text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No withdrawal requests found</p>
                      <p className="text-xs text-gray-400 mt-1">
                        When you request a payout from your available balance, it will appear here.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: TRANSACTIONS (LEDGER) ─── */}
              {activeTab === "transactions" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        Financial Ledger & Transactions
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Immutable record of all earnings, clearances, reservations, and payouts
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AnimatedSelect
                        value={selectedTxType}
                        onChange={(e) => setSelectedTxType(e.target.value)}
                        options={[
                          { value: "all", label: "All Types" },
                          { value: "EARNING_ON_HOLD", label: "Earning On Hold" },
                          { value: "EARNING_CLEARED", label: "Earning Cleared" },
                          { value: "WITHDRAWAL_REQUEST", label: "Withdrawal Reserved" },
                          { value: "WITHDRAWAL_PAID", label: "Withdrawal Paid" },
                          { value: "WITHDRAWAL_REJECTED", label: "Withdrawal Rejected" },
                          { value: "RETURN_DEDUCTION", label: "Return Deduction" },
                        ]}
                        className="min-w-[150px]"
                      />
                      <ExportButton
                        data={filteredTransactions}
                        headers={[
                          { label: "Date", accessor: (r) => new Date(r.createdAt).toLocaleString() },
                          { label: "Type", accessor: (r) => r.type },
                          { label: "Amount", accessor: (r) => r.amount },
                          { label: "Description", accessor: (r) => r.description },
                          { label: "Reference", accessor: (r) => r.referenceNumber || r.referenceId },
                        ]}
                        filename="vendor-transactions"
                      />
                    </div>
                  </div>

                  {filteredTransactions.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-semibold">
                          <tr>
                            <th className="p-3.5">Timestamp</th>
                            <th className="p-3.5">Type</th>
                            <th className="p-3.5">Amount</th>
                            <th className="p-3.5">Description</th>
                            <th className="p-3.5">Reference</th>
                            <th className="p-3.5">Balance Snapshot</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-800 dark:text-gray-200">
                          {filteredTransactions.map((tx) => {
                            const isCredit =
                              tx.type === "EARNING_CLEARED" || tx.type === "WITHDRAWAL_REJECTED";
                            const isHold = tx.type === "EARNING_ON_HOLD";
                            return (
                              <tr key={tx._id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                <td className="p-3.5 text-gray-500 whitespace-nowrap">
                                  {new Date(tx.createdAt).toLocaleString()}
                                </td>
                                <td className="p-3.5">
                                  <Badge
                                    variant={
                                      tx.type.includes("PAID")
                                        ? "success"
                                        : tx.type.includes("CLEARED")
                                        ? "info"
                                        : tx.type.includes("REJECTED") || tx.type.includes("DEDUCTION")
                                        ? "error"
                                        : "warning"
                                    }
                                  >
                                    {tx.type.replace(/_/g, " ")}
                                  </Badge>
                                </td>
                                <td className="p-3.5 font-bold whitespace-nowrap">
                                  <span
                                    className={
                                      isCredit
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : isHold
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-gray-900 dark:text-white"
                                    }
                                  >
                                    {isCredit ? "+" : isHold ? "•" : "-"}{formatPrice(tx.amount)}
                                  </span>
                                </td>
                                <td className="p-3.5 max-w-[280px] text-gray-700 dark:text-gray-300">
                                  {tx.description}
                                </td>
                                <td className="p-3.5 font-mono text-[11px] text-purple-600 dark:text-purple-400">
                                  {tx.referenceNumber || (tx.referenceId ? String(tx.referenceId).slice(-6) : "—")}
                                </td>
                                <td className="p-3.5 text-[11px] text-gray-500 whitespace-nowrap">
                                  Avail: {formatPrice(tx.balanceSnapshot?.available || 0)} | Hold: {formatPrice(tx.balanceSnapshot?.onHold || 0)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 rounded-xl bg-gray-50/50 dark:bg-white/5">
                      <FiFileText className="text-3xl text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No transactions recorded yet</p>
                      <p className="text-xs text-gray-400 mt-1">
                        All ledger events such as orders, clearances, and payouts will appear here.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: SETTLEMENTS ─── */}
              {activeTab === "settlements" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        Settlement Records
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Record of completed bank payouts with bank UTR and references
                      </p>
                    </div>
                    <ExportButton
                      data={settlements}
                      headers={[
                        { label: "Date", accessor: (r) => new Date(r.createdAt).toLocaleDateString() },
                        { label: "Amount", accessor: (r) => r.amount },
                        { label: "Method", accessor: (r) => r.paymentMethod },
                        { label: "UTR", accessor: (r) => r.utr || r.transactionId },
                        { label: "Status", accessor: (r) => r.status },
                      ]}
                      filename="vendor-settlements"
                    />
                  </div>

                  {settlements.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-semibold">
                          <tr>
                            <th className="p-3.5">Date Paid</th>
                            <th className="p-3.5">Net Paid Amount</th>
                            <th className="p-3.5">Method</th>
                            <th className="p-3.5">UTR / Bank Ref</th>
                            <th className="p-3.5">Status</th>
                            <th className="p-3.5">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-800 dark:text-gray-200">
                          {settlements.map((s) => (
                            <tr key={s._id || s.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                              <td className="p-3.5 text-gray-500 whitespace-nowrap">
                                {new Date(s.paidAt || s.createdAt).toLocaleDateString()}
                              </td>
                              <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                                {formatPrice(s.amount)}
                              </td>
                              <td className="p-3.5 uppercase text-gray-600 dark:text-gray-300 font-medium">
                                {s.paymentMethod?.replace(/_/g, " ")}
                              </td>
                              <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                                {s.utr || s.transactionId || "—"}
                              </td>
                              <td className="p-3.5">
                                <Badge variant={s.status === "failed" ? "error" : "success"}>
                                  {String(s.status || "completed").toUpperCase()}
                                </Badge>
                              </td>
                              <td className="p-3.5 text-gray-500 max-w-[200px] truncate">
                                {s.notes || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 rounded-xl bg-gray-50/50 dark:bg-white/5">
                      <FiCheckCircle className="text-3xl text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No settlement records yet</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Settlements will be recorded once your withdrawal requests are transferred by admin.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── TAB: OVERVIEW or COMMISSION HISTORY ─── */}
              {(activeTab === "overview" || activeTab === "commission") && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        Order Commission History
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Itemized breakdown of earnings and platform commissions per order
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AnimatedSelect
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        options={[
                          { value: "all", label: "All Statuses" },
                          { value: "pending", label: "Pending" },
                          { value: "paid", label: "Paid" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                        className="min-w-[130px]"
                      />
                      <ExportButton
                        data={filteredCommissions}
                        headers={[
                          {
                            label: "Order",
                            accessor: (row) =>
                              row.orderDisplayId ||
                              (typeof row.orderId === "object"
                                ? row.orderId?.orderId || row.orderId?._id
                                : row.orderId),
                          },
                          { label: "Date", accessor: (row) => new Date(row.createdAt).toLocaleDateString() },
                          { label: "Subtotal", accessor: (row) => formatPrice(row.subtotal) },
                          { label: "Commission", accessor: (row) => formatPrice(row.commission) },
                          { label: "Your Earnings", accessor: (row) => formatPrice(row.vendorEarnings) },
                          { label: "Status", accessor: (row) => row.status },
                        ]}
                        filename="vendor-commissions"
                      />
                    </div>
                  </div>

                  {filteredCommissions.length > 0 ? (
                    <div className="space-y-3">
                      {filteredCommissions.map((commission) => (
                        <div
                          key={commission._id ?? commission.id}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200/70 dark:border-white/5 hover:bg-gray-100/70 dark:hover:bg-white/10 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                                {commission.orderDisplayId ||
                                  (typeof commission.orderId === "object"
                                    ? commission.orderId?.orderId || commission.orderId?._id
                                    : commission.orderId)}
                              </h3>
                              <Badge
                                variant={
                                  (commission.effectiveStatus || commission.status) === "paid"
                                    ? "success"
                                    : (commission.effectiveStatus || commission.status) === "pending"
                                    ? "warning"
                                    : "error"
                                }
                              >
                                {(commission.effectiveStatus || commission.status)?.toUpperCase()}
                              </Badge>
                              {commission.clearanceStatus && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 font-semibold uppercase">
                                  {commission.clearanceStatus.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div>
                                <p className="text-gray-500">Date</p>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">
                                  {new Date(commission.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Subtotal</p>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">
                                  {formatPrice(commission.subtotal)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Commission ({commission.commissionRate}%)</p>
                                <p className="font-semibold text-red-500">
                                  -{formatPrice(commission.commission)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Net Seller Earnings</p>
                                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatPrice(commission.vendorEarnings)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div>
                            <button
                              onClick={() =>
                                navigate(`/vendor/orders/${commission.orderRef || commission.orderId}`)
                              }
                              className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
                            >
                              View Order
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 rounded-xl bg-gray-50/50 dark:bg-white/5">
                      <FiFileText className="text-3xl text-gray-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No commission records found</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Commissions will appear here once orders are placed for your products.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <RequestWithdrawalModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        walletData={walletData}
        onWithdrawalSuccess={handleRefresh}
        onOpenBankModal={() => {
          setIsWithdrawModalOpen(false);
          setIsBankModalOpen(true);
        }}
      />

      <BankDetailsModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        onUpdated={handleRefresh}
      />
    </motion.div>
  );
};

export default Earnings;
