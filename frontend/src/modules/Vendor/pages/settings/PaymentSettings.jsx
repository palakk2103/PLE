import { motion } from 'framer-motion';
import { useVendorAuthStore } from '../../store/vendorAuthStore';
import BankAccountsManager from '../../components/settings/BankAccountsManager';

/**
 * Payout settings. A vendor can keep several payout accounts (bank account and/or UPI ID);
 * the preferred one receives payouts. (The old "Payment Methods" tab and its Save button were
 * removed: they never saved anything except the single old bank form, which would now overwrite the
 * preferred account with stale values.)
 */
const PaymentSettings = () => {
  const { vendor } = useVendorAuthStore();
  const isManaged = vendor?.role === 'managed_vendor';

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Loading vendor information...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-full overflow-x-hidden">
      <div className="lg:hidden">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">Payment Settings</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Where your payouts are sent</p>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-white/5 p-3 sm:p-4 md:p-6">
        <BankAccountsManager isManaged={isManaged} />
      </div>
    </motion.div>
  );
};

export default PaymentSettings;
