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

  // Product tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'custom' | 'category'
  const [editingProductId, setEditingProductId] = useState(null);
  const [editForm, setEditForm] = useState({ gstMode: "category", gstRate: 18 });

  const fetchGstSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/vendor/gst-settings");
      if (res.data?.success) {
        setData(res.data.data);
        if (res.data.data.categoryBreakdown?.length > 0 && !selectedCategory) {
          setSelectedCategory(res.data.data.categoryBreakdown[0]);
          setCategoryGstRate(res.data.data.categoryBreakdown[0].categoryGstRate || 18);
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
      ? `Are you sure you want to set ${globalGstRate}% GST on ALL ${data.totalProducts} products?`
      : `Reset ALL products to use Category Default GST rates?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setSaving(true);
      const res = await api.post("/vendor/gst-settings/global", {
        gstRate: globalGstRate,
        applyToAll,
      });
      if (res.data?.success) {
        toast.success(res.data.message || "Global GST updated successfully");
        fetchGstSettings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update Global GST");
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
      if (res.data?.success) {
        toast.success(res.data.message || "Category GST updated successfully");
        fetchGstSettings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update Category GST");
    } finally {
      setSaving(false);
    }
  };

  // Handle Inline Product GST Save
  const handleSaveProductGst = async (productId) => {
    try {
      setSaving(true);
      const res = await api.patch("/vendor/gst-settings/product", {
        productId,
        gstMode: editForm.gstMode,
        gstRate: Number(editForm.gstRate),
      });
      if (res.data?.success) {
        toast.success("Product GST updated");
        setEditingProductId(null);
        fetchGstSettings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update product GST");
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

              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-3">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Select Global GST Rate (%)
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  {GST_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setGlobalGstRate(rate)}
                      className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${
                        Number(globalGstRate) === rate
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-105"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {rate}% GST
                    </button>
                  ))}

                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-emerald-500">
                    <span className="text-xs font-bold text-gray-500">Custom Rate:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={globalGstRate}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setGlobalGstRate(val);
                      }}
                      placeholder="e.g. 18"
                      className="w-16 px-2 py-1 text-sm font-bold text-gray-900 border border-gray-200 rounded-lg focus:outline-none bg-gray-50"
                    />
                    <span className="text-xs font-bold text-gray-700">%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                  <FiInfo className="text-emerald-600 flex-shrink-0" />
                  <span>Selected Rate: <strong className="text-emerald-700">{globalGstRate}% GST</strong></span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleApplyGlobalGst(true)}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  <FiCheckCircle />
                  {saving ? "Applying..." : `Apply ${globalGstRate}% GST to All Products (${data.totalProducts})`}
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyGlobalGst(false)}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-all border border-gray-300 disabled:opacity-50"
                >
                  <FiRefreshCw />
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
              <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">
                  Your Product Categories ({data.categoryBreakdown?.length || 0})
                </h3>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {data.categoryBreakdown?.map((cat) => {
                    const isSelected = selectedCategory?.categoryId === cat.categoryId;
                    return (
                      <div
                        key={cat.categoryId || "uncategorized"}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCategoryGstRate(cat.categoryGstRate || 18);
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-500 shadow-sm"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-gray-800">{cat.categoryName}</span>
                          <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                            Category Rate: {cat.categoryGstRate}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                          <span>Total Items: {cat.totalProducts}</span>
                          <span>Custom Overrides: {cat.customGstCount}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category Action Panel */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-5">
                {selectedCategory ? (
                  <>
                    <div>
                      <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                        Configuring Category
                      </span>
                      <h3 className="text-xl font-bold text-gray-900">{selectedCategory.categoryName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        System Category Default GST: <strong>{selectedCategory.categoryGstRate}%</strong>
                      </p>
                    </div>

                    <div className="space-y-4 pt-3 border-t border-gray-100">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                          Select Mode for this Category's Products:
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setCategoryGstMode("custom")}
                            className={`p-3 rounded-xl font-bold text-xs border text-left transition-all ${
                              categoryGstMode === "custom"
                                ? "bg-emerald-50 border-emerald-600 text-emerald-800"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            Set Custom Rate for Category
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryGstMode("category")}
                            className={`p-3 rounded-xl font-bold text-xs border text-left transition-all ${
                              categoryGstMode === "category"
                                ? "bg-emerald-50 border-emerald-600 text-emerald-800"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            Use System Category Default ({selectedCategory.categoryGstRate}%)
                          </button>
                        </div>
                      </div>

                      {categoryGstMode === "custom" && (
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                            Select Custom GST Percentage:
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
                            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-emerald-500">
                              <span className="text-xs font-bold text-gray-500">Custom:</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={categoryGstRate}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                  setCategoryGstRate(val);
                                }}
                                placeholder="18"
                                className="w-14 px-1.5 py-0.5 text-xs font-bold text-gray-900 border border-gray-200 rounded focus:outline-none bg-gray-50"
                              />
                              <span className="text-xs font-bold text-gray-700">%</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleApplyCategoryGst}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 mt-4"
                      >
                        <FiSave />
                        {saving
                          ? "Saving..."
                          : `Apply Settings to Category Items (${selectedCategory.totalProducts} products)`}
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
                                  <select
                                    value={editForm.gstRate}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({ ...prev, gstRate: Number(e.target.value) }))
                                    }
                                    className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none font-bold"
                                  >
                                    {GST_RATES.map((r) => (
                                      <option key={r} value={r}>
                                        {r}% GST
                                      </option>
                                    ))}
                                  </select>
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
