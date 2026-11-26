import { useState, useMemo, useEffect } from "react";
import {
  FiBarChart2,
  FiTrendingUp,
  FiTrendingDown,
  FiPackage,
  FiShoppingBag,
  FiDollarSign,
  FiRotateCcw,
  FiPercent,
  FiClock,
  FiCheckCircle,
  FiAlertTriangle,
  FiAward,
} from "react-icons/fi";
import { motion } from "framer-motion";
import RevenueLineChart from "../../Admin/components/Analytics/RevenueLineChart";
import SalesBarChart from "../../Admin/components/Analytics/SalesBarChart";
import OrderStatusPieChart from "../../Admin/components/Analytics/OrderStatusPieChart";
import RevenueVsOrdersChart from "../../Admin/components/Analytics/RevenueVsOrdersChart";
import TimePeriodFilter from "../../Admin/components/Analytics/TimePeriodFilter";
import ExportButton from "../../Admin/components/ExportButton";
import { formatPrice } from "../../../shared/utils/helpers";
import { useVendorAuthStore } from "../store/vendorAuthStore";
import { getVendorAnalyticsOverview } from "../services/vendorService";

const EMPTY_SUMMARY = {
  totalRevenue: 0, refundsOnSales: 0, netSales: 0, averageOrderValue: 0, totalOrders: 0,
  cancelledOrders: 0, cancelRate: 0, totalProducts: 0, lowStockProducts: 0, outOfStockProducts: 0,
  commission: 0, netEarnings: 0, pendingEarnings: 0, paidEarnings: 0,
};
const EMPTY_RETURNS = {
  totalReturns: 0, pendingReturns: 0, completedReturns: 0, rejectedReturns: 0,
  returnValue: 0, refundedAmount: 0, pendingRefundAmount: 0, returnRate: 0,
};
const EMPTY_COMPARISON = { previousRevenue: 0, previousOrders: 0, revenueChange: null, ordersChange: null };

/** "+12.5% vs previous period" in green/red with the matching arrow; null means there was nothing to compare with. */
const Growth = ({ value, testId }) => {
  if (value === null || value === undefined) {
    return <p className="text-[11px] sm:text-xs text-gray-400 mt-2" data-testid={testId}>No earlier sales to compare</p>;
  }
  const up = value >= 0;
  const Icon = up ? FiTrendingUp : FiTrendingDown;
  return (
    <div className={`flex items-center gap-1 mt-2 ${up ? "text-green-600" : "text-red-600"}`} data-testid={testId}>
      <Icon className="flex-shrink-0" />
      <span className="text-xs sm:text-sm">{up ? "+" : ""}{value}%</span>
      <span className="text-[11px] text-gray-400">vs previous period</span>
    </div>
  );
};

const Card = ({ title, value, sub, icon: Icon, tone, children, testId }) => (
  <div className="bg-white dark:bg-[#1A1A1A] rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-white/5 min-w-0" data-testid={testId}>
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium truncate">{title}</p>
      <Icon className={`${tone} flex-shrink-0`} />
    </div>
    <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white truncate">{value}</p>
    {sub && <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-2 truncate">{sub}</p>}
    {children}
  </div>
);

const Analytics = () => {
  const { vendor } = useVendorAuthStore();
  const [period, setPeriod] = useState("month");
  const [dates, setDates] = useState({ from: "", to: "" });
  const [data, setData] = useState({
    summary: EMPTY_SUMMARY, comparison: EMPTY_COMPARISON, returns: EMPTY_RETURNS,
    timeseries: [], statusBreakdown: [], topProducts: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const vendorId = vendor?.id || vendor?._id;
  const custom = Boolean(dates.from && dates.to);
  const datesIncomplete = Boolean(dates.from) !== Boolean(dates.to);
  const datesInvalid = custom && dates.from > dates.to;

  useEffect(() => {
    if (!vendorId || datesIncomplete || datesInvalid) return undefined;
    let alive = true;
    setIsLoading(true);
    setError("");
    const params = custom ? { from: dates.from, to: dates.to } : { period };
    getVendorAnalyticsOverview(params)
      .then((res) => {
        if (!alive) return;
        const d = res?.data ?? res;
        setData({
          summary: { ...EMPTY_SUMMARY, ...(d?.summary || {}) },
          comparison: { ...EMPTY_COMPARISON, ...(d?.comparison || {}) },
          returns: { ...EMPTY_RETURNS, ...(d?.returns || {}) },
          timeseries: Array.isArray(d?.timeseries) ? d.timeseries : [],
          statusBreakdown: Array.isArray(d?.statusBreakdown) ? d.statusBreakdown : [],
          topProducts: Array.isArray(d?.topProducts) ? d.topProducts : [],
        });
      })
      .catch((err) => {
        if (!alive) return;
        setData({ summary: EMPTY_SUMMARY, comparison: EMPTY_COMPARISON, returns: EMPTY_RETURNS, timeseries: [], statusBreakdown: [], topProducts: [] });
        setError(err?.response?.data?.message || "Could not load analytics.");
      })
      .finally(() => alive && setIsLoading(false));
    return () => { alive = false; };
  }, [vendorId, period, custom, dates.from, dates.to, datesIncomplete, datesInvalid, tick]);

  // the server already limits the data to the chosen dates; this tells the charts the same range
  const chartRange = useMemo(
    () => (custom ? { start: new Date(`${dates.from}T00:00:00`), end: new Date(`${dates.to}T23:59:59`) } : null),
    [custom, dates.from, dates.to]
  );

  if (!vendorId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to view analytics</p>
      </div>
    );
  }

  const { summary: s, comparison, returns: r, timeseries, statusBreakdown, topProducts } = data;
  const chartPeriod = custom ? "custom" : period;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white mb-1">Analytics & Reports</h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Your store performance and metrics</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
          <TimePeriodFilter selectedPeriod={custom ? "" : period} onPeriodChange={(p) => { setDates({ from: "", to: "" }); setPeriod(p); }} />
          <div className="flex items-end gap-2" data-testid="an-dates">
            <label className="text-[11px] text-gray-500">From
              <input type="date" value={dates.from} max={dates.to || undefined} onChange={(e) => setDates((d) => ({ ...d, from: e.target.value }))}
                className="block mt-0.5 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" data-testid="an-from" />
            </label>
            <label className="text-[11px] text-gray-500">To
              <input type="date" value={dates.to} min={dates.from || undefined} onChange={(e) => setDates((d) => ({ ...d, to: e.target.value }))}
                className="block mt-0.5 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" data-testid="an-to" />
            </label>
            {(dates.from || dates.to) && (
              <button type="button" onClick={() => setDates({ from: "", to: "" })} className="px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg" data-testid="an-clear">Clear</button>
            )}
          </div>
          <ExportButton
            data={timeseries}
            headers={[
              { label: "Date", accessor: (row) => row.date },
              { label: "Sales", accessor: (row) => row.revenue },
              { label: "Orders", accessor: (row) => row.orders },
            ]}
            filename="vendor-analytics-report"
          />
        </div>
      </div>
      {datesIncomplete && <p className="text-sm text-amber-600" data-testid="an-date-hint">Pick both a “From” and a “To” date to use a custom range.</p>}
      {datesInvalid && <p className="text-sm text-red-600" data-testid="an-date-error">“From” date must be on or before “To” date.</p>}
      {error && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm" data-testid="an-error">
          <span>{error}</span>
          <button type="button" onClick={() => setTick((n) => n + 1)} className="font-semibold underline">Retry</button>
        </div>
      )}

      <div className={`space-y-6 transition-opacity ${isLoading ? "opacity-60" : ""}`} data-testid="an-body" aria-busy={isLoading}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <Card testId="an-card-sales" title="Total Sales" value={formatPrice(s.totalRevenue)} icon={FiDollarSign} tone="text-green-600">
            <Growth value={comparison.revenueChange} testId="an-growth-sales" />
          </Card>
          <Card testId="an-card-orders" title="Orders" value={s.totalOrders} icon={FiShoppingBag} tone="text-blue-600"
            sub={s.cancelledOrders > 0 ? `${s.cancelledOrders} cancelled (${s.cancelRate}%)` : null}>
            <Growth value={comparison.ordersChange} testId="an-growth-orders" />
          </Card>
          <Card testId="an-card-aov" title="Average Order Value" value={formatPrice(s.averageOrderValue)} icon={FiBarChart2} tone="text-indigo-600" sub="Per completed order" />
          <Card testId="an-card-net-sales" title="Net Sales" value={formatPrice(s.netSales)} icon={FiCheckCircle} tone="text-teal-600"
            sub={`After ${formatPrice(s.refundsOnSales)} refunded`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <Card testId="an-card-commission" title="Platform Commission" value={formatPrice(s.commission)} icon={FiPercent} tone="text-orange-600" sub="Deducted from your sales" />
          <Card testId="an-card-net-earnings" title="Your Earnings" value={formatPrice(s.netEarnings)} icon={FiTrendingUp} tone="text-green-600" sub="After commission" />
          <Card testId="an-card-pending" title="Pending Earnings" value={formatPrice(s.pendingEarnings)} icon={FiClock} tone="text-yellow-600" sub={`Already paid out: ${formatPrice(s.paidEarnings)}`} />
          <Card testId="an-card-products" title="Total Products" value={s.totalProducts} icon={FiPackage} tone="text-purple-600"
            sub={s.lowStockProducts + s.outOfStockProducts > 0 ? `${s.lowStockProducts} low stock · ${s.outOfStockProducts} out of stock` : "Stock levels look healthy"} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <Card testId="an-card-returns" title="Total Returns" value={r.totalReturns} icon={FiRotateCcw} tone="text-orange-600"
            sub={`${r.pendingReturns} pending · ${r.completedReturns} completed · ${r.rejectedReturns} rejected`} />
          <Card testId="an-card-return-rate" title="Return Rate" value={`${r.returnRate}%`} icon={FiPercent} tone="text-red-600" sub="Returns ÷ orders in period" />
          <Card testId="an-card-refunded" title="Total Refunded" value={formatPrice(r.refundedAmount)} icon={FiDollarSign} tone="text-green-600" sub={`Return value: ${formatPrice(r.returnValue)}`} />
          <Card testId="an-card-pending-refunds" title="Pending Refunds" value={formatPrice(r.pendingRefundAmount)} icon={FiAlertTriangle} tone="text-yellow-600" sub="Awaiting processing" />
        </div>

        {timeseries.length > 0 ? (
          <div className="space-y-6 min-w-0">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 min-w-0">
              <div className="w-full min-w-0 overflow-hidden bg-white dark:bg-[#1A1A1A] p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                <RevenueLineChart data={timeseries} period={chartPeriod} range={chartRange} />
              </div>
              <div className="w-full min-w-0 overflow-hidden bg-white dark:bg-[#1A1A1A] p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                <SalesBarChart data={timeseries} period={chartPeriod} range={chartRange} />
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 min-w-0">
              <div className="w-full min-w-0 overflow-hidden bg-white dark:bg-[#1A1A1A] p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                <RevenueVsOrdersChart data={timeseries} period={chartPeriod} range={chartRange} />
              </div>
              <div className="w-full min-w-0 overflow-hidden bg-white dark:bg-[#1A1A1A] p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm">
                <OrderStatusPieChart data={statusBreakdown} />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-200 text-center" data-testid="an-empty">
            <FiBarChart2 className="text-4xl text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">{isLoading ? "Loading analytics..." : "No sales in this period"}</p>
            {!isLoading && <p className="text-sm text-gray-400">Sales will appear here once you receive orders, or try a wider date range.</p>}
          </div>
        )}

        <div className="bg-white dark:bg-[#1A1A1A] rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-white/5" data-testid="an-top-products">
          <div className="flex items-center gap-2 mb-4">
            <FiAward className="text-amber-500" />
            <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">Top Selling Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No product sales in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/10 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">Product</th>
                    <th className="text-right py-2 px-2">Units sold</th>
                    <th className="text-right py-2 px-2">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={String(p.productId) + i} className="border-b border-gray-100 dark:border-white/5 text-sm" data-testid="an-top-row">
                      <td className="py-2 px-2 text-gray-500">{i + 1}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {p.image && <img src={p.image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                          <span className="font-medium text-gray-800 dark:text-white truncate">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{p.quantity}</td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-800 dark:text-white">{formatPrice(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Analytics;
