import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FiShoppingBag,
  FiSun,
  FiMoon,
  FiChevronDown,
  FiUser,
  FiSearch,
  FiMenu,
  FiFileText,
  FiMapPin,
} from "react-icons/fi";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCartStore, useUIStore } from "../../../../shared/store/useStore";
import { useAuthStore } from "../../../../shared/store/authStore";
import { useB2bStore } from "../../../../shared/store/b2bStore";
import { useThemeStore } from "../../../../shared/store/themeStore";
import appLogoBlack from "../../../../assets/PLELOGOBLACK-removebg-preview (1).png";
import appLogoWhite from "../../../../assets/PLEwhite-removebg-preview (3).png";

import { motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import SearchBar from "../../../../shared/components/SearchBar";
import MobileCategoryIcons from "../Mobile/MobileCategoryIcons";
import MobileCategoryQuickNav from "../Mobile/MobileCategoryQuickNav";
import Sidebar from "../../../../shared/components/Sidebar";
import { useBusinessBuyer } from "../../hooks/useBusinessBuyer";
import { B2BBusinessBadge } from "../B2B/B2BBusinessBadge";
import { useCampaignStore } from "../../../../shared/store/campaignStore";
import { performUserLogout } from "../../../../shared/utils/userLogout";
import { useAddressStore } from "../../../../shared/store/addressStore";
import AddressBottomSheet from "../Mobile/AddressBottomSheet";

// Category gradient mapping - Very subtle pastel colors
const categoryGradients = {
  1: "from-pink-50 via-rose-50 to-pink-100", // Clothing - Pinkish
  2: "from-amber-50 via-amber-100 to-yellow-50", // Footwear - Brownish
  3: "from-orange-50 via-orange-100 to-orange-50", // Bags - Orangeish
  4: "from-green-50 via-emerald-50 to-teal-50", // Jewelry - Greenish
  5: "from-purple-50 via-purple-100 to-indigo-50", // Accessories - Purple
  6: "from-blue-50 via-cyan-50 to-teal-50", // Athletic
};

const MobileHeader = () => {
  const { isBusiness } = useBusinessBuyer();
  const { theme, toggleTheme } = useThemeStore();
  const appLogo = {
    src: (theme === "dark" ? appLogoBlack : appLogoWhite),
    alt: "PLE Logo",
  };

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCartAnimation, setShowCartAnimation] = useState(false);
  const [positionsReady, setPositionsReady] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [animationPositions, setAnimationPositions] = useState({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });
  const [isTopRowVisible, setIsTopRowVisible] = useState(true);
  const [topRowHeight, setTopRowHeight] = useState(70);
  const lastScrollYRef = useRef(0);
  const topRowRef = useRef(null);
  const userMenuRef = useRef(null);
  const logoRef = useRef(null);
  const cartRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const itemCount = useCartStore((state) => state.getItemCount());
  const toggleCart = useUIStore((state) => state.toggleCart);
  const cartAnimationTrigger = useUIStore(
    (state) => state.cartAnimationTrigger
  );
  const { user, isAuthenticated, logout } = useAuthStore();
  const { addresses, fetchAddresses } = useAddressStore();
  const isAddressSheetOpen = useUIStore((state) => state.isLocationSelectorOpen);
  const setIsAddressSheetOpen = useUIStore((state) => state.setLocationSelectorOpen);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses().catch(() => null);
    }
  }, [isAuthenticated, fetchAddresses]);

  const defaultAddress = useMemo(() => {
    return addresses.find((addr) => addr.isDefault) || addresses[0] || null;
  }, [addresses]);
  
  const { campaigns, initialize } = useCampaignStore();
  useEffect(() => {
    initialize();
  }, [initialize]);

  const activeFestivalCampaign = useMemo(() => {
    return campaigns.find(c => {
      if (c.type !== 'festival' || !c.isActive) return false;
      const now = new Date();
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      return start <= now && end >= now;
    });
  }, [campaigns]);

  // Get current category from URL (supports both /category/:id and query ?category=id)
  const getCurrentCategoryId = () => {
    const match = location.pathname.match(/\/(?:app\/)?category\/([^/]+)/);
    if (match) return String(match[1]);
    
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("category") || null;
  };

  const currentCategoryId = getCurrentCategoryId();

  // Get current page from location
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path === "/" || path === "/home") return "home";
    if (path.startsWith("/product/")) return "product";
    if (path.startsWith("/category/")) return "category";
    if (path === "/search") return "search";
    if (path === "/wishlist") return "wishlist";
    if (path === "/profile") return "profile";
    if (path === "/orders") return "orders";
    if (path.startsWith("/orders/")) return "orderDetail";
    if (path === "/checkout") return "checkout";
    if (path === "/offers") return "offers";
    if (path === "/daily-deals") return "dailyDeals";
    if (path === "/flash-sale") return "flashSale";
    if (path.startsWith("/seller/")) return "vendor";
    return "default";
  };

  const currentPage = getCurrentPage();

  // Memoize gradient background style to prevent unnecessary re-renders
  const headerBackground = useMemo(() => {
    if (theme === "dark") {
      return "linear-gradient(to bottom, #1A0A0A 0%, #140808 30%, #0D0D0D 100%)";
    }
    return "linear-gradient(135deg, #9B1C1C 0%, #7B0A0A 50%, #4C0505 100%)";
  }, [theme]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Measure top row height
  useEffect(() => {
    const measureTopRow = () => {
      if (topRowRef.current) {
        const height = topRowRef.current.offsetHeight;
        setTopRowHeight(height);
      }
    };

    measureTopRow();
    window.addEventListener("resize", measureTopRow);
    return () => window.removeEventListener("resize", measureTopRow);
  }, []);

  // Handle scroll to hide/show top row with smooth throttling
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const lastScrollY = lastScrollYRef.current;

          // Show top row when at top or scrolling up
          if (currentScrollY < 10) {
            setIsTopRowVisible(true);
          } else if (currentScrollY < lastScrollY) {
            // Scrolling up - show top row
            setIsTopRowVisible(true);
          } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
            // Scrolling down and past threshold - hide top row
            setIsTopRowVisible(false);
          }

          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate animation positions after component mounts
  useEffect(() => {
    const calculatePositions = () => {
      if (logoRef.current && cartRef.current) {
        const logoRect = logoRef.current.getBoundingClientRect();
        const cartRect = cartRef.current.getBoundingClientRect();

        const positions = {
          startX: logoRect.left + logoRect.width / 2,
          startY: logoRect.top + logoRect.height / 2,
          endX: cartRect.left + cartRect.width / 2,
          endY: cartRect.top + cartRect.height / 2,
        };

        // Only set positions if they're valid and animation hasn't played yet
        if (
          positions.startX > 0 &&
          positions.endX > 0 &&
          positions.startY > 0 &&
          positions.endY > 0 &&
          !hasPlayed
        ) {
          setAnimationPositions(positions);
          setPositionsReady(true);
          // Start animation once positions are ready
          setShowCartAnimation(true);
          setHasPlayed(true);
        }
      }
    };

    // Calculate positions after delays to ensure elements are rendered
    const timer1 = setTimeout(calculatePositions, 100);
    const timer2 = setTimeout(calculatePositions, 500);
    const timer3 = setTimeout(calculatePositions, 1000);

    // Recalculate on resize
    window.addEventListener("resize", calculatePositions);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener("resize", calculatePositions);
    };
  }, [hasPlayed]);

  const handleLogout = () => {
    setShowUserMenu(false);
    performUserLogout('/');
  };

  // Animation content - straight line movement only, starting from behind logo
  const shouldShowAnimation =
    showCartAnimation &&
    positionsReady &&
    animationPositions.startX > 0 &&
    animationPositions.endX > 0;

  const animationContent = shouldShowAnimation ? (
    <motion.div
      className="fixed pointer-events-none"
      style={{
        left: 0,
        top: 0,
        zIndex: 10000, // Above navbar but will be behind logo due to stacking context
        willChange: "transform, opacity",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
      initial={{
        x: animationPositions.startX - 24,
        y: animationPositions.startY - 24,
        scale: 0.8,
        opacity: 0,
      }}
      animate={{
        x: animationPositions.endX - 24,
        y: animationPositions.endY - 24,
        scale: [0.8, 1, 1.05, 0.95],
        opacity: [0, 1, 1, 0.8, 0],
      }}
      transition={{
        duration: 4,
        ease: [0.25, 0.1, 0.25, 1],
        times: [0, 0.1, 0.7, 0.9, 1],
        type: "tween",
      }}
      onAnimationComplete={() => {
        setShowCartAnimation(false);
      }}>
      <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
        <DotLottieReact
          src="https://lottie.host/083a2680-e854-4006-a50b-674276be82cd/oQMRcuZUkS.lottie"
          autoplay
          loop={false}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </motion.div>
  ) : null;

  const headerContent = (
    <motion.header
      key="mobile-header" // Stable key to prevent re-mounting
      className="fixed top-0 left-0 right-0 z-[9999] shadow-none overflow-visible md:hidden safe-area-top"
      style={{
        background: headerBackground,
        transition: "background 0.5s ease-in-out",
      }}
      initial={false}
      animate={{
        y: isTopRowVisible ? 0 : -(topRowHeight + 12),
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      }}>
      <div className="px-2 xs:px-3 sm:px-4 py-1.5 overflow-visible">
        {/* First Row: Location & Actions */}
        <motion.div
          ref={topRowRef}
          className="flex items-center justify-between gap-1.5 sm:gap-3 mb-2"
          initial={false}
          animate={{
            opacity: isTopRowVisible ? 1 : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 35,
            mass: 0.6,
          }}
          style={{
            pointerEvents: isTopRowVisible ? "auto" : "none",
          }}>
          {/* Left Group: Hamburger + Location Bar */}
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
            {/* Hamburger Menu Icon */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-all duration-300 text-white flex items-center justify-center flex-shrink-0"
              title="Menu">
              <FiMenu className="text-xl sm:text-2xl" />
            </button>

            {/* Dynamic Location Selection Bar */}
            <div 
              onClick={() => setIsAddressSheetOpen(true)}
              className="flex items-start gap-1.5 overflow-visible relative z-[10001] cursor-pointer min-w-0 flex-1 pr-2"
            >
              {defaultAddress && <FiMapPin className="text-white text-sm shrink-0 mt-0.5" />}
              <div className="flex flex-col text-left min-w-0">
                <span className="font-black text-white text-sm sm:text-base leading-tight flex items-center gap-1 capitalize tracking-tight select-none truncate">
                  {defaultAddress ? "Deliver to" : "Select Location"}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-white/95 flex items-center gap-0.5 truncate mt-0.5">
                  {defaultAddress ? `${defaultAddress.address}, ${defaultAddress.city}` : "Click to select"}
                  <FiChevronDown className="text-xs text-white/80 mt-0.5 flex-shrink-0" />
                </span>
              </div>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-white/10 rounded-full transition-all duration-300 text-white focus:outline-none"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              <motion.div
                key={theme}
                initial={{ scale: 0.6, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.6, rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center"
              >
                {theme === "light" ? (
                  <FiMoon className="text-xl text-white" />
                ) : (
                  <FiSun className="text-xl text-yellow-500" />
                )}
              </motion.div>
            </button>

            {/* Profile Button */}
            <button
              onClick={() => navigate(isAuthenticated ? "/profile" : "/login")}
              className="p-2 hover:bg-white/10 rounded-full transition-all duration-300 border border-white/20 text-white flex items-center justify-center"
              title="Profile"
            >
              <FiUser className="text-xl" />
            </button>

            {/* Cart Button */}
            <motion.button
              ref={cartRef}
              data-cart-icon
              onClick={toggleCart}
              className="relative p-2 hover:bg-white/10 rounded-full transition-all duration-300"
              animate={
                cartAnimationTrigger > 0
                  ? {
                    scale: [1, 1.2, 1],
                  }
                  : {}
              }
              transition={{ duration: 0.5, ease: "easeOut" }}>
              <FiShoppingBag className="text-xl text-white" />
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: "#ffc101" }}>
                  {itemCount > 9 ? "9+" : itemCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Second Row: 3 Premium Navigation Capsule Tabs (Zepto-style) */}
        <div className="flex items-center justify-between gap-1.5 mt-2 w-full relative z-[10006] overflow-x-auto scrollbar-hide">
          {(() => {
            const tabs = [
              {
                label: "PLE",
                path: "/home",
                active:
                  location.pathname === "/" ||
                  location.pathname === "/home" ||
                  location.pathname.startsWith("/product/") ||
                  location.pathname.startsWith("/brand/") ||
                  location.pathname.startsWith("/seller/"),
                style: {
                  activeLight: "bg-white border border-[#AE020B] text-[#AE020B] font-extrabold text-xs tracking-tight uppercase shadow-sm",
                  activeDark: "bg-[#7B0A0A] border border-[#7B0A0A] text-white font-extrabold text-xs tracking-tight uppercase shadow-sm",
                  inactiveLight: "bg-white border border-gray-200 text-gray-400 font-semibold text-xs tracking-tight uppercase",
                  inactiveDark: "bg-[#1A1A1A] border border-[#7B0A0A] text-white font-semibold text-xs tracking-tight uppercase",
                }
              },
              {
                label: "Categories",
                path: "/categories",
                active: location.pathname === "/categories" || location.pathname.startsWith("/category/"),
                style: {
                  activeLight: "bg-white border border-[#AE020B] text-[#AE020B] font-bold text-[10px] sm:text-xs tracking-tight shadow-sm",
                  activeDark: "bg-[#7B0A0A] border border-[#7B0A0A] text-white font-bold text-[10px] sm:text-xs tracking-tight shadow-sm",
                  inactiveLight: "bg-white border border-gray-200 text-gray-400 font-semibold text-[10px] sm:text-xs tracking-tight",
                  inactiveDark: "bg-[#1A1A1A] border border-[#7B0A0A] text-white font-semibold text-[10px] sm:text-xs tracking-tight",
                }
              },
              {
                label: "Offer",
                path: "/offers",
                active: location.pathname === "/offers",
                style: {
                  activeLight: "bg-white border border-[#AE020B] text-[#AE020B] font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-sm",
                  activeDark: "bg-[#7B0A0A] border border-[#7B0A0A] text-white font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-sm",
                  inactiveLight: "bg-white border border-gray-200 text-gray-400 font-semibold text-[10px] sm:text-xs uppercase tracking-wider",
                  inactiveDark: "bg-[#1A1A1A] border border-[#7B0A0A] text-white font-semibold text-[10px] sm:text-xs uppercase tracking-wider",
                }
              }
            ];

            if (activeFestivalCampaign) {
              tabs.push({
                label: activeFestivalCampaign.name,
                path: "/festival-campaign",
                active: location.pathname === "/festival-campaign",
                style: {
                  activeLight: "bg-red-600 border border-red-700 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-sm",
                  activeDark: "bg-red-800 border border-red-900 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-sm",
                  inactiveLight: "bg-red-50 border border-red-200 text-red-600 font-semibold text-[10px] sm:text-xs uppercase tracking-wider",
                  inactiveDark: "bg-red-950/40 border border-red-900 text-red-300 font-semibold text-[10px] sm:text-xs uppercase tracking-wider",
                }
              });
            }

            return tabs.map((tab) => {
              return (
                <Link
                  key={tab.label}
                  to={tab.path}
                  className={`flex-1 text-center py-1 px-1 rounded-full transition-all duration-300 cursor-pointer select-none truncate
                    ${theme === "dark" 
                      ? (tab.active ? tab.style.activeDark : tab.style.inactiveDark) 
                      : (tab.active ? tab.style.activeLight : tab.style.inactiveLight)
                    }
                    ${tab.active ? "opacity-100 scale-100" : "opacity-75 hover:opacity-100 scale-95"}
                  `}
                  style={{
                    willChange: "transform",
                  }}
                >
                  {tab.label}
                </Link>
              );
            });
          })()}
        </div>

        {/* Third Row: Single Integrated Search Bar with Left Logo & Right Search Icon */}
        <div className="flex items-center justify-between w-full bg-white dark:bg-[#1A1A1A] rounded-full border border-gray-200 dark:border-white/5 pl-4 pr-3 py-1 mt-1 relative z-[10007] shadow-sm select-none">
          {/* Left Side: Logo & Search placeholder trigger */}
          <div
            onClick={() => navigate("/search")}
            className="flex-grow flex items-center gap-2 cursor-pointer min-w-0"
          >
            <div className="relative inline-block">
              <img 
                src={appLogo.src} 
                alt="PLE Logo" 
                className="h-5 w-auto object-contain select-none bg-transparent" 
                style={{ mixBlendMode: theme === "dark" ? "screen" : "multiply" }}
              />
              {theme !== "dark" && (
                <span 
                  className="absolute text-[2.5px] font-normal text-[#7B0A0A]" 
                  style={{ right: '1.2px', bottom: '6.2px' }}
                >
                  TM
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 font-semibold truncate pl-1 border-l border-gray-200 dark:border-white/10">
              Search for "Earphones"
            </span>
          </div>

          {/* Right Side: Search Icon */}
          <div
            onClick={() => navigate("/search")}
            className="flex-shrink-0 flex items-center justify-center p-1 cursor-pointer"
          >
            <FiSearch className="text-gray-500 dark:text-gray-300 text-base" />
          </div>
        </div>

      </div>

      {/* Fourth Row: Category Quick Nav Bar (Home/Category Pages Only) */}
      {(currentPage === "home" || currentPage === "category") && (
        <div className="w-full">
          <MobileCategoryQuickNav />
        </div>
      )}
    </motion.header>
  );

  const b2bHeaderContent = (
    <motion.header
      key="b2b-mobile-header"
      className="fixed top-0 left-0 right-0 z-[9999] shadow-none md:hidden flex flex-col transition-colors duration-300"
      style={{
        background: headerBackground,
      }}
    >


      {/* Row 2: Location, Theme, Profile and Cart Actions in specified B2B sequence */}
      <div className="flex items-center justify-between px-4 py-3 bg-transparent">
        <div className="flex items-center gap-1.5 min-w-0 flex-grow">
          {/* 1. Hamburger Icon */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300 text-white flex items-center justify-center flex-shrink-0"
          >
            <FiMenu className="text-2xl" />
          </button>

          {/* 2. Location Selector */}
          <div 
            onClick={() => setIsAddressSheetOpen(true)}
            className="flex items-start gap-1.5 text-left cursor-pointer min-w-0 flex-grow pr-1 pl-1"
          >
            {defaultAddress && <FiMapPin className="text-white text-sm shrink-0 mt-0.5" />}
            <div className="flex flex-col min-w-0">
              <span className="font-black text-white text-sm sm:text-base leading-tight flex items-center gap-1 capitalize tracking-tight select-none truncate">
                {defaultAddress ? "Deliver to" : "Select Location"}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-white/95 flex items-center gap-0.5 truncate mt-0.5">
                {defaultAddress ? `${defaultAddress.address}, ${defaultAddress.city}` : "Click to select"}
                <FiChevronDown className="text-xs text-white/80 mt-0.5 flex-shrink-0" />
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 3. Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 hover:bg-white/10 rounded-full transition-all duration-300 text-white focus:outline-none"
          >
            {theme === "light" ? (
              <FiMoon className="text-xl text-white" />
            ) : (
              <FiSun className="text-xl text-yellow-500" />
            )}
          </button>

          {/* 4. Profile Icon with circular border */}
          <button 
            onClick={() => navigate(isAuthenticated ? "/profile" : "/login")}
            className="p-2 hover:bg-white/10 rounded-full transition-all duration-300 border border-white/20 text-white flex items-center justify-center"
          >
            <FiUser className="text-xl" />
          </button>

          {/* 5. Cart */}
          <button 
            onClick={toggleCart}
            className="p-2 hover:bg-white/10 rounded-full transition-all duration-300 text-white relative"
          >
            <FiShoppingBag className="text-xl text-white" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#AE020B] text-white text-[7px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </motion.header>
  );

  // Use portal to render outside of transformed containers (like PageTransition)
  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(isBusiness ? b2bHeaderContent : headerContent, document.body)}
      {typeof document !== "undefined" &&
        createPortal(animationContent, document.body)}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
      />
      <AddressBottomSheet
        isOpen={isAddressSheetOpen}
        onClose={() => setIsAddressSheetOpen(false)}
      />
    </>
  );
};

export default MobileHeader;
