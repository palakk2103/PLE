import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiX,
  FiShoppingBag,
  FiDollarSign,
  FiPercent,
  FiEye,
  FiSave,
  FiCheckCircle,
  FiAlertCircle,
  FiInfo,
} from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../../../shared/utils/api";
import { formatPrice } from "../../../shared/utils/helpers";

const AdminCustomerListingModal = ({
  isOpen,
  onClose,
  sourceProduct,
  negotiation,
  existingListing,
  onListingUpdated,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    originalPrice: 0,
    salesChannel: "B2C",
    publicationStatus: "published",
    seoTitle: "",
    seoDescription: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supplyPrice = Number(negotiation?.finalAgreedPrice || sourceProduct?.price || 0);

  useEffect(() => {
    if (isOpen) {
      if (existingListing) {
        setFormData({
          name: existingListing.name || "",
          description: existingListing.description || "",
          price: existingListing.price || supplyPrice * 1.3,
          originalPrice: existingListing.originalPrice || existingListing.price || supplyPrice * 1.5,
          salesChannel: existingListing.salesChannel || "B2C",
          publicationStatus: existingListing.publicationStatus || (existingListing.isActive ? "published" : "draft"),
          seoTitle: existingListing.seoTitle || "",
          seoDescription: existingListing.seoDescription || "",
        });
      } else if (sourceProduct) {
        const defaultRetail = parseFloat((supplyPrice * 1.25).toFixed(2));
        setFormData({
          name: sourceProduct.name || "",
          description: sourceProduct.description || "",
          price: defaultRetail,
          originalPrice: sourceProduct.originalPrice || parseFloat((supplyPrice * 1.4).toFixed(2)),
          salesChannel: sourceProduct.salesChannel || "B2C",
          publicationStatus: "published",
          seoTitle: sourceProduct.name || "",
          seoDescription: sourceProduct.description ? sourceProduct.description.slice(0, 160) : "",
        });
      }
    }
  }, [isOpen, sourceProduct, existingListing, supplyPrice]);

  const sellingPrice = Number(formData.price) || 0;
  const marginAmount = parseFloat((sellingPrice - supplyPrice).toFixed(2));
  const marginPercent = sellingPrice > 0 ? parseFloat(((marginAmount / sellingPrice) * 100).toFixed(2)) : 0;
  const isLossMaking = marginAmount < 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sellingPrice <= 0) {
      toast.error("Retail selling price must be greater than 0");
      return;
    }

    if (isLossMaking && !window.confirm(`Warning: The selling price (${formatPrice(sellingPrice)}) is LOWER than the negotiated supply price (${formatPrice(supplyPrice)}). Do you really want to proceed with a negative margin?`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      if (existingListing?._id) {
        await api.put(`/admin/customer-listings/${existingListing._id}`, formData);
        toast.success("Customer listing updated successfully.");
      } else {
        await api.post(`/admin/products/${sourceProduct._id}/customer-listing`, formData);
        toast.success("Customer listing created and published!");
      }

      if (onListingUpdated) onListingUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save customer listing");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <FiShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">
                  {existingListing ? "Edit Customer Listing" : "Create Customer Listing"}
                </h2>
                <p className="text-xs text-gray-500">
                  Control the retail price, margins, and customer-facing listing independently.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Margin Calculation Dashboard */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-emerald-50/40 border border-emerald-100/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FiDollarSign className="text-emerald-600" /> Commercial Margins Preview
                </span>
                <span className="text-[11px] font-semibold text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-100">
                  Supply Cost: <strong>{formatPrice(supplyPrice)}</strong> (Locked)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-xs">
                  <span className="text-[10px] text-gray-500 uppercase font-medium block">
                    Vendor Supply Price
                  </span>
                  <span className="text-sm font-bold text-gray-900 mt-0.5 block">
                    {formatPrice(supplyPrice)}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-xs">
                  <span className="text-[10px] text-gray-500 uppercase font-medium block">
                    Retail Selling Price
                  </span>
                  <span className="text-sm font-bold text-emerald-600 mt-0.5 block">
                    {formatPrice(sellingPrice)}
                  </span>
                </div>
                <div
                  className={`p-3 rounded-lg border shadow-xs ${
                    isLossMaking
                      ? "bg-red-50 border-red-200 text-red-900"
                      : "bg-white border-gray-100 text-gray-900"
                  }`}
                >
                  <span className="text-[10px] text-gray-500 uppercase font-medium block">
                    Retained Margin
                  </span>
                  <span
                    className={`text-sm font-bold mt-0.5 block ${
                      isLossMaking ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    {formatPrice(marginAmount)} ({marginPercent}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Pricing Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1">
                  Customer Retail Selling Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1">
                  Customer Original MRP (Strike-through Price ₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.originalPrice}
                  onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Title & Channel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-800 mb-1">
                  Customer-Facing Product Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1">
                  Sales Channel
                </label>
                <select
                  value={formData.salesChannel}
                  onChange={(e) => setFormData({ ...formData, salesChannel: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                >
                  <option value="B2C">B2C</option>
                  <option value="B2B">B2B</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1">
                Customer Description
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Publication State */}
            <div>
              <label className="block text-xs font-semibold text-gray-800 mb-1">
                Publication State
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, publicationStatus: "published" })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.publicationStatus === "published"
                      ? "bg-emerald-50/80 border-emerald-500 text-emerald-950 font-bold shadow-xs"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <FiEye className="text-emerald-600" /> Published (Live)
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Visible to customers immediately.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, publicationStatus: "draft" })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.publicationStatus === "draft"
                      ? "bg-amber-50/80 border-amber-500 text-amber-950 font-bold shadow-xs"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <FiSave className="text-amber-600" /> Draft
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Saved internally, hidden from storefront.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, publicationStatus: "unpublished" })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.publicationStatus === "unpublished"
                      ? "bg-gray-100 border-gray-500 text-gray-900 font-bold shadow-xs"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <FiAlertCircle className="text-gray-500" /> Unpublished
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Deactivated from storefront.
                  </p>
                </button>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-gray-100">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <FiInfo className="w-3.5 h-3.5" /> Managed vendor will not see this selling price or margin.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <FiCheckCircle />
                  {isSubmitting
                    ? "Saving..."
                    : existingListing
                    ? "Update Listing"
                    : "Save & Publish Listing"}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AdminCustomerListingModal;
