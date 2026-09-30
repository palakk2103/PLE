
import { useState, useEffect } from 'react';
import { FiSave, FiCreditCard, FiLock, FiShield } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useVendorAuthStore } from "../../store/vendorAuthStore";
import { updateVendorBankDetails } from '../../services/vendorService';
import AnimatedSelect from '../../../Admin/components/AnimatedSelect';
import toast from 'react-hot-toast';

const PaymentSettings = () => {
  const { vendor } = useVendorAuthStore();
  const isManaged = vendor?.role === 'managed_vendor';
  const [formData, setFormData] = useState({
    bankDetails: {
      accountName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
    },
    paymentMethods: {
      bankTransfer: true,
      upi: false,
      paypal: false,
    },
    upiId: '',
    paypalEmail: '',
  });
  const [activeSection, setActiveSection] = useState('bank');

  useEffect(() => {
    if (vendor && vendor.bankDetails) {
      setFormData({
        bankDetails: vendor.bankDetails || {
          accountName: '',
          accountNumber: '',
          ifscCode: '',
          bankName: '',
        },
        paymentMethods: vendor.paymentMethods || {
          bankTransfer: true,
          upi: false,
          paypal: false,
        },
        upiId: vendor.upiId || '',
        paypalEmail: vendor.paypalEmail || '',
      });
    }
  }, [vendor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('bank_')) {
      const bankField = name.replace('bank_', '');
      setFormData({
        ...formData,
        bankDetails: {
          ...formData.bankDetails,
          [bankField]: value,
        },
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handlePaymentMethodToggle = (method) => {
    setFormData({
      ...formData,
      paymentMethods: {
        ...formData.paymentMethods,
        [method]: !formData.paymentMethods[method],
      },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendor) return;

    try {
      // Save bank details via dedicated endpoint
      await updateVendorBankDetails({
        accountName: formData.bankDetails.accountName,
        accountNumber: formData.bankDetails.accountNumber,
        ifscCode: formData.bankDetails.ifscCode,
        bankName: formData.bankDetails.bankName,
      });
      toast.success('Payment settings saved successfully');
    } catch {
      // api.js shows toast
    }
  };

  const sections = [
    { id: 'bank', label: 'Bank Details', icon: FiCreditCard },
    { id: 'methods', label: 'Payment Methods', icon: FiLock },
  ];

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Loading vendor information...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-full overflow-x-hidden"
    >
      <div className="lg:hidden">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">Payment Settings</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Configure your payment and bank details</p>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-white/5 max-w-full overflow-x-hidden">
        <div className="border-b border-gray-200 dark:border-white/10 overflow-x-hidden">
          <div className="flex overflow-x-auto scrollbar-hide -mx-1 px-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b-2 transition-colors whitespace-nowrap text-xs sm:text-sm cursor-pointer ${activeSection === section.id
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-semibold'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    } `}
                >
                  <Icon className="text-base sm:text-lg" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-4 md:p-6">
          {isManaged && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-800 dark:text-amber-200 flex items-start gap-3">
              <FiShield className="text-xl mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <h4 className="font-semibold text-sm">Managed Payment Details Notice</h4>
                <p className="text-xs sm:text-sm mt-1 text-amber-700 dark:text-amber-300">
                  Your bank and payment details are managed directly by the Shop Administrator. Direct editing is disabled for managed accounts.
                </p>
              </div>
            </div>
          )}

          {/* Bank Details Section */}
          {activeSection === 'bank' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Account Holder Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bank_accountName"
                    value={formData.bankDetails.accountName || ''}
                    onChange={handleChange}
                    required
                    disabled={isManaged}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bank_accountNumber"
                    value={formData.bankDetails.accountNumber || ''}
                    onChange={handleChange}
                    required
                    disabled={isManaged}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    IFSC Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bank_ifscCode"
                    value={formData.bankDetails.ifscCode || ''}
                    onChange={handleChange}
                    required
                    disabled={isManaged}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="BANK0001234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bank_bankName"
                    value={formData.bankDetails.bankName || ''}
                    onChange={handleChange}
                    required
                    disabled={isManaged}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800/40 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Your bank details are encrypted and secure. These details are used for commission payouts.
                </p>
              </div>
            </div>
          )}

          {/* Payment Methods Section */}
          {activeSection === 'methods' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Preferred Payment Methods</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-white/10 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={formData.paymentMethods.bankTransfer || false}
                      onChange={() => handlePaymentMethodToggle('bankTransfer')}
                      disabled={isManaged}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Bank Transfer</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Receive payments via bank transfer</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-white/10 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={formData.paymentMethods.upi || false}
                      onChange={() => handlePaymentMethodToggle('upi')}
                      disabled={isManaged}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">UPI</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Receive payments via UPI</p>
                    </div>
                  </label>

                  {formData.paymentMethods.upi && (
                    <div className="ml-7 mb-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        UPI ID
                      </label>
                      <input
                        type="text"
                        name="upiId"
                        value={formData.upiId || ''}
                        onChange={handleChange}
                        disabled={isManaged}
                        placeholder="yourname@upi"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-white/10 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={formData.paymentMethods.paypal || false}
                      onChange={() => handlePaymentMethodToggle('paypal')}
                      disabled={isManaged}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">PayPal</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Receive payments via PayPal</p>
                    </div>
                  </label>

                  {formData.paymentMethods.paypal && (
                    <div className="ml-7 mb-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        PayPal Email
                      </label>
                      <input
                        type="email"
                        name="paypalEmail"
                        value={formData.paypalEmail || ''}
                        onChange={handleChange}
                        disabled={isManaged}
                        placeholder="your@paypal.com"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isManaged && (
            <div className="flex justify-end pt-4 sm:pt-6 border-t border-gray-200 dark:border-white/10 mt-4 sm:mt-6">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all font-semibold text-sm sm:text-base w-full sm:w-auto justify-center cursor-pointer shadow-sm"
              >
                <FiSave />
                Save Settings
              </button>
            </div>
          )}
        </form>
      </div>
    </motion.div>
  );
};

export default PaymentSettings;

