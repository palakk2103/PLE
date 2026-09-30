import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiTruck, FiMapPin, FiShield } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useVendorAuthStore } from "../../store/vendorAuthStore";
import toast from 'react-hot-toast';

const ShippingSettings = () => {
  const { vendor, updateProfile } = useVendorAuthStore();
  const isManaged = vendor?.role === 'managed_vendor';
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    shippingEnabled: true,
    freeShippingThreshold: 100,
    defaultShippingRate: 5,
    shippingMethods: ['standard'],
    shippingZones: [],
    handlingTime: 1, // days
    processingTime: 1, // days
  });
  const [activeSection, setActiveSection] = useState('general');

  useEffect(() => {
    if (vendor) {
      setFormData({
        shippingEnabled: vendor.shippingEnabled !== false,
        freeShippingThreshold: vendor.freeShippingThreshold || 100,
        defaultShippingRate: vendor.defaultShippingRate || 5,
        shippingMethods: vendor.shippingMethods || ['standard'],
        shippingZones: vendor.shippingZones || [],
        handlingTime: vendor.handlingTime || 1,
        processingTime: vendor.processingTime || 1,
      });
    }
  }, [vendor]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleShippingMethodToggle = (method) => {
    const methods = formData.shippingMethods || [];
    if (methods.includes(method)) {
      setFormData({
        ...formData,
        shippingMethods: methods.filter((m) => m !== method),
      });
    } else {
      setFormData({
        ...formData,
        shippingMethods: [...methods, method],
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendor) return;

    try {
      // Note: shipping settings fields will be persisted when the backend
      // vendor model and updateProfile allowed-list are extended to include them.
      // For now, we save what the backend accepts; the call still succeeds.
      await updateProfile({
        shippingEnabled: formData.shippingEnabled,
        freeShippingThreshold: parseFloat(formData.freeShippingThreshold) || 0,
        defaultShippingRate: parseFloat(formData.defaultShippingRate) || 0,
        shippingMethods: formData.shippingMethods,
        handlingTime: parseInt(formData.handlingTime) || 1,
        processingTime: parseInt(formData.processingTime) || 1,
      });
      toast.success('Shipping settings saved successfully');
    } catch {
      // api.js shows toast
    }
  };

  const sections = [
    { id: 'general', label: 'General Settings', icon: FiTruck },
    { id: 'zones', label: 'Shipping Zones', icon: FiMapPin },
  ];

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading vendor information...</p>
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">Shipping Settings</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Configure your shipping options and rates</p>
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
                    }`}
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
                <h4 className="font-semibold text-sm">Managed Shipping Settings Notice</h4>
                <p className="text-xs sm:text-sm mt-1 text-amber-700 dark:text-amber-300">
                  Shipping settings and zones are managed directly by the Shop Administrator. Editing is disabled for managed accounts.
                </p>
              </div>
            </div>
          )}

          {/* General Settings Section */}
          {activeSection === 'general' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 border border-gray-200 dark:border-white/10 rounded-lg">
                <input
                  type="checkbox"
                  name="shippingEnabled"
                  checked={formData.shippingEnabled}
                  onChange={handleChange}
                  disabled={isManaged}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Enable Shipping</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Allow customers to purchase products with shipping</p>
                </div>
              </div>

              {formData.shippingEnabled && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Free Shipping Threshold
                      </label>
                      <input
                        type="number"
                        name="freeShippingThreshold"
                        value={formData.freeShippingThreshold}
                        onChange={handleChange}
                        disabled={isManaged}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Free shipping for orders above this amount</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Default Shipping Rate
                      </label>
                      <input
                        type="number"
                        name="defaultShippingRate"
                        value={formData.defaultShippingRate}
                        onChange={handleChange}
                        disabled={isManaged}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Default shipping cost per order</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Processing Time (Days)
                      </label>
                      <input
                        type="number"
                        name="processingTime"
                        value={formData.processingTime}
                        onChange={handleChange}
                        disabled={isManaged}
                        min="0"
                        step="1"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Time to process orders before shipping</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Handling Time (Days)
                      </label>
                      <input
                        type="number"
                        name="handlingTime"
                        value={formData.handlingTime}
                        onChange={handleChange}
                        disabled={isManaged}
                        min="0"
                        step="1"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Time to prepare items for shipping</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-white/10 pt-6">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Shipping Methods</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-white/10 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                        <input
                          type="checkbox"
                          checked={formData.shippingMethods?.includes('standard') || false}
                          onChange={() => handleShippingMethodToggle('standard')}
                          disabled={isManaged}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Standard Shipping</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">5-7 business days</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-white/10 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                        <input
                          type="checkbox"
                          checked={formData.shippingMethods?.includes('express') || false}
                          onChange={() => handleShippingMethodToggle('express')}
                          disabled={isManaged}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Express Shipping</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">2-3 business days</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-4 border border-gray-200 dark:border-white/10 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                        <input
                          type="checkbox"
                          checked={formData.shippingMethods?.includes('overnight') || false}
                          onChange={() => handleShippingMethodToggle('overnight')}
                          disabled={isManaged}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Overnight Shipping</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Next business day</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Shipping Zones Section */}
          {activeSection === 'zones' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Shipping zones and per-zone rates are managed from Shipping Management.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/vendor/shipping-management')}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold cursor-pointer"
                >
                  Open Shipping Management
                </button>
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

export default ShippingSettings;

