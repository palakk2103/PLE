import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiAlertCircle, FiCheckCircle, FiDollarSign, FiCreditCard } from "react-icons/fi";
import { formatPrice } from "../../../../shared/utils/helpers";
import { requestVendorWithdrawal } from "../../services/vendorService";
import toast from "react-hot-toast";

const RequestWithdrawalModal = ({ isOpen, onClose, walletData, onWithdrawalSuccess, onOpenBankModal }) => {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const available = walletData?.wallet?.available ?? 0;
  const minAmount = walletData?.settings?.minWithdrawalAmount ?? 500;
  const maxAmount = walletData?.settings?.maxWithdrawalAmount ?? 1000000;
  const bankMasked = walletData?.bankDetailsMasked ?? {};
  const hasBank = walletData?.bankDetailsConfigured;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid withdrawal amount.");
      return;
    }
    if (numAmount < minAmount) {
      toast.error(`Minimum withdrawal amount is ${formatPrice(minAmount)}.`);
      return;
    }
    if (numAmount > available) {
      toast.error(`Amount exceeds your available balance of ${formatPrice(available)}.`);
      return;
    }
    if (!hasBank) {
      toast.error("Please add your bank details or UPI ID first.");
      return;
    }

    setIsSubmitting(true);
    try {
      await requestVendorWithdrawal({ amount: numAmount, notes });
      toast.success("Withdrawal request submitted successfully!");
      setAmount("");
      setNotes("");
      if (onWithdrawalSuccess) onWithdrawalSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to submit withdrawal request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/10 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-white/5 dark:to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-600/10 text-purple-600 rounded-xl">
                <FiDollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Request Withdrawal</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Withdraw available seller earnings to bank account</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Available Balance Preview */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Available For Withdrawal</span>
                  <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatPrice(available)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Min. Payout</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {formatPrice(minAmount)}
                  </span>
                </div>
              </div>
              {available < minAmount && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 font-medium flex items-center gap-1">
                  <FiAlertCircle className="w-3.5 h-3.5" />
                  Minimum available balance required to withdraw is {formatPrice(minAmount)}.
                </p>
              )}
            </div>

            {/* Bank Account Snapshot */}
            <div className="p-3.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200/80 dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FiCreditCard className="text-purple-600 text-sm" />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Payout Destination</span>
                </div>
                {onOpenBankModal && (
                  <button
                    type="button"
                    onClick={onOpenBankModal}
                    className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    {hasBank ? "Edit Bank Details" : "+ Add Bank Details"}
                  </button>
                )}
              </div>
              {hasBank ? (
                <div className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
                  {bankMasked.bankName && (
                    <p><span className="text-gray-400">Bank:</span> <strong className="text-gray-800 dark:text-gray-100">{bankMasked.bankName}</strong></p>
                  )}
                  {bankMasked.maskedAccountNumber && (
                    <p><span className="text-gray-400">Account:</span> <span className="font-mono">{bankMasked.maskedAccountNumber}</span> ({bankMasked.ifscCode})</p>
                  )}
                  {bankMasked.upiId && (
                    <p><span className="text-gray-400">UPI ID:</span> <span className="font-mono text-purple-600 dark:text-purple-400">{bankMasked.upiId}</span></p>
                  )}
                  {bankMasked.accountName && (
                    <p><span className="text-gray-400">Holder:</span> {bankMasked.accountName}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 py-1">
                  <div className="flex items-center gap-2">
                    <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>No bank account or UPI configured yet.</span>
                  </div>
                  {onOpenBankModal && (
                    <button
                      type="button"
                      onClick={onOpenBankModal}
                      className="text-xs font-bold px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded-md transition-colors whitespace-nowrap ml-2"
                    >
                      Configure Now
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-2">
                Withdrawal Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min={minAmount}
                  max={Math.min(available, maxAmount)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`e.g. ${minAmount}`}
                  className="w-full pl-9 pr-24 py-3 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-base font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => setAmount(String(available))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded-md hover:bg-purple-100 transition-colors"
                >
                  MAX
                </button>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                <FiAlertCircle className="w-3 h-3 text-gray-400" />
                Must be at least {formatPrice(minAmount)} and no more than {formatPrice(available)}.
              </p>
            </div>

            {/* Optional Vendor Note */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Note for Admin (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special reference or instructions..."
                rows={2}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600 resize-none"
              />
            </div>

            {/* Notice */}
            <div className="p-3 bg-blue-50/60 dark:bg-blue-900/20 rounded-xl border border-blue-200/60 dark:border-blue-800/30 text-[11px] text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <FiCheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                {walletData?.settings?.payoutNotice ||
                  "Withdrawals are manually reviewed and processed by the admin team via direct bank transfer (NEFT/IMPS/UPI)."}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !hasBank || available < minAmount}
                className="px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Confirm Withdrawal"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RequestWithdrawalModal;
