import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiEye, FiLock, FiSearch, FiMessageSquare, FiUser, FiBriefcase, FiTruck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../../../shared/utils/api';

const BASE = '/ple-ops-desk/direct-rfqs';
const STATUSES = ['Pending Vendor', 'Negotiating', 'Vendor Accepted', 'Pending Admin Approval', 'PO Generated', 'Rejected'];
const TONES = {
  'Pending Vendor': 'bg-amber-50 text-amber-700 border-amber-200',
  Negotiating: 'bg-blue-50 text-blue-700 border-blue-200',
  'Vendor Accepted': 'bg-green-50 text-green-700 border-green-200',
  'Pending Admin Approval': 'bg-purple-50 text-purple-700 border-purple-200',
  'PO Generated': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const errMsg = (e, fb) => e?.response?.data?.message || e?.message || fb;

const StatusPill = ({ value }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${TONES[value] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{value}</span>
);

const ReadOnlyBanner = () => (
  <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600" data-testid="read-only-banner">
    <FiLock className="mt-0.5 flex-shrink-0" />
    <p>
      <strong className="text-slate-800">Monitoring only.</strong> Direct RFQs are negotiations between a company's employee and a vendor.
      You can read everything but cannot edit, reply to or approve them.
    </p>
  </div>
);

/** Super Admin: all direct employee -> vendor RFQs (read-only). */
export const AdminDirectRFQs = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ status: '', search: '', from: '', to: '' });
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, search: searchText })); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchText]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page, limit: 20 }).filter(([, v]) => v !== ''));
      const [list, st] = await Promise.all([
        api.get('/admin/direct-rfqs', { params }),
        api.get('/admin/direct-rfqs/stats', { params: { from: filters.from || undefined, to: filters.to || undefined } }),
      ]);
      setData(list?.data ?? list);
      setStats(st?.data ?? st);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load direct RFQs'));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const items = data?.items || [];

  return (
    <div className="space-y-5" data-testid="direct-rfq-monitor">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Direct RFQ Monitor</h1>
        <p className="text-sm text-gray-600">Negotiations between company employees and vendors.</p>
      </div>
      <ReadOnlyBanner />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Total RFQs', stats?.total ?? 0, `${stats?.totalMessages ?? 0} messages`],
          ['Negotiating', stats?.statusCounts?.Negotiating ?? 0, `${stats?.statusCounts?.['Pending Vendor'] ?? 0} awaiting vendor`],
          ['Target value', inr(stats?.targetValue), 'what buyers asked for'],
          ['Agreed value', inr(stats?.agreedValue), `${stats?.statusCounts?.['PO Generated'] ?? 0} POs generated`],
        ].map(([label, value, hint]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{hint}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchText} onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search RFQ id, product, employee, company or vendor…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
              data-testid="direct-rfq-search"
            />
          </div>
          <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" data-testid="direct-rfq-status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={filters.from} onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" aria-label="From date" />
          <input type="date" value={filters.to} onChange={(e) => { setFilters((f) => ({ ...f, to: e.target.value })); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" aria-label="To date" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">RFQ</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Employee · Company</th>
                <th className="px-4 py-3 text-left">Vendor</th>
                <th className="px-4 py-3 text-right">Qty × Target</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Msgs</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No direct RFQs match these filters.</td></tr>
              ) : items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`${BASE}/${r.directRfqId}`)} data-testid="direct-rfq-row">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-gray-800">{r.directRfqId}</p>
                    <p className="text-xs text-gray-500">{when(r.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{r.productName || '—'}{r.category && <p className="text-xs text-gray-500">{r.category}</p>}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{r.employee?.name || '—'}</p>
                    <p className="text-xs text-gray-500">{r.company?.name || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{r.vendor?.storeName || '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <p>{r.quantity} × {inr(r.targetPrice)}</p>
                    {r.lastOffer != null && <p className="text-xs text-blue-700">Last offer {inr(r.lastOffer)}</p>}
                    {r.finalAgreedPrice != null && <p className="text-xs text-emerald-700">Agreed {inr(r.finalAgreedPrice)}</p>}
                  </td>
                  <td className="px-4 py-3"><StatusPill value={r.status} /></td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.messageCount}</td>
                  <td className="px-4 py-3 text-right text-gray-400"><FiEye /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
            <span className="text-gray-500">Page {data.page} of {data.pages} · {data.total} RFQs</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** One direct RFQ with its full negotiation, read-only. */
export const AdminDirectRFQDetail = () => {
  const { id } = useParams();
  const [rfq, setRfq] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get(`/admin/direct-rfqs/${encodeURIComponent(id)}`)
      .then((res) => { if (alive) setRfq(res?.data ?? res); })
      .catch((e) => { if (alive) setError(errMsg(e, 'Could not load this RFQ')); });
    return () => { alive = false; };
  }, [id]);

  if (error) return <div className="space-y-3"><Link to={BASE} className="text-sm text-gray-600 inline-flex items-center gap-1"><FiArrowLeft /> Back</Link><p className="text-red-600">{error}</p></div>;
  if (!rfq) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-5" data-testid="direct-rfq-detail">
      <Link to={BASE} className="text-sm text-gray-600 inline-flex items-center gap-2 hover:text-gray-900"><FiArrowLeft /> Back to Direct RFQs</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-mono">{rfq.directRfqId}</h1>
        <StatusPill value={rfq.status} />
      </div>
      <ReadOnlyBanner />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-1.5 text-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1.5"><FiUser /> Buyer</p>
          <p className="font-semibold text-gray-900">{rfq.employee?.name}</p>
          <p className="text-gray-600">{rfq.employee?.email}</p>
          <p className="text-gray-600 flex items-center gap-1.5"><FiBriefcase className="text-gray-400" />{rfq.company?.name}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-1.5 text-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1.5"><FiTruck /> Vendor</p>
          <p className="font-semibold text-gray-900">{rfq.vendor?.storeName}</p>
          <p className="text-gray-600">Created {when(rfq.createdAt)}</p>
          <p className="text-gray-600">Last activity {when(rfq.lastMessageAt || rfq.updatedAt)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-1.5 text-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Requirement</p>
          <p className="font-semibold text-gray-900">{rfq.productName || '—'}</p>
          <p className="text-gray-600">{rfq.quantity} units · target {inr(rfq.targetPrice)} each ({inr(rfq.targetTotal)})</p>
          {rfq.finalAgreedPrice != null && <p className="text-emerald-700 font-semibold">Agreed price {inr(rfq.finalAgreedPrice)}</p>}
          {rfq.requirementDetails && <p className="text-gray-600 whitespace-pre-wrap">{rfq.requirementDetails}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 text-sm font-semibold text-gray-800"><FiMessageSquare /> Negotiation ({rfq.messages?.length || 0})</div>
        <div className="p-4 space-y-3 bg-slate-50/60 max-h-[520px] overflow-y-auto" data-testid="direct-rfq-transcript">
          {(rfq.messages || []).length === 0 && <p className="text-sm text-gray-500 text-center py-6">No messages yet.</p>}
          {(rfq.messages || []).map((m) => {
            const mine = m.senderType === 'Employee';
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${mine ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${mine ? 'text-indigo-200' : 'text-emerald-700'}`}>{m.senderName} · {m.senderType}</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  {m.priceOffer != null && <p className={`mt-1.5 text-xs font-bold ${mine ? 'text-amber-200' : 'text-blue-700'}`}>Price offer: {inr(m.priceOffer)}</p>}
                  <p className={`text-[10px] mt-1 text-right ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>{when(m.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDirectRFQs;
