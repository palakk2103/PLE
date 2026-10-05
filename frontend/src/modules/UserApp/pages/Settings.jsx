import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowLeft,
  FiUser,
  FiMail,
  FiPhone,
  FiLock,
  FiEye,
  FiEyeOff,
  FiSave,
  FiBell,
  FiGlobe,
  FiMoon,
  FiSun,
  FiMapPin,
  FiChevronRight,
  FiShield,
  FiTrash2,
  FiHelpCircle,
  FiLogOut,
  FiCheck,
  FiCreditCard,
} from "react-icons/fi";
import { useAuthStore } from "../../../shared/store/authStore";
import { useThemeStore } from "../../../shared/store/themeStore";
import { useB2bStore } from "../../../shared/store/b2bStore";
import MobileLayout from "../components/Layout/MobileLayout";
import PageTransition from "../../../shared/components/PageTransition";
import TwoFactorToggle from "../../../shared/components/TwoFactorToggle";
import toast from "react-hot-toast";
import { isValidPhone } from "../../../shared/utils/helpers";
import { performUserLogout } from "../../../shared/utils/userLogout";

const MobileSettings = () => {
  const navigate = useNavigate();
  const { user, updateProfile, changePassword, logout, isLoading } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const [activeSection, setActiveSection] = useState("general"); // 'general', 'profile', 'password', 'notifications'
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Mock settings for notifications & preferences (persisted in localStorage for demo)
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem("user-notification-prefs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          return {
            orderUpdates: true,
            promotions: false,
            newsletter: true,
            smsAlerts: false,
            ...parsed,
          };
        }
      }
    } catch (e) {
      console.warn("Failed to parse user-notification-prefs from localStorage", e);
    }
    return {
      orderUpdates: true,
      promotions: false,
      newsletter: true,
      smsAlerts: false,
    };
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("user-language") || "en";
  });

  // Save preferences when they change
  useEffect(() => {
    localStorage.setItem("user-notification-prefs", JSON.stringify(notificationPrefs));
  }, [notificationPrefs]);

  useEffect(() => {
    localStorage.setItem("user-language", language);
  }, [language]);

  // Profile Form
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile,
  } = useForm({
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
    },
  });

  // Password Form
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    watch,
  } = useForm();

  const newPassword = watch("newPassword");

  useEffect(() => {
    if (user) {
      resetProfile({
        name: user.name || "",
        phone: user.phone || "",
      });
    }
  }, [user, resetProfile]);

  const onProfileSubmit = async (data) => {
    try {
      await updateProfile({
        name: data.name,
        phone: data.phone,
      });
      toast.success("Profile settings updated successfully!");
      setActiveSection("general");
    } catch (error) {
      toast.error(error?.message || "Failed to update profile settings");
    }
  };

  const onPasswordSubmit = async (data) => {
    try {
      await changePassword(data.currentPassword, data.newPassword);
      toast.success("Password changed successfully!");
      resetPassword();
      setActiveSection("general");
    } catch (error) {
      toast.error(error?.message || "Failed to change password");
    }
  };

  const handleLogout = () => {
    performUserLogout('/');
  };

  const handleTogglePref = (key) => {
    setNotificationPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    toast.success("Notification preferences updated");
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        <div className="w-full pb-24 lg:pb-12 max-w-4xl mx-auto min-h-screen bg-gray-50 dark:bg-[#121212] transition-colors duration-200">
          
          {/* Header */}
          <div className="px-4 py-4 bg-white dark:bg-[#1A1A1A] border-b border-gray-200 dark:border-white/10 sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (activeSection !== "general") {
                    setActiveSection("general");
                  } else if (window.history.state && window.history.state.idx > 0) {
                    navigate(-1);
                  } else {
                    navigate("/profile");
                  }
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-700 dark:text-gray-200"
              >
                <FiArrowLeft className="text-xl" />
              </button>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                {activeSection === "general" && "Settings"}
                {activeSection === "profile" && "Edit Profile"}
                {activeSection === "password" && "Change Password"}
                {activeSection === "notifications" && "Notification Preferences"}
              </h1>
            </div>
          </div>

          <div className="p-4">
            <AnimatePresence mode="wait">
              
              {/* Main settings menu */}
              {activeSection === "general" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  {/* Account Summary Widget */}
                  <div className="bg-white dark:bg-[#1A1A1A] p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#AE020B] to-red-400 flex items-center justify-center text-white text-xl font-extrabold shadow-md">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user?.name || "User"}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                      ) : (
                        user?.name?.charAt(0).toUpperCase() || "U"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-gray-800 dark:text-white text-lg truncate">
                        {user?.name || "User"}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm truncate">
                        {user?.email || "No email provided"}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveSection("profile")}
                      className="px-4 py-1.5 bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-bold rounded-lg border border-red-100 dark:border-red-900/30 transition-colors"
                    >
                      Edit Profile
                    </button>
                  </div>

                  {/* App Preferences */}
                  <div className="space-y-3">
                    <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
                      App Settings
                    </h2>
                    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
                      
                      {/* Theme Settings */}
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center">
                            {theme === "dark" ? <FiMoon className="text-lg" /> : <FiSun className="text-lg" />}
                          </div>
                          <div>
                            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Dark Theme</span>
                            <span className="text-gray-400 dark:text-gray-500 text-xs">Switch between light and dark modes</span>
                          </div>
                        </div>
                        <button
                          onClick={toggleTheme}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none bg-gray-200 dark:bg-red-600"
                        >
                          <span
                            className={`${
                              theme === "dark" ? "translate-x-6" : "translate-x-1"
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                          />
                        </button>
                      </div>

                      {/* Language Selection */}
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center">
                            <FiGlobe className="text-lg" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Language</span>
                            <span className="text-gray-400 dark:text-gray-500 text-xs">Select your preferred language</span>
                          </div>
                        </div>
                        <select
                          value={language}
                          onChange={(e) => {
                            setLanguage(e.target.value);
                            toast.success(`Language set to ${e.target.value === "en" ? "English" : "Hindi"}`);
                          }}
                          className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-[#222] text-gray-700 dark:text-gray-200 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
                        >
                          <option value="en">English</option>
                          <option value="hi">हिन्दी (Hindi)</option>
                        </select>
                      </div>

                      {/* Notifications Page link */}
                      <button
                        onClick={() => setActiveSection("notifications")}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center">
                            <FiBell className="text-lg" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Notification Settings</span>
                            <span className="text-gray-400 dark:text-gray-500 text-xs">Manage push & email notifications</span>
                          </div>
                        </div>
                        <FiChevronRight className="text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Security & Accounts */}
                  <div className="space-y-3">
                    <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
                      Account & Security
                    </h2>
                    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
                      
                      {/* Password Change */}
                      <button
                        onClick={() => setActiveSection("password")}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center">
                            <FiLock className="text-lg" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Change Password</span>
                            <span className="text-gray-400 dark:text-gray-500 text-xs">Update your security credentials</span>
                          </div>
                        </div>
                      </button>

                      {/* Two-Factor Authentication */}
                      <button
                        onClick={() => setActiveSection("2fa")}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center">
                            <FiShield className="text-lg" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Two-Factor Authentication</span>
                            <span className="text-gray-400 dark:text-gray-500 text-xs">Manage your 2FA settings</span>
                          </div>
                        </div>
                        <FiChevronRight className="text-gray-400" />
                      </button>

                      {/* Saved Addresses */}
                      <button
                        onClick={() => navigate("/addresses")}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center">
                            <FiMapPin className="text-lg" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Saved Addresses</span>
                            <span className="text-gray-400 dark:text-gray-500 text-xs">Manage your shipping destinations</span>
                          </div>
                        </div>
                        <FiChevronRight className="text-gray-400" />
                      </button>

                      {/* Support Page */}
                      <button
                        onClick={() => navigate("/help-support")}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-[#7B0A0A] dark:text-red-400 flex items-center justify-center">
                            <FiHelpCircle className="text-lg" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Help & Support</span>
                            <span className="text-gray-400 dark:text-gray-500 text-xs">Find FAQs or contact support agent</span>
                          </div>
                        </div>
                        <FiChevronRight className="text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-4 hover:bg-red-50 dark:hover:bg-red-950/10 text-red-600 dark:text-red-400 transition-colors text-left font-bold text-sm"
                      >
                        <FiLogOut className="text-lg" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>

                </motion.div>
              )}

              {/* Profile Details Edit Form */}
              {activeSection === "profile" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-white dark:bg-[#1A1A1A] p-6 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm space-y-6"
                >
                  <form onSubmit={handleSubmitProfile(onProfileSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <FiUser className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          {...registerProfile("name", {
                            required: "Name is required",
                            minLength: { value: 2, message: "Name must be at least 2 characters" },
                          })}
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${
                            profileErrors.name
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 dark:border-white/10 focus:border-red-500"
                          } focus:outline-none dark:bg-[#222] dark:text-white transition-colors text-base`}
                          placeholder="Your name"
                        />
                      </div>
                      {profileErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{profileErrors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Phone Number
                      </label>
                      <div className="relative">
                        <FiPhone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="tel"
                          {...registerProfile("phone", {
                            validate: (value) =>
                              !value || isValidPhone(value) || "Please enter a valid phone number",
                          })}
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 ${
                            profileErrors.phone
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 dark:border-white/10 focus:border-red-500"
                          } focus:outline-none dark:bg-[#222] dark:text-white transition-colors text-base`}
                          placeholder="Your phone number"
                        />
                      </div>
                      {profileErrors.phone && (
                        <p className="mt-1 text-sm text-red-600">{profileErrors.phone.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Email Address (Read Only)
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          value={user?.email || ""}
                          readOnly
                          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#151515] text-gray-400 cursor-not-allowed text-base focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setActiveSection("general")}
                        className="flex-1 py-3 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white font-bold rounded-xl transition-colors text-center text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 py-3 bg-[#7B0A0A] hover:bg-[#AE020B] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-md disabled:opacity-60"
                      >
                        <FiSave />
                        Save Changes
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Password update form */}
              {activeSection === "password" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-white dark:bg-[#1A1A1A] p-6 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm space-y-6"
                >
                  <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          {...registerPassword("currentPassword", {
                            required: "Current password is required",
                          })}
                          className={`w-full px-4 py-3 rounded-xl border-2 ${
                            passwordErrors.currentPassword
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 dark:border-white/10 focus:border-red-500"
                          } focus:outline-none dark:bg-[#222] dark:text-white transition-colors text-base`}
                          placeholder="Current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {passwordErrors.currentPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          {...registerPassword("newPassword", {
                            required: "New password is required",
                            minLength: { value: 6, message: "Password must be at least 6 characters" },
                          })}
                          className={`w-full px-4 py-3 rounded-xl border-2 ${
                            passwordErrors.newPassword
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 dark:border-white/10 focus:border-red-500"
                          } focus:outline-none dark:bg-[#222] dark:text-white transition-colors text-base`}
                          placeholder="New password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showNewPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {passwordErrors.newPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          {...registerPassword("confirmPassword", {
                            required: "Please confirm your new password",
                            validate: (value) => value === newPassword || "Passwords do not match",
                          })}
                          className={`w-full px-4 py-3 rounded-xl border-2 ${
                            passwordErrors.confirmPassword
                              ? "border-red-300 focus:border-red-500"
                              : "border-gray-200 dark:border-white/10 focus:border-red-500"
                          } focus:outline-none dark:bg-[#222] dark:text-white transition-colors text-base`}
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                        >
                          {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                      {passwordErrors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword.message}</p>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setActiveSection("general")}
                        className="flex-1 py-3 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white font-bold rounded-xl transition-colors text-center text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 py-3 bg-[#7B0A0A] hover:bg-[#AE020B] text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-md disabled:opacity-60"
                      >
                        <FiSave />
                        Update Password
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Notification Preferences */}
              {activeSection === "notifications" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm divide-y divide-gray-50 dark:divide-white/5"
                >
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Order Updates</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">Emails for order placements and status changes</span>
                    </div>
                    <button
                      onClick={() => handleTogglePref("orderUpdates")}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        notificationPrefs.orderUpdates ? "bg-[#7B0A0A]" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`${
                          notificationPrefs.orderUpdates ? "translate-x-6" : "translate-x-1"
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4">
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Promotions & Discounts</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">Alerts on newly released discount coupons and sales</span>
                    </div>
                    <button
                      onClick={() => handleTogglePref("promotions")}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        notificationPrefs.promotions ? "bg-[#7B0A0A]" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`${
                          notificationPrefs.promotions ? "translate-x-6" : "translate-x-1"
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4">
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">Newsletters</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">Weekly updates and curated product collections</span>
                    </div>
                    <button
                      onClick={() => handleTogglePref("newsletter")}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        notificationPrefs.newsletter ? "bg-[#7B0A0A]" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`${
                          notificationPrefs.newsletter ? "translate-x-6" : "translate-x-1"
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4">
                    <div>
                      <span className="font-bold text-gray-700 dark:text-gray-200 text-sm block">SMS Alerts</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs">Immediate SMS updates for dispatch notifications</span>
                    </div>
                    <button
                      onClick={() => handleTogglePref("smsAlerts")}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        notificationPrefs.smsAlerts ? "bg-[#7B0A0A]" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`${
                          notificationPrefs.smsAlerts ? "translate-x-6" : "translate-x-1"
                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-b-2xl">
                    <button
                      onClick={() => setActiveSection("general")}
                      className="w-full py-2.5 bg-[#7B0A0A] hover:bg-[#AE020B] text-white font-bold rounded-xl transition-colors text-center text-sm"
                    >
                      Back to Settings
                    </button>
                  </div>
                </motion.div>
              )}
              {/* 2FA Toggle Section */}
              {activeSection === "2fa" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <TwoFactorToggle apiPrefix="/user/auth" />
                  <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                    <button
                      onClick={() => setActiveSection("general")}
                      className="w-full py-2.5 bg-[#7B0A0A] hover:bg-[#AE020B] text-white font-bold rounded-xl transition-colors text-center text-sm"
                    >
                      Back to Settings
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileSettings;
