import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiX, FiUpload, FiSearch, FiFileText, FiDollarSign, FiClock, FiAlertCircle } from 'react-icons/fi';
import {
  getCompanyPOs,
  getCompanyPOStats,
  getCompanyPO,
  createCompanyPO,
  activateCompanyPO,
  revokeCompanyPO,
  closeCompanyPO,
  uploadCompanyPODocument,
  getPOSignatories,
  getEmployees,
} from '../services/b2bAdminService';
import { money, fmtDate, humanize, StatusPill, StatCard, Pager, EmptyRow, inputCls } from '../components/purchases/purchaseUi';

const errMsg = (e, fallback) => e?.response?.data?.message || e?.message || fallback;

const PO_TYPES = ['standard', 'blanket', 'contract', 'planned', 'service', 'emergency'];
const USAGE_POLICIES = [['single_use', 'Single use (one order)'], ['multi_use', 'Multi use'], ['blanket', 'Blanket / limit based']];
const TABS = [
  ['', 'All'], ['draft', 'Draft'], ['active', 'Active'], ['unused', 'Unused', 'usage'], ['partially_used', 'Partially used', 'usage'],
  ['reserved', 'Reserved', 'usage'], ['exhausted', 'Exhausted', 'usage'], ['expired', 'Expired'], ['revoked', 'Revoked'],
];
const LIFE_TONE = { active: 'green', draft: 'gray', expired: 'red', revoked: 'red', closed: 'gray', awaiting_signature: 'amber', pending_company_approval: 'amber' };
const USAGE_TONE = { unused: 'gray', reserved: 'blue', partially_used: 'amber', exhausted: 'red' };
const REVIEW_TONE = { accepted: 'green', rejected: 'red', pending_verification: 'amber', correction_requested: 'amber', on_hold: 'amber', not_submitted: 'gray' };

const emptyForm = () => ({
  poNumber: '', title: '', poType: 'standard', department: '', issueDate: new Date().toISOString().slice(0, 10), expiryDate: '',
  originalValue: '', usagePolicy: 'multi_use', signatoryId: '', paymentTerms: '', scopeNotes: '',
  allocMode: 'company', allocDepartments: '', allocUserIds: [],
});

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
  </label>
);

const BalanceBar = ({ po }) => {
  const total = po.originalValue || 1;
  const pct = (n) => `${Math.min(100, ((n || 0) / total) * 100)}%`;
  return (
    <div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
        <div className="bg-gray-700" style={{ width: pct(po.consumedAmount) }} title="Consumed" />
        <div className="bg-blue-400" style={{ width: pct(po.reservedAmount) }} title="Reserved" />
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
        <div><p className="text-gray-500">Original</p><p className="font-bold">{money(po.originalValue)}</p></div>
        <div><p className="text-gray-500">Consumed</p><p className="font-bold">{money(po.consumedAmount)}</p></div>
        <div><p className="text-gray-500">Reserved</p><p className="font-bold">{money(po.reservedAmount)}</p></div>
        <div><p className="text-gray-500">Available</p><p className="font-bold text-green-700">{money(po.availableAmount)}</p></div>
      </div>
    </div>
  );
};

/** Company admin: the PO registry. Lifecycle, usage and PLE review status are shown separately. */
const CompanyPOs = () => {
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signatories, setSignatories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const docRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const t = TABS.find((x) => x[0] === tab);
    const params = { page, limit: 15 };
    if (search.trim()) params.q = search.trim();
    if (tab) params[t?.[2] === 'usage' ? 'usage' : 'status'] = tab;
    try {
      const [list, st] = await Promise.all([getCompanyPOs(params), getCompanyPOStats()]);
      setData(list?.data ?? null);
      setStats(st?.data ?? null);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load purchase orders'));
    } finally {
      setLoading(false);
    }
  }, [tab, search, page]);

  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [load, search]);

  useEffect(() => {
    getPOSignatories().then((r) => setSignatories(r?.data ?? [])).catch(() => null);
    getEmployees().then((r) => {
      const d = r?.data;
      setEmployees(Array.isArray(d) ? d : d?.employees || []);
    }).catch(() => null);
  }, []);

  const openDetail = async (id) => {
    try {
      const r = await getCompanyPO(id);
      setDetail(r?.data);
    } catch (e) {
      toast.error(errMsg(e, 'Could not open PO'));
    }
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      poNumber: form.poNumber, title: form.title, poType: form.poType, department: form.department,
      issueDate: form.issueDate, expiryDate: form.expiryDate || null, originalValue: Number(form.originalValue),
      usagePolicy: form.usagePolicy, signatoryId: form.signatoryId || null, paymentTerms: form.paymentTerms,
      purchaseScope: { notes: form.scopeNotes },
      allocation: {
        mode: form.allocMode,
        departments: form.allocDepartments.split(',').map((x) => x.trim()).filter(Boolean),
        userIds: form.allocUserIds,
      },
    };
    try {
      const r = await createCompanyPO(payload);
      toast.success('PO saved as draft. Upload the document, then activate it.');
      setShowAdd(false);
      setForm(emptyForm());
      setPage(1);
      load();
      if (r?.data?.id) openDetail(r.data.id);
    } catch (err) {
      toast.error(errMsg(err, 'Could not save PO'));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn, okMsg) => {
    try {
      await fn();
      toast.success(okMsg);
      if (detail?.id) await openDetail(detail.id); // refetch so the signatory name is populated
      load();
    } catch (err) {
      toast.error(errMsg(err, 'Action failed'));
    }
  };

  const onDocChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && detail) act(() => uploadCompanyPODocument(detail.id, file), 'Document uploaded');
  };

  const items = data?.items || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Company Purchase Orders</h1>
          <p className="text-sm text-gray-500">Register your POs once, track their balance, and let employees use them at checkout.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D71920] text-white text-sm font-semibold hover:bg-[#B51218]">
          <FiPlus /> Register PO
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Active PO value" value={money(stats.activeValue)} hint={`${stats.active} active POs`} icon={FiFileText} />
          <StatCard label="Available" value={money(stats.availableValue)} accent="text-green-700" icon={FiDollarSign} />
          <StatCard label="Reserved" value={money(stats.reservedValue)} hint={`Consumed ${money(stats.consumedValue)}`} accent="text-blue-700" icon={FiClock} />
          <StatCard label="Expiring in 30 days" value={stats.expiringIn30Days} hint={`${stats.exhausted} exhausted · ${stats.expired} expired`} accent={stats.expiringIn30Days ? 'text-amber-600' : 'text-gray-900'} icon={FiAlertCircle} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search PO number or title" className={`${inputCls} pl-9 w-64`} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map(([v, l]) => (
            <button key={v || 'all'} onClick={() => { setTab(v); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${tab === v ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">PO</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Signatory</th>
              <th className="text-right px-4 py-3">Value / Available</th>
              <th className="text-left px-4 py-3">Validity</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <EmptyRow colSpan={6}>Loading…</EmptyRow> : items.length === 0 ? (
              <EmptyRow colSpan={6}>No purchase orders found.</EmptyRow>
            ) : items.map((po) => (
              <tr key={po.id} onClick={() => openDetail(po.id)} className="cursor-pointer hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{po.poNumber}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[220px]">{po.title} · {humanize(po.poType)}</p>
                  <p className="text-[10px] font-mono text-gray-400">{po.plePoId}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{po.department || '—'}</td>
                <td className="px-4 py-3 text-xs">{po.signatoryId?.fullName || <span className="text-gray-400">Not set</span>}</td>
                <td className="px-4 py-3 text-right">
                  <p className="font-semibold">{money(po.originalValue)}</p>
                  <p className="text-xs text-green-700">{money(po.availableAmount)} left</p>
                </td>
                <td className="px-4 py-3 text-xs">{fmtDate(po.issueDate)}<br />→ {po.expiryDate ? fmtDate(po.expiryDate) : 'no expiry'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 items-start">
                    <StatusPill value={po.lifecycleStatus} tone={LIFE_TONE[po.lifecycleStatus]} />
                    <StatusPill value={po.usageStatus} tone={USAGE_TONE[po.usageStatus]} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={data?.page || 1} pages={data?.pages || 1} total={data?.total || 0} onChange={setPage} />
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[20000] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <form onSubmit={submitAdd} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Register a Purchase Order</h2>
              <button type="button" onClick={() => setShowAdd(false)} className="p-1 text-gray-500 hover:text-gray-900"><FiX /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="PO number *" hint="Must be unique in your company"><input required className={`${inputCls} w-full`} value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} /></Field>
              <Field label="Title *"><input required className={`${inputCls} w-full`} placeholder="Laptop refresh – Q4" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="PO type *">
                <select className={`${inputCls} w-full`} value={form.poType} onChange={(e) => setForm({ ...form, poType: e.target.value })}>
                  {PO_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                </select>
              </Field>
              <Field label="Usage policy *">
                <select className={`${inputCls} w-full`} value={form.usagePolicy} onChange={(e) => setForm({ ...form, usagePolicy: e.target.value })}>
                  {USAGE_POLICIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Original authorized value (₹) *"><input required type="number" min="1" step="0.01" className={`${inputCls} w-full`} value={form.originalValue} onChange={(e) => setForm({ ...form, originalValue: e.target.value })} /></Field>
              <Field label="Department / cost centre"><input className={`${inputCls} w-full`} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
              <Field label="Issue date *"><input required type="date" max={new Date().toISOString().slice(0, 10)} className={`${inputCls} w-full`} value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></Field>
              <Field label="Expiry date" hint="Leave empty if the PO has no end date"><input type="date" className={`${inputCls} w-full`} value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></Field>
              <Field label="Authorized signatory" hint="Must be verified and within limit before the PO can be activated">
                <select className={`${inputCls} w-full`} value={form.signatoryId} onChange={(e) => setForm({ ...form, signatoryId: e.target.value })}>
                  <option value="">Select later</option>
                  {signatories.filter((s) => !['revoked'].includes(s.verificationStatus)).map((s) => <option key={s.id} value={s.id}>{s.fullName} ({humanize(s.effectiveStatus)})</option>)}
                </select>
              </Field>
              <Field label="Payment terms" hint="As stated on the PO. This is not a credit facility from PLE"><input className={`${inputCls} w-full`} placeholder="NET 30" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
            </div>
            <Field label="Purchase scope / restrictions"><textarea rows={2} className={`${inputCls} w-full`} value={form.scopeNotes} onChange={(e) => setForm({ ...form, scopeNotes: e.target.value })} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Who can use this PO">
                <select className={`${inputCls} w-full`} value={form.allocMode} onChange={(e) => setForm({ ...form, allocMode: e.target.value })}>
                  <option value="company">Whole company</option>
                  <option value="departments">Selected departments</option>
                  <option value="users">Named employees</option>
                </select>
              </Field>
              {form.allocMode === 'departments' && (
                <Field label="Departments" hint="Comma separated"><input className={`${inputCls} w-full`} value={form.allocDepartments} onChange={(e) => setForm({ ...form, allocDepartments: e.target.value })} /></Field>
              )}
              {form.allocMode === 'users' && (
                <Field label="Employees">
                  <select multiple className={`${inputCls} w-full h-28`} value={form.allocUserIds}
                    onChange={(e) => setForm({ ...form, allocUserIds: [...e.target.selectedOptions].map((o) => o.value) })}>
                    {employees.map((u) => <option key={u._id || u.id} value={u._id || u.id}>{u.name || u.email}</option>)}
                  </select>
                </Field>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancel</button>
              <button disabled={busy} className="px-4 py-2 rounded-lg bg-[#D71920] text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save as draft'}</button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-[20000] bg-black/50 flex justify-end" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-xl h-full overflow-y-auto p-6 space-y-5">
            <input ref={docRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onDocChosen} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{detail.poNumber}</h2>
                <p className="text-sm text-gray-500">{detail.title}</p>
                <p className="text-[11px] font-mono text-gray-400">{detail.plePoId}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 text-gray-500 hover:text-gray-900"><FiX /></button>
            </div>

            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="text-gray-500">Lifecycle</span><StatusPill value={detail.lifecycleStatus} tone={LIFE_TONE[detail.lifecycleStatus]} />
              <span className="text-gray-500">Usage</span><StatusPill value={detail.usageStatus} tone={USAGE_TONE[detail.usageStatus]} />
              <span className="text-gray-500">PLE review</span><StatusPill value={detail.pleReviewStatus} tone={REVIEW_TONE[detail.pleReviewStatus]} />
            </div>

            <BalanceBar po={detail} />

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-gray-500">Type</dt><dd>{humanize(detail.poType)}</dd></div>
              <div><dt className="text-xs text-gray-500">Usage policy</dt><dd>{humanize(detail.usagePolicy)}</dd></div>
              <div><dt className="text-xs text-gray-500">Department</dt><dd>{detail.department || '—'}</dd></div>
              <div><dt className="text-xs text-gray-500">Signatory</dt><dd>{detail.signatoryId?.fullName || 'Not set'}</dd></div>
              <div><dt className="text-xs text-gray-500">Issued</dt><dd>{fmtDate(detail.issueDate)}</dd></div>
              <div><dt className="text-xs text-gray-500">Expires</dt><dd>{detail.expiryDate ? fmtDate(detail.expiryDate) : 'No expiry'}</dd></div>
              <div><dt className="text-xs text-gray-500">Available to</dt><dd>{humanize(detail.allocation?.mode)}{detail.allocation?.departments?.length ? `: ${detail.allocation.departments.join(', ')}` : ''}</dd></div>
              <div><dt className="text-xs text-gray-500">Payment terms</dt><dd>{detail.paymentTerms || '—'}</dd></div>
            </dl>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">Documents</h3>
                {!['revoked', 'closed'].includes(detail.storedLifecycleStatus) && (
                  <button onClick={() => docRef.current?.click()} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-xs hover:bg-gray-50"><FiUpload /> Upload {detail.documents?.length ? 'new version' : 'PO document'}</button>
                )}
              </div>
              {detail.documents?.length ? (
                <ul className="space-y-1.5">
                  {[...detail.documents].reverse().map((d) => (
                    <li key={d.version} className="flex items-center justify-between text-xs border border-gray-100 rounded-lg px-3 py-2">
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-[#D71920] underline truncate">v{d.version} · {d.fileName || 'document'}</a>
                      <span className="text-gray-400 ml-2 whitespace-nowrap">{fmtDate(d.uploadedAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-gray-500">No document uploaded yet. Required before activation.</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              {['draft', 'pending_company_approval', 'awaiting_signature'].includes(detail.storedLifecycleStatus) && (
                <button onClick={() => act(() => activateCompanyPO(detail.id), 'PO is now active')} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">Activate</button>
              )}
              {detail.storedLifecycleStatus === 'active' && (
                <button onClick={() => { if (window.confirm('Close this PO? It will no longer be selectable.')) act(() => closeCompanyPO(detail.id, {}), 'PO closed'); }} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Close</button>
              )}
              {!['revoked', 'closed'].includes(detail.storedLifecycleStatus) && (
                <button onClick={() => { const reason = window.prompt('Revoke this PO? Enter a reason:'); if (reason) act(() => revokeCompanyPO(detail.id, { reason }), 'PO revoked'); }} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50">Revoke</button>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold mb-2">History</h3>
              <ol className="space-y-1.5 border-l border-gray-200 pl-3">
                {[...(detail.history || [])].reverse().map((h, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-semibold">{humanize(h.action)}</span>
                    <span className="text-gray-400"> · {fmtDate(h.at, true)}</span>
                    {h.note && <p className="text-gray-500">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyPOs;
