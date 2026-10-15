import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useOffers } from "../hooks/useOffers";
import { OFFER_TYPES, DISCOUNT_TYPES, OFFER_STATUS, CREATOR_TYPES } from "../constants/offerTypes";
import { categories as mockCategories } from "../../../data/categories";
import { products as mockProducts } from "../../../data/products";
import { FiArrowLeft, FiTag, FiEye, FiCheck } from "react-icons/fi";
import { ADMIN_BASE_ROUTE, getAdminPath } from "../../Admin/config/adminRoutesConfig";
import toast from "react-hot-toast";

export const CreateOffer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith(ADMIN_BASE_ROUTE) || location.pathname.startsWith("/admin");
  const baseRoute = isAdmin ? getAdminPath("offers-management") : "/vendor/my-offers";

  const { createOffer } = useOffers();

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    description: "",
    offerType: OFFER_TYPES.BANK_OFFER,
    bannerImage: "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&fit=crop",
    discountType: DISCOUNT_TYPES.PERCENTAGE,
    discountValue: "",
    couponCode: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    priority: "1",
    applicableCategories: [],
    applicableProducts: [],
    termsAndConditions: "",
    isActive: true,
    status: OFFER_STATUS.ACTIVE
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleMultiSelect = (name, id) => {
    setFormData((prev) => {
      const list = [...prev[name]];
      const index = list.indexOf(id);
      if (index > -1) {
        list.splice(index, 1);
      } else {
        list.push(id);
      }
      return { ...prev, [name]: list };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.subtitle || !formData.description) {
      toast.error("Please fill in all basic fields");
      return;
    }

    const payload = {
      ...formData,
      createdBy: isAdmin ? "System Admin" : "Fashion Hub",
      creatorType: isAdmin ? CREATOR_TYPES.ADMIN : CREATOR_TYPES.SELLER
    };

    createOffer(payload);
    toast.success("Offer created successfully");
    navigate(`${baseRoute}/list`);
  };

  return (
    <div className="p-6 bg-[#1A1310] min-h-screen text-white space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] pb-5">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl text-white transition-all"
        >
          <FiArrowLeft className="text-lg" />
        </button>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">Create Promotion</h1>
          <p className="text-sm text-[#8E7768] mt-1">Design and publish new customer offers and promotional codes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-[#120D0B] border border-white/[0.06] rounded-3xl p-6 space-y-6">
          <h3 className="text-md font-bold uppercase tracking-wider text-white mb-2 flex items-center gap-2">
            <FiTag className="text-[#C07A3D]" /> Offer Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Offer Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. SBI Card 10% Instant Discount"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50 focus:ring-1 focus:ring-[#C07A3D]/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Offer Subtitle *</label>
              <input
                type="text"
                name="subtitle"
                value={formData.subtitle}
                onChange={handleChange}
                placeholder="e.g. 10% instant savings on purchases"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Offer Type</label>
              <select
                name="offerType"
                value={formData.offerType}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50"
              >
                {Object.values(OFFER_TYPES).map((type) => (
                  <option key={type} value={type} className="bg-[#120D0B] text-white">
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your promotion in details..."
                rows="3"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50"
                required
              ></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Discount Type</label>
              <select
                name="discountType"
                value={formData.discountType}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50"
              >
                {Object.values(DISCOUNT_TYPES).map((type) => (
                  <option key={type} value={type} className="bg-[#120D0B] text-white">
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Discount Value</label>
              <input
                type="number"
                name="discountValue"
                value={formData.discountValue}
                onChange={handleChange}
                placeholder="e.g. 10 or 500"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Coupon Code (Optional)</label>
              <input
                type="text"
                name="couponCode"
                value={formData.couponCode}
                onChange={handleChange}
                placeholder="e.g. SBISAVE10"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Priority (1-10)</label>
              <input
                type="number"
                name="priority"
                min="1"
                max="10"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">End Date</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Banner Image URL</label>
              <input
                type="text"
                name="bannerImage"
                value={formData.bannerImage}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Terms & Conditions</label>
              <textarea
                name="termsAndConditions"
                value={formData.termsAndConditions}
                onChange={handleChange}
                placeholder="Specify specific conditions for the coupon..."
                rows="2"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white focus:outline-none focus:border-[#C07A3D]/50"
              ></textarea>
            </div>

            {/* Applicable Categories */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Applicable Categories</label>
              <div className="flex flex-wrap gap-2">
                {mockCategories.map((category) => {
                  const isSelected = formData.applicableCategories.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleMultiSelect("applicableCategories", category.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isSelected 
                          ? "bg-[#C07A3D]/15 text-[#F5E6DA] border-[#C07A3D]/50 font-bold" 
                          : "bg-white/[0.02] text-gray-400 border-white/[0.06] hover:bg-white/[0.06]"
                      }`}
                    >
                      {isSelected && <FiCheck className="text-green-500 text-xs" />}
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Applicable Products */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Applicable Products</label>
              <div className="max-h-40 overflow-y-auto divide-y divide-white/[0.04] bg-white/[0.02] border border-white/[0.06] rounded-2xl p-2">
                {mockProducts.map((product) => {
                  const isSelected = formData.applicableProducts.includes(product.id);
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleMultiSelect("applicableProducts", product.id)}
                      className="flex items-center justify-between p-2.5 hover:bg-white/[0.04] cursor-pointer rounded-lg transition-colors"
                    >
                      <span className="text-xs text-gray-300 font-medium">{product.name}</span>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? "bg-green-500 border-green-500 text-white" : "border-white/[0.2]"
                      }`}>
                        {isSelected && <FiCheck className="text-[10px]" />}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Checkbox */}
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-4 h-4 rounded text-[#C07A3D] bg-white/[0.04] border-white/[0.06] focus:ring-0 cursor-pointer"
              />
              <label htmlFor="isActive" className="text-xs font-bold text-gray-300 cursor-pointer select-none">
                Enable this offer immediately
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-sm font-bold transition-all text-[#C8B3A3]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#C07A3D] hover:bg-[#C07A3D]/90 rounded-xl text-sm font-bold transition-all shadow-md"
            >
              Submit Offer
            </button>
          </div>
        </form>

        {/* Live Preview Panel */}
        <div className="space-y-6">
          <div className="bg-[#120D0B] border border-white/[0.06] rounded-3xl p-6">
            <h3 className="text-md font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
              <FiEye className="text-[#C07A3D]" /> Live Preview
            </h3>

            {/* Slider Mockup */}
            <div className="relative rounded-2xl overflow-hidden aspect-[16/9] bg-[#1A1310] border border-white/[0.04] shadow-md">
              <img
                src={formData.bannerImage || "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&fit=crop"}
                alt="Banner Preview"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent flex flex-col justify-center p-4 text-left">
                <span className="text-[8px] uppercase tracking-wider font-extrabold text-yellow-400">
                  {formData.offerType}
                </span>
                <h4 className="text-sm md:text-base font-black text-white leading-tight mt-1 truncate">
                  {formData.title || "Offer Title"}
                </h4>
                <p className="text-[10px] text-gray-300 font-medium mt-0.5 truncate">
                  {formData.subtitle || "Offer Subtitle"}
                </p>

                {formData.couponCode && (
                  <div className="mt-2 text-[9px] font-mono font-bold text-white bg-white/20 border border-white/20 px-2 py-0.5 rounded inline-block self-start">
                    CODE: {formData.couponCode}
                  </div>
                )}
              </div>
            </div>

            {/* Coupon Card Mockup */}
            <div className="mt-4 bg-[#1A1310] border border-white/[0.06] rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[8px] font-black uppercase tracking-wider text-[#C07A3D] bg-[#C07A3D]/10 px-2 py-0.5 rounded-full inline-block mb-1.5">
                  {formData.offerType}
                </span>
                <h5 className="text-xs font-extrabold text-white truncate">{formData.title || "Offer Title"}</h5>
                <p className="text-[10px] text-gray-500 mt-0.5 truncate">{formData.subtitle || "Offer Subtitle"}</p>
              </div>

              {formData.couponCode && (
                <div className="mt-3 flex items-center justify-between bg-white/[0.02] border border-white/[0.04] p-1.5 rounded-xl">
                  <code className="text-xs font-mono font-bold text-white">{formData.couponCode}</code>
                  <span className="text-[9px] font-bold text-[#C07A3D]">Copy</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOffer;
