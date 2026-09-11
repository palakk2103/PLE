import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, matchPath, useNavigate, useLocation } from "react-router-dom";
import { FiHeart, FiEdit3 } from "react-icons/fi";
import MobileLayout from "../components/Layout/MobileLayout";
import ProductCard from "../../../shared/components/ProductCard";
import AnimatedBanner from "../components/Mobile/AnimatedBanner";
import NewArrivalsSection from "../components/Mobile/NewArrivalsSection";
import DailyDealsSection from "../components/Mobile/DailyDealsSection";
import RecommendedSection from "../components/Mobile/RecommendedSection";
import FeaturedVendorsSection from "../components/Mobile/FeaturedVendorsSection";
import BrandLogosScroll from "../components/Mobile/BrandLogosScroll";
import MobileCategoryGrid from "../components/Mobile/MobileCategoryGrid";
import MobileCategoryQuickNav from "../components/Mobile/MobileCategoryQuickNav";
import LazyImage from "../../../shared/components/LazyImage";
import { useCategoryStore } from "../../../shared/store/categoryStore";
import {
  getMostPopular,
  getTrending,
  getFlashSale,
  getDailyDeals,
  getAllNewArrivals,
  getRecommendedProducts,
  getApprovedVendors,
  getCatalogBrands,
} from "../data/catalogData";
import { products as allStaticProducts } from "../../../data/products";
import { categories as fallbackCategories } from "../../../data/categories";
import PageTransition from "../../../shared/components/PageTransition";
import usePullToRefresh from "../hooks/usePullToRefresh";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";
import heroSlide1 from "../../../../data/hero/slide1.png";
import heroSlide2 from "../../../../data/hero/slide2.png";
import heroSlide3 from "../../../../data/hero/slide3.png";
import heroSlide4 from "../../../../data/hero/slide4.png";
import stylishWatchImg from "../../../../data/products/stylish watch.png";

// Offers System Imports
import { useOffers } from "../../offers/hooks/useOffers";
import OfferCarousel from "../../offers/components/OfferCarousel";
import OfferModal from "../../offers/components/OfferModal";
import { useBusinessBuyer } from "../hooks/useBusinessBuyer";
import B2BRequestQuoteModal from "../components/B2B/B2BRequestQuoteModal";
import B2BHome from "../components/B2B/B2BHome";
import { useAuthStore } from "../../../shared/store/authStore";

const normalizeId = (value) => String(value ?? "").trim();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProduct = (raw) => {
  const vendorObj =
    raw?.vendor && typeof raw.vendor === "object"
      ? raw.vendor
      : raw?.vendorId && typeof raw.vendorId === "object"
        ? raw.vendorId
        : null;
  const brandObj =
    raw?.brand && typeof raw.brand === "object"
      ? raw.brand
      : raw?.brandId && typeof raw.brandId === "object"
        ? raw.brandId
        : null;
  const categoryObj =
    raw?.category && typeof raw.category === "object"
      ? raw.category
      : raw?.categoryId && typeof raw.categoryId === "object"
        ? raw.categoryId
        : null;

  const id = normalizeId(raw?.id || raw?._id);
  const vendorId = normalizeId(vendorObj?._id || vendorObj?.id || raw?.vendorId);
  const brandId = normalizeId(brandObj?._id || brandObj?.id || raw?.brandId);
  const categoryId = normalizeId(
    categoryObj?._id || categoryObj?.id || raw?.categoryId
  );
  const image = raw?.image || raw?.images?.[0] || "";

  return {
    ...raw,
    id,
    _id: id,
    vendorId,
    vendorName: raw?.vendorName || vendorObj?.storeName || vendorObj?.name || "",
    brandId,
    brandName: raw?.brandName || brandObj?.name || "",
    categoryId,
    categoryName: raw?.categoryName || categoryObj?.name || "",
    image,
    images: Array.isArray(raw?.images) ? raw.images : image ? [image] : [],
    price: toNumber(raw?.price, 0),
    originalPrice:
      raw?.originalPrice !== undefined ? toNumber(raw.originalPrice, undefined) : undefined,
    rating: toNumber(raw?.rating, 0),
    reviewCount: toNumber(raw?.reviewCount, 0),
    isActive: raw?.isActive !== false,
    flashSale: !!raw?.flashSale,
    isNew: !!raw?.isNewArrival,
  };
};

const normalizeVendor = (raw) => ({
  ...raw,
  id: normalizeId(raw?.id || raw?._id),
  _id: normalizeId(raw?.id || raw?._id),
  isVerified: !!raw?.isVerified,
  rating: toNumber(raw?.rating, 0),
  reviewCount: toNumber(raw?.reviewCount, 0),
  status: raw?.status || "approved",
});

const normalizeBrand = (raw) => ({
  ...raw,
  id: normalizeId(raw?.id || raw?._id),
  _id: normalizeId(raw?.id || raw?._id),
  name: raw?.name || "",
  logo: raw?.logo || "",
});

const deriveDailyDeals = (products = []) => {
  const flash = products.filter((p) => p.flashSale);
  const discounted = products.filter(
    (p) =>
      p.originalPrice !== undefined &&
      toNumber(p.originalPrice, 0) > toNumber(p.price, 0) &&
      !p.flashSale
  );
  const merged = [...flash, ...discounted];
  return merged.filter(
    (p, index, arr) =>
      index === arr.findIndex((x) => normalizeId(x.id) === normalizeId(p.id))
  );
};

const DEFAULT_HERO_SLIDES = [
  { image: heroSlide1 },
  { image: heroSlide2 },
  { image: heroSlide3 },
  { image: heroSlide4 },
];

const extractResponseData = (response) => {
  if (response && typeof response === "object") {
    if (Object.prototype.hasOwnProperty.call(response, "data")) {
      return response.data;
    }
    return response;
  }
  return null;
};

const asList = (value) => (Array.isArray(value) ? value : []);
const KNOWN_USER_ROUTE_PATTERNS = [
  "/",
  "/home",
  "/search",
  "/offers",
  "/daily-deals",
  "/flash-sale",
  "/new-arrivals",
  "/categories",
  "/category/:id",
  "/brand/:id",
  "/seller/:id",
  "/product/:id",
  "/sale/:slug",
  "/track-order/:orderId",
];

const getPathnameFromTarget = (target) =>
  String(target || "").trim().split("?")[0].split("#")[0];

const isKnownInternalRoute = (target) => {
  const pathname = getPathnameFromTarget(target);
  if (!pathname) return false;
  return KNOWN_USER_ROUTE_PATTERNS.some((pattern) =>
    !!matchPath({ path: pattern, end: true }, pathname)
  );
};

const resolveBannerLink = (banner) => {
  const candidate = String(
    banner?.linkUrl || banner?.link || banner?.url || ""
  ).trim();
  if (!candidate) return "";
  if (isExternalLink(candidate)) return candidate;
  if (isSafeInternalPath(candidate) && isKnownInternalRoute(candidate))
    return candidate;
  return "";
};

const isExternalLink = (target) => /^https?:\/\//i.test(String(target || "").trim());
const isSafeInternalPath = (target) => String(target || "").startsWith("/");

const fallbackSubcategories = {
  // Clothing (id: 1)
  "1": [
    { id: "1", name: "Trends", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=150&fit=crop" },
    { id: "1", name: "Kurta sets", image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=150&fit=crop" },
    { id: "1", name: "Dresses", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=150&fit=crop" },
    { id: "1", name: "Sarees", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=150&fit=crop" },
    { id: "1", name: "Jeans", image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=150&fit=crop" },
    { id: "1", name: "T-Shirts", image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=150&fit=crop" }
  ],
  // Footwear (id: 2)
  "2": [
    { id: "2", name: "Sneakers", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&fit=crop" },
    { id: "2", name: "Formal Shoes", image: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=150&fit=crop" },
    { id: "2", name: "Sandals", image: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=150&fit=crop" },
    { id: "2", name: "Sports Shoes", image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=150&fit=crop" }
  ],
  // Bags (id: 3)
  "3": [
    { id: "3", name: "Handbags", image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=150&fit=crop" },
    { id: "3", name: "Backpacks", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=150&fit=crop" },
    { id: "3", name: "Wallets", image: "https://images.unsplash.com/photo-1627124712838-19d843193af4?w=150&fit=crop" }
  ],
  // Jewelry (id: 4)
  "4": [
    { id: "4", name: "Jewellery", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=150&fit=crop" },
    { id: "4", name: "Watches", image: "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=150&fit=crop" },
    { id: "4", name: "Rings", image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=150&fit=crop" }
  ],
  // Accessories (id: 5)
  "5": [
    { id: "5", name: "Sunglasses", image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=150&fit=crop" },
    { id: "5", name: "Belts & Scarves", image: "https://images.unsplash.com/photo-1624206112918-f14bf82845a7?w=150&fit=crop" }
  ],
  // Athletic (id: 6)
  "6": [
    { id: "6", name: "Activewear", image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&fit=crop" },
    { id: "6-2", name: "Tracksuits", image: "https://images.unsplash.com/photo-1483721310020-03333e577078?w=150&fit=crop" }
  ]
};

const categoryBanners = {
  "1": { title: "Casual co-ords Under ₹449", subtitle: "Hurry, limited picks!", image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&fit=crop" },
  "2": { title: "Step Up In Style", subtitle: "Flat 40% Off on Top Brands", image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&fit=crop" },
  "3": { title: "Carry Your World", subtitle: "Up to 60% Off on Premium Bags", image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&fit=crop" },
  "4": { title: "Shine Brighter", subtitle: "Exclusive Designs For You", image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&fit=crop" },
  "5": { title: "Perfect Finish", subtitle: "Style Essentials Under ₹299", image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&fit=crop" },
  "6": { title: "Push Your Limits", subtitle: "Best Activewear Collections", image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&fit=crop" }
};

const MobileHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [autoSlidePaused, setAutoSlidePaused] = useState(false);
  const [isDraggingSlide, setIsDraggingSlide] = useState(false);
  const [slides, setSlides] = useState(DEFAULT_HERO_SLIDES);
  const [promoBanners, setPromoBanners] = useState([]);
  const [sideBanner, setSideBanner] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [homeVendors, setHomeVendors] = useState([]);
  const [homeBrands, setHomeBrands] = useState([]);
  const [selectedHomeOffer, setSelectedHomeOffer] = useState(null);
  const [isCustomRfqOpen, setIsCustomRfqOpen] = useState(false);

  const { offers } = useOffers();
  const { isBusiness } = useBusinessBuyer();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleCustomRfqClick = () => {
    if (!isAuthenticated) {
      toast.error("Please sign in or create a business account to request custom quotes.");
      return;
    }
    setIsCustomRfqOpen(true);
  };

  const { categories: allCategories, getCategoryById, getCategoriesByParent, initialize: initializeCategories } = useCategoryStore();

  useEffect(() => {
    initializeCategories();
  }, [initializeCategories]);

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeCategoryId = queryParams.get("category");

  const refurbishedRootCategories = useMemo(() => {
    const explicit = allCategories.filter(
      (cat) => cat.isActive !== false && cat.isRefurbishedCategory === true
    );
    if (explicit.length > 0) return explicit;

    // Fallback: Show categories of existing refurbished products
    const refurbishedCategoryIds = new Set(
      catalogProducts
        .filter((p) => p.isRefurbished || p.condition !== "brand_new")
        .map((p) => normalizeId(p.categoryId))
    );
    return allCategories.filter(
      (cat) => cat.isActive !== false && refurbishedCategoryIds.has(normalizeId(cat.id || cat._id))
    );
  }, [allCategories, catalogProducts]);

  const activeCategory = useMemo(() => {
    if (!activeCategoryId) return null;
    return getCategoryById(activeCategoryId) || 
           allCategories.find(c => String(c.id) === String(activeCategoryId) || String(c._id) === String(activeCategoryId)) ||
           fallbackCategories.find(c => String(c.id) === String(activeCategoryId));
  }, [activeCategoryId, allCategories, getCategoryById]);

  const activeCategoryKey = useMemo(() => {
    if (!activeCategory) return null;
    const name = String(activeCategory.name || "").toLowerCase();
    if (name.includes("clothing") || name.includes("fashion")) return "1";
    if (name.includes("footwear") || name.includes("shoe")) return "2";
    if (name.includes("bags") || name.includes("bag")) return "3";
    if (name.includes("jewelry") || name.includes("jewellery")) return "4";
    if (name.includes("accessories")) return "5";
    if (name.includes("athletic") || name.includes("sport")) return "6";
    if (["1", "2", "3", "4", "5", "6"].includes(String(activeCategory.id))) {
      return String(activeCategory.id);
    }
    return null;
  }, [activeCategory]);

  const subcategories = useMemo(() => {
    if (!activeCategoryId || !activeCategory) return [];
    const dbSubs = getCategoriesByParent(activeCategory.id) || [];
    if (dbSubs.length > 0) return dbSubs;
    return fallbackSubcategories[activeCategoryKey] || [];
  }, [activeCategoryId, activeCategory, activeCategoryKey, getCategoriesByParent]);

  const activeCategoryProducts = useMemo(() => {
    if (!activeCategoryId || !activeCategory) return [];
    const matched = catalogProducts.filter(p => String(p.categoryId) === String(activeCategory.id));
    if (matched.length > 0) return matched;
    const list = catalogProducts.length > 0 ? catalogProducts : allStaticProducts;
    return list.map(normalizeProduct).filter(p => 
      String(p.categoryId) === String(activeCategory.id) || 
      String(p.categoryName || "").toLowerCase().includes(String(activeCategory.name || "").toLowerCase())
    );
  }, [activeCategoryId, activeCategory, catalogProducts]);

  const fallbackMostPopular = getMostPopular();
  const fallbackTrending = getTrending();
  const fallbackFlashSale = getFlashSale();
  const fallbackNewArrivals = getAllNewArrivals().slice(0, 6);
  const fallbackDailyDeals = getDailyDeals().slice(0, 5);
  const fallbackRecommended = getRecommendedProducts(6);
  const fallbackVendors = getApprovedVendors();
  const fallbackBrands = getCatalogBrands().slice(0, 10);

  const computedNewArrivals = useMemo(() => {
    if (catalogProducts.length === 0) return fallbackNewArrivals;
    return catalogProducts.filter((p) => p.isNew).slice(0, 6);
  }, [catalogProducts, fallbackNewArrivals]);

  const computedDailyDeals = useMemo(() => {
    if (catalogProducts.length === 0) return fallbackDailyDeals;
    return deriveDailyDeals(catalogProducts).slice(0, 5);
  }, [catalogProducts, fallbackDailyDeals]);

  const computedRecommended = useMemo(() => {
    if (catalogProducts.length === 0) return fallbackRecommended;
    return [...catalogProducts]
      .sort((a, b) => toNumber(b.rating, 0) - toNumber(a.rating, 0))
      .slice(0, 6);
  }, [catalogProducts, fallbackRecommended]);

  const computedMostPopular = useMemo(() => {
    if (catalogProducts.length === 0) return fallbackMostPopular.slice(0, 6);
    return [...catalogProducts]
      .sort((a, b) => {
        const reviewsDiff = toNumber(b.reviewCount, 0) - toNumber(a.reviewCount, 0);
        if (reviewsDiff !== 0) return reviewsDiff;
        return toNumber(b.rating, 0) - toNumber(a.rating, 0);
      })
      .slice(0, 6);
  }, [catalogProducts, fallbackMostPopular]);

  const computedTrending = useMemo(() => {
    if (catalogProducts.length === 0) return fallbackTrending.slice(0, 6);
    return [...catalogProducts]
      .sort((a, b) => {
        const ratingDiff = toNumber(b.rating, 0) - toNumber(a.rating, 0);
        if (ratingDiff !== 0) return ratingDiff;
        return toNumber(b.reviewCount, 0) - toNumber(a.reviewCount, 0);
      })
      .slice(0, 6);
  }, [catalogProducts, fallbackTrending]);

  const computedFlashSale = useMemo(() => {
    if (catalogProducts.length === 0) return fallbackFlashSale.slice(0, 6);
    return catalogProducts.filter((product) => product.flashSale).slice(0, 6);
  }, [catalogProducts, fallbackFlashSale]);

  const computedRefurbished = useMemo(() => {
    const list = catalogProducts.length > 0 ? catalogProducts : allStaticProducts;
    return list.filter((p) => p.condition && p.condition !== "brand_new").slice(0, 5);
  }, [catalogProducts]);

  const computedVendors = useMemo(() => {
    if (homeVendors.length === 0) return fallbackVendors;
    return [...homeVendors]
      .filter((vendor) => vendor.status === "approved")
      .sort((a, b) => toNumber(b.rating, 0) - toNumber(a.rating, 0))
      .slice(0, 10);
  }, [homeVendors, fallbackVendors]);

  const computedBrands = useMemo(() => {
    if (homeBrands.length === 0) return fallbackBrands;
    return homeBrands.slice(0, 10);
  }, [homeBrands, fallbackBrands]);

  const fetchHomeData = useCallback(async () => {
    try {
        const { useAuthStore } = await import("../../../shared/store/authStore");
        const { getChannelParam } = await import("../../../shared/utils/salesChannel");
        const userRole = useAuthStore.getState().user?.role;
        const channel = getChannelParam(userRole);

        const [productsRes, vendorsRes, brandsRes, bannersRes] =
        await Promise.allSettled([
          api.get("/products", { params: { page: 1, limit: 120, channel } }),
          api.get("/vendors/all", {
            params: { status: "approved", page: 1, limit: 50 },
          }),
          api.get("/brands/all"),
          api.get("/banners"),
        ]);

      if (productsRes.status === "fulfilled") {
        const payload = extractResponseData(productsRes.value);
        const productsSource = asList(payload?.products);
        const normalizedProducts = productsSource
          .map(normalizeProduct)
          .filter((product) => product.id && product.isActive !== false);
        setCatalogProducts(normalizedProducts);
      }

      if (vendorsRes.status === "fulfilled") {
        const payload = extractResponseData(vendorsRes.value);
        const vendorsSource = asList(payload?.vendors);
        setHomeVendors(
          vendorsSource
            .map(normalizeVendor)
            .filter((vendor) => vendor.id)
        );
      }

      if (brandsRes.status === "fulfilled") {
        const payload = extractResponseData(brandsRes.value);
        const brandsSource = asList(payload);
        setHomeBrands(
          brandsSource
            .map(normalizeBrand)
            .filter((brand) => brand.id)
        );
      }

      if (bannersRes.status === "fulfilled") {
        const payload = extractResponseData(bannersRes.value);
        const allBanners = asList(payload).filter(
          (banner) => banner?.image && banner?.isActive !== false
        );

        const bannerSlides = allBanners
          .filter((banner) =>
            ["home_slider", "hero"].includes(String(banner?.type || ""))
          )
          .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
          .map((banner, index) => ({
            id: normalizeId(banner._id || banner.id || `home-slide-${index}`),
            image: banner.image,
            link: resolveBannerLink(banner),
            title: banner.title || "",
          }));
        const baseSlides = bannerSlides.length > 0 ? bannerSlides : [...DEFAULT_HERO_SLIDES];
        baseSlides.push({
          id: "refurbished-promo-slide",
          image: heroSlide3,
          link: "/refurbished-categories",
          title: "Save up to 50% on Certified Refurbished Products",
        });
        setSlides(baseSlides);

        const banners = allBanners
          .filter((banner) => String(banner?.type || "") === "promotional")
          .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
          .map((banner, index) => ({
            id: normalizeId(banner._id || banner.id || `promo-banner-${index}`),
            title: banner.title || "Special Offer",
            subtitle: banner.subtitle || "Limited Time",
            description: banner.description || "",
            discount: banner.description || "Shop Now",
            link: resolveBannerLink(banner),
            image: banner.image,
            type: banner.type || "promotional",
          }));
        setPromoBanners(banners);

        const mapped = allBanners
          .filter((banner) => String(banner?.type || "") === "side_banner")
          .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0))
          .map((banner, index) => ({
            id: normalizeId(banner._id || banner.id || `side-banner-${index}`),
            image: banner.image,
            title: banner.title || "PREMIUM",
            subtitle: banner.subtitle || "Exclusive Collection",
            link: resolveBannerLink(banner),
          }));
        setSideBanner(mapped[0] || null);
      } else {
        setSlides(DEFAULT_HERO_SLIDES);
        setPromoBanners([]);
        setSideBanner(null);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  // Auto-slide functionality (pauses when user is dragging)
  useEffect(() => {
    if (autoSlidePaused) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length, autoSlidePaused]);

  // Minimum swipe distance (in pixels) to trigger slide change
  const minSwipeDistance = 50;

  const startDrag = (clientX) => {
    setTouchEnd(null);
    setIsDraggingSlide(false);
    setTouchStart(clientX);
    setDragOffset(0);
    setAutoSlidePaused(true);
  };

  const moveDrag = (clientX, containerWidth = 400) => {
    if (touchStart === null) return;
    const diff = touchStart - clientX;
    if (Math.abs(diff) > 8) {
      setIsDraggingSlide(true);
    }
    const maxDrag = containerWidth * 0.5;
    setDragOffset(Math.max(-maxDrag, Math.min(maxDrag, diff)));
    setTouchEnd(clientX);
  };

  const endDrag = () => {
    if (touchStart === null) {
      setAutoSlidePaused(false);
      return;
    }

    const distance = touchStart - (touchEnd || touchStart);
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else if (isRightSwipe) {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }

    setTouchStart(null);
    setTouchEnd(null);
    setDragOffset(0);

    setTimeout(() => {
      setAutoSlidePaused(false);
    }, 2000);
    setTimeout(() => {
      setIsDraggingSlide(false);
    }, 200);
  };

  const onTouchStart = (e) => {
    e.stopPropagation();
    startDrag(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    if (touchStart === null) return;
    e.stopPropagation();
    const containerWidth = e.currentTarget?.offsetWidth || 400;
    moveDrag(e.targetTouches[0].clientX, containerWidth);
  };

  const onTouchEnd = (e) => {
    if (e) e.stopPropagation();
    endDrag();
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    startDrag(e.clientX);
  };

  const onMouseMove = (e) => {
    if (touchStart === null) return;
    e.preventDefault();
    const containerWidth = e.currentTarget?.offsetWidth || 400;
    moveDrag(e.clientX, containerWidth);
  };

  const onMouseUp = () => {
    if (touchStart !== null) {
      endDrag();
    }
  };

  const onMouseLeave = () => {
    if (touchStart !== null) {
      endDrag();
    }
  };

  const handleSlideClick = (slide) => {
    if (isDraggingSlide) return;
    const target = String(slide?.link || "").trim();
    if (!target) return;

    if (isExternalLink(target)) {
      window.open(target, "_blank", "noopener,noreferrer");
      return;
    }
    if (isSafeInternalPath(target) && isKnownInternalRoute(target)) {
      navigate(target);
    }
  };

  const handleBannerNavigation = (target) => {
    const normalizedTarget = String(target || "").trim();
    if (!normalizedTarget) return;
    if (isExternalLink(normalizedTarget)) {
      window.open(normalizedTarget, "_blank", "noopener,noreferrer");
      return;
    }
    if (isSafeInternalPath(normalizedTarget) && isKnownInternalRoute(normalizedTarget)) {
      navigate(normalizedTarget);
    }
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    const ok = await fetchHomeData();
    if (!ok) {
      toast.error("Refresh failed. Showing available data.");
      return;
    }
    toast.success("Refreshed");
  };

  const {
    pullDistance,
    isPulling,
    elementRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePullToRefresh(handleRefresh);

  if (isBusiness) {
    return (
      <PageTransition>
        <MobileLayout noPadding={true}>
          <B2BHome 
            computedBrands={computedBrands}
            computedVendors={computedVendors}
            computedNewArrivals={computedNewArrivals}
            computedMostPopular={computedMostPopular}
            computedDailyDeals={computedDailyDeals}
            computedRefurbished={computedRefurbished}
            computedFlashSale={computedFlashSale}
            computedTrending={computedTrending}
            offers={offers}
            promoBanners={promoBanners}
            setSelectedHomeOffer={setSelectedHomeOffer}
          />
        </MobileLayout>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <MobileLayout>
        <div
          ref={elementRef}
          className="w-full"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translateY(${Math.min(pullDistance, 80)}px)`,
            transition: isPulling ? "none" : "transform 0.3s ease-out",
          }}>


          {/* Slim RFQ Strip for B2B Users */}
          {isBusiness && (
            <div className="px-2.5 sm:px-4 md:px-0 pt-2">
              <div className="bg-gradient-to-r from-[#AE020B] to-[#7B0A0A] rounded-xl px-4 py-2 text-white shadow-sm flex items-center justify-between gap-3 bg-[#AE020B]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="bg-white/20 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider hidden xs:inline-block shrink-0">
                    RFQ
                  </span>
                  <p className="text-xs font-semibold truncate">
                    Need custom branding, size, or bulk rates?
                  </p>
                </div>
                <button
                  onClick={handleCustomRfqClick}
                  className="px-4 py-1.5 bg-white text-[#AE020B] font-extrabold rounded-lg text-xs hover:bg-red-50 transition-all whitespace-nowrap shrink-0 active:scale-95 shadow-sm"
                >
                  Request Quote
                </button>
              </div>
            </div>
          )}

          {activeCategoryId && activeCategory ? (
            <div className="w-full min-h-screen bg-gray-50 pb-20">
              {/* Category banner */}
              <div className="px-2.5 sm:px-4 md:px-0 pt-3.5 sm:pt-4 md:pt-2 select-none">
                <div className="relative rounded-2xl overflow-hidden shadow-sm aspect-[16/9] md:aspect-[21/9] select-none banner-container">
                  <img
                    src={categoryBanners[activeCategoryKey]?.image || activeCategory.image || heroSlide1}
                    alt={activeCategory.name}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    className="w-full h-full object-cover pointer-events-none select-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex flex-col justify-center px-6 text-left pointer-events-none select-none">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-yellow-400 mb-1 select-none">
                      Special Offer
                    </span>
                    <h2 className="text-xl md:text-3xl font-black text-white leading-tight select-none">
                      {categoryBanners[activeCategoryKey]?.title || `${activeCategory.name} Sale`}
                    </h2>
                    <p className="text-xs md:text-sm text-white/90 font-medium mt-1 select-none">
                      {categoryBanners[activeCategoryKey]?.subtitle || "Limited time picks!"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subcategories Circles Grid */}
              <div className="px-2.5 sm:px-4 md:px-0 py-4 md:py-6">
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 bg-white p-4 rounded-2xl shadow-sm">
                  {((subcategories.length > 0 ? subcategories : fallbackSubcategories[activeCategoryKey]) || []).map((sub) => (
                    <Link
                      key={sub.id}
                      to={sub.id && String(sub.id).includes("-") ? `/search?query=${sub.name}` : `/category/${sub.id}`}
                      className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-100 bg-gray-50">
                        <img
                          src={sub.image || "https://via.placeholder.com/150"}
                          alt={sub.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-center text-gray-700 leading-tight truncate w-full">
                        {sub.name}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Shop for Loved Ones Section / Curated Products */}
              <div className="px-2.5 sm:px-4 md:px-0 py-2">
                <h3 className="text-base font-extrabold text-gray-900 mb-3 tracking-tight">
                  Shop for loved ones!
                </h3>
                {activeCategoryProducts.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl p-6 shadow-sm">
                    <div className="text-5xl text-gray-300 mb-3">🛍️</div>
                    <h4 className="font-bold text-gray-800">No products found</h4>
                    <p className="text-xs text-gray-500 mt-1">We couldn't find any items in this category.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {activeCategoryProducts.slice(0, 10).map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Hero Banner */}
              <div className="px-2.5 sm:px-4 md:px-0 pt-3.5 pb-2 sm:pt-4 sm:pb-3 md:py-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div
                    className="relative w-full h-48 md:h-80 lg:h-[400px] xl:h-[450px] rounded-xl md:rounded-2xl overflow-hidden lg:col-span-2 select-none banner-container"
                    data-carousel
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                    onDragStart={(e) => e.preventDefault()}
                    style={{ touchAction: "pan-y", userSelect: "none", cursor: "grab" }}>
                    {/* Slider Container - All slides in a row */}
                    <motion.div
                      className="flex h-full select-none"
                      onDragStart={(e) => e.preventDefault()}
                      style={{
                        width: `${slides.length * 100}%`,
                        height: "100%",
                        userSelect: "none",
                      }}
                      animate={{
                        x:
                          dragOffset !== 0
                            ? `calc(-${currentSlide * (100 / slides.length)
                            }% - ${dragOffset}px)`
                            : `-${currentSlide * (100 / slides.length)}%`,
                      }}
                      transition={{
                        duration: dragOffset !== 0 ? 0 : 0.6,
                        ease: [0.25, 0.46, 0.45, 0.94], // Smooth easing
                        type: "tween",
                      }}>
                      {slides.map((slide, index) => (
                        <div
                          key={index}
                          className="flex-shrink-0 select-none banner-slide"
                          onClick={() => handleSlideClick(slide)}
                          onDragStart={(e) => e.preventDefault()}
                          style={{
                            width: `${100 / slides.length}%`,
                            height: "100%",
                            cursor: slide?.link ? "pointer" : "grab",
                            userSelect: "none",
                          }}>
                          <LazyImage
                            src={slide.image}
                            alt={`Slide ${index + 1}`}
                            className="w-full h-full object-cover pointer-events-none select-none"
                            draggable={false}
                            onError={(e) => {
                              e.target.src = `https://via.placeholder.com/400x200?text=Slide+${index + 1
                                }`;
                            }}
                          />
                        </div>
                      ))}
                    </motion.div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10 pointer-events-none">
                      {slides.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setCurrentSlide(index);
                            setAutoSlidePaused(true);
                            setTimeout(() => setAutoSlidePaused(false), 2000);
                          }}
                          className={`h-1.5 rounded-full transition-all pointer-events-auto ${index === currentSlide
                            ? "bg-white w-6"
                            : "bg-white/50 w-1.5"
                            }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Side Banner for Large Screens */}
                  <div className="hidden lg:block lg:col-span-1 h-[400px] xl:h-[450px] rounded-2xl overflow-hidden relative bg-gray-900 group">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/90 z-10" />
                    <LazyImage
                      src={sideBanner?.image || stylishWatchImg}
                      alt={sideBanner?.title || "Premium Watch"}
                      className="w-full h-full object-contain p-8 group-hover:scale-110 transition-transform duration-700"
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/400x400?text=Premium+Watch";
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-8 z-20 flex flex-col items-center text-center">
                      <span className="text-yellow-400 font-bold text-3xl mb-2 tracking-wider drop-shadow-lg">
                        {sideBanner?.title || "PREMIUM"}
                      </span>
                      <p className="text-gray-300 text-sm mb-6 font-medium">
                        {sideBanner?.subtitle || "Exclusive Collection"}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/product-request/new")}
                        className="bg-[#ffffff] dark:!bg-[#7B0A0A] text-gray-900 dark:text-white font-bold py-3.5 px-10 rounded-xl w-full hover:bg-gray-100 dark:hover:!bg-[#AE020B] transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-xl uppercase tracking-widest text-sm"
                      >
                        Request Product
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Brand Logos Scroll */}
              <BrandLogosScroll brands={computedBrands} />

              {/* Offer Carousel Section */}
              <div className="px-0 md:px-4 py-2">
                <OfferCarousel offers={offers} onOfferClick={setSelectedHomeOffer} />
              </div>

              {/* Categories */}
              <MobileCategoryGrid />

              {/* Request Product Button (Mobile only) */}
              <div className="px-2.5 sm:px-4 md:px-0 py-2 block lg:hidden">
                <button
                  type="button"
                  onClick={() => navigate("/product-request/new")}
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide text-white transition-all active:scale-[0.98] shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #9B1C1C 0%, #7B0A0A 50%, #4C0505 100%)"
                  }}
                >
                  <FiEdit3 className="text-base shrink-0" />
                  <span>Request Product</span>
                </button>
              </div>

              {/* Featured Vendors Section */}
              <FeaturedVendorsSection vendors={computedVendors} />

              {/* Refurbished & Renewed Deals */}
              {refurbishedRootCategories && refurbishedRootCategories.length > 0 && (
                <div className="px-2.5 sm:px-4 md:px-0 py-4 md:py-6 bg-gradient-to-br from-cyan-50/20 to-blue-50/20 dark:from-cyan-950/10 dark:to-blue-950/10 border-t border-b border-gray-100 dark:border-gray-900 my-4">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="min-w-0">
                      <h2 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2 truncate">
                        <span className="bg-gradient-to-r from-red-600 to-[#7B0A0A] text-transparent bg-clip-text truncate">Refurbished & Renewed Deals</span>
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Certified products in like-new condition with full warranty</p>
                    </div>
                    <Link
                      to="/refurbished-categories"
                      className="text-sm text-[#7B0A0A] dark:text-[#FF4D4D] font-bold hover:underline whitespace-nowrap shrink-0">
                      View All
                    </Link>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4 bg-white dark:bg-gray-850 p-4 rounded-2xl shadow-sm">
                    {refurbishedRootCategories.map((cat, index) => (
                      <Link
                        key={cat.id || cat._id}
                        to={`/refurbished-categories?category=${cat.id || cat._id}`}
                        className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
                      >
                        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                          {cat.image ? (
                            <img
                              src={cat.image}
                              alt={cat.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-gray-400">
                              {cat.name?.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-center text-gray-700 dark:text-gray-300 leading-tight truncate w-full">
                          {cat.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Animated Banner */}
              <AnimatedBanner banners={promoBanners} />

              {/* New Arrivals */}
              <NewArrivalsSection products={computedNewArrivals} />

              {/* Most Popular */}
              <div className="px-2.5 sm:px-4 md:px-0 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    <span>Most </span>
                    <span className="dark:text-[#7B0A0A]">Popular</span>
                  </h2>
                  <Link
                    to="/search"
                    className="text-sm text-primary-600 dark:text-[#7B0A0A] font-semibold">
                    See All
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 md:gap-4">
                  {computedMostPopular.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}>
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Daily Deals */}
              <DailyDealsSection products={computedDailyDeals} />

              {/* Flash Sale */}
              {computedFlashSale.length > 0 && (
                <div className="px-2.5 sm:px-4 md:px-0 py-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-transparent dark:to-transparent dark:bg-none">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        Flash Sale
                      </h2>
                      <p className="text-xs text-gray-600 dark:text-[#888888]">Limited time offers</p>
                    </div>
                    <Link
                      to="/flash-sale"
                      className="text-sm text-primary-600 dark:text-[#7B0A0A] font-semibold">
                      See All
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 md:gap-4">
                    {computedFlashSale.map((product, index) => (
                      <motion.div
                        key={product.id}
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
              <div className="px-2.5 sm:px-4 md:px-0 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">Trending Now</h2>
                  <Link
                    to="/search"
                    className="text-sm text-primary-600 dark:text-[#7B0A0A] font-semibold">
                    See All
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 md:gap-4">
                  {computedTrending.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}>
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </div>
              </div>
              {/* Tagline Section - Hidden as requested
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="px-4 py-12 text-left">
                <motion.h2
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-gray-400 leading-tight flex items-center justify-start gap-3 flex-wrap"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 }}>
                  <span>Shop from 50+ Trusted Vendors</span>
                  <motion.span
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                    className="text-[#7B0A0A] inline-block">
                    <FiHeart className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl fill-[#7B0A0A]" />
                  </motion.span>
                </motion.h2>
              </motion.div>
              */}
            </>
          )}

          {/* Offer Modal Details Preview */}
          <OfferModal
            isOpen={!!selectedHomeOffer}
            onClose={() => setSelectedHomeOffer(null)}
            offer={selectedHomeOffer}
          />

          {/* Custom General B2B RFQ Modal */}
          <B2BRequestQuoteModal
            isOpen={isCustomRfqOpen}
            onClose={() => setIsCustomRfqOpen(false)}
            product={null}
          />

          {/* Bottom Spacing */}
          <div className="h-4" />
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default MobileHome;
