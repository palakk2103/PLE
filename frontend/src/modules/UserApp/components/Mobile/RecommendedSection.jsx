import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiThumbsUp, FiArrowRight } from "react-icons/fi";
import ProductCard from "../../../../shared/components/ProductCard";
import { getRecommendedProducts } from "../../data/catalogData";

const RecommendedSection = ({ products = null }) => {
  const recommended = useMemo(() => {
    if (Array.isArray(products) && products.length > 0) {
      return products.slice(0, 6);
    }
    return getRecommendedProducts(6);
  }, [products]);

  if (recommended.length === 0) {
    return null;
  }

  return (
    <div className="relative overflow-hidden px-4 py-5 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/40 dark:from-dark-card dark:via-[#141414] dark:to-dark-bg rounded-2xl mx-2 dark:border dark:border-dark-accent/20 dark:shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
      {/* Decorative Background Pattern with Floating Animation */}
      <div className="absolute inset-0 opacity-10 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 right-0 w-24 h-24 bg-white dark:bg-dark-accent/10 rounded-full blur-2xl"
          animate={{
            x: [0, -10, 0],
            y: [0, 10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="relative z-10 flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-500 dark:from-dark-accent dark:to-[#AA1010] rounded-xl shadow-md dark:shadow-[0_0_15px_rgba(123, 10, 10,0.3)]">
            <FiThumbsUp className="text-white dark:text-[#FFFFFF] text-lg" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#FFFFFF] leading-tight">
              Recommended for You
            </h2>
            <p className="text-xs text-gray-500 dark:text-[#888888] mt-0.5">Curated just for you</p>
          </div>
        </div>
        <Link
          to="/search"
          className="flex items-center gap-1 text-sm text-primary-600 dark:text-dark-accent font-semibold hover:text-primary-700 dark:hover:text-dark-accent-hover transition-colors active:scale-95">
          <span>See All</span>
          <FiArrowRight className="text-sm" />
        </Link>
      </div>
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 xs:gap-3 md:gap-4">
        {recommended.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <ProductCard product={product} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RecommendedSection;
