import React from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useOffers } from "../hooks/useOffers";
import { categories as mockCategories } from "../data/mockCategories";
import { products as mockProducts } from "../../../data/products";
import { FiArrowLeft, FiCalendar, FiUser, FiInfo, FiTag, FiShoppingBag, FiLayers } from "react-icons/fi";
import OfferStatusChip from "../components/OfferStatusChip";

export const OfferDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { offers } = useOffers();
  
  const offer = offers.find((o) => o.id === id);

  if (!offer) {
    return (
      <div className="p-6 bg-[#1A1310] min-h-screen text-white flex items-center justify-center">
        <p>Offer not found.</p>
      </div>
    );
  }

  // Map applicable categories/products to names
  const categoryNames = offer.applicableCategories?.map(catId => {
    const cat = mockCategories.find(c => Number(c.id) === Number(catId));
    return cat ? cat.name : `Category ${catId}`;
  }) || [];

  const productNames = offer.applicableProducts?.map(prodId => {
    const prod = mockProducts.find(p => Number(p.id) === Number(prodId));
    return prod ? prod.name : `Product ${prodId}`;
  }) || [];

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
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">Offer Specifications</h1>
          <p className="text-sm text-[#8E7768] mt-1">Review coverage metrics and terms for the selected campaign.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Banner Container */}
          <div className="relative rounded-3xl overflow-hidden aspect-[16/7] md:aspect-[21/7] bg-[#120D0B] border border-white/[0.06] shadow-lg">
            {offer.bannerImage ? (
              <img
                src={offer.bannerImage}
                alt={offer.title}
                className="w-full h-full object-cover opacity-60"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#1A1310] to-[#2A1F1A]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent flex flex-col justify-center px-8 md:px-12 text-left">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded-full self-start mb-2">
                {offer.offerType}
              </span>
              <h2 className="text-lg md:text-3xl font-black text-white leading-tight mt-1">
                {offer.title}
              </h2>
              <p className="text-xs md:text-sm text-gray-300 font-medium mt-1">
                {offer.subtitle}
              </p>
            </div>
          </div>

          {/* Description & Terms */}
          <div className="bg-[#120D0B] border border-white/[0.06] rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2">Detailed Description</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{offer.description}</p>
            </div>

            <div className="pt-5 border-t border-white/[0.04]">
              <h3 className="text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FiInfo /> Terms & Conditions
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {offer.termsAndConditions || "This offer is valid only for retail customers. Multi-coupon usage is prohibited."}
              </p>
            </div>
          </div>

          {/* Covered Targets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Categories */}
            <div className="bg-[#120D0B] border border-white/[0.06] rounded-3xl p-6">
              <h3 className="text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <FiLayers /> Categories Covered
              </h3>
              {categoryNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {categoryNames.map((name, index) => (
                    <span key={index} className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-xs font-medium text-white">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Site-wide / All Categories</p>
              )}
            </div>

            {/* Products */}
            <div className="bg-[#120D0B] border border-white/[0.06] rounded-3xl p-6">
              <h3 className="text-xs font-bold text-[#8E7768] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <FiShoppingBag /> Products Covered
              </h3>
              {productNames.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                  {productNames.map((name, index) => (
                    <div key={index} className="p-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl text-xs text-gray-300">
                      {name}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">All Category-Related Products</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Info Panel */}
        <div className="bg-[#120D0B] border border-white/[0.06] rounded-3xl p-6 h-fit space-y-6">
          <h3 className="text-md font-bold uppercase tracking-wider text-white border-b border-white/[0.04] pb-3">
            Summary
          </h3>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-[#8E7768] font-bold uppercase tracking-wider mb-1">Status</p>
              <OfferStatusChip status={offer.status} isActive={offer.isActive} />
            </div>

            <div>
              <p className="text-[10px] text-[#8E7768] font-bold uppercase tracking-wider mb-1">Coupon Code</p>
              {offer.couponCode ? (
                <code className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-[#C07A3D] font-mono font-bold">
                  {offer.couponCode}
                </code>
              ) : (
                <span className="text-xs text-gray-500 italic">None (Direct discount)</span>
              )}
            </div>

            <div>
              <p className="text-[10px] text-[#8E7768] font-bold uppercase tracking-wider mb-1">Priority Level</p>
              <span className="text-sm font-bold text-white bg-white/[0.04] px-2.5 py-1 border border-white/[0.06] rounded-lg">
                Level {offer.priority}
              </span>
            </div>

            <div className="pt-4 border-t border-white/[0.04] space-y-4">
              <div className="flex items-center gap-2.5">
                <FiCalendar className="text-[#C07A3D]" />
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Duration</p>
                  <p className="text-xs text-gray-300 font-medium">
                    {offer.startDate} to {offer.endDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <FiUser className="text-[#C07A3D]" />
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Creator Information</p>
                  <p className="text-xs text-gray-300 font-medium">
                    {offer.createdBy} ({offer.creatorType})
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferDetails;
