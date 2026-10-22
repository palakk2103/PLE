import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiShield, FiKey, FiUserCheck, FiSun, FiMoon } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminAuthStore } from '../store/adminStore';
import { ADMIN_DASHBOARD_ROUTE } from '../config/adminRoutesConfig';
import toast from 'react-hot-toast';
import TwoFactorVerify from '../../../shared/components/TwoFactorVerify';
import logoImageWhite from '../../../assets/PLEwhite.png';
import logoImageBlack from '../../../assets/PLELOGOBLACK-removebg-preview (1).png';
import { useThemeStore } from '../../../shared/store/themeStore';

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useAdminAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [twoFactorData, setTwoFactorData] = useState(null);

  // Tab mode: 'gateway' (Super Admin) vs 'organizational' (Account Team)
  const [activeTab, setActiveTab] = useState('gateway');

  // Super Admin form state
  const [superAdminData, setSuperAdminData] = useState({
    identityId: '',
    email: '',
    password: '',
    personalSecret: '',
  });

  // Account Team Organizational Terminal form state
  const [orgData, setOrgData] = useState({
    identityId: '',
    email: '',
    password: '',
    personalSecret: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || ADMIN_DASHBOARD_ROUTE;
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSuperAdminChange = (e) => {
    setSuperAdminData({
      ...superAdminData,
      [e.target.name]: e.target.value,
    });
  };

  const handleOrgChange = (e) => {
    setOrgData({
      ...orgData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSuperAdminSubmit = async (e) => {
    e.preventDefault();
    const identityIdTrimmed = String(superAdminData.identityId || '').trim().toUpperCase();
    const passwordTrimmed = String(superAdminData.password || '').trim();
    const secretTrimmed = String(superAdminData.personalSecret || '').trim();

    if (!identityIdTrimmed || !passwordTrimmed || !secretTrimmed) {
      toast.error('Please enter Super Admin Identity ID, Domain Password, and Personal Secret Code');
      return;
    }

    try {
      const result = await login({
        identityId: identityIdTrimmed,
        email: superAdminData.email ? superAdminData.email.trim() : undefined,
        password: passwordTrimmed,
        personalSecret: secretTrimmed,
        role: 'superadmin'
      }, rememberMe);

      if (result?.twoFactorRequired) {
        setTwoFactorData({
          tempToken: result.tempToken,
          email: result.email,
          apiVerifyEndpoint: '/admin/auth/2fa/verify-login'
        });
        return;
      }
      toast.success(`Super Admin Verified: Welcome, ${result.admin?.name || 'Super Administrator'}!`);
      const from = location.state?.from?.pathname || ADMIN_DASHBOARD_ROUTE;
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Authentication failed. Please verify Super Admin credentials.');
    }
  };

  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    const identityIdTrimmed = String(orgData.identityId || '').trim().toUpperCase();
    const passwordTrimmed = String(orgData.password || '').trim();
    const secretTrimmed = String(orgData.personalSecret || '').trim();

    if (!identityIdTrimmed || !passwordTrimmed || !secretTrimmed) {
      toast.error('Please provide Identity ID, Domain Password, and Personal Secret Code');
      return;
    }

    try {
      const result = await login({
        identityId: identityIdTrimmed,
        email: orgData.email ? orgData.email.trim() : undefined,
        password: passwordTrimmed,
        personalSecret: secretTrimmed
      }, rememberMe);

      if (result?.twoFactorRequired) {
        setTwoFactorData({
          tempToken: result.tempToken,
          email: result.email,
          apiVerifyEndpoint: '/admin/auth/2fa/verify-login'
        });
        return;
      }

      toast.success(`Identity Verified: Welcome, ${result.admin?.name || 'Team Member'}!`);
      const from = location.state?.from?.pathname || ADMIN_DASHBOARD_ROUTE;
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Authentication failed. Please verify Identity credentials.');
    }
  };

  if (twoFactorData) {
    const handleSuccess = () => {
      toast.success('Login successful!');
      const from = location.state?.from?.pathname || ADMIN_DASHBOARD_ROUTE;
      navigate(from, { replace: true });
    };

    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#0B0B0E] flex items-center justify-center p-4 transition-colors duration-300 relative">
        <button
          type="button"
          onClick={toggleTheme}
          className="absolute right-6 top-6 p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 transition-colors cursor-pointer shadow-sm"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <FiSun className="w-5 h-5 text-amber-400" />
          ) : (
            <FiMoon className="w-5 h-5 text-gray-700" />
          )}
        </button>
        <TwoFactorVerify
          tempToken={twoFactorData.tempToken}
          email={twoFactorData.email}
          apiVerifyEndpoint={twoFactorData.apiVerifyEndpoint}
          onSuccess={handleSuccess}
          onCancel={() => setTwoFactorData(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0B0B0E] relative overflow-hidden flex items-center justify-center p-4 transition-colors duration-300">
      {/* Ambient Brand Red Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#D71920]/8 dark:bg-[#D71920]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-24 right-1/4 w-80 h-80 bg-[#B51218]/5 dark:bg-[#B51218]/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-xl dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] relative border border-gray-200 dark:border-white/10 backdrop-blur-2xl bg-white/95 dark:bg-[#141418]/95 text-gray-900 dark:text-gray-100 z-10 transition-colors duration-300"
      >
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute left-6 top-6 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full"
          title="Go Back"
        >
          <FiArrowLeft className="text-xl" />
        </button>

        {/* Light / Dark Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="absolute right-6 top-6 p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 transition-colors cursor-pointer shadow-sm"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <FiSun className="w-5 h-5 text-amber-400" />
          ) : (
            <FiMoon className="w-5 h-5 text-gray-700" />
          )}
        </button>

        {/* Header with Official PLE Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl mb-3 shadow-inner">
            <img 
              src={theme === 'dark' ? logoImageWhite : logoImageBlack} 
              alt="PLE Logo" 
              className="h-10 sm:h-12 w-auto object-contain drop-shadow" 
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-1 tracking-tight">
            PLE Admin Portal
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Authorized Personnel Terminal & Organizational Gateway
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-gray-100 dark:bg-[#0D0D11] rounded-2xl mb-6 border border-gray-200 dark:border-white/10 text-xs sm:text-sm font-semibold transition-colors">
          <button
            type="button"
            onClick={() => setActiveTab('gateway')}
            className={`py-2.5 px-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'gateway'
                ? 'bg-[#D71920] text-white shadow-lg shadow-[#D71920]/30 font-bold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
            }`}
          >
            <FiShield className="text-base" />
            <span>Super Admin</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('organizational')}
            className={`py-2.5 px-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'organizational'
                ? 'bg-[#D71920] text-white shadow-lg shadow-[#D71920]/30 font-bold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
            }`}
          >
            <FiUserCheck className="text-base" />
            <span>Account Team</span>
          </button>
        </div>

        {/* Forms Container */}
        <AnimatePresence mode="wait">
          {activeTab === 'organizational' ? (
            <motion.form
              key="org-form"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleOrgSubmit}
              className="space-y-4"
            >
              {/* Identity ID Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Organizational Identity ID <span className="text-[#D71920]">*</span>
                </label>
                <div className="relative">
                  <FiUserCheck className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="identityId"
                    value={orgData.identityId}
                    onChange={handleOrgChange}
                    placeholder="e.g. PLE-EMP-000001"
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-[#0D0D11] border border-gray-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] text-gray-900 dark:text-white text-sm font-mono placeholder:text-gray-400 dark:placeholder:text-gray-500 uppercase transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Corporate Email Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Corporate Email
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={orgData.email}
                    onChange={handleOrgChange}
                    placeholder="your.name@ple.internal"
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-[#0D0D11] border border-gray-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
                  />
                </div>
              </div>

              {/* Domain Password Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Domain Password <span className="text-[#D71920]">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={orgData.password}
                    onChange={handleOrgChange}
                    placeholder="Enter domain password"
                    className="w-full pl-11 pr-11 py-2.5 bg-gray-50 dark:bg-[#0D0D11] border border-gray-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  >
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              {/* Personal Secret Code Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Personal Secret Code <span className="text-[#D71920]">*</span>
                </label>
                <div className="relative">
                  <FiKey className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showSecret ? 'text' : 'password'}
                    name="personalSecret"
                    value={orgData.personalSecret}
                    onChange={handleOrgChange}
                    placeholder="Enter individual personal secret"
                    className="w-full pl-11 pr-11 py-2.5 bg-gray-50 dark:bg-[#0D0D11] border border-gray-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  >
                    {showSecret ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#D71920] bg-gray-100 dark:bg-[#0D0D11] border-gray-300 dark:border-white/20"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-300">Remember terminal session</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-2 bg-gradient-to-r from-[#D71920] to-[#E22A31] hover:from-[#B51218] hover:to-[#D71920] text-white rounded-xl font-bold tracking-wider uppercase text-xs sm:text-sm shadow-lg shadow-[#D71920]/30 hover:shadow-[#D71920]/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {isLoading ? (
                  <span>Authenticating Identity...</span>
                ) : (
                  <>
                    <FiShield />
                    <span>AUTHENTICATE ACCOUNT TEAM MEMBER</span>
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="gateway-form"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleSuperAdminSubmit}
              className="space-y-4"
            >
              {/* Identity ID Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Super Admin Identity ID <span className="text-[#D71920]">*</span>
                </label>
                <div className="relative">
                  <FiShield className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="identityId"
                    value={superAdminData.identityId}
                    onChange={handleSuperAdminChange}
                    placeholder="e.g. PLE-SA-000001"
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-[#0D0D11] border border-gray-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] text-gray-900 dark:text-white text-sm font-mono placeholder:text-gray-400 dark:placeholder:text-gray-500 uppercase transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Corporate Email Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Corporate / Domain Email
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={superAdminData.email}
                    onChange={handleSuperAdminChange}
                    placeholder="admin@admin.com"
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-[#0D0D11] border border-gray-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
                  />
                </div>
              </div>

              {/* Domain Password Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Domain Password <span className="text-[#D71920]">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={superAdminData.password}
                    onChange={handleSuperAdminChange}
                    placeholder="Enter super admin password"
                    className="w-full pl-11 pr-11 py-2.5 bg-gray-50 dark:bg-[#0D0D11] border border-gray-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  >
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              {/* Personal Secret Code Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Personal Secret Code <span className="text-[#D71920]">*</span>
                </label>
                <div className="relative">
                  <FiKey className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type={showSecret ? 'text' : 'password'}
                    name="personalSecret"
                    value={superAdminData.personalSecret}
                    onChange={handleSuperAdminChange}
                    placeholder="Enter super admin personal secret"
                    className="w-full pl-11 pr-11 py-2.5 bg-gray-50 dark:bg-[#0D0D11] border border-gray-300 dark:border-white/15 rounded-xl focus:outline-none focus:border-[#D71920] focus:ring-1 focus:ring-[#D71920] text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  >
                    {showSecret ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#D71920] bg-gray-100 dark:bg-[#0D0D11] border-gray-300 dark:border-white/20"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-300">Remember terminal session</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-2 bg-gradient-to-r from-[#D71920] to-[#E22A31] hover:from-[#B51218] hover:to-[#D71920] text-white rounded-xl font-bold tracking-wider uppercase text-xs sm:text-sm shadow-lg shadow-[#D71920]/30 hover:shadow-[#D71920]/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {isLoading ? (
                  <span>Authenticating Terminal...</span>
                ) : (
                  <>
                    <FiShield />
                    <span>AUTHENTICATE SUPER ADMIN TERMINAL</span>
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Development Credentials Helper Box */}
        {import.meta.env.DEV && (
          <div className="mt-6 p-3.5 bg-gray-50 dark:bg-[#0D0D11]/80 border border-gray-200 dark:border-white/10 rounded-xl transition-colors">
            <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold mb-1.5 flex items-center justify-between">
              <span>Terminal Access Credentials (DEV ONLY):</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 rounded border border-emerald-300 dark:border-emerald-500/20">DEV MODE</span>
            </p>
            <div className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1.5 font-mono">
              <p>
                <span className="text-gray-800 dark:text-gray-200 font-medium">Super Admin:</span> ID: <span className="text-[#D71920] font-bold">PLE-SA-000001</span> | Pass: admin@123 | Secret: PLE#Sec99
              </p>
              <p>
                <span className="text-gray-800 dark:text-gray-200 font-medium">Account Team:</span> ID: <span className="text-blue-600 dark:text-blue-400 font-bold">PLE-EMP-000001</span> | Pass: TempPassword@123 | Secret: PLE#Sec99
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminLogin;
