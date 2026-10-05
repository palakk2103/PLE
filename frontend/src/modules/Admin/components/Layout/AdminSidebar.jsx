import { useState, useEffect } from "react";
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
import adminMenu from "../../config/adminMenu.json";

// Icon mapping for menu items
const iconMap = {
  Dashboard: FiHome,
  "Account Team": FiUsers,
  "Activity / Audit Logs": FiFileText,
  Orders: FiShoppingBag,
  "Return Requests": FiRotateCcw,
  Products: FiPackage,
  Categories: FiGrid,
  Brands: FiTag,
  Customers: FiUsers,
  "B2B Marketplace": FiBriefcase,
  "RFQ Management": FiInbox,
  "Product Enquiries": FiMessageCircle,
  "Product Requests": FiInbox,
  "Refurbished Mkt": FiRefreshCw,
  "Delivery Management": FiTruck,
  "Offers & Sliders": FiImage,
  "Offers Management": FiPercent,
  Banners: FiImage,
  "Promo Codes": FiPercent,
  Notifications: FiBell,
  "Support Desk": FiMessageCircle,
  Reports: FiFileText,
  "Analytics & Finance": FiBarChart2,
  "About & Portfolio Content": FiFileText,
  Settings: FiSettings,
  Policies: FiShield,
  Firebase: FiDatabase,
  "Loyalty Program": FiAward,
  "Landing Page": FiGlobe,
  "B2B Users": FiUsers,
  "Wallet Management": FiCreditCard,
  "In-House Shops & Staff": FiBriefcase,
  "In-House Staff Chats": FiMessageSquare,
  "Marketplace Sellers": FiUsers,
  "My Shops": FiBriefcase,
  "Managed Vendor Chats": FiMessageSquare,
  "About Page": FiLayout,
  "Portfolio Page": FiImage,
};

// Helper function to convert child name to route path
const getChildRoute = (parentRoute, childName) => {
  const routeMap = {
    "/admin/orders": {
      "All Orders": "/admin/orders/all-orders",
      "Order Tracking": "/admin/orders/order-tracking",
    },
    "/admin/products": {
      "Manage Products": "/admin/products/manage-products",
      "Tax & Pricing": "/admin/products/tax-pricing",
      "Product Ratings": "/admin/products/product-ratings",
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
    },
    "/admin/b2b": {
      "Business Users": "/admin/b2b/business-users",
      "Company Management": "/admin/b2b/companies",
      "B2B Products": "/admin/b2b/b2b-products",
      "B2B Orders": "/admin/b2b/b2b-orders",
      "B2B Settings": "/admin/b2b/b2b-settings",
      "Agreement Templates": "/admin/b2b/agreement-template",
    },
    "/admin/b2b-enquiries": {
      "Pending RFQs": "/admin/b2b-enquiries/all?status=Submitted",
      "Under Review": "/admin/b2b-enquiries/all?status=Under Review",
      "Negotiations": "/admin/b2b-enquiries/all?status=Vendor Negotiation",
      "Vendor RFQs": "/admin/b2b-enquiries/all?status=Sent To Vendors",
      "Quotations": "/admin/b2b-enquiries/all?status=Quotations Received",
      "Vendor Selection": "/admin/b2b-enquiries/all?status=Vendor Selected",
      "Purchase Orders": "/admin/b2b-enquiries/all?status=Purchase Order Generated",
    },
    "/admin/refurbished": {
      "QC Dashboard": "/admin/refurbished/dashboard",
      "Product Approvals": "/admin/refurbished/approvals",
      "Fraud & Moderation": "/admin/refurbished/moderation",
      "Complaints & Returns": "/admin/refurbished/complaints",
      "Category Management": "/admin/refurbished/categories",
    },
    "/admin/delivery": {
      "Delivery Boys": "/admin/delivery/delivery-boys",
      "Cash Collection": "/admin/delivery/cash-collection",
      "Assign Delivery": "/admin/delivery/assign-delivery",
      "Logistics Control Center": "/admin/delivery-control",
    },
    "/admin/vendors": {
      "All Sellers": "/admin/vendors/manage-vendors",
      "Manage Vendors": "/admin/vendors/manage-vendors",
      "Seller Approvals": "/admin/vendors/pending-approvals",
      "Pending Approvals": "/admin/vendors/pending-approvals",
      "B2B Seller Requests": "/admin/vendors/b2b-requests",
      "Commission Rates": "/admin/vendors/commission-rates",
      "Vendor Analytics": "/admin/vendors/vendor-analytics",
      "Managed Shops": "/admin/vendors/managed-shops",
      "Managed Vendor Chats": "/admin/managed-vendor-chats",
      "Product Approvals": "/admin/vendors/product-approvals",
    },
    "/admin/b2b-users": {
      "Manage B2B Users": "/admin/b2b-users/manage",
      "Pending Approvals": "/admin/b2b-users/pending",
      "B2B Analytics": "/admin/b2b-users/analytics",
    },
    "/admin/offers": {
      "Home Sliders": "/admin/offers/home-sliders",
      "Festival Offers": "/admin/offers/festival-offers",
    },
    "/admin/offers-management": {
      "Dashboard": "/admin/offers-management/dashboard",
      "Offers List": "/admin/offers-management/list",
      "Create Offer": "/admin/offers-management/create",
    },
    "/admin/notifications": {
      "All Notifications": "/admin/notifications",
      "Push Notifications": "/admin/notifications/push-notifications",
      "Custom Messages": "/admin/notifications/custom-messages",
    },
    "/admin/support": {
      "Live Chat": "/admin/support/live-chat",
      "PLE Shop Chats": "/admin/ple-shop-chats",
      "Managed Vendor Chats": "/admin/managed-vendor-chats",
      "Ticket Types": "/admin/support/ticket-types",
      Tickets: "/admin/support/tickets",
    },
    "/admin/reports": {
      "Sales Report": "/admin/reports/sales-report",
      "Inventory Report": "/admin/reports/inventory-report",
    },
    "/admin/finance": {
      "Revenue Overview": "/admin/finance/revenue-overview",
      "Profit & Loss": "/admin/finance/profit-loss",
      "Order Trends": "/admin/finance/order-trends",
      "Payment Breakdown": "/admin/finance/payment-breakdown",
      "Tax Reports": "/admin/finance/tax-reports",
      "Refund Reports": "/admin/finance/refund-reports",
    },
    "/admin/settings": {
      General: "/admin/settings/general",
      "Payment & Shipping": "/admin/settings/payment-shipping",
      "Orders & Customers": "/admin/settings/orders-customers",
      "Products & Inventory": "/admin/settings/products-inventory",
      "Content & Features": "/admin/settings/content-features",
      "Notifications & SEO": "/admin/settings/notifications-seo",
    },
    "/admin/policies": {
      "Privacy Policy": "/admin/policies/privacy-policy",
      "Refund Policy": "/admin/policies/refund-policy",
      "Terms & Conditions": "/admin/policies/terms-conditions",
    },
    "/admin/firebase": {
      "Push Config": "/admin/firebase/push-config",
      Authentication: "/admin/firebase/authentication",
    },
    "/admin/loyalty": {
      "Dashboard": "/admin/loyalty/dashboard",
      "Loyalty Rules": "/admin/loyalty/rules",
      "User Points": "/admin/loyalty/users",
    },
    "/admin/landing-page": {
      "Dashboard": "/admin/landing-page",
      "Hero Section": "/admin/landing-page/hero",
      "Portfolio Highlights": "/admin/landing-page/portfolio-highlights",
      "Explore Catalogue": "/admin/landing-page/catalogue",
      "Product Categories": "/admin/landing-page/product-categories",
      "Services / Categories": "/admin/landing-page/services",
      "Features": "/admin/landing-page/features",
      "Comparison Table": "/admin/landing-page/comparison",
      "Stats Counter": "/admin/landing-page/stats",
      "Testimonials": "/admin/landing-page/testimonials",
      "Product Showcase": "/admin/landing-page/products",
      "Deals & Rewards": "/admin/landing-page/pricing",
      "CPO Section": "/admin/landing-page/cpo",
      "GPO Section": "/admin/landing-page/gpo",
      "Smart Deals": "/admin/landing-page/smart-deals",
      "Loyalty Rewards": "/admin/landing-page/loyalty-rewards",
      "Zero Maintenance": "/admin/landing-page/zero-maintenance",
      "FAQ Section": "/admin/landing-page/faq",
      "Gallery": "/admin/landing-page/gallery",
      "Contact & Social": "/admin/landing-page/contact",
      "Footer": "/admin/landing-page/footer",
      "SEO Settings": "/admin/landing-page/seo",
      "Blogs": "/admin/landing-page/blogs",
      "Ad Landing Pages": "/admin/landing-page/ad-landing-pages",
    },
    "/admin/about-page": {
      "Dashboard": "/admin/about-page",
      "Hero Section": "/admin/about-page/hero",
      "About Company": "/admin/about-page/company",
      "What We Do": "/admin/about-page/what-we-do",
      "Vision & Mission": "/admin/about-page/vision-mission",
      "Our Edge": "/admin/about-page/our-edge",
    },
    "/admin/portfolio-page": {
      "Dashboard": "/admin/portfolio-page",
      "Hero Section": "/admin/portfolio-page/hero",
      "Metrics Section": "/admin/portfolio-page/metrics",
      "Call to Action": "/admin/portfolio-page/cta",
      "Portfolio Projects": "/admin/portfolio-page/projects",
    },
  };

  return routeMap[parentRoute]?.[childName] || parentRoute;
};

const AdminSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin } = useAdminAuthStore();
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
    // Only close when route actually changes, not when sidebar opens
    if (window.innerWidth < 1024) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // Only trigger on route changes

  // Auto-expand menu items when their route is active (only if viewing a child route)
  useEffect(() => {
    const activeItem = adminMenu.find((item) => {
      if (item.route === "/admin/dashboard") {
        return location.pathname === "/admin/dashboard";
      }
      // Check if current path is a child of this item (not just the parent route itself)
      const isChildRoute =
        location.pathname.startsWith(item.route + "/") &&
        location.pathname !== item.route;
      return isChildRoute;
    });
    if (activeItem && activeItem.children && activeItem.children.length > 0) {
      // Only expand if we're actually on a child route, keep the parent open
      setExpandedItems((prev) => {
        // If the parent is already expanded, keep it expanded (don't close others)
        // This allows navigation between child items without closing the dropdown
        if (prev[activeItem.title]) {
          return prev;
        }
        // Otherwise, close all others and expand this one
        return {
          [activeItem.title]: true,
        };
      });
    } else {
      // If not on a child route, check if we should close expanded items
      // Only close if we're navigating to a completely different parent route
      const currentParent = adminMenu.find((item) => {
        if (item.route === "/admin/dashboard") {
          return location.pathname === "/admin/dashboard";
        }
        return location.pathname === item.route || location.pathname.startsWith(item.route + "/");
      });
      // If we're on a parent route without children, close all expanded items
      if (
        currentParent &&
        (!currentParent.children || currentParent.children.length === 0)
      ) {
        setExpandedItems({});
      }
      // If we're on a parent route with children, keep it expanded if it was already expanded
    }
  }, [location.pathname]);

  // Check if a menu item is active
  const isActive = (route) => {
    if (route === "/admin/dashboard") {
      return location.pathname === "/admin/dashboard";
    }
    return location.pathname === route || location.pathname.startsWith(route + "/");
  };

  // Toggle expanded state for menu items with children
  const toggleExpand = (title, closeOthers = true) => {
    setExpandedItems((prev) => {
      if (closeOthers) {
        // Close all other expanded items and toggle the clicked one
        return {
          [title]: !prev[title],
        };
      } else {
        // Just toggle the clicked item
        return {
          ...prev,
          [title]: !prev[title],
        };
      }
    });
  };

  // Close all expanded items
  const closeAllExpanded = () => {
    setExpandedItems({});
  };

  // Handle menu item click
  const handleMenuItemClick = (route, parentTitle = null) => {
    // If navigating to a child route, keep the parent expanded
    if (parentTitle) {
      setExpandedItems((prev) => {
        // Close all other expanded items, but keep the current parent open
        return {
          [parentTitle]: true,
        };
      });
    } else {
      // If navigating to a parent route without children, close all expanded items
      closeAllExpanded();
    }
    navigate(route);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  // Render menu item
  const renderMenuItem = (item) => {
    const Icon = iconMap[item.title] || FiPackage;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems[item.title];
    const active = isActive(item.route);

    return (
      <div key={item.route} className="mb-1">
        {/* Main Menu Item */}
        <div
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer
            ${active
              ? "bg-[#C07A3D] text-white shadow-sm"
              : "text-[#C8B3A3] hover:bg-[#2A1F1A]"
            }
          `}
          onClick={() => {
            if (hasChildren) {
              // Close all other expanded items when clicking on a parent with children
              toggleExpand(item.title, true);
            } else {
              // Close all expanded items when clicking on a parent without children
              handleMenuItemClick(item.route);
            }
          }}>
          <Icon
            className={`text-xl flex-shrink-0 ${active ? "text-white" : "text-[#8E7768]"
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
                        ${isChildActive
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
  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#1A1310] shadow-xl">
      {/* Header Section */}
      <div className="p-4 border-b border-white/[0.06] bg-[#120D0B]">
        {/* Header with Close Button and Admin Info */}
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
                {admin?.role === 'account_team' && (
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Team
                  </span>
                )}
                {(admin?.role === 'superadmin' || admin?.role === 'admin') && (
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
            aria-label="Close sidebar">
            <FiX className="text-xl text-[#C8B3A3]" />
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-3 scrollbar-admin lg:pb-3">
        {(() => {
          const userRole = String(admin?.role || admin?.userType || '').toLowerCase();
          const isSuperAdmin = userRole === 'superadmin' || userRole === 'admin';
          const superAdminOnlyTitles = new Set([
            'Account Team',
            'Activity / Audit Logs',
            'Settings',
            'Policies',
            'Firebase'
          ]);
          const menuItems = isSuperAdmin
            ? adminMenu
            : adminMenu.filter((item) => !superAdminOnlyTitles.has(item.title));
          return menuItems.map((item) => renderMenuItem(item));
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
            className="fixed left-0 top-0 bottom-0 w-64 z-[10000] lg:hidden">
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
