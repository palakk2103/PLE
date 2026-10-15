import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHome,
  FiShoppingBag,
  FiRotateCcw,
  FiPackage,
  FiGrid,
  FiTag,
  FiUsers,
  FiTruck,
  FiImage,
  FiPercent,
  FiBell,
  FiMessageCircle,
  FiMessageSquare,
  FiFileText,
  FiBarChart2,
  FiSettings,
  FiGlobe,
  FiShield,
  FiDatabase,
  FiChevronDown,
  FiX,
  FiUser,
  FiBriefcase,
  FiRefreshCw,
  FiInbox,
  FiAward,
  FiCreditCard,
  FiLayout,
} from "react-icons/fi";
import { useAdminAuthStore } from "../../store/adminStore";
import { ADMIN_BASE_ROUTE, ADMIN_DASHBOARD_ROUTE } from "../../config/adminRoutesConfig";
import adminMenu from "../../config/adminMenu.json";

// Icon mapping for parent menu items
const iconMap = {
  Dashboard: FiHome,
  "Account Team": FiUsers,
  "Activity / Audit Logs": FiFileText,
  Customers: FiUsers,
  "Vendors / Sellers": FiBriefcase,
  "Marketplace Sellers": FiUsers,
  "In-House Shops & Staff": FiBriefcase,
  "In-House Staff Chats": FiMessageSquare,
  "Managed Vendor Chats": FiMessageSquare,
  "Products & Catalogue": FiPackage,
  Products: FiPackage,
  Categories: FiGrid,
  Brands: FiTag,
  "Orders & Fulfilment": FiShoppingBag,
  Orders: FiShoppingBag,
  "Return Requests": FiRotateCcw,
  "Delivery Management": FiTruck,
  "B2B Marketplace": FiBriefcase,
  "B2B Users": FiUsers,
  "RFQ Management": FiInbox,
  "Product Enquiries": FiMessageCircle,
  "Product Requests": FiInbox,
  "Refurbished Mkt": FiRefreshCw,
  "Marketing & Offers": FiPercent,
  "Offers & Sliders": FiImage,
  "Offers Management": FiPercent,
  Banners: FiImage,
  "Promo Codes": FiPercent,
  "Finance & Wallet": FiCreditCard,
  "Analytics & Finance": FiBarChart2,
  "Wallet Management": FiCreditCard,
  "Loyalty Program": FiAward,
  "Support Desk": FiMessageCircle,
  "Reports & Analytics": FiBarChart2,
  Reports: FiFileText,
  Notifications: FiBell,
  "CMS & Web Pages": FiGlobe,
  "Landing Page": FiGlobe,
  "About Page": FiLayout,
  "Portfolio Page": FiImage,
  "Settings & Policies": FiSettings,
  Settings: FiSettings,
  Policies: FiShield,
  Firebase: FiDatabase,
};

// Legacy route mapping for backward-compatibility with string children
const legacyRouteMap = {
  "/admin/orders": {
    "All Orders": "/admin/orders/all-orders",
    "Order Tracking": "/admin/orders/order-tracking",
    "Return Requests": "/admin/return-requests",
  },
  "/admin/products": {
    "Manage Products": "/admin/products/manage-products",
    "Tax & Pricing": "/admin/products/tax-pricing",
    "Product Ratings": "/admin/products/product-ratings",
    Categories: "/admin/categories/manage-categories",
    "Category Display Order": "/admin/categories/category-order",
    Brands: "/admin/brands/manage-brands",
    "Product Enquiries": "/admin/product-enquiries",
    "Product Requests": "/admin/product-requests",
  },
  "/admin/categories": {
    "Manage Categories": "/admin/categories/manage-categories",
    "Category Order": "/admin/categories/category-order",
  },
  "/admin/brands": {
    "Manage Brands": "/admin/brands/manage-brands",
  },
  "/admin/customers": {
    "View Customers": "/admin/customers/view-customers",
    Addresses: "/admin/customers/addresses",
    Transactions: "/admin/customers/transactions",
    "Customer Chats": "/admin/customers/chats",
  },
  "/admin/b2b": {
    "B2B Overview": "/admin/b2b",
    "Business Users": "/admin/b2b-users/manage",
    "User Approvals": "/admin/b2b-users/pending",
    "B2B Analytics": "/admin/b2b-users/analytics",
    "Company Management": "/admin/b2b/companies",
    "B2B Products": "/admin/b2b/b2b-products",
    "B2B Orders": "/admin/b2b/b2b-orders",
    "B2B Settings": "/admin/b2b/b2b-settings",
    "Agreement Templates": "/admin/b2b/agreement-template",
    "B2B Chats": "/admin/b2b/chats",
  },
  "/admin/delivery": {
    "Delivery Boys": "/admin/delivery/delivery-boys",
    "Cash Collection": "/admin/delivery/cash-collection",
    "Assign Delivery": "/admin/delivery/assign-delivery",
    "Logistics Control Center": "/admin/delivery-control",
  },
  "/admin/vendors": {
    "All Sellers": "/admin/vendors/manage-vendors",
    "Seller Approvals": "/admin/vendors/pending-approvals",
    "Product Approvals": "/admin/vendors/product-approvals",
    "Commission Rates": "/admin/vendors/commission-rates",
    "Vendor Analytics": "/admin/vendors/vendor-analytics",
    "In-House Managed Shops": "/admin/vendors/managed-shops",
    "In-House Staff Chats": "/admin/managed-vendor-chats",
    "B2B Seller Requests": "/admin/vendors/b2b-requests",
    "Vendor Chats": "/admin/vendors/chats",
  },
  "/admin/support": {
    Tickets: "/admin/support/tickets",
    "Ticket Types": "/admin/support/ticket-types",
    "Live Chat": "/admin/support/live-chat",
    "All Chats": "/admin/all-chats",
    "PLE Shop Chats": "/admin/ple-shop-chats",
    "Managed Vendor Chats": "/admin/managed-vendor-chats",
    "Chat Moderation": "/admin/chat-moderation",
  },
};

const getChildRoute = (child, parentRoute) => {
  let route = parentRoute;
  if (typeof child === "object" && child !== null && child.route) {
    route = child.route;
  } else if (typeof child === "string") {
    route = legacyRouteMap[parentRoute]?.[child] ||
            legacyRouteMap[String(parentRoute).replace(ADMIN_BASE_ROUTE, '/admin')]?.[child] ||
            parentRoute;
  }
  if (typeof route === "string" && route.startsWith('/admin/')) {
    route = route.replace(/^\/admin/, ADMIN_BASE_ROUTE);
  }
  return route;
};

const getChildTitle = (child) => {
  if (typeof child === "object" && child !== null && child.title) {
    return child.title;
  }
  return String(child);
};

const AdminSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin } = useAdminAuthStore();
  const [expandedItems, setExpandedItems] = useState({});
  const [, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Filter menu items based on role (Super Admin vs Account Team)
  const menuItems = useMemo(() => {
    const userRole = String(admin?.role || admin?.userType || "").toLowerCase();
    const isSuperAdmin = userRole === "superadmin" || userRole === "admin";

    return adminMenu
      .filter((item) => {
        if (item.superAdminOnly && !isSuperAdmin) {
          return false;
        }
        return true;
      })
      .map((item) => {
        if (item.children && item.children.length > 0 && !isSuperAdmin) {
          return {
            ...item,
            children: item.children.filter((child) => !child.superAdminOnly),
          };
        }
        return item;
      });
  }, [admin?.role, admin?.userType]);

  // Helper to determine active child within a parent item
  const getActiveChildIndex = (item) => {
    if (!item?.children || item.children.length === 0) return -1;
    return item.children.reduce((bestIdx, child, idx) => {
      const route = getChildRoute(child, item.route);
      if (!route) return bestIdx;
      if (route.includes("?")) {
        return location.pathname + location.search === route ? idx : bestIdx;
      }
      if (location.pathname === route) {
        return idx; // Exact route matches have highest precedence
      }
      if (location.pathname.startsWith(route + "/")) {
        if (bestIdx === -1) return idx;
        const bestRoute = getChildRoute(item.children[bestIdx], item.route);
        if (location.pathname !== bestRoute && route.length > bestRoute.length) {
          return idx; // Longer prefix match wins
        }
      }
      return bestIdx;
    }, -1);
  };

  // Check if a parent route or any of its children is active
  const isParentActive = (item) => {
    if (item.children && item.children.length > 0) {
      return getActiveChildIndex(item) !== -1;
    }
    if (item.route === "/admin/dashboard" || item.route === ADMIN_DASHBOARD_ROUTE) {
      return location.pathname === ADMIN_DASHBOARD_ROUTE || location.pathname === "/admin/dashboard";
    }
    return (
      location.pathname === item.route ||
      location.pathname.startsWith(item.route + "/")
    );
  };

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // Auto-expand menu items when their child route is active
  useEffect(() => {
    const activeParent = menuItems.find((item) => {
      if (item.children && item.children.length > 0) {
        return getActiveChildIndex(item) !== -1;
      }
      return false;
    });

    if (activeParent) {
      setExpandedItems((prev) => ({
        ...prev,
        [activeParent.title]: true,
      }));
    }
  }, [location.pathname, location.search, menuItems]);

  // Toggle expanded state for menu items with children
  const toggleExpand = (title) => {
    setExpandedItems((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Handle menu navigation
  const handleMenuItemClick = (route, parentTitle = null) => {
    if (parentTitle) {
      setExpandedItems((prev) => ({
        ...prev,
        [parentTitle]: true,
      }));
    }
    navigate(route);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  // Render parent menu item
  const renderMenuItem = (item) => {
    const Icon = iconMap[item.icon] || iconMap[item.title] || FiPackage;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = !!expandedItems[item.title];
    const active = isParentActive(item);
    const activeChildIdx = hasChildren ? getActiveChildIndex(item) : -1;

    return (
      <div key={item.title} className="mb-1">
        {/* Main Parent Item */}
        <div
          className={`
            flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer select-none
            ${
              active && !hasChildren
                ? "bg-[#C07A3D] text-white shadow-sm font-medium"
                : active && hasChildren
                ? "bg-white/[0.08] text-[#F5E6DA] font-medium border border-white/[0.06]"
                : "text-[#C8B3A3] hover:bg-[#2A1F1A] hover:text-[#F5E6DA]"
            }
          `}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(item.title);
            } else {
              handleMenuItemClick(item.route);
            }
          }}
        >
          <Icon
            className={`text-lg flex-shrink-0 transition-colors ${
              active && !hasChildren
                ? "text-white"
                : active
                ? "text-[#C07A3D]"
                : "text-[#8E7768]"
            }`}
          />
          <span className="font-medium flex-1 text-sm truncate">
            {item.title}
          </span>
          {hasChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <FiChevronDown className="text-[#8E7768] text-sm" />
            </motion.div>
          )}
        </div>

        {/* Children Submenu Items */}
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-4 mt-1 pl-3 border-l-2 border-white/[0.08] space-y-1">
                {item.children.map((child, index) => {
                  const childRoute = getChildRoute(child, item.route);
                  const childTitle = getChildTitle(child);
                  const activeChild = index === activeChildIdx;

                  return (
                    <div
                      key={index}
                      onClick={() =>
                        handleMenuItemClick(childRoute, item.title)
                      }
                      className={`
                        px-3 py-2 text-xs rounded-lg transition-all duration-150 cursor-pointer truncate
                        ${
                          activeChild
                            ? "bg-[#C07A3D]/20 text-[#F5E6DA] font-semibold border-l-2 border-[#C07A3D]"
                            : "text-[#9E8778] hover:bg-[#2A1F1A] hover:text-[#E8D7CB]"
                        }
                      `}
                    >
                      {childTitle}
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
  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#1A1310] shadow-xl">
      {/* Header Section */}
      <div className="p-4 border-b border-white/[0.06] bg-[#120D0B]">
        <div className="flex items-center justify-between gap-3">
          {/* Admin User Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 bg-gradient-to-br from-[#C07A3D] to-[#D18B4A] rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <FiUser className="text-white text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-white text-sm truncate">
                {admin?.name || "Admin User"}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs text-[#8E7768] truncate max-w-[130px]">
                  {admin?.identityId || admin?.email || "admin@admin.com"}
                </p>
                {admin?.role === "account_team" && (
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Team
                  </span>
                )}
                {(admin?.role === "superadmin" ||
                  admin?.role === "admin") && (
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#C07A3D]/20 text-[#F5E6DA] border border-[#C07A3D]/30">
                    Super Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Close Button - Mobile Only */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0 lg:hidden"
            aria-label="Close sidebar"
          >
            <FiX className="text-xl text-[#C8B3A3]" />
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-3 scrollbar-admin lg:pb-3 space-y-0.5">
        {menuItems.map((item) => renderMenuItem(item))}
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
            className="fixed left-0 top-0 bottom-0 w-64 z-[10000] lg:hidden"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop Fixed */}
      <div className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 z-40">
        {sidebarContent}
      </div>
    </>
  );
};

export default AdminSidebar;
