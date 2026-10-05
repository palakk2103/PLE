import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUsers,
  FiShoppingBag,
  FiFileText,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiArrowUpRight,
  FiRefreshCw,
  FiEye,
  FiShield,
  FiTrendingUp,
  FiDollarSign,
  FiBriefcase,
  FiLayers,
} from "react-icons/fi";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { getB2BAnalytics } from "../../services/adminService";
import { formatPrice } from "../../../../shared/utils/helpers";
import toast from "react-hot-toast";

const STATUS_COLORS = {
  Approved: "#10B981", // green-500
  "Pending Verification": "#F59E0B", // amber-500
  Rejected: "#EF4444", // red-500
  Suspended: "#6B7280", // gray-500
};

const BAR_COLORS = [
  "#3B82F6", // blue-500
  "#8B5CF6", // purple-500
  "#EC4899", // pink-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#06B6D4", // cyan-500
  "#6366F1", // indigo-500
];

const B2BAnalytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);

  const fetchAnalytics = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const response = await getB2BAnalytics();
      const payload = response?.data || response;
      setData(payload);
    } catch (err) {
      console.error("Failed to load B2B Analytics:", err);
      toast.error("Failed to load B2B Analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const kpis = useMemo(() => {
    return (
      data?.kpis || {
        totalCompanies: 0,
        approvedCompanies: 0,
        pendingCompanies: 0,
        rejectedCompanies: 0,
        suspendedCompanies: 0,
        activeCompanies: 0,
        totalEmployees: 0,
        totalOrders: 0,
        totalRevenue: 0,
        aov: 0,
        totalRFQs: 0,
        totalPOs: 0,
      }
    );
  }, [data]);

  const verificationChartData = useMemo(() => {
    if (!data?.verificationBreakdown) return [];
    return data.verificationBreakdown
      .filter((item) => item.count > 0)
      .map((item) => ({
        name: item.status,
        value: item.count,
        color: STATUS_COLORS[item.status] || item.color || "#6B7280",
      }));
  }, [data]);

  const companyTypeChartData = useMemo(() => {
    if (!data?.companyTypeDistribution) return [];
    return data.companyTypeDistribution.map((item, idx) => ({
      name: item.type,
      count: item.count,
      fill: BAR_COLORS[idx % BAR_COLORS.length],
    }));
  }, [data]);

  const growthTrend = useMemo(() => {
    return data?.growthTrend || [];
  }, [data]);

  const topCompanies = useMemo(() => {
    return data?.topCompanies || [];
  }, [data]);

  const recentRegistrations = useMemo(() => {
    return data?.recentRegistrations || [];
  }, [data]);

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const p = payload[0];
      const total = verificationChartData.reduce((acc, c) => acc + c.value, 0);
      const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-gray-100 text-xs sm:text-sm">
          <p className="font-semibold text-gray-800">{p.name}</p>
          <p className="text-gray-600 mt-0.5">
            <span className="font-bold text-gray-900">{p.value}</span> companies ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomAreaTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-gray-100 text-xs sm:text-sm">
          <p className="font-semibold text-gray-800">{label}</p>
          <p className="text-blue-600 font-bold mt-0.5">
            {payload[0].value} New Registrations
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
        <p className="text-sm font-medium text-gray-500 animate-pulse">
          Loading B2B Analytics & Business Intelligence...
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-12"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <FiTrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                B2B Analytics
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Corporate clients, verification pipeline, procurement volume, and workforce telemetry
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200/80 transition-all shadow-sm active:scale-95"
            title="Refresh Data"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            onClick={() => navigate("/admin/b2b-users/pending")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all active:scale-95"
          >
            <FiClock className="w-4 h-4" />
            <span>Pending Approvals ({kpis.pendingCompanies || 0})</span>
          </button>

          <button
            onClick={() => navigate("/admin/b2b-users/manage")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <FiUsers className="w-4 h-4" />
            <span>Manage Companies</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Total B2B Companies */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-5 rounded-2xl sm:rounded-3xl shadow-lg shadow-blue-500/20"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-blue-100/90">
                Total B2B Companies
              </p>
              <h3 className="text-2xl sm:text-3xl font-black mt-1">
                {kpis.totalCompanies}
              </h3>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md">
              <FiBriefcase className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-blue-100 pt-3 border-t border-white/15">
            <span>Verified: <strong className="text-white">{kpis.approvedCompanies}</strong></span>
            <span>Active: <strong className="text-white">{kpis.activeCompanies}</strong></span>
          </div>
        </motion.div>

        {/* Pending Approvals */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 text-white p-5 rounded-2xl sm:rounded-3xl shadow-lg shadow-amber-500/20"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-amber-100/90">
                Pending Verification
              </p>
              <h3 className="text-2xl sm:text-3xl font-black mt-1">
                {kpis.pendingCompanies}
              </h3>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md">
              <FiClock className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-amber-100 pt-3 border-t border-white/15">
            <span>Action Required</span>
            <button
              onClick={() => navigate("/admin/b2b-users/pending")}
              className="underline font-semibold hover:text-white"
            >
              Review Now &rarr;
            </button>
          </div>
        </motion.div>

        {/* B2B Workforce / Employees */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-violet-600 text-white p-5 rounded-2xl sm:rounded-3xl shadow-lg shadow-purple-500/20"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-purple-100/90">
                Corporate Users
              </p>
              <h3 className="text-2xl sm:text-3xl font-black mt-1">
                {kpis.totalEmployees}
              </h3>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md">
              <FiUsers className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-purple-100 pt-3 border-t border-white/15">
            <span>Admins + Staff</span>
            <span>Registered</span>
          </div>
        </motion.div>

        {/* B2B Procurement Volume / Revenue */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-2xl sm:rounded-3xl shadow-lg shadow-emerald-500/20"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-emerald-100/90">
                B2B Revenue (GMV)
              </p>
              <h3 className="text-2xl sm:text-3xl font-black mt-1">
                {formatPrice(kpis.totalRevenue || 0)}
              </h3>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md">
              <FiDollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-emerald-100 pt-3 border-t border-white/15">
            <span>Orders: <strong className="text-white">{kpis.totalOrders}</strong></span>
            <span>RFQs: <strong className="text-white">{kpis.totalRFQs}</strong></span>
          </div>
        </motion.div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Onboarding Trajectory */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Corporate Onboarding Trend
              </h2>
              <p className="text-xs text-gray-500">
                New B2B company registrations over the past 6 months
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
              Monthly Trend
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {growthTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={growthTrend}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="b2bGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#64748B", fontSize: 12 }}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#64748B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomAreaTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="companies"
                    stroke="#2563EB"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#b2bGrowth)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No trend data available
              </div>
            )}
          </div>
        </div>

        {/* Verification Status Distribution (Donut) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Verification Pipeline
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Status distribution of B2B corporate profiles
            </p>
          </div>

          <div className="h-56 w-full relative flex items-center justify-center">
            {verificationChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={verificationChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {verificationChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400 text-xs">
                <FiAlertCircle className="w-8 h-8 mb-1 text-gray-300" />
                <span>No companies recorded</span>
              </div>
            )}

            {verificationChartData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-800">
                  {kpis.totalCompanies}
                </span>
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Total
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-600">Approved: <strong>{kpis.approvedCompanies}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-600">Pending: <strong>{kpis.pendingCompanies}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-gray-600">Rejected: <strong>{kpis.rejectedCompanies}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
              <span className="text-xs text-gray-600">Suspended: <strong>{kpis.suspendedCompanies}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Business Entity Breakdown & Procurement Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Types Distribution (Horizontal Bars) */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Company Constitution & Classification
              </h2>
              <p className="text-xs text-gray-500">
                Distribution by legal entity structure (Pvt Ltd, LLP, Proprietorship)
              </p>
            </div>
            <FiLayers className="w-5 h-5 text-gray-400" />
          </div>

          {companyTypeChartData.length > 0 ? (
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={companyTypeChartData}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={140}
                    tick={{ fill: "#334155", fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(val) => [`${val} Companies`, "Total"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0" }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {companyTypeChartData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No entity type breakdown data available
            </div>
          )}
        </div>

        {/* Quick Operations Telemetry */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Procurement Telemetry
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Order frequency and commercial metrics
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600">Total B2B Orders</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{kpis.totalOrders}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500 text-white">
                <FiShoppingBag className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-600">Average Order Value (AOV)</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{formatPrice(kpis.aov || 0)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-500 text-white">
                <FiDollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600">Purchase Orders Issued</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{kpis.totalPOs || 0}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500 text-white">
                <FiFileText className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={() => navigate("/admin/b2b-users/manage")}
              className="w-full py-2.5 px-4 bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2"
            >
              <span>Explore All B2B Corporate Accounts</span>
              <FiArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Top Performing B2B Corporate Clients Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Corporate Accounts Directory
            </h2>
            <p className="text-xs text-gray-500">
              Registered corporate clients, verification state, and employee counts
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/b2b-users/manage")}
            className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <span>View Complete Directory</span>
            <FiArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Company Name</th>
                <th className="py-3.5 px-4">Constitution</th>
                <th className="py-3.5 px-4">Admin Contact</th>
                <th className="py-3.5 px-4">Workforce</th>
                <th className="py-3.5 px-4">Total Spend</th>
                <th className="py-3.5 px-4">Verification</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topCompanies.length > 0 ? (
                topCompanies.map((c) => {
                  const isApproved = c.verificationStatus === "Approved";
                  const isPending = c.verificationStatus === "Pending Verification";
                  const isRejected = c.verificationStatus === "Rejected";

                  return (
                    <tr key={c._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-semibold text-gray-900">{c.companyName}</div>
                        <div className="text-gray-400 text-[11px] font-mono mt-0.5">
                          GST: {c.gstNumber || "N/A"}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                          {c.companyType || "Enterprise"}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="text-gray-800 font-medium">{c.adminName}</div>
                        <div className="text-gray-400 text-xs">{c.adminEmail}</div>
                      </td>

                      <td className="py-4 px-4 font-semibold text-gray-700">
                        {c.employeeCount || 1} members
                      </td>

                      <td className="py-4 px-4 font-bold text-gray-900">
                        {formatPrice(c.totalSpend || 0)}
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isApproved
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isPending
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : isRejected
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {isApproved && <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                          {isPending && <FiClock className="w-3.5 h-3.5 text-amber-600" />}
                          {isRejected && <FiXCircle className="w-3.5 h-3.5 text-red-600" />}
                          <span>{c.verificationStatus}</span>
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => navigate("/admin/b2b-users/manage")}
                          className="p-2 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          title="View in Manage B2B Users"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <FiBriefcase className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-medium">No B2B companies found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default B2BAnalytics;
