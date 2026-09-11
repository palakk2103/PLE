import { useState, useMemo, useEffect } from "react";
import { FiArrowLeft, FiFilter, FiGrid, FiList, FiTag, FiAward, FiGift } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import MobileLayout from "../components/Layout/MobileLayout";
import ProductCard from "../../../shared/components/ProductCard";
import ProductListItem from "../components/Mobile/ProductListItem";
import PageTransition from "../../../shared/components/PageTransition";
import { useCampaignStore } from "../../../shared/store/campaignStore";
import { useProductStore } from "../../../shared/store/productStore";
import { useCategoryStore } from "../../../shared/store/categoryStore";
import { formatPrice } from "../../../shared/utils/helpers";
import toast from "react-hot-toast";

const FestivalLandingPage = () => {
  const navigate = useNavigate();
  const { campaigns, initialize: initCampaigns } = useCampaignStore();
  const { products, fetchProducts } = useProductStore();
  const { categories, initialize: initCategories } = useCategoryStore();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [copiedCoupon, setCopiedCoupon] = useState(null);

  useEffect(() => {
    initCampaigns();
    fetchProducts();
    initCategories();
  }, [initCampaigns, fetchProducts, initCategories]);

  // Find active festival campaign
  const activeCampaign = useMemo(() => {
    return campaigns.find(c => {
      if (c.type !== 'festival' || !c.isActive) return false;
      const now = new Date();
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      return start <= now && end >= now;
    });
  }, [campaigns]);

  // Get campaign products
  const campaignProducts = useMemo(() => {
    if (!activeCampaign || !activeCampaign.productIds) return [];
    const ids = activeCampaign.productIds.map(String);
    return products.filter(p => {
      const pid = String(p.id || p._id);
      return ids.includes(pid);
    });
  }, [activeCampaign, products]);

  // Get categories present in the campaign products
  const campaignCategories = useMemo(() => {
    if (campaignProducts.length === 0) return [];
    const catIds = [...new Set(campaignProducts.map(p => String(p.categoryId)))].filter(Boolean);
    return categories.filter(c => catIds.includes(String(c.id || c._id)));
  }, [campaignProducts, categories]);

  // Filter products by category
  const filteredProducts = useMemo(() => {
    if (selectedCategory === "all") return campaignProducts;
    return campaignProducts.filter(p => String(p.categoryId) === String(selectedCategory));
  }, [campaignProducts, selectedCategory]);

  // Trending Products (e.g., top 4 products in campaign)
  const trendingProducts = useMemo(() => {
    return campaignProducts.slice(0, 4);
  }, [campaignProducts]);

  // Mock festival coupons
  const festivalCoupons = useMemo(() => {
    if (!activeCampaign) return [];
    const discount = activeCampaign.discountValue || 15;
    return [
      { code: `${activeCampaign.name.toUpperCase().replace(/\s+/g, '')}${discount}`, desc: `Flat ${discount}% off on all items`, minOrder: 999 },
      { code: `FESTIVE500`, desc: `Flat ₹500 off on orders above ₹2999`, minOrder: 2999 },
    ];
  }, [activeCampaign]);

  const handleCopyCoupon = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(code);
    toast.success(`Coupon "${code}" copied!`);
    setTimeout(() => setCopiedCoupon(null), 2000);
  };

  if (!activeCampaign) {
    return (
      <PageTransition>
        <MobileLayout showBottomNav={true} showCartBar={true}>
          <div className="w-full flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">No Active Festival Sale</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Stay tuned! Our next festive campaign will launch soon.</p>
            <button
              onClick={() => navigate("/home")}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-md transition-all"
            >
              Go to Homepage
            </button>
          </div>
        </MobileLayout>
      </PageTransition>
    );
  }

  const discountText = activeCampaign.discountType === 'percentage' 
    ? `Flat ${activeCampaign.discountValue}% OFF` 
    : `Flat ₹${activeCampaign.discountValue} OFF`;

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        <div className="w-full pb-24 dark:bg-neutral-900 min-h-screen">
          {/* Header Bar */}
          <div className="mx-2 mt-3 sm:mt-4 px-4 py-4 bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-full transition-colors">
                <FiArrowLeft className="text-xl text-gray-700 dark:text-gray-200" />
              </button>
              <div>
                <h1 className="text-xl font-black text-gray-800 dark:text-white tracking-tight uppercase">
                  {activeCampaign.name}
                </h1>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {campaignProducts.length} Exclusive Deals Live Now
                </p>
              </div>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-neutral-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded transition-colors ${viewMode === "list"
                  ? "bg-white dark:bg-neutral-800 text-red-600 dark:text-red-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
                  }`}
              >
                <FiList className="text-lg" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded transition-colors ${viewMode === "grid"
                  ? "bg-white dark:bg-neutral-800 text-red-600 dark:text-red-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
                  }`}
              >
                <FiGrid className="text-lg" />
              </button>
            </div>
          </div>

          {/* Festival Banner */}
          <div className="mx-2 mt-4 relative rounded-2xl overflow-hidden shadow-md group select-none banner-container">
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/90 to-amber-600/90 z-10 mix-blend-multiply pointer-events-none select-none" />
            <img
              src={activeCampaign.bannerConfig?.image || "https://images.unsplash.com/photo-1605152276897-4f618f831968?w=1200&auto=format&fit=crop&q=80"}
              alt={activeCampaign.name}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className="w-full h-48 md:h-64 object-cover transform group-hover:scale-105 transition-transform duration-700 pointer-events-none select-none"
            />
            <div className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-12 text-white pointer-events-none select-none">
              <span className="bg-yellow-400 text-red-950 text-xs font-black px-2.5 py-1 rounded-full w-max uppercase tracking-wider mb-2 animate-bounce select-none">
                {discountText}
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 uppercase drop-shadow-md select-none">
                {activeCampaign.bannerConfig?.title || activeCampaign.name}
              </h2>
              <p className="text-sm md:text-base text-white/90 font-medium max-w-md drop-shadow-sm select-none">
                {activeCampaign.bannerConfig?.subtitle || activeCampaign.description}
              </p>
            </div>
          </div>

          {/* Festival Coupons */}
          {festivalCoupons.length > 0 && (
            <div className="px-4 mt-6">
              <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <FiGift className="text-red-500 text-lg" />
                Special Festival Coupons
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {festivalCoupons.map((coupon) => (
                  <div 
                    key={coupon.code}
                    className="border border-dashed border-red-300 bg-red-50/50 dark:bg-red-950/20 rounded-xl p-3 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                  >
                    <div>
                      <p className="text-sm font-bold text-red-700 dark:text-red-300">{coupon.code}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{coupon.desc}</p>
                      <p className="text-[10px] text-gray-400 mt-1">Min Order: {formatPrice(coupon.minOrder)}</p>
                    </div>
                    <button
                      onClick={() => handleCopyCoupon(coupon.code)}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                    >
                      {copiedCoupon === coupon.code ? "Copied!" : "COPY"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories Filter Strip */}
          {campaignCategories.length > 0 && (
            <div className="px-4 mt-6">
              <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <FiFilter className="text-red-500 text-lg" />
                Browse by Category
              </h3>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold tracking-tight transition-all flex-shrink-0 ${
                    selectedCategory === "all"
                      ? "bg-red-600 text-white shadow-md"
                      : "bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-neutral-700 hover:bg-gray-50"
                  }`}
                >
                  All Items
                </button>
                {campaignCategories.map((cat) => (
                  <button
                    key={cat.id || cat._id}
                    onClick={() => setSelectedCategory(cat.id || cat._id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold tracking-tight transition-all flex-shrink-0 ${
                      selectedCategory === (cat.id || cat._id)
                        ? "bg-red-600 text-white shadow-md"
                        : "bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-neutral-700 hover:bg-gray-50"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending Festival Products Section */}
          {trendingProducts.length > 0 && selectedCategory === "all" && (
            <div className="px-4 mt-6">
              <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <FiAward className="text-yellow-500 text-lg animate-pulse" />
                Trending Festival Deals
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
                {trendingProducts.map((product) => (
                  <div key={product.id || product._id} className="w-44 flex-shrink-0">
                    <ProductCard product={product} isFlashSale={true} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Product Grid */}
          <div className="px-4 mt-6">
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-4">
              All Festival Offers
            </h3>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-2xl">
                <p className="text-gray-500 dark:text-gray-400">No products found in this category.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product.id || product._id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <ProductCard product={product} isFlashSale={true} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product, idx) => (
                  <ProductListItem
                    key={product.id || product._id}
                    product={product}
                    index={idx}
                    isFlashSale={true}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default FestivalLandingPage;
