import { Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { categories as fallbackCategories } from "../../../../data/categories";
import LazyImage from "../../../../shared/components/LazyImage";
import { useCategoryStore } from "../../../../shared/store/categoryStore";

const normalizeId = (value) => String(value ?? "").trim();

const MobileCategoryGrid = () => {
  const { categories, initialize, getRootCategories } = useCategoryStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const displayCategories = useMemo(() => {
    const roots = getRootCategories().filter((cat) => cat.isActive !== false);
    if (!roots.length) return fallbackCategories;

    return roots.map((cat) => {
      const fallbackCat = fallbackCategories.find(
        (fc) =>
          normalizeId(fc.id) === normalizeId(cat.id) ||
          fc.name?.toLowerCase() === cat.name?.toLowerCase()
      );
      return {
        ...(fallbackCat || {}),
        ...cat,
        image: cat.image || fallbackCat?.image || "",
      };
    });
  }, [categories, getRootCategories]);

  return (
    <div 
      className="bg-transparent pt-3 pb-3 px-2.5 sm:px-4 md:px-0 overflow-visible relative z-20 select-none mt-2"
    >
      <div className="flex gap-3.5 overflow-x-auto md:flex-wrap md:justify-center scrollbar-hide pb-2 px-1">
        {displayCategories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="flex-shrink-0">
            <Link
              to={`/home?category=${category.id}`}
              className="flex flex-col items-center gap-1.5 w-16 select-none">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-white dark:bg-[#1A1A1A] flex items-center justify-center p-1.5 border border-purple-200 dark:border-[#7B0A0A] shadow-sm dark:shadow-[0_0_8px_rgba(123, 10, 10,0.4)]">
                <LazyImage
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-contain rounded-full"
                  onError={(e) => {
                    e.target.src =
                      "https://via.placeholder.com/64x64?text=Cat";
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-800 dark:text-white text-center mt-2 truncate max-w-full px-0.5">
                {category.name}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default MobileCategoryGrid;
