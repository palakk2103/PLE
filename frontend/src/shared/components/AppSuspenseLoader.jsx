import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const AppSuspenseLoader = () => {
  const [showFullIndicator, setShowFullIndicator] = useState(false);

  useEffect(() => {
    // Only show the centered brand spinner if loading takes more than 200ms
    // This prevents micro-flashes on fast chunk loads while still providing feedback on slower networks
    const timer = setTimeout(() => {
      setShowFullIndicator(true);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[999999]">
      {/* Sleek Top Progress Bar */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0.8 }}
        animate={{ 
          scaleX: [0, 0.45, 0.75, 0.9],
          opacity: 1
        }}
        transition={{
          duration: 1.5,
          ease: [0.1, 0.25, 0.3, 1],
        }}
        style={{ originX: 0 }}
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#9B1C1C] via-[#AE020B] to-[#FF4D4D] shadow-[0_0_8px_rgba(174,2,11,0.5)]"
      />

      {/* Gentle center pulse loader if chunk download takes >200ms */}
      <AnimatePresence>
        {showFullIndicator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 flex flex-col items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-[2px]"
          >
            <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/90 dark:bg-[#141414]/90 shadow-xl border border-gray-100/80 dark:border-neutral-800">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-neutral-700" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-2 border-t-[#AE020B] border-r-[#AE020B] border-transparent"
                />
              </div>
              <span className="text-[11px] font-bold text-gray-500 dark:text-neutral-400">
                Loading...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppSuspenseLoader;
