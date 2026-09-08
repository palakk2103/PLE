import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiTag } from "react-icons/fi";
import LazyImage from "../../../../shared/components/LazyImage";
import { getNewArrivals } from "../../data/catalogData";

const NewArrivalsSection = ({ products = null }) => {
  const fallback = getNewArrivals(6);
  const newArrivals = Array.isArray(products) && products.length > 0
    ? products.slice(0, 6)
    : fallback;

  if (newArrivals.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.01 }}
      className="relative mx-0 md:mx-4 my-4 rounded-none md:rounded-3xl overflow-hidden shadow-lg border-t border-b md:border border-gray-100 dark:border-[#7B0A0A]/40 bg-white dark:from-[#1a0f0f] dark:via-[#0d0d0d] dark:to-[#000000] dark:bg-gradient-to-br dark:shadow-[0_8px_32px_rgba(123, 10, 10,0.25)]">
      {/* Animated Gradient Overlay */}
      <motion.div
        className="absolute inset-0 opacity-30 hidden dark:block"
        animate={{
          background: [
            "linear-gradient(45deg, rgba(123, 10, 10,0.15) 0%, transparent 50%)",
            "linear-gradient(135deg, rgba(123, 10, 10,0.15) 0%, transparent 50%)",
            "linear-gradient(225deg, rgba(123, 10, 10,0.15) 0%, transparent 50%)",
            "linear-gradient(315deg, rgba(123, 10, 10,0.15) 0%, transparent 50%)",
            "linear-gradient(45deg, rgba(123, 10, 10,0.15) 0%, transparent 50%)",
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Decorative Background Pattern with Floating Animation */}
      <div className="absolute inset-0 opacity-15 overflow-hidden hidden dark:block">
        <motion.div
          className="absolute top-0 left-0 w-32 h-32 bg-white dark:bg-[#7B0A0A] rounded-full blur-3xl"
          animate={{
            x: [0, 20, 0],
            y: [0, 15, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-24 h-24 bg-white dark:bg-[#7B0A0A] rounded-full blur-2xl"
          animate={{
            x: [0, -15, 0],
            y: [0, -10, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative px-4 py-5">
        {/* Header with Badge */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <motion.div
              className="bg-[#7B0A0A] rounded-full p-3 dark:bg-[#7B0A0A]/30 dark:border dark:border-[#7B0A0A]/50 shadow-md"
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              whileHover={{ scale: 1.15, rotate: 10 }}>
              <motion.div
                animate={{
                  y: [0, -3, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}>
                <FiTag className="text-white dark:text-[#FF4D4D] text-xl" />
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}>
              <h2 className="text-2xl font-extrabold text-[#7B0A0A] dark:text-[#FFFFFF]">
                New Arrivals
              </h2>
              <p className="text-xs text-gray-600 dark:text-[#BBBBBB] font-semibold">
                Fresh products just added
              </p>
            </motion.div>
          </div>
          <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
            <Link
              to="/new-arrivals"
              className="bg-[#7B0A0A] text-white dark:text-[#FFFFFF] text-xs font-bold px-4 py-2 rounded-full hover:bg-[#AE020B] dark:hover:bg-[#7B0A0A]/40 transition-all block dark:bg-[#7B0A0A]/25 dark:border dark:border-[#7B0A0A]/50 shadow-md">
              See All
            </Link>
          </motion.div>
        </div>

        {/* Products Grid - Image Only */}
        <div className="grid grid-cols-3 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 xs:gap-3 md:gap-4">
          {newArrivals.map((product, index) => {
            const productLink = `/product/${product.id}`;
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  delay: index * 0.08,
                  type: "spring",
                  stiffness: 100,
                  damping: 10,
                }}
                className="relative group">
                <Link to={productLink} className="block w-full h-full">
                  <motion.div
                    animate={{
                      boxShadow: [
                        "0 2px 8px rgba(123, 10, 10,0.05)",
                        "0 6px 16px rgba(123, 10, 10,0.12)",
                        "0 2px 8px rgba(123, 10, 10,0.05)",
                      ],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.2,
                    }}
                    className="rounded-2xl overflow-hidden aspect-square bg-gray-50 border border-gray-100 relative dark:bg-[#1a1a1a]/80 dark:border-2 dark:border-[#7B0A0A]/35 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-full h-full relative overflow-hidden">
                      <LazyImage
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => {
                          e.target.src =
                            "https://via.placeholder.com/300x300?text=Product+Image";
                        }}
                      />
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300" />
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default NewArrivalsSection;
