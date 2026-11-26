import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBarChart2,
  FiTrendingUp,
  FiDollarSign,
  FiShoppingBag,
  FiUsers,
  FiRotateCcw,
  FiClock,
  FiCheckCircle,
  FiPercent,
  FiSearch,
  FiChevronUp,
  FiChevronDown,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { formatPrice } from "../../../../shared/utils/helpers";
import { getVendorsAnalytics } from "../../services/adminService";
import ExportButton from "../../components/ExportButton";

const EMPTY_TOTALS = {
  vendors: 0, activeVendors: 0, orders: 0, salesValue: 0, commission: 0, netEarnings: 0,
  pendingEarnings: 0, paidEarnings: 0, returns: 0, returnValue: 0, refundedAmount: 0, pendingRefundAmount: 0,
};

const COLUMNS = [
  { key: "name", label: "Vendor", align: "left", sort: (v) => String(v.storeName || v.name || "").toLowerCase() },
  { key: "orders", label: "Orders", align: "right", sort: (v) => v.orders.sold },
  { key: "sales", label: "Sales", align: "right", sort: (v) => v.orders.salesValue },
  { key: "aov", label: "Avg order", align: "right", sort: (v) => v.orders.averageOrderValue },
  { key: "commission", label: "Commission", align: "right", sort: (v) => v.earnings.commission },
  { key: "net", label: "Net earnings", align: "right", sort: (v) => v.earnings.netEarnings },
  { key: "pending", label: "Pending", align: "right", sort: (v) => v.earnings.pending },
  { key: "paid", label: "Paid", align: "right", sort: (v) => v.earnings.paid },
  { key: "returns", label: "Returns", align: "right", sort: (v) => v.returns.total },
  { key: "returnRate", label: "Return rate", align: "right", sort: (v) => v.returns.returnRate },
  { key: "refunded", label: "Refunded", align: "right", sort: (v) => v.returns.refundedAmount },
];

const STATUS_OPTIONS = [
  { value: "approved", label: "Approved vendors" },
  { value: "pending", label: "Pending approval" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All vendors" },
];

const Card = ({ title, value, sub, icon: Icon, tone, testId }) => (
  <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200 min-w-0" data-testid={testId}>
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">{title}</p>
      <Icon className={`${tone} flex-shrink-0`} />
    </div>
    <p className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{value}</p>
    {sub && <p className="text-[11px] sm:text-xs text-gray-500 mt-1 truncate">{sub}</p>}
  </div>
);

const VendorAnalytics = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ from: "", to: "", status: "approved" });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState({ totals: EMPTY_TOTALS, vendors: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "sales", dir: "desc" });
  const [tick, setTick] = useState(0);

  // wait a moment after typing before asking the server
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const dateInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  useEffect(() => {
    if (dateInvalid) return undefined;
    let alive = true;
    setLoading(true);
    setError("");
    const params = { status: filters.status };
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (search) params.search = search;
    getVendorsAnalytics(params)
      .then((res) => {
        if (!alive) return;
        const d = res?.data ?? res;
        setData({ totals: { ...EMPTY_TOTALS, ...(d?.totals || {}) }, vendors: Array.isArray(d?.vendors) ? d.vendors : [] });
      })
      .catch((err) => {
        if (!alive) return;
        setData({ totals: EMPTY_TOTALS, vendors: [] });
        setError(err?.response?.data?.message || "Could not load vendor analytics.");
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [filters.from, filters.to, filters.status, search, dateInvalid, tick]);

  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key) || COLUMNS[2];
    const sorted = [...data.vendors].sort((a, b) => {
      const x = col.sort(a);
      const y = col.sort(b);
      if (x < y) return -1;
      if (x > y) return 1;
      return 0;
    });
    return sort.dir === "desc" ? sorted.reverse() : sorted;
  }, [data.vendors, sort]);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  const t = data.totals;
  const openVendor = (id) => navigate(`/ple-ops-desk/vendors/${id}`);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Vendor Analytics</h1>
          <p className="text-sm sm:text-base text-gray-600">Sales, earnings and returns for every vendor</p>
        </div>
        <ExportButton
          data={rows}
          filename="vendor-analytics"
          headers={[
            { label: "Vendor", accessor: (v) => v.storeName || v.name },
            { label: "Email", accessor: (v) => v.email },
            { label: "Status", accessor: (v) => v.status },
            { label: "Orders (sold)", accessor: (v) => v.orders.sold },
            { label: "Sales", accessor: (v) => v.orders.salesValue },
            { label: "Avg order value", accessor: (v) => v.orders.averageOrderValue },
            { label: "Cancelled orders", accessor: (v) => v.orders.cancelled },
            { label: "Commission", accessor: (v) => v.earnings.commission },
            { label: "Net earnings", accessor: (v) => v.earnings.netEarnings },
            { label: "Pending earnings", accessor: (v) => v.earnings.pending },
            { label: "Paid earnings", accessor: (v) => v.earnings.paid },
            { label: "Returns", accessor: (v) => v.returns.total },
            { label: "Return rate %", accessor: (v) => v.returns.returnRate },
            { label: "Return value", accessor: (v) => v.returns.returnValue },
            { label: "Refunded", accessor: (v) => v.returns.refundedAmount },
            { label: "Pending refunds", accessor: (v) => v.returns.pendingRefundAmount },
          ]}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex flex-col lg:flex-row gap-3 lg:items-end" data-testid="va-filters">
        <div className="relative flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
          <FiSearch className="absolute left-3 top-[34px] text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Store name, owner or email"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            data-testid="va-search"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vendors</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="w-full lg:w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            data-testid="va-status"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={filters.from} max={filters.to || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="va-from" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={filters.to} min={filters.from || undefined}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="va-to" />
        </div>
        {(filters.from || filters.to) && (
          <button type="button" onClick={() => setFilters((f) => ({ ...f, from: "", to: "" }))}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg" data-testid="va-clear-dates">
            Clear dates
          </button>
        )}
      </div>
      {dateInvalid && <p className="text-sm text-red-600" data-testid="va-date-error">“From” date must be on or before “To” date.</p>}
      {error && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm" data-testid="va-error">
          <span>{error}</span>
          <button type="button" onClick={() => setTick((n) => n + 1)} className="font-semibold underline">Retry</button>
        </div>
      )}

      {/* Summary */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 ${loading ? "opacity-60" : ""}`}>
        <Card testId="va-card-vendors" title="Vendors" value={t.vendors} sub={`${t.activeVendors} with orders in this period`} icon={FiUsers} tone="text-blue-600" />
        <Card testId="va-card-orders" title="Orders sold" value={t.orders} sub="Cancelled and returned excluded" icon={FiShoppingBag} tone="text-green-600" />
        <Card testId="va-card-sales" title="Sales" value={formatPrice(t.salesValue)} sub="Vendors' own goods, after coupons" icon={FiDollarSign} tone="text-purple-600" />
        <Card testId="va-card-commission" title="Platform commission" value={formatPrice(t.commission)} sub="Earned from vendor sales" icon={FiPercent} tone="text-orange-600" />
        <Card testId="va-card-net" title="Vendor net earnings" value={formatPrice(t.netEarnings)} sub="After commission" icon={FiTrendingUp} tone="text-green-600" />
        <Card testId="va-card-pending" title="Pending payout" value={formatPrice(t.pendingEarnings)} sub={`Paid out: ${formatPrice(t.paidEarnings)}`} icon={FiClock} tone="text-yellow-600" />
        <Card testId="va-card-returns" title="Returns" value={t.returns} sub={`Value ${formatPrice(t.returnValue)}`} icon={FiRotateCcw} tone="text-red-600" />
        <Card testId="va-card-refunds" title="Refunded" value={formatPrice(t.refundedAmount)} sub={`Pending refunds: ${formatPrice(t.pendingRefundAmount)}`} icon={FiCheckCircle} tone="text-teal-600" />
      </div>

      {/* Vendor table */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Vendor Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]" data-testid="va-table">
            <thead>
              <tr className="border-b border-gray-200">
                {COLUMNS.map((c) => (
                  <th key={c.key} className={`py-3 px-3 text-sm font-semibold text-gray-700 ${c.align === "right" ? "text-right" : "text-left"}`}>
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-purple-700 whitespace-nowrap" data-testid={`va-sort-${c.key}`}>
                      {c.label}
                      {sort.key === c.key && (sort.dir === "desc" ? <FiChevronDown /> : <FiChevronUp />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openVendor(v.id)} data-testid="va-row">
                  <td className="py-3 px-3">
                    <p className="font-semibold text-gray-800">{v.storeName || v.name}</p>
                    <p className="text-xs text-gray-500">{v.email}{v.status !== "approved" ? ` · ${v.status}` : ""}</p>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-gray-800">{v.orders.sold}
                    {v.orders.cancelled > 0 && <span className="block text-[11px] font-normal text-gray-500">{v.orders.cancelled} cancelled</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-gray-800">{formatPrice(v.orders.salesValue)}</td>
                  <td className="py-3 px-3 text-right text-gray-700">{formatPrice(v.orders.averageOrderValue)}</td>
                  <td className="py-3 px-3 text-right text-gray-700">{formatPrice(v.earnings.commission)}</td>
                  <td className="py-3 px-3 text-right font-semibold text-green-600">{formatPrice(v.earnings.netEarnings)}</td>
                  <td className="py-3 px-3 text-right font-semibold text-yellow-600">{formatPrice(v.earnings.pending)}</td>
                  <td className="py-3 px-3 text-right text-gray-700">{formatPrice(v.earnings.paid)}</td>
                  <td className="py-3 px-3 text-right text-gray-800">{v.returns.total}</td>
                  <td className={`py-3 px-3 text-right font-semibold ${v.returns.returnRate >= 20 ? "text-red-600" : "text-gray-700"}`}>{v.returns.returnRate}%</td>
                  <td className="py-3 px-3 text-right text-gray-700">{formatPrice(v.returns.refundedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && rows.length === 0 && <p className="text-center text-gray-500 py-12" data-testid="va-loading">Loading vendor analytics…</p>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-12" data-testid="va-empty">
            <FiBarChart2 className="text-4xl text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No vendors match these filters</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VendorAnalytics;
