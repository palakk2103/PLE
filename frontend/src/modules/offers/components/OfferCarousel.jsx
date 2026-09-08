import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiChevronLeft, FiChevronRight, FiTag } from "react-icons/fi";
import { OFFER_TYPES } from "../constants/offerTypes";

export const OfferCarousel = ({ offers = [], onOfferClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef(null);

  const activeOffers = offers.filter(o => o.isActive && o.status === "Active");

  // Auto slide loop
  useEffect(() => {
    if (activeOffers.length <= 1 || isPaused) return;

    timeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeOffers.length);
    }, 4500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentIndex, activeOffers.length, isPaused]);

  if (!activeOffers.length) return null;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeOffers.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activeOffers.length) % activeOffers.length);
  };

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsPaused(true);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }

    setTouchStart(null);
    setTouchEnd(null);
    setTimeout(() => setIsPaused(false), 2000);
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case OFFER_TYPES.BANK_OFFER:
        return "bg-blue-600 text-white";
      case OFFER_TYPES.SELLER_OFFER:
        return "bg-[#C07A3D] text-white";
      case OFFER_TYPES.FESTIVAL_OFFER:
        return "bg-red-500 text-white";
      default:
        return "bg-zinc-700 text-white";
    }
  };

  const currentOffer = activeOffers[currentIndex];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onDragStart={(e) => e.preventDefault()}
      className="relative w-full h-40 md:h-56 lg:h-64 rounded-none md:rounded-2xl overflow-hidden bg-[#120D0B] border border-white/[0.06] select-none group shadow-lg carousel-container"
    >
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDragStart={(e) => e.preventDefault()}
        onClick={() => onOfferClick && onOfferClick(currentOffer)}
        className="w-full h-full cursor-pointer relative select-none"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full relative select-none"
          >
            {currentOffer.bannerImage ? (
              <img
                src={currentOffer.bannerImage}
                alt={currentOffer.title}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="w-full h-full object-cover opacity-60 pointer-events-none select-none"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#1A1310] to-[#2A1F1A] pointer-events-none select-none" />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent flex flex-col justify-center px-6 md:px-12 text-left pointer-events-none select-none">
              <div className="flex items-center gap-2 select-none">
                <span className={`text-[9px] md:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none ${getBadgeStyle(currentOffer.offerType)}`}>
                  {currentOffer.offerType}
                </span>
                {currentOffer.discountValue > 0 && (
                  <span className="text-[9px] md:text-xs font-black uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full select-none">
                    {currentOffer.discountType === "Percentage" ? `${currentOffer.discountValue}% OFF` : `₹${currentOffer.discountValue} OFF`}
                  </span>
                )}
              </div>

              <h2 className="text-base md:text-2xl font-black text-white leading-tight mt-2.5 select-none">
                {currentOffer.title}
              </h2>
              <p className="text-xs md:text-sm text-gray-300 font-medium mt-1 select-none">
                {currentOffer.subtitle}
              </p>

              {currentOffer.couponCode && (
                <div className="mt-3 select-none">
                  <span className="text-[10px] md:text-xs font-mono font-bold text-white bg-white/20 border border-white/20 px-2.5 py-1 rounded-lg select-none">
                    CODE: {currentOffer.couponCode}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Arrows */}
      {activeOffers.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10"
          >
            <FiChevronLeft className="text-lg md:text-xl" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10"
          >
            <FiChevronRight className="text-lg md:text-xl" />
          </button>
        </>
      )}

      {/* Indicators */}
      {activeOffers.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {activeOffers.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex ? "bg-white w-5" : "bg-white/40 w-1.5"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default OfferCarousel;
