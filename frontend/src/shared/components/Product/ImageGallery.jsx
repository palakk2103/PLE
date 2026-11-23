import { useState } from "react";
import { FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import LazyImage from "../LazyImage";
import useSwipeGesture from "../../../modules/UserApp/hooks/useSwipeGesture";

const ImageGallery = ({ images, productName = "Product", children }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Ensure images is an array
  const imageArray =
    Array.isArray(images) && images.length > 0
      ? images
      : [images].filter(Boolean);

  if (imageArray.length === 0) {
    return (
      <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
        <p className="text-gray-400">No image available</p>
      </div>
    );
  }

  const handleThumbnailClick = (index) => {
    setSelectedIndex(index);
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % imageArray.length);
  };

  const handlePrevious = () => {
    setSelectedIndex(
      (prev) => (prev - 1 + imageArray.length) % imageArray.length
    );
  };

  const handleImageClick = () => {
    setIsLightboxOpen(true);
  };

  // Swipe gestures for image navigation
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrevious,
    threshold: 50,
  });

  return (
    <>
      <div className="w-full flex flex-col gap-6">
        {/* Main Image */}
        <div
          className="relative w-full aspect-square bg-white rounded-3xl p-4 shadow-sm border border-gray-100 overflow-hidden"
          data-gallery>
          <motion.div
            key={selectedIndex}
            className="w-full h-full"
            onClick={handleImageClick}
            onTouchStart={swipeHandlers.onTouchStart}
            onTouchMove={swipeHandlers.onTouchMove}
            onTouchEnd={swipeHandlers.onTouchEnd}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}>
            <LazyImage
              src={imageArray[selectedIndex]}
              alt={`${productName} - Image ${selectedIndex + 1}`}
              className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal"
              onError={(e) => {
                e.target.src =
                  "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/%3E%3Ccircle cx=%2234%22 cy=%2236%22 r=%228%22 fill=%22%23d1d5db%22/%3E%3Cpath d=%22M12 80l24-28 16 18 12-13 24 23z%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E";
              }}
            />
          </motion.div>

          {/* Navigation Arrows (Mobile Only) */}
          {imageArray.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:bg-white hover:scale-110 lg:hidden">
                <FiChevronLeft className="text-gray-800 text-xl" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:bg-white hover:scale-110 lg:hidden">
                <FiChevronRight className="text-gray-800 text-xl" />
              </button>
            </>
          )}

          {/* Zoom Hint */}
          <div className="absolute bottom-4 right-4 bg-white/90 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 shadow-sm pointer-events-none opacity-0 lg:opacity-100 transition-opacity">
            Click to zoom
          </div>
        </div>

        {/* Action Buttons / Badge Area (Injected via children) */}
        {children}

        {/* Thumbnails Row */}
        {imageArray.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory justify-start">
            {imageArray.map((image, index) => (
              <button
                key={index}
                onClick={() => handleThumbnailClick(index)}
                className={`w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-300 snap-start ${selectedIndex === index
                  ? "border-primary-600 ring-2 ring-primary-50 ring-offset-2"
                  : "border-transparent hover:border-gray-300"
                  }`}>
                <LazyImage
                  src={image}
                  alt={`${productName} thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src =
                      "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/%3E%3Ccircle cx=%2234%22 cy=%2236%22 r=%228%22 fill=%22%23d1d5db%22/%3E%3Cpath d=%22M12 80l24-28 16 18 12-13 24 23z%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E";
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
            onClick={() => setIsLightboxOpen(false)}>
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-4 right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white transition-colors z-10">
              <FiX className="text-2xl" />
            </button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-7xl max-h-[90vh] w-full">
              <img
                src={imageArray[selectedIndex]}
                alt={`${productName} - Full view`}
                className="w-full h-full object-contain max-h-[90vh] rounded-lg"
                onError={(e) => {
                  e.target.src =
                    "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/%3E%3Ccircle cx=%2234%22 cy=%2236%22 r=%228%22 fill=%22%23d1d5db%22/%3E%3Cpath d=%22M12 80l24-28 16 18 12-13 24 23z%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E";
                }}
              />

              {/* Navigation in Lightbox */}
              {imageArray.length > 1 && (
                <>
                  <button
                    onClick={handlePrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white transition-colors">
                    <FiChevronLeft className="text-2xl" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white transition-colors">
                    <FiChevronRight className="text-2xl" />
                  </button>
                </>
              )}

              {/* Image Counter */}
              {imageArray.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
                  {selectedIndex + 1} / {imageArray.length}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ImageGallery;
