import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOffers } from "../hooks/useOffers";
import { OfferStatsCard } from "../components/OfferStatsCard";
import { FiPercent, FiCheckCircle, FiClock, FiXCircle, FiUser, FiActivity, FiArrowUpRight, FiTag } from "react-icons/fi";
import { useAdminAuthStore } from "../../Admin/store/adminStore";
import { ADMIN_BASE_ROUTE, getAdminPath } from "../../Admin/config/adminRoutesConfig";
import { useVendorAuthStore } from "../../Vendor/store/vendorAuthStore";

export const OfferDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith(ADMIN_BASE_ROUTE) || location.pathname.startsWith("/admin");
  
  const { admin } = useAdminAuthStore();
  const { vendor } = useVendorAuthStore();
  
  const sellerName = vendor?.storeName || vendor?.name || "Fashion Hub";
  
  const { getDashboardStats, getSellerDashboardStats, offers } = useOffers();
  
  const stats = isAdmin 
    ? getDashboardStats() 
    : getSellerDashboardStats(sellerName);

  const baseRoute = isAdmin ? getAdminPath("offers-management") : "/vendor/my-offers";

  // Mock analytics for Seller/Admin dashboard charts
  const mockMonthlyData = [
    { month: "Jan", views: 240, clicks: 120, sales: 45 },
    { month: "Feb", views: 360, clicks: 180, sales: 60 },
    { month: "Mar", views: 480, clicks: 210, sales: 78 },
    { month: "Apr", views: 600, clicks: 320, sales: 110 },
    { month: "May", views: 850, clicks: 490, sales: 165 },
    { month: "Jun", views: 980, clicks: 540, sales: 190 }
  ];

  return (
    <div className="p-6 bg-[#1A1310] min-h-screen text-white space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            {isAdmin ? "Offers Management Dashboard" : "My Offers Dashboard"}
          </h1>
          <p className="text-sm text-[#8E7768] mt-1">
            {isAdmin 
              ? "Oversee site-wide promotion campaigns, coupon codes, and bank partnerships."
              : `Manage discounts, clearance deals, and customer benefits for ${sellerName}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`${baseRoute}/list`)}
            className="px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-sm font-bold transition-all text-[#C8B3A3]"
          >
            View Offers List
          </button>
          <button
            onClick={() => navigate(`${baseRoute}/create`)}
            className="px-5 py-2.5 bg-[#C07A3D] hover:bg-[#C07A3D]/90 rounded-xl text-sm font-bold transition-all shadow-md"
          >
            Create Offer
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <OfferStatsCard title="Total Offers" value={stats.total} icon={FiPercent} color="primary" />
        <OfferStatsCard title="Active Offers" value={stats.active} icon={FiCheckCircle} color="green" />
        <OfferStatsCard title="Expired Offers" value={stats.expired} icon={FiXCircle} color="red" />
        <OfferStatsCard title="Scheduled Offers" value={stats.scheduled} icon={FiClock} color="blue" />
        {isAdmin ? (
          <>
            <OfferStatsCard title="Admin Campaigns" value={stats.admin} icon={FiActivity} color="purple" />
            <OfferStatsCard title="Seller Campaigns" value={stats.seller} icon={FiUser} color="amber" />
          </>
        ) : (
          <>
            <OfferStatsCard title="Total Views" value="4.8K" icon={FiActivity} color="purple" />
            <OfferStatsCard title="Total Clicks" value="1.2K" icon={FiArrowUpRight} color="amber" />
          </>
        )}
      </div>

      {/* Analytics Placeholder Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Performance Chart Placeholder */}
        <div className="lg:col-span-2 bg-[#120D0B] border border-white/[0.06] rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-md font-bold text-white uppercase tracking-wider">Campaign Analytics</h3>
              <p className="text-xs text-[#8E7768]">View rates, click-through rates, and promotional sales</p>
            </div>
            <span className="text-xs font-bold text-[#C07A3D] bg-[#C07A3D]/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Live Feed
            </span>
          </div>

          {/* Styled Mock Chart */}
          <div className="h-64 flex flex-col justify-between pt-4">
            <div className="flex-1 flex items-end justify-between gap-2.5 px-4">
              {mockMonthlyData.map((data, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full flex items-end gap-1 justify-center h-48">
                    {/* Views Bar */}
                    <div 
                      style={{ height: `${(data.views / 1000) * 100}%` }}
                      className="w-3 md:w-5 bg-white/[0.06] group-hover:bg-[#C07A3D]/30 rounded-t-md transition-all duration-300 relative"
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#1A1310] border border-white/[0.06] px-1.5 py-0.5 rounded text-[9px] opacity-0 group-hover:opacity-100 transition-all font-bold whitespace-nowrap z-10">
                        {data.views} views
                      </span>
                    </div>
                    {/* Clicks Bar */}
                    <div 
                      style={{ height: `${(data.clicks / 1000) * 100}%` }}
                      className="w-3 md:w-5 bg-[#C07A3D]/50 group-hover:bg-[#C07A3D] rounded-t-md transition-all duration-300 relative"
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#1A1310] border border-white/[0.06] px-1.5 py-0.5 rounded text-[9px] opacity-0 group-hover:opacity-100 transition-all font-bold whitespace-nowrap z-10">
                        {data.clicks} clicks
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-[#8E7768] font-bold mt-1">{data.month}</span>
                </div>
              ))}
            </div>
            
            {/* Chart Legend */}
            <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-white/[0.04] text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-white/[0.06] border border-white/[0.1]"></span>
                <span className="text-[#8E7768]">Impressions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-[#C07A3D]"></span>
                <span className="text-[#8E7768]">Clicks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Conversion Analytics Placeholder */}
        <div className="bg-[#120D0B] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-md font-bold text-white uppercase tracking-wider mb-4">Conversion Rate</h3>
            
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative w-36 h-36 rounded-full border-[10px] border-white/[0.04] flex items-center justify-center">
                {/* Circular indicator mock */}
                <div className="absolute inset-0 rounded-full border-[10px] border-t-[#C07A3D] border-r-[#C07A3D] border-b-transparent border-l-transparent -m-[10px] rotate-45"></div>
                <div className="text-center">
                  <span className="text-3xl font-black text-white">4.2%</span>
                  <p className="text-[10px] text-[#8E7768] font-bold uppercase mt-1">Average CTR</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3.5 mt-4">
            <div className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
              <span className="text-[#8E7768]">Conversion Rate</span>
              <span className="font-bold text-green-500">+12.4% ↑</span>
            </div>
            <div className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
              <span className="text-[#8E7768]">Top Performing Offer</span>
              <span className="font-bold text-[#C07A3D]">FESTIVAL20</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferDashboard;
