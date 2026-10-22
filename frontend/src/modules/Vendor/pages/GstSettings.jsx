import React, { useState, useEffect } from "react";
import {
  FiPercent,
  FiGlobe,
  FiGrid,
  FiPackage,
  FiCheckCircle,
  FiEdit2,
  FiSave,
  FiRefreshCw,
  FiSearch,
  FiFilter,
  FiInfo,
  FiAlertCircle,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";

const GST_RATES = [0, 5, 12, 18, 28];

const GstSettings = () => {
  const [activeTab, setActiveTab] = useState("global"); // 'global' | 'category' | 'product'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    totalProducts: 0,
    customGstCount: 0,
    categoryGstCount: 0,
    categoryBreakdown: [],
    products: [],
  });

  // Global tab state
  const [globalGstRate, setGlobalGstRate] = useState(18);

  // Category tab state
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryGstRate, setCategoryGstRate] = useState(18);
  const [categoryGstMode, setCategoryGstMode] = useState("custom");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [categoryFilterTab, setCategoryFilterTab] = useState("all"); // 'all' | 'withProducts' | 'withRules'

  // Product tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'custom' | 'category'
  const [editingProductId, setEditingProductId] = useState(null);
  const [editForm, setEditForm] = useState({ gstMode: "category", gstRate: 18 });

  const fetchGstSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/vendor/gst-settings");
      const isSuccess = res?.success || res?.data?.success || (res && !res.error);
      const payload = res?.data?.data || res?.data || res;
      if (isSuccess && payload) {
        const catList = Array.isArray(payload.categoryBreakdown) ? payload.categoryBreakdown : [];
        setData({
          totalProducts: payload.totalProducts || 0,
          customGstCount: payload.customGstCount || 0,
          categoryGstCount: payload.categoryGstCount || 0,
          categoryBreakdown: catList,
          products: Array.isArray(payload.products) ? payload.products : [],
        });
        if (catList.length > 0) {
          if (selectedCategory) {
            const fresh = catList.find((c) => String(c.categoryId) === String(selectedCategory.categoryId));
            if (fresh) setSelectedCategory(fresh);
          } else {
            const first = catList[0];
            setSelectedCategory(first);
            const hasVendorRate = first.vendorCategoryGstRate !== null && first.vendorCategoryGstRate !== undefined;
            setCategoryGstMode(hasVendorRate ? "custom" : "category");
            setCategoryGstRate(hasVendorRate ? first.vendorCategoryGstRate : (first.categoryGstRate || 18));
          }
        }
      }
    } catch (err) {
      toast.error("Failed to load GST settings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGstSettings();
  }, []);

  // Handle Global GST Update
  const handleApplyGlobalGst = async (applyToAll) => {
    const confirmMsg = applyToAll
      ? `Are you sure you want to set ${globalGstRate}% GST on ALL ${data.totalProducts || 0} products?`
      : `Reset ALL products to use Category Default GST rates?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setSaving(true);
      const res = await api.post("/vendor/gst-settings/global", {
        gstRate: globalGstRate,
        applyToAll,
      });
      if (res?.success || res?.data?.success) {
        toast.success(res?.message || res?.data?.message || "Global GST updated successfully");
        fetchGstSettings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to update Global GST");
    } finally {
      setSaving(false);
    }
  };

  // Handle Category GST Update
  const handleApplyCategoryGst = async () => {
    if (!selectedCategory) return;
    try {
      setSaving(true);
      const res = await api.post("/vendor/gst-settings/category", {
        categoryId: selectedCategory.categoryId,
        gstRate: categoryGstRate,
        gstMode: categoryGstMode,
      });
      if (res?.success || res?.data?.success) {
        toast.success(res?.message || res?.data?.message || "Category GST updated successfully");
        fetchGstSettings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to update Category GST");
    } finally {
      setSaving(false);
    }
  };

  // Handle Inline Product GST Save
  const handleSaveProductGst = async (productId) => {
    try {
      const rateNum = Number(editForm.gstRate);
      if (editForm.gstMode === "custom" && (isNaN(rateNum) || rateNum < 0 || rateNum > 100)) {
        toast.error("Please enter a valid GST percentage (0 - 100%)");
        return;
      }
      setSaving(true);
      const res = await api.patch("/vendor/gst-settings/product", {
        productId,
        gstMode: editForm.gstMode,
        gstRate: rateNum,
      });
      if (res?.success || res?.data?.success) {
        toast.success("Product GST updated");
        setEditingProductId(null);
        fetchGstSettings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to update product GST");
    } finally {
      setSaving(false);
    }
  };

  // Filter products for product manager tab
  const filteredProducts = (data.products || []).filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterMode === "custom") return matchesSearch && p.gstMode === "custom";
    if (filterMode === "category") return matchesSearch && p.gstMode === "category";
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <FiPercent className="w-4 h-4" />
              Tax Management & Compliance
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">GST Settings Hub</h1>
            <p className="text-emerald-100 text-sm mt-1 max-w-2xl">
              Manage GST rates across your entire catalog. Set global defaults, category-wise rules, or custom product overrides easily.
            </p>
          </div>
          <button
            onClick={fetchGstSettings}
            disabled={loading}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all text-sm font-semibold border border-white/20"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/20">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
            <span className="text-emerald-200 text-xs font-semibold block">Total Active Products</span>
            <span className="text-2xl font-bold text-white mt-1 block">{data.totalProducts}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
            <span className="text-emerald-200 text-xs font-semibold block">Category Default GST</span>
            <span className="text-2xl font-bold text-white mt-1 block">{data.categoryGstCount} Items</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10">
            <span className="text-emerald-200 text-xs font-semibold block">Custom Rate Overrides</span>
            <span className="text-2xl font-bold text-amber-300 mt-1 block">{data.customGstCount} Items</span>
          </div>
        </div>
      </div>

      {/* Mode Selection Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab("global")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "global"
              ? "border-emerald-600 text-emerald-600 bg-emerald-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <FiGlobe className="w-4 h-4" />
          1. Global GST Default
        </button>

        <button
          onClick={() => setActiveTab("category")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "category"
              ? "border-emerald-600 text-emerald-600 bg-emerald-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <FiGrid className="w-4 h-4" />
          2. Category-Wise GST
        </button>

        <button
          onClick={() => setActiveTab("product")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === "product"
              ? "border-emerald-600 text-emerald-600 bg-emerald-50/50 rounded-t-xl"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <FiPackage className="w-4 h-4" />
          3. Product-Wise Overrides
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <FiRefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">Loading GST configuration...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* TAB 1: GLOBAL GST */}
          {activeTab === "global" && (
            <motion.div
              key="global"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6"
            >
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FiGlobe className="text-emerald-600" />
                  Set Store-Wide Global GST Rate
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Choose a default GST percentage to apply across all products in your store in one click.
                </p>
              </div>

              <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Quick Preset Rates
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {GST_RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setGlobalGstRate(rate)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all border cursor-pointer ${
                          Number(globalGstRate) === rate
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-105"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {rate}% GST
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-emerald-200/60">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                    Or Type / Enter Custom GST Rate Manually (%)
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Aap yahan direct type karke koi bhi custom rate (e.g. 12, 18, 7.5, etc.) likh sakte hain:
                  </p>
                  <div className="flex items-center gap-3 max-w-sm">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={globalGstRate === "" ? "" : globalGstRate}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Math.max(0, Math.min(100, Number(e.target.value)));
                          setGlobalGstRate(val);
                        }}
                        placeholder="e.g. 18 or 12"
                        className="w-full px-4 py-2.5 bg-white border-2 border-emerald-300 focus:border-emerald-500 rounded-xl text-base font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400 pointer-events-none">% GST</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 flex items-start gap-2.5 text-xs text-emerald-900">
                  <FiInfo className="text-emerald-600 w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Active Selected Rate: {globalGstRate}% GST</span>
                    <p className="text-gray-600 text-[11px] mt-0.5">
                      Neeche green button click karne par yeh <strong>{globalGstRate}% GST</strong> aapke store ke sabhi <strong>{data.totalProducts} active products</strong> par ek sath apply ho jayega.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleApplyGlobalGst(true)}
                  disabled={saving || globalGstRate === ""}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  <FiCheckCircle className="w-4 h-4" />
                  {saving ? "Applying to All Products..." : `Apply ${globalGstRate}% GST to All Products (${data.totalProducts})`}
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyGlobalGst(false)}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-all border border-gray-300 disabled:opacity-50 cursor-pointer"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  Reset All Products to Category Default GST
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 2: CATEGORY-WISE GST */}
          {activeTab === "category" && (
            <motion.div
              key="category"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Category List */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                    All Categories ({data.categoryBreakdown?.length || 0})
                  </h3>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {data.categoryBreakdown?.filter(c => c.vendorCategoryGstRate !== null && c.vendorCategoryGstRate !== undefined).length} Custom Configured
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    placeholder="Search any category (e.g. Women, Electronics)..."
                    className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                  />
                  {categorySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCategorySearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCategoryFilterTab("all")}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all border ${
                      categoryFilterTab === "all"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    All ({data.categoryBreakdown?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilterTab("withProducts")}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all border ${
                      categoryFilterTab === "withProducts"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    In My Store ({data.categoryBreakdown?.filter(c => (c.totalProducts || 0) > 0).length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilterTab("withRules")}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all border ${
                      categoryFilterTab === "withRules"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    My Rates ({data.categoryBreakdown?.filter(c => c.vendorCategoryGstRate !== null && c.vendorCategoryGstRate !== undefined).length || 0})
                  </button>
                </div>

                {/* Category List */}
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 flex-1">
                  {data.categoryBreakdown
                    ?.filter((cat) => {
                      const matchesSearch = String(cat.categoryName || "")
                        .toLowerCase()
                        .includes(categorySearchQuery.toLowerCase());
                      if (!matchesSearch) return false;
                      if (categoryFilterTab === "withProducts") return (cat.totalProducts || 0) > 0;
                      if (categoryFilterTab === "withRules")
                        return cat.vendorCategoryGstRate !== null && cat.vendorCategoryGstRate !== undefined;
                      return true;
                    })
                    .map((cat) => {
                      const isSelected = selectedCategory?.categoryId === cat.categoryId;
                      const hasVendorRate =
                        cat.vendorCategoryGstRate !== null && cat.vendorCategoryGstRate !== undefined;

                      return (
                        <div
                          key={cat.categoryId || "uncategorized"}
                          onClick={() => {
                            setSelectedCategory(cat);
                            if (hasVendorRate) {
                              setCategoryGstMode("custom");
                              setCategoryGstRate(cat.vendorCategoryGstRate);
                            } else {
                              setCategoryGstMode("category");
                              setCategoryGstRate(cat.categoryGstRate || 18);
                            }
                          }}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-emerald-50 border-emerald-500 shadow-sm"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-gray-800">{cat.categoryName}</span>
                            {hasVendorRate ? (
                              <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1 border border-emerald-200">
                                My Store: {cat.vendorCategoryGstRate}%
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                                System: {cat.categoryGstRate}%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                            <span>
                              {cat.totalProducts > 0 ? (
                                <strong className="text-gray-700">{cat.totalProducts} Products in Store</strong>
                              ) : (
                                <span className="text-gray-400 italic">0 Products (Ready to configure)</span>
                              )}
                            </span>
                            <span>
                              Effective: <strong className="text-gray-800">{cat.effectiveGstRate ?? cat.categoryGstRate}% GST</strong>
                            </span>
                          </div>
                        </div>
                      );
                    })}

                  {data.categoryBreakdown?.filter((cat) => {
                    const matchesSearch = String(cat.categoryName || "")
                      .toLowerCase()
                      .includes(categorySearchQuery.toLowerCase());
                    if (!matchesSearch) return false;
                    if (categoryFilterTab === "withProducts") return (cat.totalProducts || 0) > 0;
                    if (categoryFilterTab === "withRules")
                      return cat.vendorCategoryGstRate !== null && cat.vendorCategoryGstRate !== undefined;
                    return true;
                  }).length === 0 && (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 p-4">
                      <FiGrid className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-500">No categories found matching your filter</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCategorySearchQuery("");
                          setCategoryFilterTab("all");
                        }}
                        className="mt-2 text-xs text-emerald-600 font-bold underline"
                      >
                        Reset Search / Filters
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Action Panel */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-5">
                {selectedCategory ? (
                  <>
                    <div>
                      <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                        Configure Store Rate for Category
                      </span>
                      <h3 className="text-xl font-bold text-gray-900">{selectedCategory.categoryName}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>Platform Default: <strong>{selectedCategory.categoryGstRate}%</strong></span>
                        {selectedCategory.vendorCategoryGstRate !== null && selectedCategory.vendorCategoryGstRate !== undefined ? (
                          <span className="text-emerald-700 font-bold">Your Saved Rate: {selectedCategory.vendorCategoryGstRate}%</span>
                        ) : (
                          <span className="text-gray-400">No store override saved yet</span>
                        )}
                        <span>Active Products: <strong>{selectedCategory.totalProducts || 0}</strong></span>
                      </div>
                    </div>

                    {/* Explanatory Info Box */}
                    {selectedCategory.totalProducts > 0 ? (
                      <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                        <FiInfo className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <strong>{selectedCategory.totalProducts} active products in store:</strong> Saving this rate will update all existing products in <em>{selectedCategory.categoryName}</em>, as well as apply automatically to future products added to this category.
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                        <FiCheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <strong>Pre-Configure for Future Products:</strong> You currently have 0 products in <em>{selectedCategory.categoryName}</em>. Saving your rate here will ensure that whenever you add new products in this category, this rate will be applied automatically!
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 pt-3 border-t border-gray-100">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                          Choose GST Option for {selectedCategory.categoryName}:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setCategoryGstMode("custom")}
                            className={`p-3 rounded-xl font-bold text-xs border text-left transition-all ${
                              categoryGstMode === "custom"
                                ? "bg-emerald-50 border-emerald-600 text-emerald-800 shadow-sm"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <span className="block font-bold">Set My Store's Category Rate</span>
                            <span className="text-[11px] font-normal text-gray-500 mt-0.5 block">
                              Apply custom GST percentage for this category across my store
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryGstMode("category")}
                            className={`p-3 rounded-xl font-bold text-xs border text-left transition-all ${
                              categoryGstMode === "category"
                                ? "bg-emerald-50 border-emerald-600 text-emerald-800 shadow-sm"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <span className="block font-bold">Use Platform Category Default</span>
                            <span className="text-[11px] font-normal text-gray-500 mt-0.5 block">
                              Inherit platform standard rate ({selectedCategory.categoryGstRate}%)
                            </span>
                          </button>
                        </div>
                      </div>

                      {categoryGstMode === "custom" && (
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                            Select or Type Custom GST Rate for {selectedCategory.categoryName}:
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            {GST_RATES.map((rate) => (
                              <button
                                key={rate}
                                type="button"
                                onClick={() => setCategoryGstRate(rate)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                                  Number(categoryGstRate) === rate
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                {rate}%
                              </button>
                            ))}
                            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
                              <span className="text-xs font-bold text-gray-500">Type Rate:</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={categoryGstRate}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : Math.max(0, Math.min(100, Number(e.target.value)));
                                  setCategoryGstRate(val);
                                }}
                                placeholder="18"
                                className="w-16 px-1.5 py-0.5 text-xs font-bold text-gray-900 border border-gray-200 rounded focus:outline-none bg-gray-50"
                              />
                              <span className="text-xs font-bold text-gray-700">% GST</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleApplyCategoryGst}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 mt-4 cursor-pointer"
                      >
                        <FiSave />
                        {saving
                          ? "Saving..."
                          : categoryGstMode === "custom"
                          ? `Save ${categoryGstRate}% as My Store Rate for ${selectedCategory.categoryName}${selectedCategory.totalProducts > 0 ? ` (${selectedCategory.totalProducts} Products)` : ''}`
                          : `Reset ${selectedCategory.categoryName} to Platform Default (${selectedCategory.categoryGstRate}%)`}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-400 text-sm">Select a category on the left to configure.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: PRODUCT-WISE OVERRIDES */}
          {activeTab === "product" && (
            <motion.div
              key="product"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4"
            >
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product name..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <FiFilter className="text-gray-400 w-4 h-4" />
                  <select
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Products</option>
                    <option value="custom">Custom GST Only</option>
                    <option value="category">Category Default GST Only</option>
                  </select>
                </div>
              </div>

              {/* Product Table */}
              <div className="overflow-x-auto scrollbar-admin rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                  <thead className="bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Current GST Mode</th>
                      <th className="py-3 px-4">Effective GST Rate</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                          No products found.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const isEditing = editingProductId === p._id;
                        return (
                          <tr key={p._id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {p.image ? (
                                  <img
                                    src={p.image}
                                    alt={p.name}
                                    className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                                    No Image
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold text-gray-800 line-clamp-1">{p.name}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-xs text-gray-600 font-medium">{p.categoryName}</td>
                            <td className="py-3 px-4 text-xs font-bold text-gray-800">₹{p.price}</td>

                            <td className="py-3 px-4">
                              {isEditing ? (
                                <select
                                  value={editForm.gstMode}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, gstMode: e.target.value }))
                                  }
                                  className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none"
                                >
                                  <option value="category">Category Default</option>
                                  <option value="custom">Custom Rate</option>
                                </select>
                              ) : (
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    p.gstMode === "custom"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {p.gstMode === "custom" ? "Custom Override" : "Category Default"}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 font-bold text-xs text-gray-900">
                              {isEditing ? (
                                editForm.gstMode === "custom" ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="relative flex items-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="any"
                                        value={editForm.gstRate ?? ""}
                                        onChange={(e) =>
                                          setEditForm((prev) => ({ ...prev, gstRate: e.target.value }))
                                        }
                                        placeholder="Rate"
                                        className="w-16 px-2 py-1 pr-5 text-xs font-bold border border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/50 text-emerald-950"
                                      />
                                      <span className="absolute right-1.5 text-[10px] font-bold text-emerald-700 pointer-events-none">%</span>
                                    </div>
                                    <select
                                      value={GST_RATES.includes(Number(editForm.gstRate)) ? Number(editForm.gstRate) : ""}
                                      onChange={(e) => {
                                        if (e.target.value !== "") {
                                          setEditForm((prev) => ({ ...prev, gstRate: Number(e.target.value) }));
                                        }
                                      }}
                                      className="px-1.5 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none bg-gray-50 text-gray-700 font-semibold cursor-pointer"
                                      title="Presets"
                                    >
                                      <option value="" disabled>Presets ▾</option>
                                      {GST_RATES.map((r) => (
                                        <option key={r} value={r}>
                                          {r}% GST
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">
                                    Uses {p.categoryDefaultRate}%
                                  </span>
                                )
                              ) : (
                                <span className="text-emerald-700">{p.gstRate}%</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleSaveProductGst(p._id)}
                                    disabled={saving}
                                    className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                    title="Save GST"
                                  >
                                    <FiSave className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingProductId(null)}
                                    className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                    title="Cancel"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingProductId(p._id);
                                    setEditForm({ gstMode: p.gstMode || "category", gstRate: p.gstRate });
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
                                >
                                  <FiEdit2 className="w-3 h-3" />
                                  Edit GST
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default GstSettings;
