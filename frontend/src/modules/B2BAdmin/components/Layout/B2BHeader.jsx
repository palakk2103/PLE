import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiBell, FiSearch, FiArrowLeft, FiShoppingBag, FiSun, FiMoon } from 'react-icons/fi';
import { useB2BAdminStore } from '../../store/b2bAdminStore';
import { useB2bStore } from '../../../../shared/store/b2bStore';
import { useThemeStore } from '../../../../shared/store/themeStore';

const B2BHeader = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  const { adminProfile, fetchAdminProfile, unreadNotificationsCount, fetchNotifications } = useB2BAdminStore();
  const { theme, toggleTheme } = useThemeStore();

  const handleBackToB2BApp = () => {
    try {
      useB2bStore.getState().setUserRole('business_buyer');
    } catch (e) {
      console.error(e);
    }
    navigate('/profile');
  };

  useEffect(() => {
    if (!adminProfile) {
      fetchAdminProfile();
    }
    fetchNotifications(1);
  }, [adminProfile, fetchAdminProfile, fetchNotifications]);

  return (
    <header className="h-16 bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-4 lg:px-6 shadow-sm z-10 transition-colors duration-200">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar} 
          className="lg:hidden text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white focus:outline-none mr-4"
        >
          <FiMenu className="w-6 h-6" />
        </button>
        
        <div className="hidden md:flex items-center bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-lg px-3 py-1.5 w-64 lg:w-96">
          <FiSearch className="text-gray-400 w-4 h-4 mr-2" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="bg-transparent border-none focus:outline-none text-sm w-full text-gray-700 dark:text-gray-200"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Back to B2B Store Header Button */}
        <button
          onClick={handleBackToB2BApp}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-[#D71920] dark:hover:text-[#D71920] bg-gray-100 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg border border-gray-250 dark:border-white/10 hover:border-red-200 transition-all shadow-xs cursor-pointer"
          title="Back to B2B User App / Store"
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Back to B2B Store</span>
          <span className="sm:hidden">Store</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-1.5 sm:p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-white/10 cursor-pointer shadow-2xs"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <FiSun className="w-4 h-4 text-amber-400" />
          ) : (
            <FiMoon className="w-4 h-4 text-gray-700" />
          )}
        </button>

        <button 
          onClick={() => navigate('/b2b-dashboard/notifications')}
          className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white relative p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <FiBell className="w-5 h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#121212] animate-pulse">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>
        
        <div className="flex items-center cursor-pointer p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold mr-2 sm:mr-3 text-xs sm:text-sm">
            {adminProfile?.adminName?.charAt(0) || 'A'}
          </div>
          <div className="hidden sm:block text-sm">
            <p className="font-medium text-gray-700 dark:text-gray-200 leading-tight">{adminProfile?.adminName || 'Admin'}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              {adminProfile?.isEmployee || adminProfile?.role === 'b2bEmployee' ? 'B2B Employee' : 'B2B Admin'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default B2BHeader;
