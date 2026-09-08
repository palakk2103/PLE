import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiGlobe, FiCheckCircle, FiSun, FiMoon } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useB2bStore } from '../../../shared/store/b2bStore';
import { useThemeStore } from '../../../shared/store/themeStore';
import pleLogo from '../../../assets/PLEwhite.png';
import splashVideo from '../../../assets/splashVideo.mp4';

import { useAuthStore } from '../../../shared/store/authStore';
import { useB2BAdminStore } from '../../B2BAdmin/store/b2bAdminStore';

const PortalSelection = () => {
  const navigate = useNavigate();
  const setUserRole = useB2bStore((state) => state.setUserRole);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isB2BAuthenticated = useB2BAdminStore((state) => state.isAuthenticated);
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const b2bToken = localStorage.getItem('b2bAdminToken') || sessionStorage.getItem('b2bAdminToken');

  // If user is already authenticated with a saved token, skip selection and navigate directly to /home
  useEffect(() => {
    if ((isAuthenticated && token) || (isB2BAuthenticated && b2bToken)) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, isB2BAuthenticated, token, b2bToken, navigate]);

  const [showSplash, setShowSplash] = useState(() => {
    // If user is logged in, don't show splash
    if ((isAuthenticated && token) || (isB2BAuthenticated && b2bToken)) return false;
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    if (isDesktop) return false;
    return !sessionStorage.getItem('splash-shown');
  });
  const { theme, setTheme } = useThemeStore();
  const isDarkMode = theme === 'dark';

  const [retailAgreed, setRetailAgreed] = useState(false);
  const [enterpriseAgreed, setEnterpriseAgreed] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      if (window.innerWidth >= 768) {
        setShowSplash(false);
      }
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const handleSelectB2C = () => {
    if (!retailAgreed) {
      toast.error('Please agree to the Terms & Conditions and Policies to proceed.');
      return;
    }
    setUserRole('customer');
    navigate('/portal/retail');
  };

  const handleSelectB2B = () => {
    if (!enterpriseAgreed) {
      toast.error('Please agree to the Business Terms and Policies to proceed.');
      return;
    }
    setUserRole('business_buyer');
    navigate('/portal/business');
  };

  return (
    <div className={`w-full min-h-screen overflow-hidden relative flex flex-col md:flex-row items-stretch justify-center ${isDarkMode ? 'bg-zinc-950' : 'bg-white'}`}>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black md:hidden"
          >
            <video
              src={splashVideo}
              autoPlay
              muted
              playsInline
              onEnded={() => {
                sessionStorage.setItem('splash-shown', 'true');
                setShowSplash(false);
              }}
              className="w-full h-full object-cover md:object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!showSplash && (
        <>
          {/* Floating Dark Mode Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
            className={`absolute top-6 right-6 z-30 p-3 rounded-full border transition-all duration-200 shadow-md ${isDarkMode
                ? 'bg-zinc-900 border-zinc-800 text-yellow-400 hover:bg-zinc-800'
                : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
              }`}
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
          </motion.button>

          {/* Left Panel: Retail Store (B2C) */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', stiffness: 80, damping: 15, duration: 0.8 }}
            className={`flex-1 flex flex-col justify-between p-8 md:p-16 relative z-10 ${isDarkMode ? 'bg-zinc-950' : 'bg-white'}`}
          >
            <div className="my-auto max-w-lg mx-auto w-full space-y-6">
              <div>
                <h1 className={`text-4xl md:text-5xl font-black tracking-tight mb-4 ${isDarkMode ? 'text-zinc-50' : 'text-gray-800'}`}>
                  Retail Store
                </h1>
                <p className={`text-base leading-relaxed md:text-lg ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                  A multi-category electronics retail portal built for discovering, sourcing, and purchasing the right tech with ease.
                </p>
              </div>

              {/* Quick Specs Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col items-center text-center ${isDarkMode ? 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60' : 'border-red-100 bg-white hover:shadow-md'}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${isDarkMode ? 'bg-red-950/40 text-red-400' : 'bg-red-50 text-red-600'}`}>
                    <FiUser size={24} />
                  </div>
                  <span className={`font-bold text-sm tracking-wide ${isDarkMode ? 'text-zinc-200' : 'text-gray-800'}`}>MULTI-CATEGORY STORE</span>
                  <span className={`text-xs mt-1 tracking-wider font-semibold ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Browse electronics across categories</span>
                </div>

                <div className={`border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col items-center text-center ${isDarkMode ? 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60' : 'border-red-100 bg-white hover:shadow-md'}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${isDarkMode ? 'bg-red-950/40 text-red-400' : 'bg-red-50 text-red-600'}`}>
                    <FiGlobe size={24} />
                  </div>
                  <span className={`font-bold text-sm tracking-wide ${isDarkMode ? 'text-zinc-200' : 'text-gray-800'}`}>SPECIAL REQ</span>
                  <span className={`text-xs mt-1 uppercase tracking-wider font-semibold ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>PRODUCT SOURCING</span>
                </div>
              </div>

              {/* Legal Consent Section B2C */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="retail-consent"
                  checked={retailAgreed}
                  onChange={(e) => setRetailAgreed(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-[#AE020B] focus:ring-[#AE020B] cursor-pointer accent-[#AE020B]"
                  aria-label="I agree to the retail store terms and policies"
                />
                <label htmlFor="retail-consent" className={`text-xs md:text-sm leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'} cursor-pointer select-none font-medium`}>
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate('/legal/terms'); }}
                    className="text-[#AE020B] hover:underline font-bold transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#AE020B] rounded px-0.5"
                  >
                    Terms & Conditions
                  </button>
                  {" • "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate('/legal/privacy'); }}
                    className="text-[#AE020B] hover:underline font-bold transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#AE020B] rounded px-0.5"
                  >
                    Privacy Policy
                  </button>
                  {" • "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate('/legal/user-agreement'); }}
                    className="text-[#AE020B] hover:underline font-bold transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#AE020B] rounded px-0.5"
                  >
                    User Agreement
                  </button>
                  {" • "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate('/legal/trademark'); }}
                    className="text-[#AE020B] hover:underline font-bold transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#AE020B] rounded px-0.5"
                  >
                    Trademark Policy
                  </button>
                </label>
              </div>

              {/* Button */}
              <button
                onClick={handleSelectB2C}
                className="w-full bg-[#AE020B] hover:bg-[#8d0208] text-white py-4 rounded-xl font-bold tracking-widest text-sm uppercase transition-all duration-300 hover:shadow-xl transform active:scale-[0.98]"
                aria-disabled={!retailAgreed}
              >
                ENTER PORTAL
              </button>
            </div>
          </motion.div>

          {/* Center Divider & Logo Overlay */}
          <div className="hidden md:flex flex-col items-center justify-center absolute inset-y-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 12 }}
              className={`rounded-full p-4 shadow-lg border pointer-events-auto ${isDarkMode ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-100'}`}
            >
              <img
                src={pleLogo}
                alt="PLE Logo"
                className="w-20 h-20 rounded-full object-cover border-2 border-red-600"
              />
            </motion.div>
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className={`w-[2px] flex-1 origin-top mt-4 ${isDarkMode ? 'bg-zinc-800' : 'bg-red-100'}`}
            />
          </div>

          {/* Right Panel: Enterprise (B2B) */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', stiffness: 80, damping: 15, duration: 0.8 }}
            className={`flex-1 flex flex-col justify-between p-8 md:p-16 border-t md:border-t-0 md:border-l relative z-10 ${isDarkMode ? 'bg-zinc-950 border-zinc-900' : 'bg-white border-gray-100'}`}
          >
            <div className="my-auto max-w-lg mx-auto w-full space-y-6">
              <div>
                <h1 className={`text-4xl md:text-5xl font-black tracking-tight mb-4 ${isDarkMode ? 'text-zinc-50' : 'text-gray-800'}`}>
                  Enterprise
                </h1>
                <p className={`text-base leading-relaxed md:text-lg ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                  Enquiry-based procurement, bulk quotations, and GST-compliant enterprise logistics management.
                </p>
              </div>

              {/* Features Checklist Panel */}
              <div className={`border rounded-2xl p-6 space-y-4 ${isDarkMode ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <FiCheckCircle className={`flex-shrink-0 ${isDarkMode ? 'text-red-500' : 'text-red-600'}`} size={20} />
                  <span className={`font-bold text-xs md:text-sm uppercase tracking-wider ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                    GST VALIDATION REQUIRED
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <FiCheckCircle className={`flex-shrink-0 ${isDarkMode ? 'text-red-500' : 'text-red-600'}`} size={20} />
                  <span className={`font-bold text-xs md:text-sm uppercase tracking-wider ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                    RFQ SYSTEM INTEGRATION
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <FiCheckCircle className={`flex-shrink-0 ${isDarkMode ? 'text-red-500' : 'text-red-600'}`} size={20} />
                  <span className={`font-bold text-xs md:text-sm uppercase tracking-wider ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                    BULK PRICING ENGINE
                  </span>
                </div>
              </div>

              {/* Legal Consent Section B2B */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="enterprise-consent"
                  checked={enterpriseAgreed}
                  onChange={(e) => setEnterpriseAgreed(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-[#AE020B] focus:ring-[#AE020B] cursor-pointer accent-[#AE020B]"
                  aria-label="I agree to the enterprise business terms and policies"
                />
                <label htmlFor="enterprise-consent" className={`text-xs md:text-sm leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'} cursor-pointer select-none font-medium`}>
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate('/legal/business-terms'); }}
                    className="text-[#AE020B] hover:underline font-bold transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#AE020B] rounded px-0.5"
                  >
                    Business Terms
                  </button>
                  {" • "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate('/legal/privacy'); }}
                    className="text-[#AE020B] hover:underline font-bold transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#AE020B] rounded px-0.5"
                  >
                    Privacy Policy
                  </button>
                  {" • "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate('/legal/user-agreement'); }}
                    className="text-[#AE020B] hover:underline font-bold transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#AE020B] rounded px-0.5"
                  >
                    User Agreement
                  </button>
                  {" • "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate('/legal/trademark'); }}
                    className="text-[#AE020B] hover:underline font-bold transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#AE020B] rounded px-0.5"
                  >
                    Trademark Policy
                  </button>
                </label>
              </div>

              {/* Button */}
              <button
                onClick={handleSelectB2B}
                className="w-full bg-[#AE020B] hover:bg-[#8d0208] text-white py-4 rounded-xl font-bold tracking-widest text-sm uppercase transition-all duration-300 hover:shadow-xl transform active:scale-[0.98]"
                aria-disabled={!enterpriseAgreed}
              >
                BUSINESS ONBOARDING
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default PortalSelection;
