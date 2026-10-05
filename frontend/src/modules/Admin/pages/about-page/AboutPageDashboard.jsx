import React, { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLayout, FiImage, FiGrid, FiFeather, FiStar, FiChevronRight } from 'react-icons/fi';
import { useAboutPageStore } from '../../store/aboutPageStore';

// Import Editors
import HeroEditor from './HeroEditor';
import CompanyEditor from './CompanyEditor';
import WhatWeDoEditor from './WhatWeDoEditor';
import VisionMissionEditor from './VisionMissionEditor';
import OurEdgeEditor from './OurEdgeEditor';

export default function AboutPageDashboard() {
  const location = useLocation();
  const { fetchInitialData, isLoading } = useAboutPageStore();

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const SECTIONS = [
    { id: 'hero', title: 'Hero Section', desc: 'Main titles, stats, and background image', icon: FiLayout, path: 'hero', color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'company', title: 'About Company', desc: 'Founder info, dual images, and core paragraphs', icon: FiImage, path: 'company', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'what-we-do', title: 'What We Do', desc: 'Grid of features (Smart Shopping, etc)', icon: FiGrid, path: 'what-we-do', color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'vision-mission', title: 'Vision & Mission', desc: 'Company vision and mission statements', icon: FiFeather, path: 'vision-mission', color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'our-edge', title: 'Our Edge', desc: 'Why shoppers trust PLE (4 steps)', icon: FiStar, path: 'our-edge', color: 'text-rose-500', bg: 'bg-rose-50' },
  ];

  if (isLoading && location.pathname === '/admin/about-page') {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C07A3D]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center text-sm text-gray-500">
        <Link to="/admin" className="hover:text-[#C07A3D]">Dashboard</Link>
        <FiChevronRight className="mx-2" />
        <Link to="/admin/about-page" className={`hover:text-[#C07A3D] ${location.pathname === '/admin/about-page' ? 'text-gray-900 font-semibold' : ''}`}>
          About Page CMS
        </Link>
      </div>

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Main Dashboard Grid */}
          <Route
            path="/"
            element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">About Page CMS</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Manage sections and content for the About Page</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    return (
                      <Link
                        key={section.id}
                        to={section.path}
                        className="block group"
                      >
                        <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all duration-200 hover:border-[#C07A3D]/40 h-full">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${section.bg} ${section.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                              <Icon size={20} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-gray-800 group-hover:text-[#C07A3D] transition-colors">{section.title}</h3>
                              <p className="text-xs text-gray-500 mt-0.5">{section.desc}</p>
                            </div>
                          </div>
                          <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-[#C07A3D] font-medium">
                            <span>Edit Section</span>
                            <FiChevronRight className="transform group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            }
          />

          {/* Section Editors */}
          <Route path="hero" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><HeroEditor /></motion.div>} />
          <Route path="company" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><CompanyEditor /></motion.div>} />
          <Route path="what-we-do" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><WhatWeDoEditor /></motion.div>} />
          <Route path="vision-mission" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><VisionMissionEditor /></motion.div>} />
          <Route path="our-edge" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><OurEdgeEditor /></motion.div>} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
