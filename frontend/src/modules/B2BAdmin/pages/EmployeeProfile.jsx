import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiArrowLeft, FiMail, FiPhone, FiBriefcase, FiCreditCard, FiShoppingBag, FiRotateCcw,
  FiTrendingUp, FiX, FiPackage, FiDollarSign,
} from 'react-icons/fi';
import {
  getEmployeePurchaseOverview, getEmployeeOrders, getEmployeeOrderDetail,
  getEmployeeReturns, getEmployeeWalletTransactions,
} from '../services/b2bAdminService';
import { money, fmtDate, humanize, StatCard, StatusPill, Pager, EmptyRow, inputCls } from '../components/purchases/purchaseUi';

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
const RETURN_STATUSES = ['pending', 'approved', 'processing', 'return_initiated', 'in_transit', 'qc_center', 'refund_processed', 'completed', 'rejected', 'claim_rejected'];
const TX_CATEGORIES = ['b2b_allotment', 'order_payment', 'refund'];

const TABS = [
  { key: 'orders', label: 'Orders', icon: FiShoppingBag },
  { key: 'returns', label: 'Returns & Refunds', icon: FiRotateCcw },
  { key: 'wallet', label: 'Wallet History', icon: FiCreditCard },
];

const cleanParams = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));

/** Generic paginated loader for one tab */
const usePagedList = (fetcher, id, filters) => {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ items: [], total: 0, pages: 0, loading: true });
  const key = JSON.stringify(filters);

  useEffect(() => { setPage(1); }, [key]);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fetcher(id, cleanParams({ ...filters, page, limit: 15 }))
      .then((res) => { if (alive) setState({ ...res.data, loading: false }); })
      .catch((err) => {
        if (alive) setState((s) => ({ ...s, loading: false }));
        toast.error(err.response?.data?.message || 'Failed to load data');
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, id, key, page]);

  return { ...state, page, setPage };
};

const DateRange = ({ value, onChange }) => (
  <>
    <label className="flex items-center gap-1 text-xs text-gray-500">From
      <input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className={inputCls} />
    </label>
    <label className="flex items-center gap-1 text-xs text-gray-500">To
      <input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className={inputCls} />
    </label>
  </>
);

// ─── Orders tab ──────────────────────────────────────────────────────────────
const OrdersTab = ({ id, onOpenOrder }) => {
  const [filters, setFilters] = useState({ status: '', paymentMethod: '', search: '', from: '', to: '' });
  const list = usePagedList(getEmployeeOrders, id, filters);

  return (
    <>
      <div className="p-4 flex flex-wrap gap-2 border-b border-gray-100">
        <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Order ID…" className={`${inputCls} w-40`} />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={inputCls} aria-label="Order status">
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <select value={filters.paymentMethod} onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })} className={inputCls} aria-label="Payment method">
          <option value="">All payment methods</option>
          {['wallet', 'card', 'upi', 'bank', 'cod', 'mixed'].map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
        </select>
        <DateRange value={filters} onChange={setFilters} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Products</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Payment</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.loading && !list.items.length && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
            {!list.loading && !list.items.length && <EmptyRow colSpan={5}>No orders found.</EmptyRow>}
            {list.items.map((o) => (
              <tr key={o._id} onClick={() => onOpenOrder(o.orderId)} className="hover:bg-gray-50 cursor-pointer align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#D71920] whitespace-nowrap">{o.orderId}</p>
                  <p className="text-xs text-gray-500">{fmtDate(o.createdAt, true)}</p>
                </td>
                <td className="px-4 py-3 min-w-[200px]">
                  {(o.items || []).slice(0, 3).map((it, i) => (
                    <p key={i} className="text-gray-800">{it.name} <span className="text-gray-500">× {it.quantity} @ {money(it.price)}</span></p>
                  ))}
                  {o.items?.length > 3 && <p className="text-xs text-gray-500">+{o.items.length - 3} more</p>}
                </td>
                <td className="px-4 py-3"><StatusPill value={o.status} /></td>
                <td className="px-4 py-3">
                  <p className="text-gray-800">{humanize(o.paymentMethod)}</p>
                  <StatusPill value={o.paymentStatus} />
                  {o.walletAmountUsed > 0 && o.paymentMethod !== 'wallet' && <p className="text-xs text-gray-500 mt-1">{money(o.walletAmountUsed)} from wallet</p>}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{money(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pages={list.pages} total={list.total} onChange={list.setPage} />
    </>
  );
};

// ─── Returns tab ─────────────────────────────────────────────────────────────
const ReturnsTab = ({ id, onOpenOrder }) => {
  const [filters, setFilters] = useState({ status: '', refundStatus: '', from: '', to: '' });
  const list = usePagedList(getEmployeeReturns, id, filters);

  return (
    <>
      <div className="p-4 flex flex-wrap gap-2 border-b border-gray-100">
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={inputCls} aria-label="Return status">
          <option value="">All return statuses</option>
          {RETURN_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <select value={filters.refundStatus} onChange={(e) => setFilters({ ...filters, refundStatus: e.target.value })} className={inputCls} aria-label="Refund status">
          <option value="">All refund statuses</option>
          {['pending', 'processed', 'failed'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <DateRange value={filters} onChange={setFilters} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
              <th className="px-4 py-3 font-semibold">Return</th>
              <th className="px-4 py-3 font-semibold">Returned items</th>
              <th className="px-4 py-3 font-semibold">Return status</th>
              <th className="px-4 py-3 font-semibold">Refund</th>
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.loading && !list.items.length && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
            {!list.loading && !list.items.length && <EmptyRow colSpan={5}>No returns found.</EmptyRow>}
            {list.items.map((r) => {
              const orderNo = r.orderId?.orderId || r.orderNumber;
              return (
                <tr key={r._id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 whitespace-nowrap">{r.returnId || r._id.slice(-8)}</p>
                    {orderNo && <button onClick={() => onOpenOrder(orderNo)} className="text-xs text-[#D71920] hover:underline">{orderNo}</button>}
                    <p className="text-xs text-gray-500">{fmtDate(r.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 min-w-[200px]">
                    {(r.items || []).map((it, i) => (
                      <p key={i} className="text-gray-800">{it.name} <span className="text-gray-500">× {it.quantity}</span></p>
                    ))}
                    <p className="text-xs text-gray-500 mt-1">“{r.reason}”</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.status} />
                    {r.rejectionReason && <p className="text-xs text-red-600 mt-1">{r.rejectionReason}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {r.refundStatus ? <StatusPill value={r.refundStatus} /> : <span className="text-gray-400">—</span>}
                    <p className="text-xs text-gray-500 mt-1">To: {r.refundDetails?.destination || r.refundDestination || '—'}</p>
                    {r.refundDetails?.processedAt && <p className="text-xs text-gray-500">{fmtDate(r.refundDetails.processedAt)}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{money(r.refundAmount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pages={list.pages} total={list.total} onChange={list.setPage} />
    </>
  );
};

// ─── Wallet tab ──────────────────────────────────────────────────────────────
const WalletTab = ({ id, onOpenOrder }) => {
  const [filters, setFilters] = useState({ type: '', category: '', from: '', to: '' });
  const list = usePagedList(getEmployeeWalletTransactions, id, filters);

  return (
    <>
      <div className="p-4 flex flex-wrap gap-2 border-b border-gray-100">
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className={inputCls} aria-label="Type">
          <option value="">Credits & debits</option>
          <option value="credit">Credits only</option>
          <option value="debit">Debits only</option>
        </select>
        <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className={inputCls} aria-label="Category">
          <option value="">All categories</option>
          {TX_CATEGORIES.map((c) => <option key={c} value={c}>{c === 'b2b_allotment' ? 'Allotment' : humanize(c)}</option>)}
        </select>
        <DateRange value={filters} onChange={setFilters} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
              <th className="px-4 py-3 font-semibold text-right">Balance after</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.loading && !list.items.length && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
            {!list.loading && !list.items.length && <EmptyRow colSpan={5}>No wallet transactions found.</EmptyRow>}
            {list.items.map((t) => (
              <tr key={t._id} className="align-top">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(t.createdAt, true)}</td>
                <td className="px-4 py-3 min-w-[200px]">
                  <p className="text-gray-800">{t.description}</p>
                  <p className="text-xs text-gray-500">
                    {t.transactionCategory === 'b2b_allotment' ? 'Allotment' : humanize(t.transactionCategory)}
                    {t.performedBy?.name && ` · by ${t.performedBy.name}`}
                  </p>
                  {t.orderId?.orderId && <button onClick={() => onOpenOrder(t.orderId.orderId)} className="text-xs text-[#D71920] hover:underline">{t.orderId.orderId}</button>}
                </td>
                <td className="px-4 py-3"><StatusPill value={t.type} /></td>
                <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${t.type === 'credit' ? 'text-green-700' : 'text-red-600'}`}>
                  {t.type === 'credit' ? '+' : '−'}{money(t.amount)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{money(t.balanceAfterTransaction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pages={list.pages} total={list.total} onChange={list.setPage} />
    </>
  );
};

// ─── Order detail drawer ─────────────────────────────────────────────────────
const ProductThumb = ({ src }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="w-12 h-12 rounded bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0"><FiPackage /></div>;
  }
  return <img src={src} alt="" onError={() => setFailed(true)} className="w-12 h-12 rounded object-cover bg-gray-50 flex-shrink-0" />;
};

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <span className="text-gray-500">{label}</span>
    <span className="text-gray-900 text-right">{children}</span>
  </div>
);

const OrderDrawer = ({ employeeId, orderId, onClose }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    getEmployeeOrderDetail(employeeId, orderId)
      .then((res) => alive && setData(res.data))
      .catch((err) => { toast.error(err.response?.data?.message || 'Failed to load order'); onClose(); });
    return () => { alive = false; };
  }, [employeeId, orderId, onClose]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const o = data?.order;
  const p = data?.payment;

  // Portal to <body> so the drawer sits above the dashboard sidebar/header stacking contexts
  return createPortal(
    <div className="fixed inset-0 z-[20000] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-label={`Order ${orderId}`} className="relative w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Order</p>
            <h2 className="font-bold text-gray-900 truncate">{orderId}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close"><FiX /></button>
        </div>

        {!data ? <p className="p-6 text-sm text-gray-500">Loading…</p> : (
          <div className="p-5 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill value={o.status} />
              <span className="text-sm text-gray-500">Placed {fmtDate(o.createdAt, true)} by <strong className="text-gray-800">{data.employee.name}</strong></span>
            </div>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><FiPackage /> Products</h3>
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
                {o.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <ProductThumb src={it.image} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{it.name}</p>
                      <p className="text-xs text-gray-500">{it.quantity} × {money(it.price)}{it.gstRate ? ` + ${it.gstRate}% GST` : ''}</p>
                    </div>
                    <p className="font-semibold text-gray-900 whitespace-nowrap">{money((it.price || 0) * (it.quantity || 0))}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 px-1">
                <Row label="Subtotal">{money(o.subtotal)}</Row>
                <Row label="Shipping">{o.shipping ? money(o.shipping) : 'Free'}</Row>
                <Row label="Tax">{money(o.tax)}</Row>
                {o.discount > 0 && <Row label="Discount">−{money(o.discount)}</Row>}
                <div className="border-t border-gray-100 mt-1 pt-1"><Row label={<strong className="text-gray-900">Total</strong>}><strong>{money(o.total)}</strong></Row></div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><FiDollarSign /> Payment</h3>
              <div className="border border-gray-100 rounded-lg p-3">
                <Row label="Method">{humanize(p.method)}</Row>
                <Row label="Status"><StatusPill value={p.status} /></Row>
                <Row label="Paid from wallet">{money(p.walletAmountUsed)}</Row>
                {p.onlineAmount > 0 && <Row label={p.method === 'cod' ? 'Cash on delivery' : 'Paid online'}>{money(p.onlineAmount)}</Row>}
                {p.gateway?.razorpayPaymentId && <Row label="Transaction ID"><span className="font-mono text-xs">{p.gateway.razorpayPaymentId}</span></Row>}
                {(p.gateway?.cardNetwork || p.gateway?.cardLast4) && <Row label="Card">{[p.gateway.cardNetwork, p.gateway.cardLast4 && `•••• ${p.gateway.cardLast4}`].filter(Boolean).join(' ')}</Row>}
                {p.gateway?.bankName && <Row label="Bank">{p.gateway.bankName}</Row>}
                {p.gateway?.transactionTime && <Row label="Paid at">{fmtDate(p.gateway.transactionTime, true)}</Row>}
                {p.refund?.totalRefunded > 0 && (
                  <Row label="Refunded">{money(p.refund.totalRefunded)} {p.refund.reason ? <span className="text-gray-500">({p.refund.reason})</span> : null}</Row>
                )}
              </div>
            </section>

            {data.walletTransactions.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><FiCreditCard /> Wallet movements</h3>
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
                  {data.walletTransactions.map((t) => (
                    <div key={t._id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-gray-800 truncate">{t.description}</p>
                        <p className="text-xs text-gray-500">{fmtDate(t.createdAt, true)} · balance after {money(t.balanceAfterTransaction)}</p>
                      </div>
                      <span className={`font-semibold whitespace-nowrap ${t.type === 'credit' ? 'text-green-700' : 'text-red-600'}`}>{t.type === 'credit' ? '+' : '−'}{money(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><FiRotateCcw /> Returns</h3>
              {data.returns.length === 0 ? <p className="text-sm text-gray-500">No returns on this order.</p> : (
                <div className="space-y-2">
                  {data.returns.map((r) => (
                    <div key={r._id} className="border border-gray-100 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900">{r.returnId || r._id.slice(-8)}</span>
                        <StatusPill value={r.status} />
                      </div>
                      {r.items.map((it, i) => <p key={i} className="text-gray-700 mt-1">{it.name} × {it.quantity}</p>)}
                      <Row label="Refund">{money(r.refundAmount)} {r.refundStatus && <StatusPill value={r.refundStatus} />}</Row>
                      <Row label="Refund to">{r.refundDetails?.destination || r.refundDestination || '—'}</Row>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {o.shippingAddress && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Delivery address</h3>
                <p className="text-sm text-gray-700">
                  {o.shippingAddress.name}<br />
                  {o.shippingAddress.address}<br />
                  {[o.shippingAddress.city, o.shippingAddress.state, o.shippingAddress.zipCode].filter(Boolean).join(', ')}
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────
const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('orders');
  const [openOrder, setOpenOrder] = useState(null);
  const closeOrder = useCallback(() => setOpenOrder(null), []);

  useEffect(() => {
    setOverview(null);
    setError(null);
    getEmployeePurchaseOverview(id)
      .then((res) => setOverview(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load employee'));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/b2b-dashboard/employee-purchases')} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><FiArrowLeft /> Back</button>
        <div className="bg-white rounded-xl border border-gray-100 p-6 text-gray-600">{error}</div>
      </div>
    );
  }
  if (!overview) return <p className="text-sm text-gray-500">Loading…</p>;

  const { employee: e, stats: s, wallet: w } = overview;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><FiArrowLeft /> Back</button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-full bg-red-50 text-[#D71920] flex items-center justify-center text-lg font-bold flex-shrink-0">
            {(e.name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 truncate">{e.name}</h1>
              <StatusPill value={e.isActive === false ? 'inactive' : 'active'} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1 min-w-0"><FiMail className="flex-shrink-0" /><span className="truncate">{e.email}</span></span>
              {e.phone && <span className="inline-flex items-center gap-1"><FiPhone /> {e.phone}</span>}
              {(e.department || e.designation) && <span className="inline-flex items-center gap-1"><FiBriefcase /> {[e.designation, e.department].filter(Boolean).join(' · ')}</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">Member since {fmtDate(e.createdAt)} · Role: {e.b2bRole || 'Staff'}</p>
          </div>
        </div>
        <div className="md:text-right md:border-l md:border-gray-100 md:pl-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Wallet balance</p>
          <p className="text-2xl font-bold text-gray-900">{money(w.currentBalance)}</p>
          <p className="text-xs text-gray-500">Spending limit: {w.spendingLimit ? money(w.spendingLimit) : 'Unlimited'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Net spend" icon={FiTrendingUp} value={money(s.netSpent)} hint={`${money(s.grossSpent)} gross · ${s.itemsPurchased} items`} />
        <StatCard label="Orders" icon={FiShoppingBag} value={s.placedOrders} hint={`${s.deliveredOrders} delivered · ${s.cancelledOrders} cancelled`} />
        <StatCard label="Returns" icon={FiRotateCcw} value={s.totalReturns} hint={`${money(s.refundedAmount)} refunded${s.pendingRefunds ? ` · ${s.pendingRefunds} pending` : ''}`} />
        <StatCard label="Wallet usage" icon={FiCreditCard} value={money(w.totalDebited)} hint={`${money(w.totalAllotted)} allotted · ${money(w.totalRefundedToWallet)} refunded back`} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex border-b border-gray-100 overflow-x-auto" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? 'border-[#D71920] text-[#D71920]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              <t.icon /> {t.label}
            </button>
          ))}
        </div>
        {tab === 'orders' && <OrdersTab id={id} onOpenOrder={setOpenOrder} />}
        {tab === 'returns' && <ReturnsTab id={id} onOpenOrder={setOpenOrder} />}
        {tab === 'wallet' && <WalletTab id={id} onOpenOrder={setOpenOrder} />}
      </div>

      {openOrder && <OrderDrawer employeeId={id} orderId={openOrder} onClose={closeOrder} />}
    </div>
  );
};

export default EmployeeProfile;
