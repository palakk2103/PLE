import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiFilter,
  FiCheckCircle,
  FiXCircle,
  FiEye,
  FiAlertCircle,
  FiCpu,
  FiActivity,
  FiShield,
  FiTool,
  FiCalendar,
  FiFlag,
  FiLayers,
} from "react-icons/fi";
import Badge from "../../../../shared/components/Badge";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

// Fetch dynamic data instead of mock

const ProductApprovals = () => {
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Edit/Moderation form state inside slide-over
  const [moderateGrade, setModerateGrade] = useState("A");
  const [isFlagged, setIsFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  // Initialize from backend
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/refurbished-products');
      const formatted = res.data.map(p => ({
        id: p._id,
        name: p.name,
        vendorName: p.vendorId?.storeName || p.vendorId?.name || "Unknown Vendor",
        price: p.price,
        originalPrice: p.originalPrice || p.price,
        image: p.image || p.images?.[0] || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/%3E%3Ccircle cx=%2234%22 cy=%2236%22 r=%228%22 fill=%22%23d1d5db%22/%3E%3Cpath d=%22M12 80l24-28 16 18 12-13 24 23z%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E',
        condition: p.refurbishedDetails?.condition || 'refurbished',
        refurbishedGrade: p.refurbishedDetails?.grade || 'A',
        status: p.refurbishedDetails?.approvalStatus || 'pending',
        usageAge: p.refurbishedDetails?.usageAge || 'Unknown',
        purchaseYear: p.refurbishedDetails?.purchaseYear || new Date().getFullYear(),
        batteryHealth: p.refurbishedDetails?.batteryHealth || 100,
        cosmeticCondition: p.refurbishedDetails?.cosmeticCondition || 'Good',
        functionalCondition: p.refurbishedDetails?.functionalCondition || 'Functional',
        replacedParts: p.refurbishedDetails?.replacedParts || 'None',
        repairDetails: p.refurbishedDetails?.repairDetails || 'None',
        warrantyDuration: p.refurbishedDetails?.warrantyDuration || 'No Warranty',
        warrantyType: p.refurbishedDetails?.warrantyType || 'None',
        accessories: p.refurbishedDetails?.accessories || [],
        tested: p.refurbishedDetails?.tested || false,
        certified: p.refurbishedDetails?.certified || false,
        qualityChecked: p.refurbishedDetails?.qualityChecked || false,
        flagged: p.refurbishedDetails?.flagged || false,
        flagReason: p.refurbishedDetails?.flagReason || "",
      }));
      setProducts(formatted);
    } catch (err) {
      toast.error('Failed to fetch refurbished products');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProducts = () => {
    fetchProducts();
  };

  // Filter products based on tab, search, and condition
  const filteredProducts = products.filter((p) => {
    const matchesTab = activeTab === "all" || p.status === activeTab;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCondition = selectedCondition === "all" || p.condition === selectedCondition;
    return matchesTab && matchesSearch && matchesCondition;
  });

  const handleOpenReview = (product) => {
    setSelectedProduct(product);
    setModerateGrade(product.refurbishedGrade);
    setIsFlagged(product.flagged || false);
    setFlagReason(product.flagReason || "");
    setRejectionReason("");
    setShowRejectForm(false);
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/admin/refurbished-products/${id}/status`, {
        status: 'approved',
        grade: moderateGrade,
        flagged: isFlagged,
        flagReason: isFlagged ? flagReason : "",
      });
      toast.success("Listing approved successfully!");
      saveProducts();
      setSelectedProduct(null);
    } catch (err) {
      toast.error("Failed to approve product");
    }
  };

  const handleReject = async (id) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejecting the listing.");
      return;
    }
    try {
      await api.put(`/admin/refurbished-products/${id}/status`, {
        status: 'rejected',
        grade: moderateGrade,
        flagged: isFlagged || true,
        flagReason: `Rejected: ${rejectionReason}. ${isFlagged ? flagReason : ""}`,
        rejectionReason: rejectionReason
      });
      toast.error("Listing rejected.");
      saveProducts();
      setSelectedProduct(null);
    } catch (err) {
      toast.error("Failed to reject product");
    }
  };

  // Condition Formatter Helper
  const getConditionLabel = (condition) => {
    switch (condition) {
      case "refurbished":
        return "Refurbished";
      case "renewed":
        return "Renewed";
      case "open_box":
        return "Open Box";
      default:
        return condition;
    }
  };

  // Grading Warning Check (Battery health threshold & condition metrics)
  const isFakeGrading =
    moderateGrade === "A" &&
    selectedProduct &&
    (selectedProduct.batteryHealth < 80 ||
      selectedProduct.cosmeticCondition === "Fair" ||
      selectedProduct.cosmeticCondition === "Poor");

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
          Refurbished Product Approvals
        </h1>
        <p className="text-sm text-gray-500">
          Moderate new refurbished, open-box, or renewed submissions from registered vendors before publication.
        </p>
      </div>

      {/* Tabs and Controls */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm space-y-4">
        {/* Tab Filters */}
        <div className="flex border-b border-gray-100 pb-2 flex-wrap gap-2">
          {["all", "pending", "approved", "rejected"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-semibold text-xs sm:text-sm rounded-lg transition-all capitalize ${
                activeTab === tab
                  ? "bg-[#C07A3D]/15 text-[#C07A3D]"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Input Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product name, ID, or vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D]/40 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D]/40 text-xs sm:text-sm font-semibold text-gray-600"
            >
              <option value="all">All Conditions</option>
              <option value="refurbished">Refurbished</option>
              <option value="renewed">Renewed</option>
              <option value="open_box">Open Box</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Listings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
            <div className="col-span-full py-12 text-center text-gray-500">Loading...</div>
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <motion.div
              layout
              key={product.id}
              className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="p-4 space-y-3">
                {/* Image and badges */}
                <div className="relative h-44 w-full rounded-xl bg-gray-50 overflow-hidden flex items-center justify-center border border-gray-100">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain"
                  />
                  <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                    <Badge
                      variant={
                        product.condition === "refurbished"
                          ? "warning"
                          : product.condition === "renewed"
                            ? "info"
                            : "success"
                      }
                    >
                      {getConditionLabel(product.condition)}
                    </Badge>
                    <Badge variant="neutral">Grade {product.refurbishedGrade}</Badge>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant={
                        product.status === "approved"
                          ? "success"
                          : product.status === "pending"
                            ? "warning"
                            : "error"
                      }
                    >
                      {product.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <h3 className="font-bold text-gray-800 text-sm sm:text-base line-clamp-2 min-h-[44px]">
                    {product.name}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Vendor: <span className="font-bold text-gray-600">{product.vendorName}</span>
                  </p>
                </div>

                {/* Stats snippets */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-xl text-gray-500 font-medium">
                  <div>Age: <span className="text-gray-900 font-bold">{product.usageAge}</span></div>
                  <div>Battery: <span className="text-gray-900 font-bold">{product.batteryHealth}%</span></div>
                  <div>Cosmetic: <span className="text-gray-900 font-bold">{product.cosmeticCondition}</span></div>
                  <div>Warranty: <span className="text-gray-900 font-bold">{product.warrantyDuration}</span></div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="border-t border-gray-100 p-4 bg-gray-50/50 flex justify-between items-center gap-2">
                <span className="text-sm font-black text-[#C07A3D]">
                  ₹{product.price.toLocaleString("en-IN")}
                </span>
                <button
                  onClick={() => handleOpenReview(product)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-[#C07A3D] text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  <FiEye /> Review Details
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full bg-white border border-gray-200 rounded-2xl py-16 text-center">
            <FiLayers className="text-4xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold">No product listings match your filters.</p>
            <p className="text-xs text-gray-400 mt-1">Try resetting the search terms or filtering by all status.</p>
          </div>
        )}
      </div>

      {/* Review Slide-Over Drawer */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black z-50"
            />

            {/* Slide-over */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-[60] flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-900 text-white">
                <div>
                  <span className="text-xs uppercase tracking-wider text-[#C07A3D] font-bold">
                    Inspection & Quality Review
                  </span>
                  <h2 className="font-bold text-base line-clamp-1">
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

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Image and status overview */}
                <div className="flex gap-4 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="w-20 h-20 object-contain rounded-lg bg-white border border-gray-200"
                  />
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm sm:text-base">
                      ₹{selectedProduct.price.toLocaleString("en-IN")}
                    </h3>
                    <p className="text-xs text-gray-400 mb-1.5">Original: ₹{selectedProduct.originalPrice.toLocaleString("en-IN")}</p>
                    <div className="flex gap-1.5">
                      <Badge variant="warning">{getConditionLabel(selectedProduct.condition)}</Badge>
                      <Badge variant="neutral">Grade {selectedProduct.refurbishedGrade}</Badge>
                    </div>
                  </div>
                </div>

                {/* Diagnostic Details Grid */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                    <FiCpu /> Diagnostic Criteria Check
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-gray-100 p-3 rounded-xl bg-white shadow-sm space-y-1">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Battery Health</p>
                      <p className={`text-base font-bold ${
                        selectedProduct.batteryHealth >= 80 ? "text-emerald-600" : "text-amber-500"
                      }`}>{selectedProduct.batteryHealth}% Capacity</p>
                    </div>
                    <div className="border border-gray-100 p-3 rounded-xl bg-white shadow-sm space-y-1">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Cosmetic Condition</p>
                      <p className="text-base font-bold text-gray-800">{selectedProduct.cosmeticCondition}</p>
                    </div>
                    <div className="border border-gray-100 p-3 rounded-xl bg-white shadow-sm space-y-1">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Usage Info</p>
                      <p className="text-xs font-bold text-gray-800 flex items-center gap-1">
                        <FiCalendar className="text-gray-400" /> Age: {selectedProduct.usageAge} ({selectedProduct.purchaseYear})
                      </p>
                    </div>
                    <div className="border border-gray-100 p-3 rounded-xl bg-white shadow-sm space-y-1">
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">Diagnostics Status</p>
                      <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <FiShield className="text-emerald-500" /> {selectedProduct.functionalCondition}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Replaced parts / Repair log */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                    <FiTool /> Repair & Service Logs
                  </h4>
                  <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl text-xs space-y-1.5 leading-relaxed text-gray-600">
                    <div>
                      <span className="font-bold text-gray-800 block">Replaced Parts:</span>
                      {selectedProduct.replacedParts}
                    </div>
                    <div>
                      <span className="font-bold text-gray-800 block">Repair Service Detail:</span>
                      {selectedProduct.repairDetails}
                    </div>
                  </div>
                </div>

                {/* Warranty and Accessories */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      Warranty
                    </h4>
                    <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl text-xs">
                      <p className="font-bold text-gray-800">{selectedProduct.warrantyDuration}</p>
                      <p className="text-gray-400">{selectedProduct.warrantyType}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      Accessories Included
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedProduct.accessories.map((acc) => (
                        <span
                          key={acc}
                          className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold text-gray-600"
                        >
                          ✓ {acc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Verification Checkmarks */}
                <div className="bg-[#C07A3D]/5 border border-[#C07A3D]/20 p-3.5 rounded-xl space-y-2 text-xs">
                  <h4 className="font-bold text-gray-800">Trust & Certifications Status</h4>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-emerald-700">
                      ✓ Diagnostics Tested
                    </span>
                    <span className={`flex items-center gap-1 ${
                      selectedProduct.certified ? "text-emerald-700" : "text-gray-400"
                    }`}>
                      {selectedProduct.certified ? "✓ Certified Refurbished" : "✗ Not Certified"}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700">
                      ✓ Quality Checked
                    </span>
                  </div>
                </div>

                {/* Moderation Controls */}
                <div className="border-t border-gray-100 pt-5 space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Admin Moderation Tools
                  </h4>

                  {/* Override Grade */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">Override Listing Grade</label>
                    <select
                      value={moderateGrade}
                      onChange={(e) => setModerateGrade(e.target.value)}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none"
                    >
                      <option value="A">Grade A (Pristine/Mint)</option>
                      <option value="B">Grade B (Good/Minor wear)</option>
                      <option value="C">Grade C (Fair/Scuffs)</option>
                    </select>
                  </div>

                  {/* Fake grading warning */}
                  {isFakeGrading && (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex gap-3 text-rose-800 text-xs">
                      <FiAlertCircle className="text-rose-500 text-lg flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold">Fake Grading Standard Flagged!</span>
                        <p className="leading-relaxed">
                          This product is configured as **Grade A** but has **Battery Capacity at {selectedProduct.batteryHealth}%** (standards require &gt;80% for Grade A). Please override the Grade to B/C or Reject the listing.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Suspicious listing flag */}
                  <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
                    <input
                      type="checkbox"
                      id="flagCheckbox"
                      checked={isFlagged}
                      onChange={(e) => setIsFlagged(e.target.checked)}
                      className="mt-1"
                    />
                    <div className="space-y-1.5 flex-1">
                      <label htmlFor="flagCheckbox" className="text-xs font-bold text-gray-800 flex items-center gap-1.5 cursor-pointer">
                        <FiFlag className="text-rose-500" /> Flag listing as Suspicious / Misleading
                      </label>
                      {isFlagged && (
                        <input
                          type="text"
                          placeholder="Provide audit flags reason (e.g. Price too low, mismatched description)"
                          value={flagReason}
                          onChange={(e) => setFlagReason(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Reject Area */}
                {showRejectForm && (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl space-y-2">
                    <label className="text-xs font-bold text-red-800 block">Reason for Rejection</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Specify why this refurbished listing is being rejected (e.g., failed audio diagnosis, fake Grade A battery report)..."
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
                        onClick={() => handleReject(selectedProduct.id)}
                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex-1 py-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <FiXCircle /> Reject Product
                </button>
                <button
                  onClick={() => handleApprove(selectedProduct.id)}
                  className="flex-1 py-3 bg-[#C07A3D] hover:bg-[#D18B4A] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
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
