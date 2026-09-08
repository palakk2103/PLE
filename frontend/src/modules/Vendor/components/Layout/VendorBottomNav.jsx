import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHome,
  FiPackage,
  FiShoppingBag,
  FiDollarSign,
} from "react-icons/fi";

import { useVendorAuthStore } from "../../store/vendorAuthStore";
import useKeyboardVisible from "../../../../shared/hooks/useKeyboardVisible";

const VendorBottomNav = () => {
  const location = useLocation();
  const { vendor } = useVendorAuthStore();
  const isManagedVendor = vendor?.role === "managed_vendor";
  const isKeyboardVisible = useKeyboardVisible();

  const navItems = isManagedVendor
    ? [
        { path: "/vendor/dashboard", icon: FiHome, label: "Home" },
        { path: "/vendor/products", icon: FiPackage, label: "Products" },
        { path: "/vendor/orders", icon: FiShoppingBag, label: "Orders" },
      ]
    : [
        { path: "/vendor/dashboard", icon: FiHome, label: "Home" },
        { path: "/vendor/products", icon: FiPackage, label: "Products" },
        { path: "/vendor/orders", icon: FiShoppingBag, label: "Orders" },
        { path: "/vendor/earnings", icon: FiDollarSign, label: "Earnings" },
      ];

  const isActive = (path) => {
    if (path === "/vendor/dashboard") {
      return location.pathname === "/vendor/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  // Animation variants for icon
  const iconVariants = {
    inactive: {
      scale: 1,
      color: "#878787",
    },
    active: {
      scale: 1.1,
      color: "#2874F0", // Primary color
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
  };

  const navContent = (
    <AnimatePresence>
      {!isKeyboardVisible && (
        <motion.nav
          data-bottom-nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="mobile-bottom-nav fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[9999] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] lg:hidden"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="flex items-center justify-around h-16 px-1" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center justify-center flex-1 h-full gap-1">
                  <motion.div
                    className={`relative flex items-center justify-center ${
                      active ? "text-[#2874F0]" : "text-[#878787]"
                    }`}
                    variants={iconVariants}
                    initial="inactive"
                    animate={active ? "active" : "inactive"}>
                    <Icon
                      className="text-2xl"
                      style={{
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: 2,
                      }}
                    />
                  </motion.div>
                  <span
                    className={`text-xs font-medium ${
                      active ? "text-primary-600" : "text-gray-500"
                    }`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );

  // Use portal to render outside of transformed containers
  return createPortal(navContent, document.body);
};

export default VendorBottomNav;

