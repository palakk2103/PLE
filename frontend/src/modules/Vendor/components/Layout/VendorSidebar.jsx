import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHome,
  FiPackage,
  FiShoppingBag,
  FiBarChart2,
  FiDollarSign,
  FiSettings,
  FiUser,
  FiChevronDown,
  FiX,
  FiTrendingDown,
  FiCreditCard,
  FiMapPin,
  FiMessageCircle,
  FiRefreshCw,
  FiStar,
  FiFileText,
  FiTag,
  FiBell,
  FiTruck,
  FiUsers,
  FiMessageSquare,
  FiTrendingUp,
  FiFile,
  FiInbox,
} from "react-icons/fi";
import { useVendorAuthStore } from "../../store/vendorAuthStore";
import vendorMenu from "../../config/vendorMenu.json";

// Icon mapping for menu items
const iconMap = {
  Dashboard: FiHome,
  Products: FiPackage,
  Orders: FiShoppingBag,
  "B2B Enquiries": FiInbox,
  "Direct RFQs": FiFileText,
  "Product Enquiries": FiMessageSquare,
  "Product Requests": FiInbox,
  "Return Requests": FiRefreshCw,
  "Product Reviews": FiStar,
  "Stock Management": FiTrendingDown,
  "Wallet History": FiCreditCard,
  "Pickup Locations": FiMapPin,
  Chat: FiMessageCircle,
  "Admin Support Chat": FiMessageSquare,
  Promotions: FiTag,
  "Festival Campaigns": FiTag,
  Notifications: FiBell,
  "Shipping Management": FiTruck,
  Customers: FiUsers,
  "Support Tickets": FiMessageSquare,
  "Support Escalations": FiMessageSquare,
  "Inventory Reports": FiBarChart2,
  "Performance Metrics": FiTrendingUp,
  Documents: FiFile,
  "Legal Documents": FiFileText,
  Analytics: FiBarChart2,
  Earnings: FiDollarSign,
  Settings: FiSettings,
  Profile: FiUser,
};

// Helper function to convert child name to route path
const getChildRoute = (parentRoute, childName) => {
  const routeMap = {
    "/vendor/products": {
      "Manage Products": "/vendor/products/manage-products",
      "Add Product": "/vendor/products/add-product",
      "Bulk Upload Products": "/vendor/products/bulk-upload",
      "Add Refurbished Product": "/vendor/products/add-product?condition=refurbished",
    },
    "/vendor/orders": {
      "All Orders": "/vendor/orders/all-orders",
      "Bulk Orders": "/vendor/orders/bulk-orders",
      "Order Tracking": "/vendor/orders/order-tracking",
    },
    "/vendor/b2b-enquiries": {
      "B2B Seller Application": "/vendor/b2b-application",
      "All Enquiries": "/vendor/b2b-enquiries/all",
      "B2B Orders": "/vendor/b2b-enquiries/orders",
      "B2B Analytics": "/vendor/b2b-enquiries/analytics",
      "B2B Settings": "/vendor/b2b-enquiries/settings",
    },
    "/vendor/earnings": {
      "Earnings Overview": "/vendor/earnings/overview",
      "Wallet": "/vendor/earnings/wallet",
      "Withdrawals": "/vendor/earnings/withdrawals",
      "Transactions": "/vendor/earnings/transactions",
      "Settlements": "/vendor/earnings/settlements",
      "Commission History": "/vendor/earnings/commission-history",
      "Settlement History": "/vendor/earnings/settlement-history",
    },
    "/vendor/settings": {
      "Store Settings": "/vendor/settings/store",
      "GST Settings": "/vendor/settings/gst",
      "Payment Settings": "/vendor/settings/payment",
      "Shipping Settings": "/vendor/settings/shipping",
    },
    "/vendor/shipping-management": {
      "Dispatch Settings": "/vendor/delivery-settings",
    },
  };

  return routeMap[parentRoute]?.[childName] || parentRoute;
};

const VendorSidebar = ({ isOpen, onClose, isCollapsed = false, onToggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { vendor } = useVendorAuthStore();
  const [expandedItems, setExpandedItems] = useState({});
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Auto-expand menu items when their route is active
  useEffect(() => {
    const activeItem = vendorMenu.find((item) => {
      if (item.route === "/vendor/dashboard") {
        return location.pathname === "/vendor/dashboard";
      }
      const isChildRoute =
        location.pathname.startsWith(item.route) &&
        location.pathname !== item.route;
      return isChildRoute;
    });
    if (activeItem && activeItem.children && activeItem.children.length > 0) {
      setExpandedItems((prev) => {
        if (prev[activeItem.title]) {
          return prev;
        }
        return {
          [activeItem.title]: true,
        };
      });
    }
  }, [location.pathname]);

  // Check if a menu item is active
  const isActive = (route) => {
    if (route === "/vendor/dashboard") {
      return location.pathname === "/vendor/dashboard";
    }
    return location.pathname.startsWith(route);
  };

  // Toggle expanded state for menu items with children
  const toggleExpand = (title, closeOthers = true) => {
    setExpandedItems((prev) => {
      if (closeOthers) {
        return {
          [title]: !prev[title],
        };
      } else {
        return {
          ...prev,
          [title]: !prev[title],
        };
      }
    });
  };

  // Handle menu item click
  const handleMenuItemClick = (route, parentTitle = null) => {
    if (parentTitle) {
      setExpandedItems((prev) => {
        return {
          [parentTitle]: true,
        };
      });
    }
    navigate(route);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  // Render menu item
  const renderMenuItem = (item, collapsed = false) => {
    const Icon = iconMap[item.title] || FiPackage;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems[item.title];
    const active = isActive(item.route);

    if (collapsed) {
      return (
        <div key={item.route} className="mb-1 relative group">
          <div
            onClick={() => {
              handleMenuItemClick(item.route);
            }}
            title={item.title}
            className={`
              flex items-center justify-center w-12 h-12 mx-auto rounded-xl transition-all duration-200 cursor-pointer
              ${
                active
                  ? "bg-[#C07A3D] text-white shadow-sm"
                  : "text-[#C8B3A3] hover:bg-[#2A1F1A]"
              }
            `}>
            <Icon className="text-xl" />
          </div>
          {/* Tooltip on hover in collapsed mode */}
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity whitespace-nowrap z-50">
            {item.title}
          </div>
        </div>
      );
    }

    return (
      <div key={item.route} className="mb-1">
        {/* Main Menu Item */}
        <div
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer
            ${
              active
                ? "bg-[#C07A3D] text-white shadow-sm"
                : "text-[#C8B3A3] hover:bg-[#2A1F1A]"
            }
          `}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(item.title, true);
            } else {
              handleMenuItemClick(item.route);
            }
          }}>
          <Icon
            className={`text-xl flex-shrink-0 ${
              active ? "text-white" : "text-[#8E7768]"
            }`}
          />
          <span className="font-medium flex-1 text-sm">{item.title}</span>
          {hasChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}>
              <FiChevronDown className="text-[#8E7768] text-sm" />
            </motion.div>
          )}
        </div>

        {/* Children Items */}
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden">
              <div className="ml-4 mt-1 pl-4 border-l-2 border-white/[0.06] space-y-1">
                {item.children.map((child, index) => {
                  const childRoute = getChildRoute(item.route, child);
                  const isChildActive =
                    location.pathname === childRoute ||
                    (childRoute !== item.route &&
                      location.pathname.startsWith(childRoute));

                  return (
                    <div
                      key={index}
                      onClick={() =>
                        handleMenuItemClick(childRoute, item.title)
                      }
                      className={`
                        px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer
                        ${
                          isChildActive
                            ? "bg-[#C07A3D]/15 text-[#F5E6DA] font-medium"
                            : "text-[#8E7768] hover:bg-[#2A1F1A]"
                        }
                      `}>
                      {child}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Sidebar content
  const renderSidebarContent = (collapsed = false) => (
    <div className="h-full flex flex-col bg-[#1A1310] shadow-xl">
      {/* Header Section */}
      <div className={`p-4 border-b border-white/[0.06] bg-[#120D0B] ${collapsed ? "px-2 text-center" : ""}`}>
        {/* Header with Close Button and Vendor Info */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between gap-3"}`}>
          {/* Vendor User Info */}
          <div className={`flex items-center gap-3 min-w-0 ${collapsed ? "justify-center" : "flex-1"}`}>
            <div className="w-10 h-10 lg:w-11 lg:h-11 bg-gradient-to-br from-[#C07A3D] to-[#D18B4A] rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <FiShoppingBag className="text-white text-lg" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-white text-sm truncate">
                  {vendor?.storeName || vendor?.name || "Vendor Store"}
                </h2>
                <p className="text-xs text-[#8E7768] truncate">
                  {vendor?.email || "vendor@example.com"}
                </p>
              </div>
            )}
          </div>

          {/* Close Button - Mobile Only */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0 lg:hidden"
            aria-label="Close sidebar">
            <FiX className="text-xl text-[#C8B3A3]" />
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? "p-2" : "p-3"} scrollbar-admin lg:pb-3`}>
        {(() => {
          const allowedTitles = ["Dashboard", "Products", "Orders", "Return Requests", "Admin Support Chat", "Profile"];
          const isManagedVendor = vendor?.role === "managed_vendor";
          const filteredMenu = isManagedVendor
            ? vendorMenu.filter((item) => allowedTitles.includes(item.title))
            : vendorMenu;
          return filteredMenu.map((item) => renderMenuItem(item, collapsed));
        })()}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile: Overlay Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[9998] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-64 max-w-[80vw] z-[10000] lg:hidden">
            {renderSidebarContent(false)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop / Laptop Fixed */}
      <div
        className={`hidden lg:flex fixed left-0 top-0 bottom-0 z-20 transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-64"
        }`}>
        {renderSidebarContent(isCollapsed)}
      </div>
    </>
  );
};

export default VendorSidebar;
