import React from "react";
import { FiArrowRight, FiTag } from "react-icons/fi";
import { DISCOUNT_TYPES } from "../constants/offerTypes";

export const OfferBanner = ({ offer, onClick }) => {
  if (!offer) return null;

  return (
    <div
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden shadow-sm aspect-[16/6] md:aspect-[21/6] bg-[#120D0B] cursor-pointer group border border-white/[0.04] select-none banner-container"
    >
      {/* Background Image with Overlay */}
      {offer.bannerImage ? (
        <img
          src={offer.bannerImage}
          alt={offer.title}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 pointer-events-none select-none"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-r from-[#1A1310] to-[#2A1F1A] pointer-events-none select-none" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex flex-col justify-center px-6 md:px-12 text-left pointer-events-none select-none">
        <span className="text-[10px] uppercase tracking-wider font-extrabold text-yellow-400 mb-1.5 flex items-center gap-1 select-none">
          <FiTag />
          {offer.offerType}
        </span>
        <h2 className="text-lg md:text-3xl font-black text-white leading-tight select-none">
          {offer.title}
        </h2>
        <p className="text-xs md:text-sm text-white/80 font-medium mt-1 select-none">
          {offer.subtitle}
        </p>

        {offer.couponCode && (
          <div className="mt-3 flex items-center gap-2 select-none">
            <span className="text-[9px] md:text-xs font-mono font-bold text-white bg-white/20 border border-white/30 px-2 py-0.5 rounded select-none">
              USE CODE: {offer.couponCode}
            </span>
            <span className="text-[9px] md:text-xs font-bold text-yellow-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform select-none">
              Apply Now <FiArrowRight />
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfferBanner;
