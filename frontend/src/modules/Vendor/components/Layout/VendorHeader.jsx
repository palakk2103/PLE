import { useEffect, useState } from "react";
import { FiMenu, FiBell, FiLogOut, FiShoppingBag, FiSun, FiMoon } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { useVendorAuthStore } from "../../store/vendorAuthStore";
import { useVendorNotificationStore } from "../../store/vendorNotificationStore";
import { useThemeStore } from "../../../../shared/store/themeStore";
import toast from "react-hot-toast";
import Button from "../../../Admin/components/Button";
import VendorNotificationWindow from "./VendorNotificationWindow";
import logoImage from "../../../../assets/PLEwhite.png";

const VendorHeader = ({ onMenuClick, isCollapsed = false, onToggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { vendor, logout } = useVendorAuthStore();
  const { unreadCount, fetchNotifications } = useVendorNotificationStore();
  const { theme, toggleTheme } = useThemeStore();
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(), 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/vendor/login");
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  // Get page name from pathname
  const getPageName = (pathname) => {
    const path = pathname.split("/").pop() || "dashboard";
    const pageNames = {
      dashboard: "Dashboard",
      products: "Products",
      orders: "Orders",
      analytics: "Analytics",
      earnings: "Earnings",
      settings: "Settings",
      profile: "Profile",
    };
    return pageNames[path] || path.charAt(0).toUpperCase() + path.slice(1);
  };

  const pageName = getPageName(location.pathname);
  const storeName = vendor?.storeName || vendor?.name || "Vendor Store";

  return (
    <header
      className={`bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-white/10 fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${
        isCollapsed ? "lg:left-20" : "lg:left-64"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}>
      <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        {/* Left: Menu Button & Page Title */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button
            onClick={() => {
              if (window.innerWidth < 1024) {
                onMenuClick?.();
              } else {
                onToggleCollapse?.();
              }
            }}
            variant="icon"
            className="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 flex-shrink-0"
            icon={FiMenu}
            title="Toggle Sidebar"
          />

          {/* Page Heading - Desktop & Laptop */}
          <div className="hidden sm:flex items-center gap-3 md:gap-5 min-w-0">
            <img src={logoImage} alt="PLE Logo" className="h-8 md:h-9 w-auto object-contain hidden md:block flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-800 dark:text-white truncate">
                {pageName}
              </h1>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5 truncate">
                <FiShoppingBag className="text-primary-500 flex-shrink-0" />
                <span className="truncate max-w-[200px] lg:max-w-[320px]">{storeName}</span>
              </p>
            </div>
          </div>

          {/* Mobile Page Title */}
          <div className="sm:hidden min-w-0">
            <h1 className="text-base font-bold text-gray-800 dark:text-white truncate">
              {pageName}
            </h1>
          </div>
        </div>

        {/* Right: Theme Toggle, Notifications & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-white/10 cursor-pointer shadow-2xs"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <FiSun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            ) : (
              <FiMoon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <Button
              data-notification-button
              onClick={toggleNotifications}
              variant="icon"
              className="text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
              icon={FiBell}
            />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}

            {/* Notification Window - positioned relative to this container */}
            <VendorNotificationWindow
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              position="right"
            />
          </div>

          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            variant="ghost"
            icon={FiLogOut}
            size="sm"
            className="text-gray-700 dark:text-gray-200 hover:bg-red-600 hover:text-white hover:border-red-600 border border-gray-300 dark:border-white/10 text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default VendorHeader;
