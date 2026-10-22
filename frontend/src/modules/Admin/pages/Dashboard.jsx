import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import StatsCards from "../components/Analytics/StatsCards";
import RevenueBreakdownCards from "../components/Analytics/RevenueBreakdownCards";
import { FiBriefcase, FiPackage, FiShoppingBag, FiTrendingUp } from "react-icons/fi";
import RevenueLineChart from "../components/Analytics/RevenueLineChart";
import SalesBarChart from "../components/Analytics/SalesBarChart";
import OrderStatusPieChart from "../components/Analytics/OrderStatusPieChart";
import CustomerGrowthAreaChart from "../components/Analytics/CustomerGrowthAreaChart";
import RevenueVsOrdersChart from "../components/Analytics/RevenueVsOrdersChart";
import TopProducts from "../components/Analytics/TopProducts";
import RecentOrders from "../components/Analytics/RecentOrders";
import TimePeriodFilter from "../components/Analytics/TimePeriodFilter";
import ExportButton from "../components/ExportButton";
import { formatCurrency } from "../utils/adminHelpers";
import {
  getDashboardStats,
  getB2bOverviewStats,
  getRevenueData,
  getOrderStatusBreakdown,
  getTopProducts,
  getCustomerGrowth,
  getRecentOrders,
} from "../services/adminService";

const Dashboard = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalRevenue: 0,
    inHouseRevenue: 0,
    vendorGrossRevenue: 0,
    adminCommission: 0,
    vendorNetEarnings: 0,
    totalAdminRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalVendors: 0,
    pendingOrders: 0,
    totalSellers: 0,
    gstSellers: 0,
    nonGstSellers: 0,
    msmeSellers: 0,
    homeBusinesses: 0,
    pendingVerification: 0,
    approvedSellers: 0,
    rejectedSellers: 0,
  });
  const [b2bStats, setB2bStats] = useState({
    b2bUsers: 0,
    b2bProducts: 0,
    b2bOrders: 0,
    b2bRevenue: 0,
  });
  const [revenueData, setRevenueData] = useState([]);

  const mapUiPeriodToApiPeriod = (uiPeriod) => {
    if (uiPeriod === "today" || uiPeriod === "week") return "daily";
    if (uiPeriod === "month") return "weekly";
    return "monthly";
  };

  const getDateFromBucket = (bucket = "", apiPeriod = "monthly") => {
    if (!bucket) return new Date();

    if (apiPeriod === "daily") {
      const d = new Date(bucket);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    }

    if (apiPeriod === "weekly") {
      const [yearStr, weekStr] = String(bucket).split("-");
      const year = Number(yearStr);
      const week = Number(weekStr);
      if (Number.isNaN(year) || Number.isNaN(week)) return new Date();

      const firstDay = new Date(year, 0, 1);
      const dayOffset = (week - 1) * 7;
      return new Date(
        firstDay.getFullYear(),
        firstDay.getMonth(),
        firstDay.getDate() + dayOffset
      );
    }

    const monthlyDate = new Date(`${bucket}-01`);
    return Number.isNaN(monthlyDate.getTime()) ? new Date() : monthlyDate;
  };

  const normalizeRevenueData = (data, apiPeriod) =>
    (data || []).map((item) => ({
      date: getDateFromBucket(item._id, apiPeriod).toISOString(),
      bucket: item._id || "",
      revenue: item.revenue || 0,
      orders: item.orders || 0,
    }));

  const [orderStatusData, setOrderStatusData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [customerGrowth, setCustomerGrowth] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  const getDateRangeForPeriod = (uiPeriod) => {
    const now = new Date();
    const endDate = now.toISOString();
    let startDate;

    if (uiPeriod === "today" || uiPeriod === "day") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      startDate = start.toISOString();
    } else if (uiPeriod === "week") {
      const start = new Date(now);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      startDate = start.toISOString();
    } else if (uiPeriod === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = start.toISOString();
    } else if (uiPeriod === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      startDate = start.toISOString();
    }
    
    return { startDate, endDate };
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const apiPeriod = mapUiPeriodToApiPeriod(period);
      const dateParams = getDateRangeForPeriod(period);

      const [
        statsRes,
        b2bRes,
        revenueRes,
        orderStatusRes,
        topProductsRes,
        customerGrowthRes,
        recentOrdersRes,
      ] = await Promise.allSettled([
        getDashboardStats(dateParams),
        getB2bOverviewStats(dateParams),
        getRevenueData(apiPeriod),
        getOrderStatusBreakdown(dateParams),
        getTopProducts(dateParams),
        getCustomerGrowth(apiPeriod),
        getRecentOrders(dateParams),
      ]);

      if (statsRes.status === "fulfilled") {
        const d = statsRes.value.data;
        setStats({
          totalRevenue: d.totalRevenue || 0,
          inHouseRevenue: d.inHouseRevenue || 0,
          vendorGrossRevenue: d.vendorGrossRevenue || 0,
          adminCommission: d.adminCommission || 0,
          vendorNetEarnings: d.vendorNetEarnings || 0,
          totalAdminRevenue: d.totalAdminRevenue || 0,
          totalOrders: d.totalOrders || 0,
          totalProducts: d.totalProducts || 0,
          totalCustomers: d.totalUsers || 0,
          totalVendors: d.totalVendors || 0,
          pendingOrders: d.pendingOrders || 0,
          totalSellers: d.totalSellers || 0,
          gstSellers: d.gstSellers || 0,
          nonGstSellers: d.nonGstSellers || 0,
          msmeSellers: d.msmeSellers || 0,
          homeBusinesses: d.homeBusinesses || 0,
          pendingVerification: d.pendingVerification || 0,
          approvedSellers: d.approvedSellers || 0,
          rejectedSellers: d.rejectedSellers || 0,
        });
      } else {
        setStats({
          totalRevenue: 0,
          inHouseRevenue: 0,
          vendorGrossRevenue: 0,
          adminCommission: 0,
          vendorNetEarnings: 0,
          totalAdminRevenue: 0,
          totalOrders: 0,
          totalProducts: 0,
          totalCustomers: 0,
          totalVendors: 0,
          pendingOrders: 0,
          totalSellers: 0,
          gstSellers: 0,
          nonGstSellers: 0,
          msmeSellers: 0,
          homeBusinesses: 0,
          pendingVerification: 0,
          approvedSellers: 0,
          rejectedSellers: 0,
        });
      }
      
      if (b2bRes.status === "fulfilled") {
        const bd = b2bRes.value.data;
        setB2bStats({
          b2bUsers: bd.b2bUsers || 0,
          b2bProducts: bd.b2bProducts || 0,
          b2bOrders: bd.b2bOrders || 0,
          b2bRevenue: bd.b2bRevenue || 0,
        });
      } else {
        setB2bStats({
          b2bUsers: 0,
          b2bProducts: 0,
          b2bOrders: 0,
          b2bRevenue: 0,
        });
      }

      if (revenueRes.status === "fulfilled") {
        setRevenueData(normalizeRevenueData(revenueRes.value.data, apiPeriod));
      } else {
        setRevenueData([]);
      }
      if (orderStatusRes.status === "fulfilled") {
        setOrderStatusData(orderStatusRes.value.data || []);
      } else {
        setOrderStatusData([]);
      }
      if (topProductsRes.status === "fulfilled") {
        setTopProducts(topProductsRes.value.data || []);
      } else {
        setTopProducts([]);
      }
      if (customerGrowthRes.status === "fulfilled") {
        setCustomerGrowth(customerGrowthRes.value.data || []);
      } else {
        setCustomerGrowth([]);
      }
      if (recentOrdersRes.status === "fulfilled") {
        setRecentOrders(recentOrdersRes.value.data || []);
      } else {
        setRecentOrders([]);
      }
    } catch (error) {
      // Don't toast here as api.js interceptor handled global errors
      // or to avoid 6+ toasts if all parallel requests fail simultaneously
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-2">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Welcome back! Here's your business overview.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full">
          <TimePeriodFilter selectedPeriod={period} onPeriodChange={setPeriod} />
          <ExportButton
            data={revenueData}
            headers={[
              { label: "Period", accessor: (row) => row.bucket || row.date },
              { label: "Revenue", accessor: (row) => formatCurrency(row.revenue) },
              { label: "Orders", accessor: (row) => row.orders },
            ]}
            filename="revenue_report"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Revenue & Earnings Breakdown (In-House vs Vendors) */}
      <RevenueBreakdownCards stats={stats} />

      {/* Business Verification & Seller Overview */}
      <div className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white px-1 flex items-center gap-2">
          <span className="w-2.5 h-5 bg-purple-600 rounded-full inline-block"></span>
          Business Verification & Seller Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-indigo-100 dark:border-indigo-800/40 relative overflow-hidden">
            <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">Total Sellers</h3>
            <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{stats.totalSellers}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-green-100 dark:border-green-800/40 relative overflow-hidden">
            <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">GST Sellers</h3>
            <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{stats.gstSellers}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-blue-100 dark:border-blue-800/40 relative overflow-hidden">
            <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">Non-GST Sellers</h3>
            <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{stats.nonGstSellers}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-amber-100 dark:border-amber-800/40 relative overflow-hidden">
            <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">MSME Sellers</h3>
            <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{stats.msmeSellers}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-purple-100 dark:border-purple-800/40 relative overflow-hidden">
            <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">Home Businesses</h3>
            <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{stats.homeBusinesses}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/40 dark:to-amber-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-yellow-100 dark:border-yellow-800/40 relative overflow-hidden animate-pulse">
            <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">Pending Verification</h3>
            <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{stats.pendingVerification}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-emerald-100 dark:border-emerald-800/40 relative overflow-hidden">
            <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">Approved Sellers</h3>
            <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{stats.approvedSellers}</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-red-100 dark:border-red-800/40 relative overflow-hidden">
            <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">Rejected Sellers</h3>
            <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{stats.rejectedSellers}</p>
          </div>
        </div>
      </div>

      {/* B2B Marketplace Overview */}
      <div className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white px-1 flex items-center gap-2">
          <span className="w-2.5 h-5 bg-[#C07A3D] rounded-full inline-block"></span>
          B2B Marketplace Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-amber-100 dark:border-amber-800/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden cursor-pointer"
            onClick={() => navigate("/ple-ops-desk/b2b/business-users")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500 to-orange-600 opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 sm:p-3 rounded-lg shadow-md text-white">
                <FiBriefcase className="text-lg sm:text-xl" />
              </div>
              <div className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                +2 new
              </div>
            </div>
            <div className="relative z-10">
              <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">Business Users</h3>
              <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{b2bStats.b2bUsers}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-teal-100 dark:border-teal-800/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden cursor-pointer"
            onClick={() => navigate("/ple-ops-desk/b2b/b2b-products")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-500 to-emerald-600 opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
              <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-2.5 sm:p-3 rounded-lg shadow-md text-white">
                <FiPackage className="text-lg sm:text-xl" />
              </div>
              <div className="text-xs font-semibold px-2 py-1 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                34 listed
              </div>
            </div>
            <div className="relative z-10">
              <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">B2B Products</h3>
              <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{b2bStats.b2bProducts}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-indigo-100 dark:border-indigo-800/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden cursor-pointer"
            onClick={() => navigate("/ple-ops-desk/b2b/b2b-orders")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500 to-blue-600 opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
              <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2.5 sm:p-3 rounded-lg shadow-md text-white">
                <FiShoppingBag className="text-lg sm:text-xl" />
              </div>
              <div className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                8 orders
              </div>
            </div>
            <div className="relative z-10">
              <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">B2B Orders</h3>
              <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{b2bStats.b2bOrders}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-900/30 rounded-xl p-4 sm:p-6 shadow-md border border-emerald-100 dark:border-emerald-800/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden cursor-pointer"
            onClick={() => navigate("/ple-ops-desk/b2b/b2b-orders")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500 to-green-600 opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 sm:p-3 rounded-lg shadow-md text-white">
                <FiTrendingUp className="text-lg sm:text-xl" />
              </div>
              <div className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                Target: 80%
              </div>
            </div>
            <div className="relative z-10">
              <h3 className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium mb-1">B2B Revenue</h3>
              <p className="text-gray-800 dark:text-white text-xl sm:text-2xl font-bold">{formatCurrency(b2bStats.b2bRevenue)}</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueLineChart data={revenueData} period={period} />
        <SalesBarChart data={revenueData} period={period} />
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueVsOrdersChart data={revenueData} period={period} />
        <OrderStatusPieChart data={orderStatusData} />
      </div>

      {/* Customer Growth Chart */}
      <div className="grid grid-cols-1 gap-6">
        <CustomerGrowthAreaChart data={customerGrowth} period={period} />
      </div>

      {/* Products and Orders Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopProducts products={topProducts} />
        <RecentOrders
          orders={recentOrders}
          onViewOrder={(order) => navigate(`/ple-ops-desk/orders/${order._id || order.orderId}`)}
        />
      </div>
    </motion.div>
  );
};

export default Dashboard;
