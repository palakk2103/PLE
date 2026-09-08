import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCartStore, useUIStore } from "../../../../shared/store/useStore";
import { useWishlistStore } from "../../../../shared/store/wishlistStore";
import { useAuthStore } from "../../../../shared/store/authStore";
import { useB2bStore } from "../../../../shared/store/b2bStore";
import appLogoBlack from "../../../../assets/PLELOGOBLACK-removebg-preview (1).png";
import appLogoWhite from "../../../../assets/PLEwhite-removebg-preview (3).png";
import api from "../../../../shared/utils/api";

import SearchBar from "../../../../shared/components/SearchBar";
import { FiHeart, FiShoppingBag, FiUser, FiLogOut, FiGrid, FiBell, FiSun, FiMoon, FiMenu, FiFileText, FiSearch } from "react-icons/fi";
import Sidebar from '../../../../shared/components/Sidebar';
import { HiOutlineUserCircle } from "react-icons/hi";
import { useState, useRef, useEffect, useCallback } from "react";
// isSidebarOpen state moved inside component
import { motion, AnimatePresence } from "framer-motion";
import { useUserNotificationStore } from "../../store/userNotificationStore";
import { useThemeStore } from "../../../../shared/store/themeStore"; // needed for conditional logo
import { getCatalogBrands } from "../../data/catalogData";

import { useCampaignStore } from "../../../../shared/store/campaignStore";

import { performUserLogout } from "../../../../shared/utils/userLogout";

const DesktopHeader = () => {
    const { theme, toggleTheme } = useThemeStore();
    const isBusiness = useB2bStore((state) => state.userRole === 'business_buyer');
    
    const appLogo = {
        src: (theme === "dark" ? appLogoBlack : appLogoWhite),
        alt: "PLE Logo",
    };
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated, logout } = useAuthStore();
    const itemCount = useCartStore((state) => state.getItemCount());
    const wishlistCount = useWishlistStore((state) => state.getItemCount());
    const unreadCount = useUserNotificationStore((state) => state.unreadCount);
    const ensureHydrated = useUserNotificationStore((state) => state.ensureHydrated);
    const toggleCart = useUIStore((state) => state.toggleCart);
    const quotations = useB2bStore((state) => state.quotations || []);
    const [liveRfqCount, setLiveRfqCount] = useState(0);

    const fetchRfqCount = useCallback(async () => {
        if (!isAuthenticated) {
            setLiveRfqCount(0);
            return;
        }
        try {
            const [reqRes, rfqRes] = await Promise.allSettled([
                api.get('/user/product-requests?limit=1'),
                api.get('/user/rfq')
            ]);
            let total = 0;
            if (reqRes.status === 'fulfilled' && reqRes.value) {
                const data = reqRes.value.data;
                const reqTotal = data?.pagination?.total ?? (Array.isArray(data) ? data.length : (data?.requests?.length || 0));
                total += (Number(reqTotal) || 0);
            }
            if (rfqRes.status === 'fulfilled' && rfqRes.value) {
                const data = rfqRes.value.data;
                const rfqList = Array.isArray(data) ? data : (data?.data || []);
                total += (Array.isArray(rfqList) ? rfqList.length : 0);
            }
            setLiveRfqCount(total);
        } catch (err) {
            // Keep fallback count if API errors
            setLiveRfqCount(quotations.length || 0);
        }
    }, [isAuthenticated, quotations.length]);

    useEffect(() => {
        fetchRfqCount();
    }, [fetchRfqCount, location.pathname]);

    const rfqCount = isAuthenticated ? liveRfqCount : (quotations.length || 0);

    const { campaigns, initialize } = useCampaignStore();
    useEffect(() => {
        initialize();
    }, [initialize]);

    const activeFestivalCampaign = campaigns.find(c => {
        if (c.type !== 'festival' || !c.isActive) return false;
        const now = new Date();
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        return start <= now && end >= now;
    });

    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const userMenuRef = useRef(null);

    useEffect(() => {
        ensureHydrated();
    }, [ensureHydrated, isAuthenticated]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        setShowUserMenu(false);
        performUserLogout('/');
    };

    if (isBusiness) {
        return (
            <header className="hidden md:block sticky top-0 z-[999] bg-[#0d0d0d] text-white border-b border-zinc-800 shadow-lg">
                <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 h-20 flex items-center justify-between gap-3 lg:gap-6">
                    {/* Logo & Hamburger */}
                    <div className="flex items-center gap-3 lg:gap-4 flex-shrink-0">
                        <Link to="/home" className="flex items-center gap-2">
                            {appLogoWhite ? (
                                <img
                                    src={appLogoWhite}
                                    alt="OPLE Logo"
                                    className="h-10 lg:h-12 w-auto object-contain brightness-115"
                                />
                            ) : (
                                <span className="text-xl lg:text-2xl font-bold text-red-650">OPLE</span>
                            )}
                        </Link>
                        
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 text-zinc-450 hover:text-white transition-colors"
                            aria-label="Menu"
                        >
                            <FiMenu className="text-xl lg:text-2xl" />
                        </button>
                    </div>

                    {/* Navigation Links */}
                    <nav className="hidden lg:flex items-center gap-3 xl:gap-6 text-xs xl:text-sm font-semibold">
                        <Link to="/home" className="text-white border-b-2 border-red-650 pb-1 px-1 transition-all">Home</Link>
                        
                        <Link to="/categories" className="relative group cursor-pointer text-zinc-450 hover:text-white transition-colors py-2 flex items-center gap-1">
                            <span>Categories</span>
                            <span className="text-[10px] opacity-70">▼</span>
                        </Link>
                        
                        <div className="relative group cursor-pointer text-zinc-450 hover:text-white transition-colors py-2 flex items-center gap-1">
                            <span>Brands by PLE</span>
                            <span className="bg-red-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider scale-90 origin-left animate-pulse">New</span>
                            <span className="text-[10px] opacity-70">▼</span>
                            
                            {/* Hover Dropdown for Brands */}
                            <div className="absolute left-0 top-full mt-1 bg-zinc-950 text-white rounded-xl shadow-xl border border-zinc-800 p-2 z-[60] min-w-[200px] hidden group-hover:block">
                                {getCatalogBrands().slice(0, 10).map((brand) => (
                                    <button
                                        key={brand.id}
                                        onClick={() => navigate(`/brand/${brand.id}`)}
                                        className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-900 rounded-lg transition-colors text-left w-full text-zinc-300"
                                    >
                                        {brand.logo && (
                                            <img src={brand.logo} alt={brand.name} className="w-5 h-5 object-contain invert brightness-200" />
                                        )}
                                        <span className="text-sm font-medium">{brand.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </nav>

                    {/* Search Bar */}
                    <div className="flex-1 min-w-[120px] max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg relative flex items-center bg-zinc-900 border border-zinc-800 rounded-lg pl-3 pr-10 py-2">
                        <input
                            type="text"
                            placeholder="Search products, brands, categories..."
                            className="w-full bg-transparent text-xs text-white focus:outline-none placeholder-zinc-550"
                        />
                        <button className="absolute right-1 top-1 bottom-1 px-3 bg-[#1A1A1A] hover:bg-zinc-800 text-zinc-350 rounded flex items-center justify-center transition-colors">
                            <FiSearch className="text-sm text-white" />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 lg:gap-4">
                        {/* RFQ Icon */}
                        <button 
                            onClick={() => navigate('/product-requests')} 
                            className="relative text-zinc-400 hover:text-white transition-colors flex flex-col items-center justify-center shrink-0 h-12 w-12 group"
                            title="Request for Quotation"
                        >
                            <div className="relative flex items-center justify-center h-6 w-6">
                                <FiFileText className="text-2xl text-zinc-300 group-hover:text-white transition-colors" />
                                {rfqCount > 0 && (
                                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E53E3E] text-white text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-[#0d0d0d]">
                                        {rfqCount > 99 ? '99+' : rfqCount}
                                    </span>
                                )}
                            </div>
                            <span className="text-[9px] font-extrabold uppercase mt-1 tracking-wider leading-none text-zinc-400 group-hover:text-zinc-200">RFQ</span>
                        </button>

                        {/* Cart */}
                        <button
                            onClick={toggleCart}
                            className="relative text-zinc-400 hover:text-white transition-colors flex flex-col items-center justify-center shrink-0 h-12 w-12 group"
                            title="Cart"
                        >
                            <div className="relative flex items-center justify-center h-6 w-6">
                                <FiShoppingBag className="text-2xl text-zinc-300 group-hover:text-white transition-colors" />
                                {itemCount > 0 && (
                                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E53E3E] text-white text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-[#0d0d0d]">
                                        {itemCount > 99 ? '99+' : itemCount}
                                    </span>
                                )}
                            </div>
                            <span className="text-[9px] font-extrabold uppercase mt-1 tracking-wider leading-none opacity-0 select-none pointer-events-none">Cart</span>
                        </button>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="relative text-zinc-450 hover:text-white transition-colors flex flex-col items-center justify-center shrink-0 h-12 w-12 rounded-full hover:bg-zinc-900 focus:outline-none"
                            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
                        >
                            <div className="relative flex items-center justify-center h-6 w-6">
                                <motion.div
                                    key={theme}
                                    initial={{ scale: 0.6, rotate: -90, opacity: 0 }}
                                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                    exit={{ scale: 0.6, rotate: 90, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-center justify-center"
                                >
                                    {theme === "light" ? (
                                        <FiMoon className="text-2xl" />
                                    ) : (
                                        <FiSun className="text-2xl text-yellow-500 animate-pulse" />
                                    )}
                                </motion.div>
                            </div>
                            <span className="text-[8px] font-extrabold uppercase mt-1 tracking-wider leading-none opacity-0 select-none pointer-events-none">Theme</span>
                        </button>

                        {/* Business User Account Info */}
                        <div ref={userMenuRef} className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2.5 p-1 hover:bg-zinc-900 rounded-full transition-all border border-transparent hover:border-zinc-800"
                            >
                                {user?.avatar ? (
                                    <img
                                        src={user.avatar}
                                        alt={user.name}
                                        className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                                    />
                                ) : (
                                    <HiOutlineUserCircle className="text-zinc-400 text-3xl" />
                                )}
                                <div className="text-left hidden xl:block">
                                    <p className="text-xs font-bold text-white max-w-[120px] truncate leading-tight">
                                        {user?.name || "info"}
                                    </p>
                                    <p className="text-[9px] text-zinc-500 leading-none">
                                        Business Account
                                    </p>
                                </div>
                            </button>

                            <AnimatePresence>
                                {showUserMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute right-0 mt-2 bg-zinc-950 text-white rounded-xl shadow-xl border border-zinc-800 p-2 z-[60] min-w-[200px]"
                                    >
                                        <div className="px-3 py-2 border-b border-zinc-900 mb-2">
                                            <p className="font-semibold text-white text-sm">
                                                {user?.name || "info"}
                                            </p>
                                            <p className="text-xs text-zinc-400 truncate">
                                                {user?.email || "info@company.com"}
                                            </p>
                                        </div>
                                        <Link
                                            to="/profile"
                                            onClick={() => setShowUserMenu(false)}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-900 rounded-lg transition-colors text-left w-full text-zinc-300"
                                        >
                                            <FiUser className="text-zinc-400" />
                                            <span className="text-sm">Profile</span>
                                        </Link>
                                        <Link
                                            to="/orders"
                                            onClick={() => setShowUserMenu(false)}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-900 rounded-lg transition-colors text-left w-full text-zinc-300"
                                        >
                                            <FiShoppingBag className="text-zinc-400" />
                                            <span className="text-sm">Orders</span>
                                        </Link>
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-red-950/20 rounded-lg transition-colors text-left w-full text-red-400 mt-1"
                                        >
                                            <FiLogOut className="text-red-400" />
                                            <span className="text-sm">Logout</span>
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
                {/* Sidebar */}
                <Sidebar
                    isOpen={isSidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    user={user}
                    onLogout={handleLogout}
                />
            </header>
        );
    }

    return (
        <header className="hidden md:block sticky top-0 z-[999] bg-[#ffffff] dark:!bg-black shadow-sm border-b border-gray-100 dark:!border-black">
            <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 h-20 flex items-center justify-between gap-3 lg:gap-6">
                {/* Logo */}
                <Link to="/home" className="flex-shrink-0 flex items-center gap-2">
                    {appLogo.src ? (
                        <div className="relative">
                            <img
                                src={appLogo.src}
                                alt={appLogo.alt}
                                className="h-11 lg:h-14 w-auto object-contain"
                                style={{ mixBlendMode: theme === "dark" ? "screen" : "multiply" }}
                            />
                            {theme !== "dark" && (
                                <span 
                                    className="absolute text-[5px] font-normal text-[#7B0A0A]" 
                                    style={{ right: '4.5px', bottom: '17px' }}
                                >
                                    TM
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-xl lg:text-2xl font-bold text-[#7B0A0A]">PLE</span>
                    )}
                </Link>

                {/* Hamburger Menu */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 text-gray-650 dark:text-gray-300 hover:text-[#7B0A0A] dark:hover:text-[#FF4D4D] transition-colors"
                  aria-label="Menu"
                >
                  <FiMenu className="text-xl lg:text-2xl" />
                </button>

                {/* Navigation Links */}
                <nav className="hidden lg:flex items-center gap-3 xl:gap-6">
                    <Link to="/home" className="text-gray-655 dark:text-gray-300 hover:text-[#7B0A0A] dark:hover:text-[#FF4D4D] font-semibold text-xs xl:text-sm whitespace-nowrap">Home</Link>
                    <Link to="/categories" className="text-gray-655 dark:text-gray-300 hover:text-[#7B0A0A] dark:hover:text-[#FF4D4D] font-semibold text-xs xl:text-sm flex items-center gap-1 whitespace-nowrap">
                        <FiGrid /> Categories
                    </Link>
                    <Link to="/offers" className="text-gray-655 dark:text-gray-300 hover:text-[#7B0A0A] dark:hover:text-[#FF4D4D] font-semibold text-xs xl:text-sm whitespace-nowrap">Offers</Link>
                    {activeFestivalCampaign && (
                        <Link to="/festival-campaign" className="text-red-650 dark:text-red-400 hover:text-red-700 font-bold text-xs xl:text-sm transition-all animate-pulse flex items-center gap-1 whitespace-nowrap">
                            ✨ {activeFestivalCampaign.name}
                        </Link>
                    )}
                    <Link to="/refurbished-categories" className="text-gray-655 dark:text-gray-300 hover:text-[#7B0A0A] dark:hover:text-[#FF4D4D] font-semibold text-xs xl:text-sm whitespace-nowrap">Refurbished</Link>
                </nav>

                {/* Search Bar */}
                <div className="flex-1 min-w-[120px] max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg">
                    <SearchBar />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
                    {/* Cart */}
                    <button
                        onClick={toggleCart}
                        className="relative p-2 text-gray-655 dark:text-gray-300 hover:text-[#7B0A0A] dark:hover:text-[#FF4D4D] transition-colors"
                    >
                        <FiShoppingBag className="text-2xl" />
                        {itemCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#7B0A0A] text-white text-xs font-bold flex items-center justify-center">
                                {itemCount > 9 ? "9+" : itemCount}
                            </span>
                        )}
                    </button>
                    {/* Hamburger Menu */}


                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="relative p-2 text-gray-655 dark:text-[#C8B3A3] hover:text-[#7B0A0A] dark:hover:text-[#D18B4A] transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-[#2A1F1A] focus:outline-none"
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
                                <FiMoon className="text-2xl" />
                            ) : (
                                <FiSun className="text-2xl text-yellow-500 animate-pulse" />
                            )}
                        </motion.div>
                    </button>

                    {/* User Menu */}
                    {isAuthenticated ? (
                        <div ref={userMenuRef} className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-1 lg:p-1.5 hover:bg-gray-50 dark:hover:bg-neutral-900 rounded-full transition-all border border-transparent hover:border-gray-200 dark:hover:border-neutral-800"
                            >
                                {user?.avatar ? (
                                    <img
                                        src={user.avatar}
                                        alt={user.name}
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <HiOutlineUserCircle className="text-gray-655 dark:text-gray-305 text-3xl" />
                                )}
                                <span className="hidden lg:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[100px] truncate">{user?.name || "User"}</span>
                            </button>

                            <AnimatePresence>
                                {showUserMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute right-0 mt-2 bg-white dark:bg-black rounded-xl shadow-xl border border-gray-200 dark:border-neutral-800 p-2 z-[60] min-w-[200px]"
                                    >
                                        <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 mb-2">
                                            <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                                                {user?.name || "User"}
                                            </p>
                                            <p className="text-xs text-gray-550 dark:text-gray-400 truncate">
                                                {user?.email || ""}
                                            </p>
                                        </div>
                                        <Link
                                            to="/profile"
                                            onClick={() => setShowUserMenu(false)}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-900 rounded-lg transition-colors text-left w-full"
                                        >
                                            <FiUser className="text-gray-555 dark:text-gray-400" />
                                            <span className="text-gray-750 dark:text-gray-300 text-sm">Profile</span>
                                        </Link>
                                        <Link
                                            to="/orders"
                                            onClick={() => setShowUserMenu(false)}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-900 rounded-lg transition-colors text-left w-full"
                                        >
                                            <FiShoppingBag className="text-gray-555 dark:text-gray-400" />
                                            <span className="text-gray-750 dark:text-gray-300 text-sm">Orders</span>
                                        </Link>
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors text-left w-full text-red-650 mt-1"
                                        >
                                            <FiLogOut className="text-red-500 dark:text-red-400" />
                                            <span className="text-sm">Logout</span>
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <Link to="/login" className="px-5 py-2.5 bg-[#7B0A0A] text-white rounded-lg font-medium hover:bg-[#AE020B] transition-colors shadow-sm shadow-red-200">
                            Login
                        </Link>
                    )}
                </div>
                {/* Sidebar */}
                <Sidebar
                  isOpen={isSidebarOpen}
                  onClose={() => setSidebarOpen(false)}
                  user={user}
                  onLogout={handleLogout}
                />
            </div>
        </header>
    );
};

export default DesktopHeader;
