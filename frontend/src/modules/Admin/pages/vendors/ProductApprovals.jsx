import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiFilter,
  FiCheckCircle,
  FiXCircle,
  FiEye,
  FiTag,
  FiShoppingBag,
  FiEdit3,
  FiLayers,
  FiInfo,
} from "react-icons/fi";
import Badge from "../../../../shared/components/Badge";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

const ProductApprovals = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shops, setShops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending"); // default to pending
  const [sellerType, setSellerType] = useState("all"); // all, independent, managed
  const [shopFilter, setShopFilter] = useState("all");
  const [salesChannelFilter, setSalesChannelFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Form edit state inside modal
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    price: 0,
    originalPrice: 0,
    salesChannel: "B2C",
    b2bWholesalePrice: 0,
    b2bMinOrderQty: 1,
  });

  useEffect(() => {
    fetchFiltersData();
    fetchProducts();
  }, [statusFilter, sellerType, shopFilter, salesChannelFilter, categoryFilter]);

  const fetchFiltersData = async () => {
    try {
      const catRes = await api.get("/admin/categories");
      setCategories(catRes.data?.data || catRes.data?.categories || catRes.data || []);
      
      const shopRes = await api.get("/admin/managed-shops");
      setShops(shopRes.data?.data || shopRes.data || []);
    } catch (err) {
      console.error("Failed to load category/shop filters", err);
    }
  };

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      
      let queryParams = [];
      if (statusFilter !== "all") queryParams.push(`approvalStatus=${statusFilter}`);
      if (sellerType !== "all") queryParams.push(`sellerType=${sellerType}`);
      if (shopFilter !== "all") queryParams.push(`shopId=${shopFilter}`);
      if (salesChannelFilter !== "all") queryParams.push(`salesChannel=${salesChannelFilter}`);
      if (categoryFilter !== "all") queryParams.push(`categoryId=${categoryFilter}`);
      queryParams.push("includeInactive=true");

      const res = await api.get(`/admin/products?${queryParams.join("&")}`);
      setProducts(res.data?.products || res.data || []);
    } catch (err) {
      toast.error("Failed to fetch products");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReview = (product) => {
    setSelectedProduct(product);
    setEditForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price || 0,
      originalPrice: product.originalPrice || 0,
      salesChannel: product.salesChannel || "B2C",
      b2bWholesalePrice: product.b2bWholesalePrice !== undefined && product.b2bWholesalePrice !== null ? product.b2bWholesalePrice : product.price || 0,
      b2bMinOrderQty: product.b2bMinOrderQty || 1,
    });
    setRejectionReason("");
    setShowRejectForm(false);
  };

  const handleApprove = async (id) => {
    try {
      await api.patch(`/admin/products/${id}/review`, {
        status: "approved",
        approveBrand: true,
        approveCategory: true,
        ...editForm,
      });
      toast.success("Product approved and live with Category & Brand!");
      setSelectedProduct(null);
      fetchProducts();
    } catch (err) {
      toast.error("Failed to approve product");
    }
  };

  const handleReject = async (id) => {
    if (!rejectionReason.trim()) {
      toast.error("Please specify a reason for rejection");
      return;
    }
    try {
      await api.patch(`/admin/products/${id}/review`, {
        status: "rejected",
        reason: rejectionReason,
        ...editForm,
      });
      toast.success("Product rejected.");
      setSelectedProduct(null);
      fetchProducts();
    } catch (err) {
      toast.error("Failed to reject product");
    }
  };

  const filteredList = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(term) ||
      p.shopId?.name?.toLowerCase().includes(term) ||
      p.vendorId?.storeName?.toLowerCase().includes(term)
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <FiCheckCircle className="text-[#C07A3D]" />
          Pending Product Approval & Review
        </h1>
        <p className="text-sm text-gray-500">
          Moderate, edit, and approve submissions from managed shops and independent vendors.
        </p>
      </div>

      {/* Filters & Control Area */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Status Tabs */}
        <div className="flex border-b border-gray-100 pb-2 flex-wrap gap-2">
          {[
            { value: "pending", label: "Pending Approval" },
            { value: "approved", label: "Approved (Live)" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All Submissions" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 font-semibold text-xs sm:text-sm rounded-lg transition-all ${
                statusFilter === tab.value
                  ? "bg-[#C07A3D]/15 text-[#C07A3D]"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D]/40 text-xs"
            />
          </div>

          {/* Seller Type Filter */}
          <select
            value={sellerType}
            onChange={(e) => setSellerType(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-xs"
          >
            <option value="all">All Seller Types</option>
            <option value="independent">Independent Sellers</option>
            <option value="managed">Managed Shops Only</option>
          </select>

          {/* Managed Shop Filter */}
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-xs"
          >
            <option value="all">All Managed Shops</option>
            {shops.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Sales Channel Filter */}
          <select
            value={salesChannelFilter}
            onChange={(e) => setSalesChannelFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-xs"
          >
            <option value="all">All Channels</option>
            <option value="B2C">B2C Only</option>
            <option value="B2B">B2B Only</option>
            <option value="BOTH">B2B & B2C (Both)</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-xs"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Submissions */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading products...</div>
      ) : filteredList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredList.map((product) => (
            <div
              key={product._id}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
            >
              <div className="p-4 space-y-3">
                {/* Image and Badges */}
                <div className="relative h-44 w-full rounded-xl bg-gray-50 overflow-hidden flex items-center justify-center border border-gray-100">
                  <img
                    src={product.image || product.images?.[0] || "https://via.placeholder.com/150"}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain"
                  />
                  <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                    <Badge variant="neutral">{product.salesChannel}</Badge>
                    {product.shopId ? (
                      <Badge variant="info">Managed Shop</Badge>
                    ) : (
                      <Badge variant="success">Independent</Badge>
                    )}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant={
                        product.approvalStatus === "approved"
                          ? "success"
                          : product.approvalStatus === "pending"
                            ? "warning"
                            : "error"
                      }
                    >
                      {product.approvalStatus?.toUpperCase() || "PENDING"}
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                  <div className="space-y-1">
                  <h3 className="font-bold text-gray-800 text-sm sm:text-base line-clamp-2 min-h-[44px]">
                    {product.name}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Seller:{" "}
                    <span className="font-bold text-gray-650">
                      {product.shopId?.name || product.vendorId?.storeName || "Unknown"}
                    </span>
                  </p>
                  {(product.brandApprovalStatus === 'pending' || product.customBrandName) && (
                    <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 pt-0.5">
                      <FiTag className="w-3 h-3 text-amber-500" />
                      <span>Brand Request: <strong>{product.customBrandName || product.brandId?.name}</strong></span>
                    </p>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t border-gray-100 p-4 bg-gray-50/50 flex justify-between items-center gap-2">
                <span className="text-sm font-black text-[#C07A3D]">
                  ₹{product.price?.toLocaleString("en-IN")}
                </span>
                <button
                  onClick={() => handleOpenReview(product)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-[#C07A3D] text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  <FiEye /> Review & Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
          <FiLayers className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-bold">No product listings found matching criteria.</p>
        </div>
      )}

      {/* Review & Edit Drawer/Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-[60] flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-900 text-white">
                <div>
                  <span className="text-xs uppercase tracking-wider text-[#C07A3D] font-bold">
                    Product Moderation
                  </span>
                  <h2 className="font-bold text-sm sm:text-base line-clamp-1">
                    {selectedProduct.name}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white"
                >
                  ✕
                </button>
              </div>

              {/* Form Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex gap-4 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <img
                    src={selectedProduct.image || selectedProduct.images?.[0] || "https://via.placeholder.com/80"}
                    alt={selectedProduct.name}
                    className="w-16 h-16 object-contain rounded-lg bg-white border border-gray-200"
                  />
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">
                      Seller: {selectedProduct.shopId?.name || selectedProduct.vendorId?.storeName || "N/A"}
                    </h3>
                    <p className="text-xs text-gray-400">Status: {selectedProduct.approvalStatus?.toUpperCase()}</p>
                  </div>
                </div>

                {(selectedProduct.categoryApprovalStatus === 'pending' || selectedProduct.customCategoryName || (typeof selectedProduct.categoryId === 'object' && selectedProduct.categoryId?.status === 'pending')) && (
                  <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50/50 border border-emerald-200 rounded-xl space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-2">
                      <FiLayers className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-900">Custom Category Request:</span>
                      <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-950 font-extrabold text-xs rounded-md shadow-2xs">
                        {selectedProduct.customCategoryName || (typeof selectedProduct.categoryId === 'object' ? selectedProduct.categoryId?.name : '')}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                      Approving this product will automatically approve this category into the master catalog, publishing the category to the storefront and adding it to dropdowns for all vendors.
                    </p>
                  </div>
                )}

                {(selectedProduct.brandApprovalStatus === 'pending' || selectedProduct.customBrandName || (typeof selectedProduct.brandId === 'object' && selectedProduct.brandId?.status === 'pending')) && (
                  <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200 rounded-xl space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-2">
                      <FiTag className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold text-amber-900">Custom Brand Request:</span>
                      <span className="px-2 py-0.5 bg-amber-200/80 text-amber-950 font-extrabold text-xs rounded-md shadow-2xs">
                        {selectedProduct.customBrandName || (typeof selectedProduct.brandId === 'object' ? selectedProduct.brandId?.name : '')}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                      Approving this product will automatically approve this custom brand into the master catalog, making it permanently available for all vendors and publishing all associated products to the live store.
                    </p>
                  </div>
                )}

                {/* Edit Form Fields */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Edit Product Parameters
                  </h4>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Product Title</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">Retail / B2C Price (₹)</label>
                      <input
                        type="number"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">Original MRP (₹)</label>
                      <input
                        type="number"
                        value={editForm.originalPrice}
                        onChange={(e) => setEditForm({ ...editForm, originalPrice: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Admin Channel Selection */}
                  <div className="bg-amber-50/60 border border-amber-200/80 p-3.5 rounded-2xl space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-900 mb-1 flex items-center justify-between">
                        <span>Target Sales Channel *</span>
                        <span className="text-[10px] text-amber-800 font-semibold uppercase">Admin Publish Destination</span>
                      </label>
                      <p className="text-[11px] text-gray-500 mb-2">
                        Decide where this product should be displayed once approved:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'B2C', label: 'B2C Only', desc: 'Retail Marketplace' },
                          { id: 'B2B', label: 'B2B Only', desc: 'Wholesale Platform' },
                          { id: 'BOTH', label: 'Both Channels', desc: 'B2C + B2B Wholesale' },
                        ].map((chan) => (
                          <button
                            key={chan.id}
                            type="button"
                            onClick={() => setEditForm({ ...editForm, salesChannel: chan.id })}
                            className={`p-2.5 rounded-xl text-center border transition-all ${
                              editForm.salesChannel === chan.id
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-50/50'
                            }`}
                          >
                            <div className="text-xs font-bold">{chan.label}</div>
                            <div className={`text-[10px] truncate ${editForm.salesChannel === chan.id ? 'text-amber-100' : 'text-gray-400'}`}>
                              {chan.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {(editForm.salesChannel === 'B2B' || editForm.salesChannel === 'BOTH') && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-800">B2B Wholesale Price (₹)</label>
                          <input
                            type="number"
                            value={editForm.b2bWholesalePrice}
                            onChange={(e) => setEditForm({ ...editForm, b2bWholesalePrice: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none"
                            placeholder="Wholesale price"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-800">Min Order Qty (MOQ)</label>
                          <input
                            type="number"
                            min="1"
                            value={editForm.b2bMinOrderQty}
                            onChange={(e) => setEditForm({ ...editForm, b2bMinOrderQty: Number(e.target.value) })}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none"
                            placeholder="e.g. 10"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={3}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Audit Logs */}
                {selectedProduct.auditLog && selectedProduct.auditLog.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      Audit History Log
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-100 p-3 rounded-xl bg-gray-50">
                      {selectedProduct.auditLog.map((log, idx) => (
                        <div key={idx} className="text-[11px] leading-relaxed text-gray-500 border-b border-gray-200/50 pb-1.5 last:border-b-0">
                          <span className="font-bold text-gray-700 capitalize">{log.action}</span> by{" "}
                          <span className="font-bold text-gray-650">{log.userType}</span> on{" "}
                          {new Date(log.timestamp).toLocaleString()}
                          {log.reason && <p className="text-rose-600 italic">"Reason: {log.reason}"</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reject Area */}
                {showRejectForm && (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl space-y-2">
                    <label className="text-xs font-bold text-red-800 block">Reason for Rejection *</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Specify rejection reasons (e.g. incorrect pricing, image quality, description details)..."
                      rows={3}
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowRejectForm(false)}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleReject(selectedProduct._id)}
                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex-1 py-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <FiXCircle /> Reject Submission
                </button>
                <button
                  onClick={() => handleApprove(selectedProduct._id)}
                  className="flex-1 py-3 bg-[#C07A3D] hover:bg-[#A8642C] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <FiCheckCircle /> Approve & Publish
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProductApprovals;
