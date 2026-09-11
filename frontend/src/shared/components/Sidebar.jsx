import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiUser,
  FiShoppingBag,
  FiHeart,
  FiMapPin,
  FiMessageSquare,
  FiRefreshCw,
  FiFileText,
  FiBell,
  FiTag,
  FiHelpCircle,
  FiTool,
  FiGift,
  FiChevronDown,
  FiSettings,
  FiLogOut
} from 'react-icons/fi';
import { useCategoryStore } from '../store/categoryStore';
import { useCampaignStore } from '../store/campaignStore';
import { categories as fallbackCategories } from '../../data/categories';
import LucideIcon from './LucideIcon';
import { performUserLogout } from '../utils/userLogout';

/**
 * Reusable slide‑in sidebar with categories support.
 * Props:
 *   isOpen: boolean – controls visibility
 *   onClose: () => void – called when backdrop or close button clicked
 *   user: object (optional) – user data for avatar/name display
 *   onLogout: () => void – logout handler
 */
const Sidebar = ({ isOpen, onClose, user, onLogout }) => {
  const { categories: apiCategories, getRootCategories, initialize } = useCategoryStore();
  const [showCategories, setShowCategories] = useState(false);

  // Initialize categories
  useEffect(() => {
    initialize();
  }, [initialize]);

  const { campaigns, initialize: initCampaigns } = useCampaignStore();
  
  useEffect(() => {
    initCampaigns();
  }, [initCampaigns]);

  const activeFestivalCampaign = useMemo(() => {
    return campaigns.find(c => {
        if (c.type !== 'festival' || !c.isActive) return false;
        const now = new Date();
        const start = new Date(c.startDate);
        const end = new Date(c.endDate);
        return start <= now && end >= now;
    });
  }, [campaigns]);

  const categories = useMemo(() => {
    const roots = getRootCategories().filter((cat) => cat.isActive !== false);
    if (!roots.length) return fallbackCategories;

    return roots.map((cat) => {
      const fallback = fallbackCategories.find(
        (fc) =>
          String(fc.id) === String(cat.id) ||
          String(fc.name || "").toLowerCase() ===
            String(cat.name || "").toLowerCase()
      );

      return {
        ...(fallback || {}),
        ...cat,
        id: String(cat.id ?? cat._id ?? fallback?.id ?? ""),
      };
    });
  }, [apiCategories, getRootCategories]);

  const sidebarContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[99999] flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          {/* Sidebar panel */}
          <motion.div
            className="relative w-64 md:w-80 h-full bg-white dark:bg-[#1A1A1A] shadow-2xl pt-14 pb-4 px-4 overflow-y-auto z-[100000]"
            initial={{ x: '-100%' }}
            animate={{ x: 0, transition: { duration: 0.3 } }}
            exit={{ x: '-100%', transition: { duration: 0.3 } }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 p-1.5 rounded-lg transition-all"
              aria-label="Close sidebar"
            >
              <FiX size={24} />
            </button>

            {/* User Section */}
            {user && (
              <div className="flex items-center gap-2 mb-6 mt-2">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600" />
                )}
                <span className="font-medium text-gray-800 dark:text-white truncate">{user.name || 'User'}</span>
              </div>
            )}

            <nav className="space-y-2">
              {/* Profile & Orders */}
              <Link
                to="/profile"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiUser />
                Profile
              </Link>
              <Link
                to="/orders"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiShoppingBag />
                Orders
              </Link>
              <Link
                to="/wishlist"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiHeart />
                Wishlist
              </Link>
              <Link
                to="/addresses"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiMapPin />
                Addresses
              </Link>
              <Link
                to="/support-tickets"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiMessageSquare />
                Support Tickets
              </Link>
              <Link
                to="/returns"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiRefreshCw />
                My Returns
              </Link>
              <Link
                to="/product-requests"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiFileText />
                Product Requests
              </Link>
              <Link
                to="/notifications"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiBell />
                Notifications
              </Link>
              <Link
                to="/offers"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiTag />
                My Offers
              </Link>
              <Link
                to="/help-support"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiHelpCircle />
                Help & Support
              </Link>
              <Link
                to="/refurbished-categories"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiTool />
                Refurbished
              </Link>
              {activeFestivalCampaign && (
                <Link
                  to="/festival-campaign"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-bold animate-pulse"
                >
                  <FiGift />
                  {activeFestivalCampaign.name}
                </Link>
              )}

              {/* Categories Section - Commented out as requested by client */}
              {/* 
              <div className="my-4 pt-4 border-t border-gray-200 dark:border-white/10">
                <button
                  onClick={() => setShowCategories(!showCategories)}
                  className="flex items-center justify-between w-full px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors font-semibold"
                >
                  <span>Shop by Category</span>
                  <motion.div
                    animate={{ rotate: showCategories ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FiChevronDown />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {showCategories && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 space-y-1">
                        {categories.map((category) => {
                          return (
                            <Link
                              key={category.id}
                              to={`/category/${category.id}`}
                              onClick={onClose}
                              className="flex items-center gap-3 px-5 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-sm"
                            >
                              <LucideIcon name={category.icon} className="text-lg flex-shrink-0" />
                              <span>{category.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              */}

              {/* Settings & Logout */}
              <Link
                to="/settings"
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <FiSettings />
                Settings
              </Link>
              <button
                onClick={() => {
                  if (typeof onLogout === 'function') {
                    onLogout();
                  } else {
                    performUserLogout('/');
                  }
                  onClose();
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
              >
                <FiLogOut />
                Logout
              </button>
            </nav>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(sidebarContent, document.body);
};

export default Sidebar;
