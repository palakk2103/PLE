import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiArrowLeft, FiFilter, FiX, FiSearch } from "react-icons/fi";
import MobileLayout from "../components/Layout/MobileLayout";
import { useCategoryStore } from "../../../shared/store/categoryStore";
import PageTransition from "../../../shared/components/PageTransition";
import LazyImage from "../../../shared/components/LazyImage";
import ProductCard from "../../../shared/components/ProductCard";
import api from "../../../shared/utils/api";

const normalizeId = (value) => String(value ?? "").trim();

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

  return {
    ...raw,
    id,
    _id: id,
    vendorId: normalizeId(vendorObj?._id || vendorObj?.id || raw?.vendorId),
    vendorName: raw?.vendorName || vendorObj?.storeName || vendorObj?.name || "",
    brandId: normalizeId(brandObj?._id || brandObj?.id || raw?.brandId),
    brandName: raw?.brandName || brandObj?.name || "",
    categoryId: normalizeId(categoryObj?._id || categoryObj?.id || raw?.categoryId),
    categoryName: raw?.categoryName || categoryObj?.name || "",
    image: raw?.image || raw?.images?.[0] || "",
    images: Array.isArray(raw?.images) ? raw.images : raw?.image ? [raw.image] : [],
    price: Number(raw?.price) || 0,
    rating: Number(raw?.rating) || 0,
  };
};

const RefurbishedCatalog = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { categories, initialize, getCategoriesByParent, getRootCategories } =
    useCategoryStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const initialCategoryId = searchParams.get("category") || null;
  const [refurbishedProductCategories, setRefurbishedProductCategories] = useState(new Set());

  useEffect(() => {
    const fetchAllRefurbishedProducts = async () => {
      try {
        const response = await api.get("/products", {
          params: {
            condition: "refurbished",
            limit: 200
          }
        });
        const payload = response?.data ?? response;
        const products = Array.isArray(payload?.products) ? payload.products : [];
        
        const catIds = new Set();
        products.forEach(p => {
          if (p.categoryId) {
            catIds.add(normalizeId(typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId));
          }
          if (p.category) {
            catIds.add(normalizeId(typeof p.category === 'object' ? p.category._id : p.category));
          }
        });
        setRefurbishedProductCategories(catIds);
      } catch (err) {
        console.error("Error fetching refurbished products for catalog:", err);
      }
    };
    fetchAllRefurbishedProducts();
  }, [categories]);

  // Filter root categories to only show Refurbished Categories (or those containing refurbished subcategories)
  const rootCategories = useMemo(() => {
    return getRootCategories().filter((cat) => {
      if (cat.isActive === false) return false;
      if (cat.isRefurbishedCategory === true) return true;
      const subcats = getCategoriesByParent(cat.id || cat._id);
      
      // Dynamic fallback matching Home page: check if the category or any of its subcategories has refurbished products
      const hasRefurbishedProducts = refurbishedProductCategories.has(normalizeId(cat.id)) ||
        subcats.some(sub => refurbishedProductCategories.has(normalizeId(sub.id)));
      
      if (hasRefurbishedProducts) return true;
      if (subcats.some((sub) => sub.isActive !== false && sub.isRefurbishedCategory === true)) return true;
      // Fallback: Always show the category that the user navigated to from the home page
      if (normalizeId(cat.id) === normalizeId(initialCategoryId)) return true;
      return false;
    });
  }, [categories, getRootCategories, getCategoriesByParent, initialCategoryId, refurbishedProductCategories]);

  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const categoryListRef = useRef(null);
  const activeCategoryRef = useRef(null);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    minRating: "",
  });
  const [categoryProductsFeed, setCategoryProductsFeed] = useState([]);
  const [isFetchingProducts, setIsFetchingProducts] = useState(true);

  // Get subcategories for selected category
  const subcategories = useMemo(() => {
    if (!selectedCategoryId) return [];
    const parentCategory = categories.find(c => normalizeId(c.id) === normalizeId(selectedCategoryId));
    const isParentRefurbished = parentCategory?.isRefurbishedCategory === true;

    return getCategoriesByParent(selectedCategoryId).filter(
      (cat) => cat.isActive !== false && (isParentRefurbished || cat.isRefurbishedCategory === true)
    );
  }, [selectedCategoryId, categories, getCategoriesByParent]);

  useEffect(() => {
    if (!rootCategories.length) return;
    if (!selectedCategoryId) {
      setSelectedCategoryId(rootCategories[0].id);
      return;
    }
    const exists = rootCategories.some(
      (cat) => normalizeId(cat.id) === normalizeId(selectedCategoryId)
    );
    if (!exists) {
      setSelectedCategoryId(rootCategories[0].id);
    }
  }, [rootCategories, selectedCategoryId]);

  // Reset selected subcategory when category changes
  useEffect(() => {
    if (subcategories.length > 0) {
      setSelectedSubcategory(subcategories[0].id);
    } else {
      setSelectedSubcategory(null);
    }
  }, [selectedCategoryId, subcategories]);

  useEffect(() => {
    let cancelled = false;
    const fetchCategoryProducts = async () => {
      const targetCategoryId = normalizeId(selectedSubcategory || selectedCategoryId);
      if (!targetCategoryId) {
        if (!cancelled) {
          setCategoryProductsFeed([]);
          setIsFetchingProducts(false);
        }
        return;
      }

      setIsFetchingProducts(true);
      try {
        const response = await api.get("/products", {
          params: {
            category: targetCategoryId,
            condition: "refurbished", // Only fetch refurbished items!
            page: 1,
            limit: 200,
            sort: "newest",
          },
        });
        const payload = response?.data ?? response;
        const products = Array.isArray(payload?.products) ? payload.products : [];
        if (cancelled) return;

        setCategoryProductsFeed(
          products.map(normalizeProduct).filter((product) => product.id)
        );
      } catch {
        if (!cancelled) {
          setCategoryProductsFeed([]);
        }
      } finally {
        if (!cancelled) {
          setIsFetchingProducts(false);
        }
      }
    };

    fetchCategoryProducts();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId, selectedSubcategory]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return [];
    let filtered = [...categoryProductsFeed];

    if (searchQuery) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filters.minPrice) {
      filtered = filtered.filter(
        (product) => product.price >= parseFloat(filters.minPrice)
      );
    }
    if (filters.maxPrice) {
      filtered = filtered.filter(
        (product) => product.price <= parseFloat(filters.maxPrice)
      );
    }

    if (filters.minRating) {
      filtered = filtered.filter(
        (product) => product.rating >= parseFloat(filters.minRating)
      );
    }

    return filtered;
  }, [selectedCategoryId, categoryProductsFeed, searchQuery, filters]);

  useEffect(() => {
    if (isInitialMount) {
      requestAnimationFrame(() => {
        setIsInitialMount(false);
      });
    }
  }, [isInitialMount]);

  useEffect(() => {
    if (activeCategoryRef.current && categoryListRef.current) {
      const categoryElement = activeCategoryRef.current;
      const listContainer = categoryListRef.current;
      const elementTop = categoryElement.offsetTop;
      const elementHeight = categoryElement.offsetHeight;
      const containerHeight = listContainer.clientHeight;
      const scrollTop = listContainer.scrollTop;

      if (
        elementTop < scrollTop ||
        elementTop + elementHeight > scrollTop + containerHeight
      ) {
        requestAnimationFrame(() => {
          listContainer.scrollTo({
            top: elementTop - listContainer.offsetTop - 10,
            behavior: "smooth",
          });
        });
      }
    }
  }, [selectedCategoryId]);

  const handleCategorySelect = (categoryId) => {
    setSelectedCategoryId(categoryId);
  };

  const handleFilterChange = (name, value) => {
    setFilters({ ...filters, [name]: value });
  };

  const clearFilters = () => {
    setFilters({
      minPrice: "",
      maxPrice: "",
      minRating: "",
    });
  };

  const hasActiveFilters = Boolean(
    filters.minPrice || filters.maxPrice || filters.minRating
  );

  const selectedCategory = useMemo(() => {
    return rootCategories.find(
      (cat) => normalizeId(cat.id) === normalizeId(selectedCategoryId)
    );
  }, [rootCategories, selectedCategoryId]);

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={true}>
        <div className="w-full flex flex-col min-h-[calc(100vh-64px)]">
          {/* Header */}
          <div className="relative bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              >
                <FiArrowLeft className="text-xl text-gray-700" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-800">
                  {selectedCategory ? selectedCategory.name : "Refurbished Store"}
                </h2>
                <p className="text-[10px] text-gray-500">
                  {filteredProducts.length} refurbished item{filteredProducts.length !== 1 ? "s" : ""} available
                </p>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 hover:bg-gray-100 rounded-full transition-colors ${
                  showFilters ? "bg-gray-100" : ""
                }`}
              >
                <FiFilter
                  className={`text-xl transition-colors ${
                    hasActiveFilters ? "text-[#7B0A0A]" : "text-gray-700"
                  }`}
                />
              </button>
            </div>

            {/* Price/Rating Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Min Price</label>
                      <input
                        type="number"
                        placeholder="Min Price"
                        value={filters.minPrice}
                        onChange={(e) => handleFilterChange("minPrice", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-1 focus:ring-[#7B0A0A]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Max Price</label>
                      <input
                        type="number"
                        placeholder="Max Price"
                        value={filters.maxPrice}
                        onChange={(e) => handleFilterChange("maxPrice", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-1 focus:ring-[#7B0A0A]"
                      />
                    </div>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs font-bold text-[#7B0A0A] hover:underline"
                    >
                      Clear Filters
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search Input */}
            <div className="mt-3 relative">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                placeholder="Search in refurbished..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#7B0A0A] placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <FiX className="text-sm" />
                </button>
              )}
            </div>
          </div>

          {/* Main Layout Area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div
              ref={categoryListRef}
              className="w-20 md:w-24 bg-gray-50 border-r border-gray-200 overflow-y-auto"
            >
              {rootCategories.map((category) => {
                const isActive = normalizeId(category.id) === normalizeId(selectedCategoryId);
                return (
                  <button
                    key={category.id}
                    ref={isActive ? activeCategoryRef : null}
                    onClick={() => handleCategorySelect(category.id)}
                    className={`w-full px-2 py-4 text-left transition-all duration-200 relative ${
                      isActive ? "bg-white shadow-sm" : "hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 transition-all duration-200 ${
                          isActive ? "ring-2 ring-[#7B0A0A] ring-offset-1 scale-105" : ""
                        }`}
                      >
                        <LazyImage
                          src={category.image}
                          alt={category.name}
                          className="w-full h-full object-cover"
                          placeholderWidth={48}
                          placeholderHeight={48}
                          placeholderText={category.name}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-semibold text-center leading-tight transition-colors ${
                          isActive ? "text-[#7B0A0A]" : "text-gray-700"
                        }`}
                      >
                        {category.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto bg-white p-3">
              {/* Subcategories Horizontal Bar */}
              {subcategories.length > 0 && (
                <div className="flex gap-2 pb-3 mb-3 border-b border-gray-100 overflow-x-auto scrollbar-hide">
                  {subcategories.map((sub) => {
                    const isActive = normalizeId(selectedSubcategory) === normalizeId(sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubcategory(sub.id)}
                        className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          isActive
                            ? "bg-[#7B0A0A] text-white border-transparent"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Feed */}
              {isFetchingProducts ? (
                <div className="flex justify-center items-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7B0A0A]"></div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 font-medium">No refurbished items found in this section.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default RefurbishedCatalog;
