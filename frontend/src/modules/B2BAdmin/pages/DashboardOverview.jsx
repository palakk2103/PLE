import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FiFileText, FiClock, FiActivity, FiCheckCircle, FiDollarSign,
  FiTrendingUp, FiUsers, FiAward, FiPackage, FiAlertCircle,
  FiRefreshCw, FiArrowRight, FiShoppingBag, FiBarChart2
} from 'react-icons/fi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
  Legend, ComposedChart, Line
} from 'recharts';
import api from '../../../shared/utils/api';
import toast from 'react-hot-toast';
import Badge from '../../../shared/components/Badge';
import { formatPrice } from '../../../shared/utils/helpers';
import { useWalletStore } from '../../../shared/store/walletStore';

const COLORS = ['#D71920', '#D18B4A', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];

const getStatusVariant = (status) => {
  if (['Purchase Order Generated', 'Completed'].includes(status)) return 'success';
  if (['Awaiting B2B Approval', 'Vendor Selected', 'Approved'].includes(status)) return 'warning';
  if (status === 'Rejected') return 'danger';
  return 'default';
};

const SkeletonCard = () => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse space-y-3">
    <div className="w-10 h-10 bg-gray-100 rounded-xl" />
    <div className="h-3 bg-gray-100 rounded w-24" />
    <div className="h-6 bg-gray-100 rounded w-16" />
  </div>
);

const DashboardOverview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const { balance: walletBalance, fetchWallet } = useWalletStore();

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const res = await api.get('/b2b-user/admin/dashboard');
      const payload = res?.data?.data || res?.data || res;
      if (payload && typeof payload === 'object') setData(payload);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load dashboard analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { 
    fetchDashboardData(); 
    fetchWallet();
  }, []);

  const statCards = data ? [
    {
      title: 'Total RFQs',
      value: data.rfq?.total ?? 0,
      sub: `${data.rfq?.draft ?? 0} drafts`,
      icon: <FiFileText className="w-5 h-5 text-[#D71920]" />,
      bg: 'bg-[#D71920]/10',
      onClick: () => navigate('/b2b-dashboard/rfqs')
    },
    {
      title: 'In Progress',
      value: data.rfq?.inProgress ?? 0,
      sub: `${data.rfq?.submitted ?? 0} submitted`,
      icon: <FiActivity className="w-5 h-5 text-indigo-600" />,
      bg: 'bg-indigo-50',
      onClick: () => navigate('/b2b-dashboard/rfqs')
    },
    {
      title: 'Completed RFQs',
      value: data.rfq?.completed ?? 0,
      sub: `${data.rfq?.rejected ?? 0} rejected`,
      icon: <FiCheckCircle className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50',
      onClick: () => navigate('/b2b-dashboard/rfqs')
    },
    {
      title: 'Purchase Orders',
      value: data.procurement?.totalPOs ?? 0,
      sub: `${data.procurement?.thisMonthPOs ?? 0} this month`,
      icon: <FiPackage className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-50',
      onClick: () => navigate('/b2b-dashboard/purchase-orders')
    },
    {
      title: 'Total Spend',
      value: formatPrice(data.procurement?.totalSpend || 0),
      sub: `Avg PO: ${formatPrice(data.procurement?.avgPOValue || 0)}`,
      icon: <FiDollarSign className="w-5 h-5 text-blue-600" />,
      bg: 'bg-blue-50',
      isLarge: true
    },
    {
      title: 'Employees',
      value: data.employees?.total ?? 0,
      sub: `${data.employees?.active ?? 0} active`,
      icon: <FiUsers className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-50',
      onClick: () => navigate('/b2b-dashboard/employees')
    },
    {
      title: 'Wallet Balance',
      value: formatPrice(walletBalance),
      sub: 'Click to view wallet page',
      icon: <FiDollarSign className="w-5 h-5 text-red-600" />,
      bg: 'bg-red-50',
      onClick: () => navigate('/wallet')
    }
  ] : [];

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
        <div className="h-8 bg-gray-100 rounded-xl w-64 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          <div className="h-80 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-[1400px] mx-auto pb-12"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {data?.company?.name || 'RFQ Sourcing'} Analytics
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Live procurement overview — RFQs, spend, vendors & orders.
          </p>
        </div>
        <button
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* This Month Spend Banner */}
      {data?.procurement?.thisMonthSpend > 0 && (
        <div className="bg-gradient-to-r from-[#D71920] to-[#B51218] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-white">
            <p className="text-xs font-bold opacity-75 uppercase tracking-wider">This Month Procurement Spend</p>
            <h2 className="text-3xl font-black mt-1">{formatPrice(data.procurement.thisMonthSpend)}</h2>
            <p className="text-xs opacity-70 mt-1">{data.procurement.thisMonthPOs} Purchase Orders issued</p>
          </div>
          <button
            onClick={() => navigate('/b2b-dashboard/purchase-orders')}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shrink-0"
          >
            View All POs <FiArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={card.onClick}
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between hover:shadow-md transition-all ${card.onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
          >
            <div className={`p-3 rounded-xl w-fit ${card.bg} mb-3`}>{card.icon}</div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{card.title}</p>
              <h3 className={`font-extrabold text-gray-900 mt-1 ${card.isLarge ? 'text-base' : 'text-xl'}`}>{card.value}</h3>
              {card.sub && <p className="text-[10px] text-gray-400 font-medium mt-0.5">{card.sub}</p>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <FiBarChart2 className="text-[#D71920]" /> Monthly Procurement Activity
            </h3>
            <span className="text-xs font-bold text-[#D71920] bg-[#D71920]/10 px-2.5 py-1 rounded-full">Last 6 Months</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data?.charts?.monthlyTrend || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={70}
                  tickFormatter={v => v > 0 ? `₹${(v / 100000).toFixed(1)}L` : '0'} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value, name) => name === 'Spend' ? [formatPrice(value), 'Spend'] : [value, name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="RFQs" fill="#D71920" radius={[6, 6, 0, 0]} barSize={20} opacity={0.85} />
                <Area yAxisId="right" type="monotone" dataKey="Spend" stroke="#6366f1" strokeWidth={2.5}
                  fill="url(#colorSpend)" dot={{ r: 4, fill: '#6366f1' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h3 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider">RFQ Status Split</h3>
          <div className="h-48 relative flex items-center justify-center">
            {(data?.charts?.statusDistribution?.length || 0) === 0 ? (
              <p className="text-sm text-gray-400 font-medium">No RFQ data</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.charts.statusDistribution} cx="50%" cy="50%"
                      innerRadius={52} outerRadius={72} paddingAngle={4} dataKey="value">
                      {data.charts.statusDistribution.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center pointer-events-none">
                  <span className="text-[9px] text-gray-400 font-bold uppercase block">Total</span>
                  <span className="text-2xl font-black text-gray-800">{data?.rfq?.total || 0}</span>
                </div>
              </>
            )}
          </div>
          {/* Legend */}
          <div className="space-y-2">
            {(data?.charts?.statusDistribution || []).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-600 font-medium truncate max-w-[130px]">{item.name}</span>
                </div>
                <span className="font-extrabold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendor Bids Bar */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h3 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <FiAward className="text-[#D71920]" /> Vendor Bids Per RFQ
          </h3>
          <div className="h-60">
            {(data?.charts?.vendorParticipation?.length || 0) === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400 font-medium">No bids yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.vendorParticipation} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                    labelFormatter={(label) => {
                      const item = data.charts.vendorParticipation.find(v => v.name === label);
                      return item?.product || label;
                    }}
                  />
                  <Bar dataKey="Bids" radius={[8, 8, 0, 0]} barSize={32}>
                    {data.charts.vendorParticipation.map((_, i) => (
                       <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quick Stats Panel */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
          <h3 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <FiTrendingUp className="text-[#D71920]" /> Procurement Health
          </h3>
          <div className="space-y-3">
            {[
              {
                label: 'Completion Rate',
                value: data?.rfq?.total > 0 ? `${Math.round(((data?.rfq?.completed || 0) / data.rfq.total) * 100)}%` : '0%',
                color: 'bg-emerald-500',
                pct: data?.rfq?.total > 0 ? ((data?.rfq?.completed || 0) / data.rfq.total) * 100 : 0
              },
              {
                label: 'Active Pipeline',
                value: data?.rfq?.total > 0 ? `${Math.round(((data?.rfq?.inProgress || 0) / data.rfq.total) * 100)}%` : '0%',
                color: 'bg-indigo-500',
                pct: data?.rfq?.total > 0 ? ((data?.rfq?.inProgress || 0) / data.rfq.total) * 100 : 0
              },
              {
                label: 'Avg PO Value',
                value: formatPrice(data?.procurement?.avgPOValue || 0),
                color: 'bg-[#D71920]',
                pct: 100
              }
            ].map((item, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-medium">{item.label}</span>
                  <span className="font-extrabold text-gray-900">{item.value}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.min(item.pct, 100)}%` }} />
                </div>
              </div>
            ))}

            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Total Spend</p>
                <p className="text-sm font-extrabold text-gray-900 mt-0.5">{formatPrice(data?.procurement?.totalSpend || 0)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Active Staff</p>
                <p className="text-sm font-extrabold text-gray-900 mt-0.5">{data?.employees?.active || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Spend Analytics Section */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
        <h3 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
          <FiUsers className="text-[#C07A3D]" /> Employee Spend Breakdown
        </h3>
        <div className="h-64">
          {(!data?.charts?.employeeSpending || data.charts.employeeSpending.length === 0) ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400 font-medium">No employee spending recorded</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.charts.employeeSpending}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => [formatPrice(value), 'Total Spend']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="spend" fill="#C07A3D" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Activity — RFQs + POs side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent RFQs */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <FiFileText className="text-[#C07A3D]" /> Recent RFQs
            </h3>
            <button onClick={() => navigate('/b2b-dashboard/rfqs')}
              className="text-[11px] font-bold text-[#C07A3D] hover:underline flex items-center gap-1">
              View all <FiArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {(data?.recentRFQs?.length || 0) === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FiFileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No RFQs yet</p>
              </div>
            ) : data.recentRFQs.map((rfq) => (
              <div key={rfq._id}
                onClick={() => navigate(`/b2b-dashboard/rfqs/${rfq._id}`)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-gray-900 truncate">{rfq.product}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{rfq.rfqId} · {rfq.quantity} units</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge variant={getStatusVariant(rfq.status)}>
                    <span className="text-[9px]">{rfq.status}</span>
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent POs */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <FiShoppingBag className="text-[#C07A3D]" /> Recent Purchase Orders
            </h3>
            <button onClick={() => navigate('/b2b-dashboard/purchase-orders')}
              className="text-[11px] font-bold text-[#C07A3D] hover:underline flex items-center gap-1">
              View all <FiArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {(data?.recentPOs?.length || 0) === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FiPackage className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No Purchase Orders yet</p>
                <p className="text-[10px] mt-1">Approve an RFQ to generate your first PO</p>
              </div>
            ) : data.recentPOs.map((po) => (
              <div key={po._id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-gray-900 truncate">{po.product}</p>
                  <p className="text-[10px] text-gray-400">{po.poNumber} · {po.vendorName}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-extrabold text-[#C07A3D]">{formatPrice(po.total)}</p>
                  <p className="text-[10px] text-gray-400">{po.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DashboardOverview;
