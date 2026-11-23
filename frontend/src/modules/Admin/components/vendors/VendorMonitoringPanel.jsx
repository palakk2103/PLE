import { useEffect, useState } from 'react';
import { FiX, FiMessageSquare, FiRefreshCw } from 'react-icons/fi';
import api from '../../../../shared/utils/api';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const METHOD = { upi: 'UPI', cod: 'Cash on delivery', card: 'Card', wallet: 'Wallet', bank: 'Bank transfer', cash: 'Cash', mixed: 'Mixed', unknown: 'Not recorded' };
const label = (s) => String(s || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const Stat = ({ title, value, sub, testId }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4" data-testid={testId}>
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

const Transcript = ({ threadId, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    api.get(`/admin/chat-hub/threads/${threadId}/messages`).then((res) => { if (alive) setData(res?.data ?? res); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [threadId]);
  const t = data?.thread;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" data-testid="transcript">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-start justify-between gap-3 p-4 border-b">
          <div>
            <p className="font-bold text-gray-800">{t?.customerName || 'Chat'}{t?.productName ? ` · ${t.productName}` : ''}</p>
            <p className="text-xs text-gray-500">Read-only view · {t ? `started ${when(t.startedAt || t.createdAt)}${t.endedAt ? ` · ended ${when(t.endedAt)}` : ''}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close"><FiX /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {error && <p className="text-sm text-red-600">Could not load this conversation.</p>}
          {!data && !error && <p className="text-sm text-gray-500">Loading…</p>}
          {data?.messages?.length === 0 && <p className="text-sm text-gray-500">No messages.</p>}
          {(data?.messages || []).map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'vendor' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.sender === 'vendor' ? 'bg-purple-50 text-gray-800' : m.sender === 'admin' ? 'bg-amber-50 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>
                <p className="text-[10px] font-bold uppercase text-gray-400 mb-0.5">{m.sender}</p>
                <p className="whitespace-pre-wrap break-words" data-testid="transcript-message">{m.message}</p>
                <p className="text-[10px] text-gray-400 mt-1">{when(m.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** Admin > Vendor detail > Monitoring: how this vendor is doing, counted from real orders, returns and chats. */
const VendorMonitoringPanel = ({ vendorId }) => {
  const [range, setRange] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState({ list: [], total: 0 });
  const [open, setOpen] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    const params = {};
    if (range.from) params.from = range.from;
    if (range.to) params.to = range.to;
    api.get(`/admin/vendors/${vendorId}/monitoring`, { params })
      .then((res) => { if (alive) setData(res?.data ?? res); })
      .catch((err) => { if (alive) setError(err?.response?.data?.message || 'Could not load monitoring data.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [vendorId, range.from, range.to, tick]);

  useEffect(() => {
    let alive = true;
    api.get('/admin/chat-hub/threads', { params: { vendorId, limit: 20 } })
      .then((res) => { const d = res?.data ?? res; if (alive) setThreads({ list: d.threads || [], total: d.pagination?.total || 0 }); })
      .catch(() => { if (alive) setThreads({ list: [], total: 0 }); });
    return () => { alive = false; };
  }, [vendorId, tick]);

  const dateBad = range.from && range.to && range.from > range.to;
  const d = data;
  return (
    <div className="space-y-6" data-testid="vendor-monitoring">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
          <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="mon-from" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
          <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" data-testid="mon-to" />
        </div>
        {(range.from || range.to) && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50" data-testid="mon-clear">All time</button>}
        <button type="button" onClick={() => setTick((t) => t + 1)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1.5"><FiRefreshCw /> Refresh</button>
        <p className="text-xs text-gray-500 pb-2">Dates are India time. Orders, returns and chats follow the range; product counts are always current.</p>
      </div>
      {dateBad && <p className="text-sm text-red-600">"From" is after "To".</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !d && <p className="text-sm text-gray-500">Loading…</p>}

      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat testId="mon-products" title="Products" value={d.products.total} sub={`${d.products.live} live · ${d.products.pendingApproval} awaiting approval · ${d.products.outOfStock} out of stock`} />
            <Stat testId="mon-orders" title="Orders" value={d.orders.total} sub={`${d.orders.sold} sold · ${d.orders.cancelled} cancelled · ${d.orders.returned} returned`} />
            <Stat testId="mon-sales" title="Sales value" value={inr(d.orders.salesValue)} sub={`Average order ${inr(d.orders.averageOrderValue)}`} />
            <Stat testId="mon-customers" title="Unique customers" value={d.customers.unique} sub={`${d.customers.repeat} bought more than once`} />
          </div>
          <p className="text-xs text-gray-500 -mt-3">Sales value counts only this vendor's items in each order (after coupon discount), excluding cancelled and returned orders.</p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 p-4" data-testid="mon-payments">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Payment modes</h3>
              {d.payments.length === 0 ? <p className="text-sm text-gray-500">No sold orders in this range.</p> : (
                <div className="space-y-3">
                  {d.payments.map((p) => (
                    <div key={p.method} data-testid="mon-payment-row">
                      <div className="flex justify-between text-sm"><span className="font-medium text-gray-700">{METHOD[p.method] || label(p.method)}</span><span className="text-gray-600">{p.orders} order{p.orders === 1 ? '' : 's'} · {inr(p.value)} · {p.sharePercent}%</span></div>
                      <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${p.sharePercent}%` }} /></div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{p.paidOrders} paid · {p.orders - p.paidOrders} not yet paid</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4" data-testid="mon-statuses">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Orders by status</h3>
              {d.orders.byStatus.length === 0 ? <p className="text-sm text-gray-500">No orders in this range.</p> : (
                <table className="w-full text-sm">
                  <tbody>
                    {d.orders.byStatus.map((s) => (
                      <tr key={s.status} className="border-b border-gray-100 last:border-0"><td className="py-1.5 text-gray-700">{label(s.status)}</td><td className="py-1.5 text-right text-gray-600">{s.orders}</td><td className="py-1.5 text-right text-gray-600">{inr(s.value)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-[11px] text-gray-400 mt-2">First order {when(d.orders.firstOrderAt)} · latest {when(d.orders.lastOrderAt)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4" data-testid="mon-returns">
            <h3 className="font-bold text-gray-800 text-sm mb-3">Returns and refunds</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Return requests</p><p className="text-lg font-bold">{d.returns.total}</p><p className="text-xs text-gray-500">{d.returns.returnRate}% of orders</p></div>
              <div><p className="text-xs text-gray-500">Open / completed / rejected</p><p className="text-lg font-bold">{d.returns.pending} / {d.returns.completed} / {d.returns.rejected}</p></div>
              <div><p className="text-xs text-gray-500">Value of returns</p><p className="text-lg font-bold">{inr(d.returns.returnValue)}</p></div>
              <div><p className="text-xs text-gray-500">Refunded / still to refund</p><p className="text-lg font-bold">{inr(d.returns.refundedAmount)} / {inr(d.returns.pendingRefundAmount)}</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4" data-testid="mon-chats">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-gray-800 text-sm inline-flex items-center gap-2"><FiMessageSquare /> Chat history</h3>
              <p className="text-xs text-gray-500">{d.chats.total} chats ({d.chats.active} active · {d.chats.resolved} resolved · {d.chats.closed} closed) · {d.chats.enquiries} product enquiries · {d.chats.messages} messages · last activity {when(d.chats.lastActivity)}</p>
            </div>
            {threads.list.length === 0 ? <p className="text-sm text-gray-500">No chats yet.</p> : (
              <div className="divide-y divide-gray-100">
                {threads.list.map((t) => (
                  <button type="button" key={t._id || t.id} onClick={() => setOpen(t._id || t.id)} className="w-full text-left py-2.5 px-1 hover:bg-gray-50 rounded flex items-center justify-between gap-3" data-testid="mon-thread">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{t.customerName || 'Customer'}{t.productName ? ` · ${t.productName}` : t.orderDisplayId ? ` · Order ${t.orderDisplayId}` : ''}</p>
                      <p className="text-xs text-gray-500 truncate">{t.lastMessage || 'No messages'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{label(t.status || 'active')}</span>
                      <p className="text-[11px] text-gray-400 mt-0.5">{when(t.lastActivity)}</p>
                    </div>
                  </button>
                ))}
                {threads.total > threads.list.length && <p className="text-xs text-gray-500 pt-2">Showing the latest {threads.list.length} of {threads.total}. Open the Chat Hub for the full list.</p>}
              </div>
            )}
          </div>
        </>
      )}
      {open && <Transcript threadId={open} onClose={() => setOpen(null)} />}
    </div>
  );
};

export default VendorMonitoringPanel;
