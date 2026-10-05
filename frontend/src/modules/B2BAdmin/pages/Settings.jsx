import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FiSettings,
  FiSun,
  FiMoon,
  FiBell,
  FiShield,
  FiSliders,
  FiCheck,
  FiSave,
  FiRefreshCw,
  FiBriefcase,
  FiUser,
  FiCreditCard,
  FiFileText,
  FiClock,
  FiTruck,
  FiMail,
  FiMessageSquare,
  FiArrowRight,
  FiLock,
  FiVolume2,
  FiExternalLink,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useB2BAdminStore } from '../store/b2bAdminStore';
import { useThemeStore } from '../../../shared/store/themeStore';
import TwoFactorToggle from '../../../shared/components/TwoFactorToggle';

const STORAGE_KEY = 'b2b-dashboard-settings';

const DEFAULT_SETTINGS = {
  // Appearance
  language: 'en',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  compactView: false,

  // Procurement & RFQ Defaults
  defaultRfqValidityDays: 15,
  defaultDeliveryUrgency: 'Standard (7-10 Days)',
  preferredPaymentTerms: 'Net 30 Days',
  autoNotifyMatchingVendors: true,
  allowAlternativeQuotes: true,
  requireGstInvoice: true,

  // Notification Preferences
  emailRfqQuotes: true,
  emailOrderUpdates: true,
  smsUrgentAlerts: true,
  inAppChatAlerts: true,
  soundAlerts: true,
  weeklyDigest: false,
};

const Settings = () => {
  const navigate = useNavigate();
  const { adminProfile, companyProfile, fetchCompanyProfile, fetchAdminProfile, updateCompanyProfile } = useB2BAdminStore();
  const { theme, toggleTheme } = useThemeStore();

  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse B2B settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [isSaving, setIsSaving] = useState(false);

  // Sync profile data on mount
  useEffect(() => {
    fetchCompanyProfile();
    fetchAdminProfile();
  }, [fetchCompanyProfile, fetchAdminProfile]);

  // Merge remote settings if available
  useEffect(() => {
    if (companyProfile?.settings && typeof companyProfile.settings === 'object') {
      setSettings((prev) => ({
        ...prev,
        ...companyProfile.settings,
      }));
    }
  }, [companyProfile]);

  const handleToggle = (field) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        [field]: !prev[field],
      };
      // Auto cache immediately
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleChange = (field, value) => {
    setSettings((prev) => {
      const updated = {
        ...prev,
        [field]: value,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Save locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      // 2. Persist to backend DB via company profile
      await updateCompanyProfile({ settings });
      toast.success('B2B Dashboard settings saved successfully!');
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.success('Settings saved to browser session.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
      try {
        await updateCompanyProfile({ settings: DEFAULT_SETTINGS });
      } catch (e) {}
      toast.success('Settings reset to defaults');
    }
  };

  const playTestAlertSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
      audio.volume = 0.5;
      audio.play().then(() => {
        toast.success('Alert sound test successful! 🔔');
      }).catch(() => {
        toast('Sound alerts enabled');
      });
    } catch (e) {
      toast('Sound alerts enabled');
    }
  };

  const tabs = [
    { id: 'general', label: 'General & Appearance', icon: FiSliders },
    { id: 'procurement', label: 'RFQ & Procurement', icon: FiBriefcase },
    { id: 'notifications', label: 'Notification Alerts', icon: FiBell },
    { id: 'security', label: 'Security & Access', icon: FiShield },
  ];

  const companyName = companyProfile?.companyName || 'Registered Enterprise';
  const roleName = adminProfile?.isEmployee || adminProfile?.role === 'b2bEmployee' ? 'B2B Employee' : 'B2B Admin / Owner';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-5xl mx-auto pb-12"
    >
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#121212] rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-white/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-[#D71920]/10 text-[#D71920] rounded-xl flex items-center justify-center">
              <FiSettings className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
              B2B Dashboard Settings
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Manage your enterprise procurement rules, alert preferences, and account display options.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-all border border-gray-200 dark:border-white/10 flex items-center gap-1.5 cursor-pointer"
            title="Reset settings"
          >
            <FiRefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#D71920] to-[#B51218] hover:from-[#B51218] hover:to-[#900E12] rounded-xl transition-all shadow-md shadow-red-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <FiSave className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Organization Meta Card */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D71920] to-[#B51218] text-white flex items-center justify-center font-bold text-base shadow-sm flex-shrink-0">
            {typeof companyName === 'string' && companyName.length > 0 ? companyName.charAt(0).toUpperCase() : 'B'}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
              {companyName}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
              Operating as: <span className="font-semibold text-[#D71920] dark:text-red-400">{roleName}</span>
              {companyProfile?.gstNumber && ` • GST: ${companyProfile.gstNumber}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/b2b-dashboard/company-profile')}
            className="text-xs font-semibold text-[#D71920] dark:text-red-400 hover:underline flex items-center gap-1 bg-white/60 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-red-200/60 dark:border-red-900/40 cursor-pointer"
          >
            Company Profile <FiArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-white/10 gap-1 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#D71920] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: General & Appearance */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#121212] rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-white/10 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                <FiSun className="text-amber-500" />
                Theme & Interface Appearance
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose how your B2B workspace looks across desktop and mobile devices.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Light Mode Option */}
              <div
                onClick={() => {
                  if (theme === 'dark') toggleTheme();
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  theme === 'light'
                    ? 'border-[#D71920] bg-red-50/20 dark:bg-white/5'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <FiSun className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">Light Mode</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Crisp, high-contrast clean look</p>
                  </div>
                </div>
                {theme === 'light' && (
                  <span className="w-5 h-5 rounded-full bg-[#D71920] text-white flex items-center justify-center text-xs">
                    <FiCheck />
                  </span>
                )}
              </div>

              {/* Dark Mode Option */}
              <div
                onClick={() => {
                  if (theme === 'light') toggleTheme();
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  theme === 'dark'
                    ? 'border-[#D71920] bg-red-50/20 dark:bg-white/5'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-800 text-gray-200 flex items-center justify-center">
                    <FiMoon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">Dark Mode</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Sleek dark theme, easy on eyes</p>
                  </div>
                </div>
                {theme === 'dark' && (
                  <span className="w-5 h-5 rounded-full bg-[#D71920] text-white flex items-center justify-center text-xs">
                    <FiCheck />
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-white/10 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Portal Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => handleChange('language', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1A1A1A] text-gray-800 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-[#D71920] outline-none"
                >
                  <option value="en">English (Default)</option>
                  <option value="hi">Hindi (हिंदी)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Display Currency
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1A1A1A] text-gray-800 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-[#D71920] outline-none"
                >
                  <option value="INR">₹ INR (Indian Rupee)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Access Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => navigate('/b2b-dashboard/employees')}
              className="bg-white dark:bg-[#121212] p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#D71920] transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
                  <FiUser className="w-4 h-4" />
                </span>
                <FiExternalLink className="text-gray-400 w-3.5 h-3.5" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 dark:text-white">Employees</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage team access & permissions</p>
            </div>

            <div
              onClick={() => navigate('/wallet')}
              className="bg-white dark:bg-[#121212] p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#D71920] transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300">
                  <FiCreditCard className="w-4 h-4" />
                </span>
                <FiExternalLink className="text-gray-400 w-3.5 h-3.5" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 dark:text-white">Business Wallet</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">View balance & transactions</p>
            </div>

            <div
              onClick={() => navigate('/b2b-dashboard/rfqs')}
              className="bg-white dark:bg-[#121212] p-4 rounded-xl border border-gray-200 dark:border-white/10 hover:border-[#D71920] transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
                  <FiBriefcase className="w-4 h-4" />
                </span>
                <FiExternalLink className="text-gray-400 w-3.5 h-3.5" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 dark:text-white">RFQs</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Track procurement quotes</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Procurement & RFQ */}
      {activeTab === 'procurement' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#121212] rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-white/10 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                <FiBriefcase className="text-[#D71920]" />
                RFQ & Procurement Default Rules
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                These defaults will pre-populate whenever you or your employees generate a new RFQ inquiry.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Default RFQ Validity Period
                </label>
                <select
                  value={settings.defaultRfqValidityDays}
                  onChange={(e) => handleChange('defaultRfqValidityDays', Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1A1A1A] text-gray-800 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-[#D71920] outline-none"
                >
                  <option value={7}>7 Days</option>
                  <option value={15}>15 Days (Recommended)</option>
                  <option value={30}>30 Days</option>
                  <option value={45}>45 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Preferred Delivery Timeline
                </label>
                <select
                  value={settings.defaultDeliveryUrgency}
                  onChange={(e) => handleChange('defaultDeliveryUrgency', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1A1A1A] text-gray-800 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-[#D71920] outline-none"
                >
                  <option value="Urgent (1-3 Days)">Urgent (1-3 Days)</option>
                  <option value="Priority (3-5 Days)">Priority (3-5 Days)</option>
                  <option value="Standard (7-10 Days)">Standard (7-10 Days)</option>
                  <option value="Flexible (15+ Days)">Flexible (15+ Days)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Preferred Payment Terms
                </label>
                <select
                  value={settings.preferredPaymentTerms}
                  onChange={(e) => handleChange('preferredPaymentTerms', e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1A1A1A] text-gray-800 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-[#D71920] outline-none"
                >
                  <option value="100% Advance">100% Advance Payment</option>
                  <option value="50% Advance, 50% on Dispatch">50% Advance, 50% on Dispatch</option>
                  <option value="Net 15 Days">Net 15 Days Credit</option>
                  <option value="Net 30 Days">Net 30 Days Credit</option>
                </select>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-white/10 pt-4 space-y-3">
              {/* Toggle 1 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5">
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-white">
                    Auto-notify Verified Suppliers
                  </h4>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                    Instantly broadcast newly published RFQs to matching top-tier manufacturers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('autoNotifyMatchingVendors')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.autoNotifyMatchingVendors ? 'bg-[#D71920]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.autoNotifyMatchingVendors ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 2 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5">
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-white">
                    Accept Alternative Product Quotes
                  </h4>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                    Allow suppliers to suggest alternative specifications or bulk discounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('allowAlternativeQuotes')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.allowAlternativeQuotes ? 'bg-[#D71920]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.allowAlternativeQuotes ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 3 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5">
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-white">
                    Strict GST Invoice Enforcement
                  </h4>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                    Only engage with vendors capable of providing valid GST input tax credit invoices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('requireGstInvoice')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.requireGstInvoice ? 'bg-[#D71920]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.requireGstInvoice ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#121212] rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                  <FiBell className="text-blue-500" />
                  Notification & Alert Preferences
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose how and when your team receives operational updates.
                </p>
              </div>
              <button
                type="button"
                onClick={playTestAlertSound}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg border border-gray-200 dark:border-white/10 flex items-center gap-1.5 cursor-pointer"
              >
                <FiVolume2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Test Alert Sound</span>
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <FiMail className="w-5 h-5 text-gray-500" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-white">
                      RFQ Quotation Received (Email)
                    </h4>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                      Receive an email whenever a supplier submits a quotation for your RFQs.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('emailRfqQuotes')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    settings.emailRfqQuotes ? 'bg-[#D71920]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.emailRfqQuotes ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <FiTruck className="w-5 h-5 text-gray-500" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-white">
                      Purchase Order Dispatch Updates (Email & In-App)
                    </h4>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                      Real-time alerts when logistics tracking or shipping status is updated.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('emailOrderUpdates')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    settings.emailOrderUpdates ? 'bg-[#D71920]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.emailOrderUpdates ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <FiMessageSquare className="w-5 h-5 text-gray-500" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-white">
                      RFQ Discussion & Chat Alerts
                    </h4>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                      Sound and visual popup badge when a seller replies to your inquiry.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('inAppChatAlerts')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    settings.inAppChatAlerts ? 'bg-[#D71920]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.inAppChatAlerts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <FiVolume2 className="w-5 h-5 text-gray-500" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-white">
                      In-App Audio Chimes
                    </h4>
                    <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                      Play audio sound on new order dispatch or vendor quotes.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('soundAlerts')}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    settings.soundAlerts ? 'bg-[#D71920]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.soundAlerts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Security & Access */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#121212] rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-white/10 shadow-sm space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                <FiLock className="text-emerald-500" />
                Security & Two-Factor Authentication (2FA)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Protect your company portal and bulk purchasing operations with two-factor email OTP authentication.
              </p>
            </div>

            {/* Live Real Two-Factor Authentication Toggle */}
            <div className="bg-gray-50 dark:bg-white/5 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-white/10">
              <TwoFactorToggle apiPrefix="/b2b-user/auth" />
            </div>

            {/* Account Credentials & Legal Compliance Quick Access */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
                    <FiUser className="text-[#D71920]" />
                    Admin Credentials & Password
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Change admin account password, update authorized email or phone number.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/b2b-dashboard/admin-profile')}
                  className="px-4 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-300 dark:border-white/15 text-gray-800 dark:text-white rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors self-start cursor-pointer"
                >
                  Manage Admin Profile
                </button>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
                    <FiFileText className="text-blue-500" />
                    GST & Compliance Documents
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Review uploaded certificate of incorporation, GST certificate, and MSME docs.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/b2b-dashboard/legal-documents')}
                  className="px-4 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-300 dark:border-white/15 text-gray-800 dark:text-white rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors self-start cursor-pointer"
                >
                  View Legal Documents
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Settings;
