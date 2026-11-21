import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiSearch, FiShoppingBag, FiCreditCard, FiRotateCcw, FiTrendingUp, FiChevronRight, FiDownload } from 'react-icons/fi';
import { getEmployeePurchaseSummary } from '../services/b2bAdminService';
import { generateCSV } from '../../Admin/utils/adminHelpers';
import { money, fmtDate, StatCard, StatusPill, Pager, EmptyRow, inputCls } from '../components/purchases/purchaseUi';

const SORTS = [
  { value: 'netSpent', label: 'Net spend' },
  { value: 'totalOrders', label: 'Orders' },
  { value: 'lastOrderAt', label: 'Last order' },
  { value: 'name', label: 'Name' },
];

const EmployeePurchases = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: '', from: '', to: '', status: '', sortBy: 'netSpent', order: 'desc' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, search })); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Only the most recent request may update the screen, so a slow earlier response
  // can never overwrite the result of a newer filter.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page, limit: 20 }).filter(([, v]) => v !== ''));
      const res = await getEmployeePurchaseSummary(params);
      if (requestId === latestRequest.current) { setData(res.data); setError(null); }
    } catch (err) {
      if (requestId === latestRequest.current) {
        const message = err.response?.data?.message || 'Could not load employee purchases. Please try again.';
        setError(message);
        toast.error(message);
      }
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };

  const exportCsv = async () => {
    try {
      // Export every matching employee, not just the visible page
      const params = Object.fromEntries(Object.entries({ ...filters, page: 1, limit: 100 }).filter(([, v]) => v !== ''));
      const res = await getEmployeePurchaseSummary(params);
      const rows = res.data?.items || [];
      if (!rows.length) return toast.error('Nothing to export');
      generateCSV(rows, [
        { label: 'Employee', accessor: (r) => r.employee.name },
        { label: 'Email', accessor: (r) => r.employee.email },
        { label: 'Department', accessor: (r) => r.employee.department || '' },
        { label: 'Designation', accessor: (r) => r.employee.designation || '' },
        { label: 'Status', accessor: (r) => (r.employee.isActive === false ? 'Inactive' : 'Active') },
        { label: 'Orders', accessor: (r) => r.stats.totalOrders },
        { label: 'Placed', accessor: (r) => r.stats.placedOrders },
        { label: 'Cancelled', accessor: (r) => r.stats.cancelledOrders },
        { label: 'Items Purchased', accessor: (r) => r.stats.itemsPurchased },
        { label: 'Gross Spend', accessor: (r) => r.stats.grossSpent },
        { label: 'Paid From Wallet', accessor: (r) => r.stats.walletSpent },
        { label: 'Returns', accessor: (r) => r.stats.totalReturns },
        { label: 'Refunded', accessor: (r) => r.stats.refundedAmount },
        { label: 'Net Spend', accessor: (r) => r.stats.netSpent },
        { label: 'Wallet Balance', accessor: (r) => r.employee.b2bWalletBalance || 0 },
        { label: 'Last Order', accessor: (r) => (r.stats.lastOrderAt ? new Date(r.stats.lastOrderAt).toISOString().slice(0, 10) : '') },
      ], 'employee-purchases'); // generateCSV appends the date itself
    } catch {
      toast.error('Export failed');
    }
  };

  const totals = data?.totals;
  const rows = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Purchases</h1>
          <p className="text-sm text-gray-500 mt-1">What each employee has bought, returned and spent from their wallet.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 self-start sm:self-auto">
          <FiDownload /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Net spend" icon={FiTrendingUp} value={money(totals?.netSpent)} hint={`${money(totals?.grossSpent)} gross − ${money(totals?.refundedAmount)} refunded`} />
        <StatCard label="Orders placed" icon={FiShoppingBag} value={totals?.placedOrders ?? 0} hint={`${totals?.cancelledOrders ?? 0} cancelled (not counted)`} />
        <StatCard label="Paid from wallets" icon={FiCreditCard} value={money(totals?.walletSpent)} hint={`${money(totals?.walletBalanceRemaining)} still in wallets`} />
        <StatCard label="Returns" icon={FiRotateCcw} value={totals?.totalReturns ?? 0} hint={`${money(totals?.refundedAmount)} refunded`} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 flex flex-col lg:flex-row gap-3 border-b border-gray-100">
          <div className="relative flex-1 min-w-0">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, department…" className={`${inputCls} w-full pl-9`} />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-500">From
              <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className={inputCls} />
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-500">To
              <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className={inputCls} />
            </label>
            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={inputCls} aria-label="Employee status">
              <option value="">All employees</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select value={`${filters.sortBy}:${filters.order}`} onChange={(e) => { const [sortBy, order] = e.target.value.split(':'); setFilters((f) => ({ ...f, sortBy, order })); setPage(1); }} className={inputCls} aria-label="Sort">
              {SORTS.flatMap((s) => [
                <option key={`${s.value}:desc`} value={`${s.value}:desc`}>{s.label} {s.value === 'name' ? '(Z–A)' : '(high → low)'}</option>,
                <option key={`${s.value}:asc`} value={`${s.value}:asc`}>{s.label} {s.value === 'name' ? '(A–Z)' : '(low → high)'}</option>,
              ])}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold text-right">Orders</th>
                <th className="px-4 py-3 font-semibold text-right">Net spend</th>
                <th className="px-4 py-3 font-semibold text-right">From wallet</th>
                <th className="px-4 py-3 font-semibold text-right">Returns / refunded</th>
                <th className="px-4 py-3 font-semibold text-right">Wallet balance</th>
                <th className="px-4 py-3 font-semibold">Last order</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !rows.length && <EmptyRow colSpan={8}>Loading…</EmptyRow>}
              {!loading && error && (
                <EmptyRow colSpan={8}>
                  {error} <button onClick={load} className="ml-1 text-[#D71920] font-medium hover:underline">Retry</button>
                </EmptyRow>
              )}
              {!loading && !error && !rows.length && <EmptyRow colSpan={8}>No employees match these filters.</EmptyRow>}
              {rows.map(({ employee: e, stats: s }) => (
                <tr key={e._id} onClick={() => navigate(`/b2b-dashboard/employees/${e._id}`)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-red-50 text-[#D71920] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(e.name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{e.name}</p>
                        <p className="text-xs text-gray-500 truncate">{[e.department, e.designation].filter(Boolean).join(' · ') || e.email}</p>
                      </div>
                      {e.isActive === false && <StatusPill value="inactive" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-gray-900">{s.placedOrders}</span>
                    {s.cancelledOrders > 0 && <span className="block text-xs text-gray-500">{s.cancelledOrders} cancelled</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{money(s.netSpent)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(s.walletSpent)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {s.totalReturns}
                    {s.refundedAmount > 0 && <span className="block text-xs text-gray-500">{money(s.refundedAmount)}</span>}
                    {s.pendingRefunds > 0 && <span className="block text-xs text-amber-600">{s.pendingRefunds} refund pending</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(e.b2bWalletBalance)}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(s.lastOrderAt)}</td>
                  <td className="px-4 py-3 text-gray-400"><FiChevronRight /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
      </div>
    </div>
  );
};

export default EmployeePurchases;
