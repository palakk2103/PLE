import { useState, useEffect, useMemo } from "react";
import { 
  FiSearch, 
  FiShoppingBag, 
  FiFileText, 
  FiUploadCloud, 
  FiClock, 
  FiChevronRight,
  FiEdit3,
  FiMonitor,
  FiCpu,
  FiShield,
  FiGlobe,
  FiDatabase,
  FiPrinter,
  FiZap,
  FiSmartphone,
  FiLayers,
  FiHome,
  FiTruck,
  FiPhone,
  FiPlus,
  FiTrendingUp
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import B2BRequestQuoteModal from "./B2BRequestQuoteModal";
import ProductCard from "../../../../shared/components/ProductCard";
import AnimatedBanner from "../Mobile/AnimatedBanner";
import NewArrivalsSection from "../Mobile/NewArrivalsSection";
import DailyDealsSection from "../Mobile/DailyDealsSection";
import RecommendedSection from "../Mobile/RecommendedSection";
import FeaturedVendorsSection from "../Mobile/FeaturedVendorsSection";
import BrandLogosScroll from "../Mobile/BrandLogosScroll";
import MobileCategoryGrid from "../Mobile/MobileCategoryGrid";
import OfferCarousel from "../../../offers/components/OfferCarousel";
import { useCategoryStore } from "../../../../shared/store/categoryStore";
import { categories as fallbackCategories } from "../../../../data/categories";
import { useThemeStore } from "../../../../shared/store/themeStore";
import { useAuthStore } from "../../../../shared/store/authStore";
import { useB2BAdminStore } from "../../../B2BAdmin/store/b2bAdminStore";
import { useB2bStore } from "../../../../shared/store/b2bStore";
import { getPlaceholderImage } from "../../../../shared/utils/helpers";

const B2BHome = ({
  computedBrands,
  computedVendors,
  computedNewArrivals,
  computedMostPopular,
  computedDailyDeals,
  computedRefurbished,
  computedFlashSale,
  computedTrending,
  offers,
  promoBanners,
  setSelectedHomeOffer
}) => {
  const navigate = useNavigate();
  const [isRfqOpen, setIsRfqOpen] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState("All");
  const [activeMarketTab, setActiveMarketTab] = useState("Official Store");

  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  const { user, isAuthenticated } = useAuthStore();
  const { companyProfile, fetchCompanyProfile } = useB2BAdminStore();
  const { companies } = useB2bStore();

  const isB2BAdmin = user?.role === 'b2bAdmin' || user?.role === 'b2b_admin';
  const isB2BEmployee = user?.role === 'b2bEmployee' || user?.role === 'b2b_employee';
  const isB2BUser = isB2BAdmin || isB2BEmployee;

  useEffect(() => {
    if (isB2BUser && fetchCompanyProfile) {
      fetchCompanyProfile();
    }
  }, [isB2BUser, fetchCompanyProfile]);

  const company = isB2BUser
    ? companyProfile
    : (user?.companyId || user?.companyName || user?.email
        ? companies?.find(c => c.id === user?.companyId || (user?.companyName && c.companyName === user?.companyName) || (user?.email && c.admin?.email?.toLowerCase() === user?.email?.toLowerCase()))
        : null);

  const displayCompanyName =
    company?.companyName ||
    user?.companyName ||
    user?.company?.name ||
    user?.company?.companyName ||
    (user?.name ? `${user.name}'s Enterprise` : "Business Account");

  const displayGSTIN =
    company?.gstNumber ||
    company?.gstin ||
    user?.gstin ||
    user?.gstNumber ||
    user?.company?.gstNumber ||
    user?.company?.gstin ||
    "";

  const displayAdminName =
    user?.name ||
    company?.admin?.name ||
    "Business User";

  const displayRole =
    isB2BAdmin
      ? "Super Admin"
      : isB2BEmployee
      ? (user?.designation || "B2B Member")
      : user?.role === "customer"
      ? "Customer (B2B)"
      : (user?.role || "Business Member");

  const displayMemberSince = (() => {
    const rawDate = user?.createdAt || company?.createdAt;
    if (rawDate) {
      try {
        return new Date(rawDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      } catch (e) {
        return "Member";
      }
    }
    return "Member";
  })();

  const { categories: allCategories, initialize: initCategories, getRootCategories } = useCategoryStore();

  useEffect(() => {
    initCategories();
  }, [initCategories]);

  const displayCategories = useMemo(() => {
    const roots = getRootCategories().filter((cat) => cat.isActive !== false);
    if (!roots.length) return fallbackCategories;

    return roots.map((cat) => {
      const fallbackCat = fallbackCategories.find(
        (fc) =>
          String(fc.id ?? "").trim() === String(cat.id ?? "").trim() ||
          fc.name?.toLowerCase() === cat.name?.toLowerCase()
      );
      return {
        ...(fallbackCat || {}),
        ...cat,
        image: cat.image || fallbackCat?.image || "",
      };
    });
  }, [allCategories, getRootCategories]);

  const categoryTabs = [
    { name: "All", count: 0 },
    { name: "Men's", count: 0 },
    { name: "Women's", count: 0 },
    { name: "Books", count: 0 },
    { name: "Kids", count: 0 }
  ];

  const brands = [
    { name: "Armani Exchange", logo: "A|X", subtitle: "Armani Exchange" },
    { name: "Chanel", logo: "CHANEL", subtitle: "Chanel" },
    { name: "Charles & Keith", logo: "CHARLES & KEITH", subtitle: "Charles & Keith" },
    { name: "Chloe", logo: "Chloé", subtitle: "Chloe" }
  ];





  const handleUploadBOQ = () => {
    if (!isAuthenticated) {
      toast.error("Please sign in or create a business account to upload BOQs.");
      return;
    }
    toast.success("BOQ Upload dialog opened. Choose your procurement list.");
  };

  const handleRfqClick = () => {
    if (!isAuthenticated) {
      toast.error("Please sign in or create a business account to request quotes.");
      return;
    }
    setIsRfqOpen(true);
  };

  // Sidebar category items
  const sidebarCategories = [
    { name: "Computers & Peripherals", icon: <FiMonitor /> },
    { name: "Components", icon: <FiCpu /> },
    { name: "Security & Surveillance", icon: <FiShield /> },
    { name: "Networking", icon: <FiGlobe /> },
    { name: "Storage & Backup", icon: <FiDatabase /> },
    { name: "Office Equipment", icon: <FiPrinter /> },
    { name: "Power & Electricals", icon: <FiZap /> },
    { name: "Software & Licenses", icon: <FiFileText /> },
    { name: "Mobility & Accessories", icon: <FiSmartphone /> },
    { name: "Consumables", icon: <FiLayers /> }
  ];

  // Explore by category grid items
  const exploreCategories = [
    { name: "Computers & Peripherals", image: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=200&fit=crop&q=80" },
    { name: "Components", image: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=200&fit=crop&q=80" },
    { name: "Security & Surveillance", image: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=200&fit=crop&q=80" },
    { name: "Networking", image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=200&fit=crop&q=80" },
    { name: "Storage & Backup", image: "https://images.unsplash.com/photo-1600541519468-4a78a7ff6942?w=200&fit=crop&q=80" },
    { name: "Office Equipment", image: "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=200&fit=crop&q=80" },
    { name: "Power & Electricals", image: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=200&fit=crop&q=80" },
    { name: "Software & Licenses", image: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=200&fit=crop&q=80" },
    { name: "Mobility & Accessories", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&fit=crop&q=80" }
  ];

  return (
    <div className="w-full min-h-screen bg-black text-white dark:bg-black dark:text-white light:bg-gray-50 light:text-gray-900 transition-colors duration-300 pb-24">
      {/* CSS injection for light/dark custom styles */}
      <style>{`
        .light\\:bg-gray-50:not(.dark *) {
          background-color: #f9fafb !important;
        }
        .light\\:text-gray-900:not(.dark *) {
          color: #111827 !important;
        }
        .light\\:bg-white:not(.dark *) {
          background-color: #ffffff !important;
        }
        .light\\:border-gray-200:not(.dark *) {
          border-color: #e5e7eb !important;
        }
        .light\\:text-gray-500:not(.dark *) {
          color: #6b7280 !important;
        }
        .light\\:text-gray-650:not(.dark *) {
          color: #4b5563 !important;
        }
        .light\\:text-gray-800:not(.dark *) {
          color: #1f2937 !important;
        }
        .light\\:bg-gray-100:not(.dark *) {
          background-color: #f3f4f6 !important;
        }
      `}</style>

      {/* Main Container */}
      <div className="w-full max-w-full">

        {/* MOBILE ONLY TOP SECTION */}
        <div className="block md:hidden">
          {/* Red Background Top Section wrapper */}
          <div 
            className="w-full px-3 pt-1.5 pb-1.5 space-y-1.5 transition-colors duration-300"
            style={{
              background: theme === "dark" 
                ? "linear-gradient(to bottom, #1A0A0A 0%, #140808 30%, #0D0D0D 100%)" 
                : "linear-gradient(135deg, #9B1C1C 0%, #7B0A0A 50%, #4C0505 100%)"
            }}
          >
            {/* Third Row: Slim Navigation Capsule Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
              <button 
                onClick={() => setActiveMarketTab("Official Store")}
                className={`w-[96px] h-[36px] flex-shrink-0 flex flex-col items-center justify-center rounded-md text-center transition-all cursor-pointer ${
                  activeMarketTab === "Official Store"
                    ? "bg-white text-[#AE020B] shadow-sm font-extrabold"
                    : "border border-white/20 bg-white/10 text-white font-medium hover:bg-white/20"
                }`}
              >
                <span className={`block text-[7px] opacity-75 font-normal leading-tight ${activeMarketTab === "Official Store" ? "text-zinc-550" : "text-white/80"}`}>BRANDS BY PLE</span>
                <span className="text-[9px] leading-tight">Official Store</span>
              </button>
              
              <button 
                onClick={() => setActiveMarketTab("Marketplace")}
                className={`w-[96px] h-[36px] flex-shrink-0 flex flex-col items-center justify-center rounded-md text-center transition-all cursor-pointer ${
                  activeMarketTab === "Marketplace"
                    ? "bg-white text-[#AE020B] shadow-sm font-extrabold"
                    : "border border-white/20 bg-white/10 text-white font-medium hover:bg-white/20"
                }`}
              >
                <span className={`block text-[7px] opacity-75 font-normal leading-tight ${activeMarketTab === "Marketplace" ? "text-zinc-550" : "text-white/80"}`}>OTHER SHOPS</span>
                <span className="text-[9px] leading-tight">Marketplace</span>
              </button>

              <button 
                onClick={() => navigate('/categories')}
                className="w-[96px] h-[36px] flex-shrink-0 flex flex-col items-center justify-center border border-white/20 bg-white/10 text-white font-semibold text-[9px] uppercase rounded-md"
              >
                CATEGORIES
              </button>

              <button 
                onClick={() => navigate('/offers')}
                className="w-[96px] h-[36px] flex-shrink-0 flex flex-col items-center justify-center border border-white/20 bg-white/10 text-white font-semibold text-[9px] uppercase rounded-md"
              >
                OFFER
              </button>

              <button 
                onClick={() => navigate('/offers')}
                className="w-[96px] h-[36px] flex-shrink-0 flex flex-col items-center justify-center border border-white/20 bg-white/10 text-yellow-300 font-extrabold text-[9px] uppercase rounded-md"
              >
                <span className="flex items-center justify-center gap-0.5">DIWALI <span className="text-[8px]">★</span> SALE</span>
              </button>
            </div>

            {/* Fourth Row: Single Integrated Search Bar with Left Logo & Right Search Icon */}
            <div className="relative flex items-center w-full bg-white rounded-full border border-white/20 pl-3 pr-8 py-1.5 shadow-sm">
              <div className="flex items-center gap-1.5 pr-2 border-r border-gray-200">
                <div className="w-4.5 h-4.5 rounded-full bg-[#AE020B] flex items-center justify-center text-white text-[8px] font-black">
                  PLE
                </div>
              </div>
              <input 
                type="text" 
                placeholder="Search for products, brands, categories..." 
                className="flex-grow pl-2 bg-transparent text-xs text-gray-900 focus:outline-none placeholder-gray-400"
              />
              <FiSearch className="absolute right-3 text-gray-400 text-sm" />
            </div>
          </div>

          {/* Fifth Row: Category Quick Nav Bar Wrapper */}
          <div 
            className="w-full px-3 py-1.5 transition-colors duration-300 border-b border-white/10"
            style={{
              background: theme === "dark" 
                ? "linear-gradient(to bottom, #1A0A0A 0%, #140808 30%, #0D0D0D 100%)" 
                : "linear-gradient(135deg, #9B1C1C 0%, #7B0A0A 50%, #4C0505 100%)"
            }}
          >
            <div className="flex gap-4 overflow-x-auto scrollbar-hide py-0.5 items-center">
              {/* "All" button */}
              <button
                onClick={() => {
                  setActiveCategoryTab("All");
                  navigate("/home");
                }}
                className="flex flex-col items-center gap-0.5 min-w-[48px] relative pb-1 cursor-pointer flex-shrink-0 focus:outline-none"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border overflow-hidden p-0.5 transition-all ${
                  activeCategoryTab === "All" 
                    ? "border-white bg-white text-[#AE020B] shadow-md" 
                    : "border-white/20 bg-white/10 text-white/90 hover:bg-white/20"
                }`}>
                  <FiShoppingBag className="text-xs" />
                </div>
                <span className={`text-[9px] font-bold text-center transition-colors ${
                  activeCategoryTab === "All" ? "text-white font-extrabold" : "text-white/70"
                }`}>
                  All
                </span>
                {activeCategoryTab === "All" && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-white rounded-full" />
                )}
              </button>

              {/* Dynamic Categories */}
              {displayCategories.map((category) => {
                const isSelected = activeCategoryTab === category.name || activeCategoryTab === String(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setActiveCategoryTab(category.name);
                      navigate(`/category/${category.id}`);
                    }}
                    className="flex flex-col items-center gap-0.5 min-w-[48px] relative pb-1 cursor-pointer flex-shrink-0 focus:outline-none"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border overflow-hidden p-0.5 transition-all ${
                      isSelected 
                        ? "border-white bg-white text-[#AE020B] shadow-md" 
                        : "border-white/20 bg-white/10 text-white/90 hover:bg-white/20"
                    }`}>
                      {category.image ? (
                        <img
                          src={category.image}
                          alt={category.name}
                          className="w-full h-full object-contain rounded-full"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = getPlaceholderImage(32, 32, category.name);
                          }}
                        />
                      ) : (
                        <span className="text-xs font-bold text-white">{category.name?.charAt(0)}</span>
                      )}
                    </div>
                    <span className={`text-[9px] font-semibold text-center transition-colors truncate max-w-[56px] ${
                      isSelected ? "text-white font-extrabold" : "text-white/70"
                    }`}>
                      {category.name}
                    </span>
                    {isSelected && (
                      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-white rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-4 py-3 space-y-4 md:px-2 lg:px-3 xl:px-4 w-full max-w-full">




        {activeMarketTab === "Official Store" ? (
            <>
              {/* Sixth Row: Main Hero Banner ("BUSINESS PROCUREMENT") */}
              <div 
                className="relative rounded-2xl overflow-hidden p-6 flex flex-col justify-between min-h-[220px] transition-all border border-zinc-800/50 bg-black"
                style={{
                  backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.4) 100%), url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80')",
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              >
                <div className="space-y-2 relative z-10">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF3E46]">
                    BUSINESS PROCUREMENT
                  </span>
                  <h2 className="text-2xl font-black leading-tight text-white">
                    Smart Sourcing.<br />Reliable Supply.
                  </h2>
                  <p className="text-xs max-w-sm font-medium mt-1 leading-relaxed text-zinc-300">
                    GST-compliant sourcing, bulk quotes and business purchasing made easy.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-4 relative z-10 w-full max-w-[340px]">
                  <button 
                    onClick={handleRfqClick}
                    className="flex items-center justify-center gap-1 px-2.5 py-2 bg-[#AE020B] hover:bg-[#8B0208] text-white font-extrabold text-[10px] sm:text-xs uppercase rounded-lg transition-all shadow-md active:scale-95 cursor-pointer w-full text-center"
                  >
                    <FiFileText className="text-xs shrink-0" />
                    Request Quote
                  </button>
                  <button 
                    onClick={() => navigate('/product-request/new')}
                    className="flex items-center justify-center gap-1 px-2.5 py-2 border border-white/20 bg-white/10 hover:bg-white/20 text-white font-extrabold text-[10px] sm:text-xs uppercase rounded-lg transition-all active:scale-95 cursor-pointer w-full text-center"
                  >
                    <FiPlus className="text-xs shrink-0" />
                    Source Now
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div 
                  onClick={handleRfqClick}
                  className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                    isDark 
                      ? "bg-zinc-955 border-zinc-900 hover:border-zinc-800" 
                      : "bg-white border-gray-150 hover:border-gray-250 shadow-sm"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isDark ? "bg-red-955/50 text-red-500" : "bg-red-50 text-red-600"
                  }`}>
                    <FiFileText className="text-lg" />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Request Quote</h4>
                    <p className={`text-[10px] mt-0.5 leading-tight ${isDark ? "text-zinc-500" : "text-gray-500"}`}>Get best quotes for your needs</p>
                  </div>
                </div>
     
                <div 
                  onClick={() => navigate('/product-request/new')}
                  className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                    isDark 
                      ? "bg-zinc-955 border-zinc-900 hover:border-zinc-800" 
                      : "bg-white border-gray-150 hover:border-gray-250 shadow-sm"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isDark ? "bg-blue-955/50 text-blue-500" : "bg-blue-50 text-blue-600"
                  }`}>
                    <FiPlus className="text-lg" />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Source Now</h4>
                    <p className={`text-[10px] mt-0.5 leading-tight ${isDark ? "text-zinc-500" : "text-gray-500"}`}>Request custom or unlisted items</p>
                  </div>
                </div>
     
                <div className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                  isDark 
                    ? "bg-zinc-950 border-zinc-900 hover:border-zinc-800" 
                    : "bg-white border-gray-150 hover:border-gray-250 shadow-sm"
                }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isDark ? "bg-green-955/50 text-green-500" : "bg-green-50 text-green-600"
                  }`}>
                    <FiClock className="text-lg" />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Track Orders</h4>
                    <p className={`text-[10px] mt-0.5 leading-tight ${isDark ? "text-zinc-500" : "text-gray-500"}`}>Real-time status of your orders</p>
                  </div>
                </div>
     
                <div className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                  isDark 
                    ? "bg-zinc-950 border-zinc-900 hover:border-zinc-800" 
                    : "bg-white border-gray-150 hover:border-gray-250 shadow-sm"
                }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isDark ? "bg-amber-955/50 text-amber-500" : "bg-amber-50 text-amber-600"
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-gray-900"}`}>GST Invoices</h4>
                    <p className={`text-[10px] mt-0.5 leading-tight ${isDark ? "text-zinc-500" : "text-gray-500"}`}>100% GST compliant invoicing</p>
                  </div>
                </div>
              </div>

              {/* Ninth Row: POPULAR CATEGORIES */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-bold tracking-wide uppercase ${isDark ? "text-white" : "text-gray-900"}`}>
                    POPULAR CATEGORIES
                  </h3>
                  <button 
                    onClick={() => navigate('/categories')}
                    className="text-xs font-bold text-[#AE020B] flex items-center gap-0.5 hover:underline cursor-pointer"
                  >
                    View All <FiChevronRight className="mt-0.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide py-1">
                  {displayCategories.map((cat) => {
                    return (
                      <Link
                        key={cat.id}
                        to={`/category/${cat.id}`}
                        className="flex flex-col items-center gap-1.5 flex-shrink-0"
                      >
                        <div className={`w-14 h-14 rounded-full border flex items-center justify-center p-1.5 overflow-hidden transition-all ${
                          isDark 
                            ? "border-red-900/60 bg-zinc-955 hover:border-red-500" 
                            : "border-gray-200 bg-white hover:border-red-500 shadow-sm"
                        }`}>
                          <img
                            src={cat.image}
                            alt={cat.name}
                            className="w-full h-full object-contain rounded-full"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = getPlaceholderImage(64, 64, cat.name || "Cat");
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 text-center truncate w-20">
                          {cat.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Marketplace Content (Other Shops / Featured Vendors) */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-bold tracking-wide uppercase ${isDark ? "text-white" : "text-gray-900"}`}>
                    Featured Marketplace Shops
                  </h3>
                </div>
                {computedVendors && (
                  <FeaturedVendorsSection vendors={computedVendors} />
                )}
              </div>
            </>
          )}
        </div>


        {/* DESKTOP ONLY TOP SECTION (MATCHING SCREENSHOT) */}
        <div className="hidden md:block space-y-8 pb-4 w-full">
          
          {/* 3-Column Layout */}
          <div className="grid grid-cols-12 gap-4 items-stretch">
            
            {/* Left Column: BROWSE CATEGORIES */}
            <div className={`col-span-3 rounded-2xl p-5 flex flex-col justify-between border ${
              isDark 
                ? "bg-zinc-955 border-zinc-900 text-zinc-400" 
                : "bg-white border-gray-200 text-gray-700"
            }`}>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-5 ${isDark ? "text-zinc-450" : "text-gray-500"}`}>Browse Categories</h3>
                <div className="space-y-1">
                  {sidebarCategories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => navigate(`/search?query=${cat.name}`)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group text-sm font-medium ${
                        isDark 
                          ? "text-zinc-400 hover:text-white hover:bg-zinc-900" 
                          : "text-gray-600 hover:text-red-600 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg transition-colors ${
                          isDark ? "text-zinc-400 group-hover:text-red-505" : "text-gray-400 group-hover:text-red-600"
                        }`}>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </div>
                      <FiChevronRight className={`${isDark ? "text-zinc-600 group-hover:text-white" : "text-gray-400 group-hover:text-gray-900"} transition-colors`} />
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => navigate('/categories')}
                className={`w-full mt-6 py-3 text-xs font-bold rounded-xl transition-colors border ${
                  isDark 
                    ? "bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800" 
                    : "bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200"
                }`}
              >
                View All Categories
              </button>
            </div>

            {/* Middle Column: Hero Carousel Banner */}
            <div className="col-span-6 relative rounded-2xl overflow-hidden bg-[#0A0506] border border-zinc-900 p-8 md:p-10 flex flex-col justify-between min-h-[420px]">
              
              {/* Background gradient & decorative dark architectural picture style */}
              <div 
                className="absolute right-0 top-0 bottom-0 w-1/2 bg-cover bg-right bg-no-repeat opacity-40 select-none pointer-events-none mix-blend-screen"
                style={{
                  backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop')"
                }}
              />
              
              <div className="space-y-4 relative z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
                  Corporate Procurement Made Easy
                </span>
                <h2 className="text-4xl font-black text-white leading-tight">
                  Smart Sourcing.<br />
                  Reliable Supply.<br />
                  Built for Business.
                </h2>
                <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
                  End-to-end procurement solutions with GST-compliant invoicing, bulk pricing, and dedicated support.
                </p>
              </div>
              
              <div className="relative z-10 flex items-center gap-4 mt-8">
                <button 
                  onClick={() => navigate('/b2b-dashboard/rfqs')}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-750 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-md active:scale-95"
                >
                  RFQ Details <span className="text-sm">➔</span>
                </button>
                <button 
                  onClick={() => navigate('/product-request/new')}
                  className="px-6 py-3 border border-zinc-800 bg-black/40 hover:bg-zinc-900 text-white font-extrabold text-xs uppercase rounded-xl transition-all active:scale-95"
                >
                  Source Now
                </button>
              </div>

              {/* Indicators */}
              <div className="flex gap-1.5 justify-center mt-6 z-10">
                <span className="w-4 h-1.5 bg-red-600 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-zinc-800 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-zinc-800 rounded-full"></span>
              </div>
            </div>

            {/* Right Column: BUSINESS ACCOUNT Card */}
            <div className={`col-span-3 rounded-2xl p-5 border flex flex-col justify-between ${
              isDark 
                ? "bg-zinc-955 border-zinc-900 text-white" 
                : "bg-white border-gray-200 text-gray-800"
            }`}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-450" : "text-gray-500"}`}>Business Account</h3>
                  <Link to="/profile" className="text-red-500 hover:text-red-400 text-xs font-extrabold flex items-center gap-0.5 transition-colors">
                    View Profile ➔
                  </Link>
                </div>
                
                {/* Profile detail card box */}
                <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                  isDark 
                    ? "bg-zinc-900 border-zinc-850" 
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                    isDark 
                      ? "bg-red-955/30 border-red-900/10 text-red-500" 
                      : "bg-red-50 border-red-100 text-red-600"
                  }`}>
                    <FiHome className="text-lg" />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold truncate leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                      {displayCompanyName}
                    </h4>
                    <p className={`text-[10px] mt-0.5 flex items-center gap-1.5 ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                      <span>GSTIN: {displayGSTIN || "Not Configured"}</span>
                      {displayGSTIN && (
                        <span className="w-3.5 h-3.5 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[8px] font-bold">✔</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Profile Info fields */}
                <div className="mt-5 space-y-3">
                  <div className={`flex items-center justify-between text-xs py-1 border-b ${isDark ? "border-zinc-900/50" : "border-gray-100"}`}>
                    <span className="text-zinc-500">Admin</span>
                    <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{displayAdminName}</span>
                  </div>
                  <div className={`flex items-center justify-between text-xs py-1 border-b ${isDark ? "border-zinc-900/50" : "border-gray-100"}`}>
                    <span className="text-zinc-500">Role</span>
                    <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{displayRole}</span>
                  </div>
                  <div className={`flex items-center justify-between text-xs py-1 border-b ${isDark ? "border-zinc-900/50" : "border-gray-100"}`}>
                    <span className="text-zinc-500">Purchases History</span>
                    <Link to="/orders" className="font-semibold text-red-500 hover:text-red-450 hover:underline">View History</Link>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-zinc-500">Member Since</span>
                    <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{displayMemberSince}</span>
                  </div>
                </div>

                {/* Bulk Request callout alert */}
                <div className={`rounded-xl p-3.5 flex items-start gap-2.5 text-[10px] mt-5 leading-normal border ${
                  isDark 
                    ? "bg-red-955/10 border-red-900/20 text-zinc-400" 
                    : "bg-red-50 border-red-100 text-gray-700"
                }`}>
                  <FiFileText className="text-red-500 text-sm shrink-0 mt-0.5" />
                  <span>Need bulk pricing or custom sourcing? Submit an RFQ and get best quotes.</span>
                </div>
              </div>

              <button
                onClick={() => navigate('/b2b-dashboard/rfqs')}
                className="w-full mt-6 py-3.5 bg-red-600 hover:bg-red-750 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-md active:scale-95"
              >
                RFQ Details
              </button>
            </div>

          </div>

          {/* Quick Action Cards Row (4 cards) */}
          <div className="grid grid-cols-4 gap-5">
            <div 
              className={`rounded-2xl p-5 transition-all flex items-start gap-4 border ${
                isDark 
                  ? "bg-zinc-955 border-zinc-900 hover:border-zinc-800 text-white" 
                  : "bg-white border-gray-200 hover:border-gray-350 text-gray-800"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isDark 
                  ? "bg-red-955/20 border-red-900/10 text-red-500" 
                  : "bg-red-50 border-red-100/50 text-red-605"
              }`}>
                <FiTrendingUp className="text-lg" />
              </div>
              <div className="min-w-0">
                <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Wholesale Pricing</h4>
                <p className="text-xs text-zinc-505 mt-1 leading-relaxed">Verified tier discounts & bulk volume rates on all catalog items.</p>
              </div>
            </div>

            <div 
              onClick={() => navigate('/product-request/new')}
              className={`rounded-2xl p-5 cursor-pointer transition-all flex items-start gap-4 border ${
                isDark 
                  ? "bg-zinc-955 border-zinc-900 hover:border-zinc-800 text-white" 
                  : "bg-white border-gray-200 hover:border-gray-350 text-gray-800"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isDark 
                  ? "bg-zinc-900 border-zinc-850 text-zinc-400" 
                  : "bg-gray-100 border-gray-200 text-gray-600"
              }`}>
                <FiPlus className="text-lg" />
              </div>
              <div className="min-w-0">
                <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Source Now</h4>
                <p className="text-xs text-zinc-505 mt-1 leading-relaxed">Request custom or unlisted items.</p>
              </div>
            </div>

            <div className={`rounded-2xl p-5 transition-all flex items-start gap-4 border ${
              isDark 
                ? "bg-zinc-955 border-zinc-900 hover:border-zinc-800 text-white" 
                : "bg-white border-gray-200 hover:border-gray-350 text-gray-800"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isDark 
                  ? "bg-red-955/20 border-red-900/10 text-red-500" 
                  : "bg-red-50 border-red-100/50 text-red-605"
              }`}>
                <FiTruck className="text-lg" />
              </div>
              <div className="min-w-0">
                <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Fast & Reliable Delivery</h4>
                <p className="text-xs text-zinc-505 mt-1 leading-relaxed">Pan-India delivery with real-time tracking.</p>
              </div>
            </div>

            <div className={`rounded-2xl p-5 transition-all flex items-start gap-4 border ${
              isDark 
                ? "bg-zinc-955 border-zinc-900 hover:border-zinc-800 text-white" 
                : "bg-white border-gray-200 hover:border-gray-355 text-gray-805"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isDark 
                  ? "bg-zinc-900 border-zinc-850 text-zinc-400" 
                  : "bg-gray-100 border-gray-200 text-gray-600"
              }`}>
                <FiShield className="text-lg" />
              </div>
              <div className="min-w-0">
                <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>GST Compliant</h4>
                <p className="text-xs text-zinc-505 mt-1 leading-relaxed">All invoices & billing 100% GST compliant.</p>
              </div>
            </div>
          </div>

          {/* EXPLORE BY CATEGORY */}
          <div className="space-y-5 mt-10">
            <div className="flex items-center justify-between">
              <h3 className={`text-lg font-black tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>Explore By Category</h3>
              <Link to="/categories" className="text-red-500 hover:text-red-400 text-xs font-bold flex items-center gap-0.5">
                View All ➔
              </Link>
            </div>
            
            <div className="grid grid-cols-9 gap-4">
              {exploreCategories.map((cat) => {
                const match = displayCategories.find(c => c.name?.toLowerCase().includes(cat.name.toLowerCase()) || cat.name.toLowerCase().includes(c.name?.toLowerCase()));
                return (
                  <div
                    key={cat.name}
                    onClick={() => {
                      if (match?.id) {
                        navigate(`/category/${match.id}`);
                      } else {
                        navigate(`/search?query=${cat.name}`);
                      }
                    }}
                    className={`rounded-2xl p-3 text-center cursor-pointer hover:scale-102 transition-all flex flex-col items-center justify-between group border ${
                    isDark 
                      ? "bg-zinc-955 border-zinc-900 hover:border-zinc-800 text-white" 
                      : "bg-white border-gray-200 hover:border-gray-300 text-gray-800"
                  }`}
                >
                  <div className={`w-full aspect-square rounded-xl overflow-hidden mb-3 border ${isDark ? "bg-zinc-900 border-zinc-850" : "bg-gray-55 border-gray-100"}`}>
                    <img 
                      src={cat.image} 
                      alt={cat.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                  </div>
                  <span className={`text-[11px] font-bold transition-colors leading-tight line-clamp-2 ${
                    isDark 
                      ? "text-zinc-400 group-hover:text-white" 
                      : "text-gray-700 group-hover:text-black"
                  }`}>
                    {cat.name}
                  </span>
                </div>
                );
              })}
            </div>
          </div>

          {/* Trust Features Footer Banner */}
          <div className={`grid grid-cols-4 gap-6 py-6 border-t border-b mt-10 text-xs font-medium ${
            isDark 
              ? "border-zinc-900 text-zinc-450" 
              : "border-gray-200 text-gray-600"
          }`}>
            <div className="flex items-center justify-center gap-3">
              <FiShield className="text-red-500 text-lg shrink-0" />
              <span>
                <strong className={`block font-bold ${isDark ? "text-white" : "text-gray-900"}`}>200+ Trusted Brands</strong>
                <span className="text-[11px] text-zinc-500">Curated for Business</span>
              </span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <FiFileText className="text-red-500 text-lg shrink-0" />
              <span>
                <strong className={`block font-bold ${isDark ? "text-white" : "text-gray-900"}`}>GST Compliant Billing</strong>
                <span className="text-[11px] text-zinc-500">100% Secure & Compliant</span>
              </span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <FiTruck className="text-red-500 text-lg shrink-0" />
              <span>
                <strong className={`block font-bold ${isDark ? "text-white" : "text-gray-900"}`}>PAN India Delivery</strong>
                <span className="text-[11px] text-zinc-500">Fast & Reliable</span>
              </span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <FiPhone className="text-red-500 text-lg shrink-0" />
              <span>
                <strong className={`block font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Dedicated Support</strong>
                <span className="text-[11px] text-zinc-500">Always Here For You</span>
              </span>
            </div>
          </div>

        </div>

        {/* RESTORED ORIGINAL BOTTOM SECTIONS (UNCHANGED) */}
        
        {/* Brand Logos Scroll */}
        {computedBrands && <BrandLogosScroll brands={computedBrands} />}

        {/* Offer Carousel Section */}
        {offers && (
          <div className="px-4 py-2">
            <OfferCarousel offers={offers} onOfferClick={setSelectedHomeOffer} />
          </div>
        )}

        {/* Featured Vendors Section */}
        {computedVendors && (
          <div id="featured-vendors-section">
            <FeaturedVendorsSection vendors={computedVendors} />
          </div>
        )}

        {/* Animated Promo Banner */}
        {promoBanners && <AnimatedBanner banners={promoBanners} />}

        {/* New Arrivals */}
        {computedNewArrivals && <NewArrivalsSection products={computedNewArrivals} />}

        {/* Most Popular */}
        {computedMostPopular && (
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                <span>Most </span>
                <span className="text-[#AE020B] dark:text-[#AE020B]">Popular</span>
              </h2>
              <Link
                to="/search"
                className="text-sm text-primary-600 dark:text-[#AE020B] font-semibold text-zinc-400">
                See All
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {computedMostPopular.map((product, index) => (
                <motion.div
                  key={product.id}
                  className={index === 5 ? "xl:hidden" : ""}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Deals */}
        {computedDailyDeals && <DailyDealsSection products={computedDailyDeals} />}

        {/* Refurbished & Renewed Deals */}
        {computedRefurbished && computedRefurbished.length > 0 && (
          <div className="px-4 py-6 bg-gradient-to-br from-cyan-50/20 to-blue-50/20 dark:from-cyan-950/10 dark:to-blue-950/10 border-t border-b border-zinc-900 light:border-gray-100 my-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="bg-gradient-to-r from-red-600 to-[#7B0A0A] text-transparent bg-clip-text">Refurbished & Renewed Deals</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Certified products in like-new condition with full warranty</p>
              </div>
              <Link
                to="/refurbished-categories"
                className="text-sm text-[#7B0A0A] dark:text-[#FF4D4D] font-bold hover:underline">
                View All
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {computedRefurbished.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}>
                  <ProductCard product={product} showCondition={true} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Flash Sale */}
        {computedFlashSale && computedFlashSale.length > 0 && (
          <div className="px-4 py-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-transparent dark:to-transparent dark:bg-none">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-850 dark:text-white">
                  Flash Sale
                </h2>
                <p className="text-xs text-gray-650 dark:text-[#888888]">Limited time offers</p>
              </div>
              <Link
                to="/flash-sale"
                className="text-sm text-primary-600 dark:text-[#7B0A0A] font-semibold text-zinc-400">
                See All
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {computedFlashSale.map((product, index) => (
                <motion.div
                  key={product.id}
                  className={index === 5 ? "xl:hidden" : ""}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}>
                  <ProductCard product={product} isFlashSale={true} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Trending Items */}
        {computedTrending && (
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-850 dark:text-white">Trending Now</h2>
              <Link
                to="/search"
                className="text-sm text-primary-600 dark:text-[#7B0A0A] font-semibold text-zinc-400">
                See All
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {computedTrending.map((product, index) => (
                <motion.div
                  key={product.id}
                  className={index === 5 ? "hidden xl:block 2xl:hidden" : ""}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        </div>

      {/* General B2B Request Quote Modal */}
      <B2BRequestQuoteModal
        isOpen={isRfqOpen}
        onClose={() => setIsRfqOpen(false)}
        product={null}
      />
    </div>
  );
};

export default B2BHome;
