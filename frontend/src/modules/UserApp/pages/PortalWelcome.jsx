import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import { useB2bStore } from '../../../shared/store/b2bStore';
import { useThemeStore } from '../../../shared/store/themeStore';
import pleLogo from '../../../assets/PLEwhite.png';

import { useAuthStore } from '../../../shared/store/authStore';
import { useB2BAdminStore } from '../../B2BAdmin/store/b2bAdminStore';

const PortalWelcome = ({ type }) => {
  const navigate = useNavigate();
  const setUserRole = useB2bStore((state) => state.setUserRole);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isB2BAuthenticated = useB2BAdminStore((state) => state.isAuthenticated);
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const b2bToken = localStorage.getItem('b2bAdminToken') || sessionStorage.getItem('b2bAdminToken');

  React.useEffect(() => {
    if ((isAuthenticated && token) || (isB2BAuthenticated && b2bToken)) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, isB2BAuthenticated, token, b2bToken, navigate]);

  const { theme } = useThemeStore();
  const isDarkMode = theme === 'dark';

  const isB2B = type === 'business';

  const handleSignIn = () => {
    if (isB2B) {
      setUserRole('business_buyer');
      navigate('/b2b/login');
    } else {
      setUserRole('customer');
      navigate('/login');
    }
  };

  const handleSignUp = () => {
    if (isB2B) {
      setUserRole('business_buyer');
      navigate('/b2b/register');
    } else {
      setUserRole('customer');
      navigate('/register');
    }
  };

  const handleSkip = () => {
    if (isB2B) {
      setUserRole('business_buyer');
    } else {
      setUserRole('customer');
    }
    navigate('/home');
  };

  const benefits = isB2B
    ? [
        'Request custom RFQs & bulk quotes',
        'Download 100% GST-compliant invoices',
        'Access volume-based discount tiers',
      ]
    : [
        'View your wish list',
        'Find & reorder past purchases',
        'Track your active deliveries',
      ];

  return (
    <div className={`w-full min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-300 relative ${
      isDarkMode 
        ? 'bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white' 
        : 'bg-gradient-to-b from-gray-100 via-white to-gray-100 text-gray-900'
    }`}>
      {/* Back Button */}
      <button
        onClick={() => navigate('/portal')}
        className={`absolute top-6 left-6 p-3 rounded-full border transition-all duration-200 shadow-sm flex items-center gap-2 font-bold text-sm ${
          isDarkMode
            ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
            : 'bg-white border-gray-250 text-gray-700 hover:bg-gray-50 hover:text-gray-900'
        }`}
        aria-label="Back to selection"
      >
        <FiArrowLeft size={16} />
        Back
      </button>

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`w-full max-w-md p-8 rounded-3xl border shadow-xl flex flex-col items-center text-center backdrop-blur-md ${
          isDarkMode
            ? 'bg-zinc-900/60 border-zinc-800/80 shadow-black/40'
            : 'bg-white/80 border-gray-200/80 shadow-gray-300/40'
        }`}
      >
        {/* Logo Container */}
        <div className={`w-24 h-24 mb-6 rounded-full p-1 flex items-center justify-center shadow-md border ${
          isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-100'
        }`}>
          <img
            src={pleLogo}
            alt="PLE Logo"
            className="w-20 h-20 rounded-full object-cover"
          />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">
          {isB2B ? 'Welcome to Business Portal' : 'Welcome to Retail Store'}
        </h1>
        <p className={`text-sm mb-6 font-medium ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
          {isB2B ? 'Sign in to access your business benefits' : 'Sign in to your account'}
        </p>

        {/* Benefits List */}
        <div className="w-full space-y-3 mb-8 text-left pl-2">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-3">
              <FiCheckCircle className="text-[#AE020B] shrink-0" size={18} />
              <span className={`text-sm font-semibold ${isDarkMode ? 'text-zinc-300' : 'text-gray-600'}`}>
                {benefit}
              </span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-4">
          {/* Gold / Primary Button */}
          <button
            onClick={handleSignIn}
            className="w-full bg-gradient-to-b from-[#E22A31] to-[#D71920] hover:from-[#F23B42] hover:to-[#B51218] active:from-[#B51218] active:to-[#D71920] text-white border border-[#B51218] font-bold py-3 px-6 rounded-xl shadow-sm transition-all text-sm tracking-wide"
          >
            {isB2B ? 'Already a business buyer? Sign in' : 'Already a customer? Sign in'}
          </button>

          {/* Secondary Button */}
          <button
            onClick={handleSignUp}
            className="w-full bg-gradient-to-b from-[#f7f8fa] to-[#e7e9ec] hover:from-[#e7e9ec] hover:to-[#d9dce1] active:from-[#e7e9ec] active:to-[#f7f8fa] text-zinc-900 border border-[#adb1b8] font-bold py-3 px-6 rounded-xl shadow-sm transition-all text-sm tracking-wide"
          >
            {isB2B ? 'New to PLE Business? Create an account' : 'New to PLE? Create an account'}
          </button>

          {/* Skip Button */}
          {!isB2B && (
            <button
              onClick={handleSkip}
              className={`w-full py-2.5 px-6 font-bold text-sm tracking-wide bg-transparent transition-all hover:underline ${
                isDarkMode
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Skip sign in
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PortalWelcome;
