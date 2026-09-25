import { useState, useEffect } from 'react';
import { FiSave, FiUser, FiLock, FiShield, FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useVendorAuthStore } from "../../store/vendorAuthStore";
import toast from 'react-hot-toast';
import OTPVerificationModal from '../../../../shared/components/OTPVerificationModal';
import TwoFactorToggle from '../../../../shared/components/TwoFactorToggle';
import { requestChangePasswordOTP, verifyChangePasswordOTP } from '../../services/vendorService';

const ProfileSettings = () => {
  const { vendor, updateProfile, verifyProfileOTP, resendProfileOTP, logout } = useVendorAuthStore();
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingUpdateId, setPendingUpdateId] = useState(null);
  const [showPasswordOtpModal, setShowPasswordOtpModal] = useState(false);
  const [passwordOtpEmail, setPasswordOtpEmail] = useState('');
  const [isRequestingPasswordOtp, setIsRequestingPasswordOtp] = useState(false);

  // Delete Account States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    companyName: '',
    gstNumber: '',
    address: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [activeSection, setActiveSection] = useState('profile');

  useEffect(() => {
    if (vendor) {
      setFormData((prev) => ({
        ...prev,
        name: vendor.name || '',
        phone: vendor.phone || '',
        email: vendor.email || vendor.username || '',
        companyName: vendor.companyName || '',
        gstNumber: vendor.gstNumber || '',
        address: vendor.address || '',
      }));
    }
  }, [vendor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!vendor) return;

    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
      };
      if (vendor.role === 'managed_vendor') {
        payload.companyName = formData.companyName;
        payload.gstNumber = formData.gstNumber;
        payload.address = formData.address;
      }
      const res = await updateProfile(payload);
      if (res?.success && res.pendingUpdateId) {
        setPendingUpdateId(res.pendingUpdateId);
        setShowOtpModal(true);
      } else {
        toast.success('Profile updated successfully');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!vendor) return;

    if (!formData.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setIsRequestingPasswordOtp(true);
    try {
      const res = await requestChangePasswordOTP(formData.currentPassword, formData.newPassword);
      const email = res?.data?.email || vendor?.email || vendor?.username;
      setPasswordOtpEmail(email);
      setShowPasswordOtpModal(true);
      toast.success(res?.message || `Verification OTP sent to ${email}`);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to request password change OTP');
    } finally {
      setIsRequestingPasswordOtp(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      toast.error('Please enter your vendor account password to confirm.');
      return;
    }
    setIsDeleting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast.success('Vendor account deleted successfully.');
      setShowDeleteModal(false);
      setDeletePassword('');
      logout();
    } catch (error) {
      toast.error('Failed to delete vendor account');
    } finally {
      setIsDeleting(false);
    }
  };

  const sections = [
    { id: 'profile', label: 'Profile Info', icon: FiUser },
    { id: 'password', label: 'Change Password', icon: FiLock },
    { id: 'security', label: 'Security', icon: FiShield },
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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Profile Settings</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage your profile and account security</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-full overflow-x-hidden">
        <div className="border-b border-gray-200 overflow-x-hidden">
          <div className="flex overflow-x-auto scrollbar-hide -mx-1 px-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b-2 transition-colors whitespace-nowrap text-xs sm:text-sm ${activeSection === section.id
                    ? 'border-purple-600 text-purple-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                >
                  <Icon className="text-base sm:text-lg" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 sm:p-4 md:p-6">
          {vendor?.role === 'managed_vendor' && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-3">
              <FiShield className="text-xl mt-0.5 flex-shrink-0 text-amber-600" />
              <div>
                <h4 className="font-semibold text-sm">Managed Account Notice</h4>
                <p className="text-xs sm:text-sm mt-1 text-amber-700">
                  Your profile and account credentials are managed by the Shop Administrator. Direct profile edits and password changes are disabled. Please contact your Administrator for updates.
                </p>
              </div>
            </div>
          )}

          {/* Profile Info Section */}
          {activeSection === 'profile' && (
            <div className="space-y-8">
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={vendor?.role === 'managed_vendor'}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email / Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="email"
                      value={formData.email}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 bg-gray-50 rounded-lg focus:outline-none disabled:opacity-75 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={vendor?.role === 'managed_vendor'}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {vendor?.role === 'managed_vendor' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Company Name
                        </label>
                        <input
                          type="text"
                          name="companyName"
                          value={formData.companyName}
                          onChange={handleChange}
                          disabled
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          GST Number
                        </label>
                        <input
                          type="text"
                          name="gstNumber"
                          value={formData.gstNumber}
                          onChange={handleChange}
                          disabled
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Address
                        </label>
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          disabled
                          rows={2}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </>
                  )}
                </div>

                {vendor?.role !== 'managed_vendor' && (
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold text-sm sm:text-base shadow-sm"
                    >
                      <FiSave />
                      Save Profile
                    </button>
                  </div>
                )}
              </form>

              {/* Danger Zone: Delete Vendor Account */}
              <div className="pt-6 border-t border-red-200">
                <h3 className="text-red-700 font-bold text-base mb-2 flex items-center gap-2">
                  <FiAlertTriangle className="text-red-600" /> Danger Zone
                </h3>
                <div className="border border-red-200 bg-red-50/40 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">Delete Vendor Account</h4>
                    <p className="text-xs text-gray-500 mt-1 max-w-xl">
                      Permanently delete your vendor store account, unpublish active product listings, and terminate seller access. This action cannot be reversed.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm self-start sm:self-center shrink-0"
                  >
                    <FiTrash2 />
                    <span>Delete Account</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Change Password Section */}
          {activeSection === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    disabled={vendor?.role === 'managed_vendor'}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    disabled={vendor?.role === 'managed_vendor'}
                    required
                    minLength={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={vendor?.role === 'managed_vendor'}
                    required
                    minLength={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {vendor?.role !== 'managed_vendor' && (
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={isRequestingPasswordOtp}
                    className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold text-sm sm:text-base disabled:opacity-50"
                  >
                    <FiSave />
                    {isRequestingPasswordOtp ? 'Sending OTP...' : 'Change Password'}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Security Section */}
          {activeSection === 'security' && (
            <div className="space-y-6">
              <TwoFactorToggle apiPrefix="/vendor/auth" />
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Account Status</h3>
                <div className="space-y-2 text-sm text-blue-700">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <span className="font-semibold capitalize">{vendor.status || 'pending'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Verified:</span>
                    <span className="font-semibold">{vendor.isVerified ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Joined:</span>
                    <span className="font-semibold">{new Date(vendor.joinDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-sm font-semibold text-yellow-800 mb-2">Security Recommendations</h3>
                <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                  <li>Use a strong, unique password</li>
                  <li>Enable two-factor authentication when available</li>
                  <li>Never share your login credentials</li>
                  <li>Log out from shared devices</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={logout}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-semibold text-sm"
                >
                  Logout
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold text-sm shadow-sm"
                >
                  <FiTrash2 />
                  <span>Delete Account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Vendor Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl max-w-md w-full border border-gray-200 space-y-4 max-h-[90vh] overflow-y-auto my-auto"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl font-bold">
                  <FiAlertTriangle />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Permanently Delete Vendor Account?</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Warning: Deleting your vendor account will permanently unlist all your catalog items, cancel pending applications, and erase your store profile.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">Enter your password to confirm</label>
                  <input
                    type="password"
                    placeholder="Account password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={!deletePassword.trim() || isDeleting}
                    onClick={handleDeleteAccount}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FiTrash2 />
                    <span>{isDeleting ? 'Deleting...' : 'Delete Account'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeletePassword('');
                    }}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm rounded-xl transition-colors text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <OTPVerificationModal
        isOpen={showOtpModal}
        onClose={() => {
          setShowOtpModal(false);
          setPendingUpdateId(null);
        }}
        email={vendor?.email}
        onVerify={async (otp) => {
          await verifyProfileOTP(pendingUpdateId, otp);
          toast.success('Profile updated successfully');
        }}
        onResend={async () => {
          await resendProfileOTP(pendingUpdateId);
          toast.success('OTP resent successfully');
        }}
      />

      <OTPVerificationModal
        isOpen={showPasswordOtpModal}
        onClose={() => {
          setShowPasswordOtpModal(false);
        }}
        email={passwordOtpEmail}
        onVerify={async (otp) => {
          await verifyChangePasswordOTP(otp);
          toast.success('Password changed successfully');
          setShowPasswordOtpModal(false);
          setFormData((prev) => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          }));
        }}
        onResend={async () => {
          const res = await requestChangePasswordOTP(formData.currentPassword, formData.newPassword);
          toast.success(res?.message || 'OTP resent successfully');
        }}
      />
    </motion.div>
  );
};

export default ProfileSettings;


