import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiDollarSign,
  FiClock,
  FiCheckCircle,
  FiArrowUpRight,
  FiSettings,
  FiUsers,
  FiRefreshCw,
  FiFileText,
  FiShield,
  FiSave,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { formatPrice } from "../../../../shared/utils/helpers";
import {
  getAdminFinanceOverview,
  updateAdminPayoutSettings,
} from "../../services/adminService";
import toast from "react-hot-toast";

const AdminFinanceOverview = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    clearanceDays: 7,
    minWithdrawalAmount: 500,
    maxWithdrawalAmount: 1000000,
    payoutNotice: "",
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await getAdminFinanceOverview();
      const payload = res?.data ?? res;
      setData(payload);
      if (payload?.settings) {
        setSettingsForm({
          clearanceDays: payload.settings.clearanceDays ?? 7,
          minWithdrawalAmount: payload.settings.minWithdrawalAmount ?? 500,
          maxWithdrawalAmount: payload.settings.maxWithdrawalAmount ?? 1000000,
          payoutNotice: payload.settings.payoutNotice || "",
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load finance overview");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateAdminPayoutSettings(settingsForm);
      toast.success("Payout settings updated successfully!");
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update payout settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const overview = data?.overview || {};
  const withdrawals = data?.withdrawals || {};
  const settlements = data?.settlements || {};

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Finance & Seller Payouts Overview
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time multi-vendor wallet ledger balances, clearance periods, and manual payout configuration
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Sync Balances</span>
        </button>
      </div>

      {/* Main Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available to Withdraw */}
        <div className="p-5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Total Cleared (Available)
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <FiCheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {formatPrice(overview.available ?? 0)}
          </p>
          <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400/80 mt-1">
            Eligible across all sellers
          </p>
        </div>

        {/* On Hold in Clearance */}
        <div className="p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
              On Hold (Clearance Period)
            </span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
              <FiClock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-400">
            {formatPrice(overview.onHold ?? 0)}
          </p>
          <p className="text-[11px] text-amber-600/90 dark:text-amber-400/80 mt-1">
            Delivered, in return window
          </p>
        </div>

        {/* Reserved for Withdrawal */}
        <div className="p-5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
              Pending Payouts (Reserved)
            </span>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
              <FiArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-400">
            {formatPrice(overview.reserved ?? 0)}
          </p>
          <p className="text-[11px] text-blue-600/90 dark:text-blue-400/80 mt-1">
            {withdrawals.pendingCount ?? 0} request(s) awaiting payout
          </p>
        </div>

        {/* Total Settled / Paid Out */}
        <div className="p-5 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-800 dark:text-purple-300">
              Total Settled (Paid Out)
            </span>
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
              <FiDollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-700 dark:text-purple-400">
            {formatPrice(overview.withdrawn ?? 0)}
          </p>
          <p className="text-[11px] text-purple-600/90 dark:text-purple-400/80 mt-1">
            {settlements.count ?? 0} manual payout settlements
          </p>
        </div>
      </div>

      {/* Secondary Stats & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Action Card */}
        <div className="p-6 bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FiArrowUpRight className="text-purple-600" />
              <span>Withdrawal Actions Needed</span>
            </h3>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
              {withdrawals.pendingCount || 0} Pending
            </span>
          </div>

          <div className="p-4 bg-purple-50/50 dark:bg-white/5 rounded-xl border border-purple-100 dark:border-white/5">
            <p className="text-xs text-gray-600 dark:text-gray-300">Pending Amount Requiring Transfer:</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
              {formatPrice(withdrawals.pendingAmount || 0)}
            </p>
          </div>

          <div className="space-y-2">
            <Link
              to="/admin/finance/vendor-withdrawals"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md shadow-purple-600/20 transition-all"
            >
              Review & Process Withdrawals
            </Link>
            <Link
              to="/admin/finance/settlements"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
            >
              View Settlement Records
            </Link>
          </div>
        </div>

        {/* Payout & Clearance Settings Form */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-200 dark:border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-600/10 text-purple-600 rounded-xl">
                <FiSettings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Seller Payout & Clearance Rules
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Global settings governing seller earnings lifecycle and withdrawal eligibility
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Clearance Window (Days after Delivery)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={settingsForm.clearanceDays}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, clearanceDays: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                    days
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Earnings remain <code>On Hold</code> during this return/refund period.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Minimum Withdrawal Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={settingsForm.minWithdrawalAmount}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, minWithdrawalAmount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full pl-8 pr-3.5 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                    required
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Threshold minimum a seller must accumulate before requesting payout.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Payout Notice to Sellers
              </label>
              <textarea
                value={settingsForm.payoutNotice}
                onChange={(e) => setSettingsForm({ ...settingsForm, payoutNotice: e.target.value })}
                rows={2}
                placeholder="Notice displayed in the seller withdrawal dialog..."
                className="w-full px-3.5 py-2 bg-gray-50 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600 resize-none"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-lg shadow-purple-600/20 transition-all"
              >
                {isSavingSettings ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave className="w-3.5 h-3.5" /> Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminFinanceOverview;
