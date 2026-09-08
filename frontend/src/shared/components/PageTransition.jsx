import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import React from 'react';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

/**
 * Ultra-smooth, GPU-accelerated page transition wrapper.
 * Provides a fluid fade & micro-elevation without horizontal bumping or layout shifting.
 */
const PageTransition = ({ children, className = "" }) => {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      initial="initial"
      animate="animate"
      variants={pageVariants}
      style={{ willChange: 'opacity, transform' }}
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
