import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCreditCard, FiLock, FiCheck } from "react-icons/fi";
import { updateVendorFinanceBankDetails, getVendorFinanceBankDetails } from "../../services/vendorService";
import toast from "react-hot-toast";

const BankDetailsModal = ({ isOpen, onClose, onUpdated }) => {
  const [formData, setFormData] = useState({
    accountName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    bankName: "",
    ifscCode: "",
    upiId: "",
  });
  const [maskedAccount, setMaskedAccount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCurrent = async () => {
      setIsLoading(true);
      try {
        const res = await getVendorFinanceBankDetails();
        const data = res?.data ?? res;
        setFormData({
          accountName: data?.accountName || "",
          accountNumber: "",
          confirmAccountNumber: "",
          bankName: data?.bankName || "",
          ifscCode: data?.ifscCode || "",
          upiId: data?.upiId || "",
        });
        setMaskedAccount(data?.maskedAccountNumber || "");
      } catch (err) {
        toast.error("Failed to load existing bank details.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCurrent();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.accountNumber && formData.accountNumber !== formData.confirmAccountNumber) {
      toast.error("Account numbers do not match.");
      return;
    }

    if (formData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(formData.ifscCode.trim())) {
      toast.error("Please enter a valid 11-character Indian IFSC code (e.g., SBIN0001234).");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        accountName: formData.accountName,
        bankName: formData.bankName,
        ifscCode: formData.ifscCode.toUpperCase(),
        upiId: formData.upiId,
      };
      if (formData.accountNumber) {
        payload.accountNumber = formData.accountNumber;
      }

      await updateVendorFinanceBankDetails(payload);
      toast.success("Bank details updated successfully!");
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update bank details.");
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
                <FiCreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bank & Payout Details</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Used by administrators to process manual payouts</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-gray-500">Loading current bank info...</div>
            ) : (
              <>
                {maskedAccount && (
                  <div className="p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-200/50 dark:border-purple-800/30 flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-300">Current Saved Account:</span>
                    <span className="font-mono font-bold text-purple-700 dark:text-purple-300">{maskedAccount}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Beneficiary / Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    placeholder="Full name as in bank account"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="e.g. HDFC Bank"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={formData.ifscCode}
                      onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-xs uppercase font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Bank Account Number
                    </label>
                    <input
                      type="password"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      placeholder={maskedAccount ? "Leave blank to keep existing" : "Account number"}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Confirm Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.confirmAccountNumber}
                      onChange={(e) => setFormData({ ...formData, confirmAccountNumber: e.target.value })}
                      placeholder="Re-enter account number"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    UPI ID (VPA) (Optional Alternate)
                  </label>
                  <input
                    type="text"
                    value={formData.upiId}
                    onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                    placeholder="e.g. seller@okaxis"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-black/20 border border-gray-300 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-[11px] text-gray-500">
                  <FiLock className="flex-shrink-0 text-gray-400" />
                  <span>Bank details are encrypted server-side and never exposed publicly.</span>
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiCheck /> Save Bank Details
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BankDetailsModal;
