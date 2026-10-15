import React, { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLayout, FiBarChart2, FiCrosshair, FiFolder, FiChevronRight } from 'react-icons/fi';
import { usePortfolioPageStore } from '../../store/portfolioPageStore';
import { getAdminPath, ADMIN_DASHBOARD_ROUTE } from '../../config/adminRoutesConfig';

// Import Editors
import HeroEditor from './components/HeroEditor';
import MetricsEditor from './components/MetricsEditor';
import CTAEditor from './components/CTAEditor';
import PortfolioCMS from '../cms/PortfolioCMS';

export default function PortfolioPageDashboard() {
  const location = useLocation();
  const { fetchContent, loading } = usePortfolioPageStore();

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const SECTIONS = [
    { id: 'hero', title: 'Hero Section', icon: FiLayout, path: 'hero', color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'metrics', title: 'Metrics Section', icon: FiBarChart2, path: 'metrics', color: 'text-green-500', bg: 'bg-green-50' },
    { id: 'cta', title: 'Call to Action', icon: FiCrosshair, path: 'cta', color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'projects', title: 'Portfolio Projects', icon: FiFolder, path: 'projects', color: 'text-purple-500', bg: 'bg-purple-50' }
  ];

  if (loading && location.pathname === getAdminPath('portfolio-page')) {
    return <div className="p-8 flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="mb-8 flex items-center text-sm text-gray-500">
        <Link to={ADMIN_DASHBOARD_ROUTE} className="hover:text-primary">Dashboard</Link>
        <FiChevronRight className="mx-2" />
        <Link to={getAdminPath('portfolio-page')} className={`hover:text-primary ${location.pathname === getAdminPath('portfolio-page') ? 'text-gray-900 font-semibold' : ''}`}>
          Portfolio Page
        </Link>
      </div>

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Main Dashboard Grid */}
          <Route path="/" element={
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Portfolio Page Content</h1>
                <p className="text-gray-500 mt-1">Manage the sections and project showcases of your portfolio page.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  return (
                    <Link 
                      key={section.id} 
                      to={section.path}
                      className="block group"
                    >
                      <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md hover:border-primary/30 transition-all duration-300">
                        <div className={`w-12 h-12 rounded-lg ${section.bg} ${section.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 group-hover:text-primary transition-colors">{section.title}</h3>
                        <p className="text-sm text-gray-500 mt-1 flex items-center justify-between">
                          Edit section <FiChevronRight className="transform group-hover:translate-x-1 transition-transform" />
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          } />

          {/* Editor Routes */}
          <Route path="hero" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><HeroEditor /></motion.div>} />
          <Route path="metrics" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><MetricsEditor /></motion.div>} />
          <Route path="cta" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><CTAEditor /></motion.div>} />
          <Route path="projects" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><PortfolioCMS /></motion.div>} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
