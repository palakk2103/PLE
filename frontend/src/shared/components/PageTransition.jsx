import { motion } from 'framer-motion';
import React from 'react';

/**
 * Ultra-smooth, lightweight page transition wrapper.
 * Provides a fluid micro-fade without jarring vertical bumping, blank flashes, or layout shifting.
 */
const PageTransition = ({ children, className = "" }) => {
  return (
    <motion.div
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.12,
        ease: "easeOut",
      }}
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
