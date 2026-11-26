import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiX, FiUpload, FiCheckCircle, FiSlash, FiUserCheck } from 'react-icons/fi';
import {
  getPOSignatories,
  createPOSignatory,
  updatePOSignatory,
  setPOSignatoryVerification,
  revokePOSignatory,
  uploadPOSignatoryEvidence,
} from '../services/b2bAdminService';
import { money, fmtDate, humanize, StatusPill, EmptyRow, inputCls } from '../components/purchases/purchaseUi';

const errMsg = (e, fallback) => e?.response?.data?.message || e?.message || fallback;

const PO_TYPES = ['standard', 'blanket', 'contract', 'planned', 'service', 'emergency'];
const BASES = [
  ['board_resolution', 'Board resolution'],
  ['delegation_of_authority', 'Delegation of authority'],
  ['power_of_attorney', 'Power of attorney'],
  ['other', 'Other company record'],
];
const METHODS = [
  ['wet_ink_scan', 'Wet-ink signed scan'],
  ['e_signature', 'Provider e-signature'],
  ['digital_certificate', 'Certificate-backed digital signature'],
];
const STATUS_TONE = { verified: 'green', pending_verification: 'amber', unverified: 'gray', suspended: 'amber', revoked: 'red', expired: 'red' };

const todayInput = () => new Date().toISOString().slice(0, 10);
const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

const emptyForm = () => ({
  fullName: '', designation: '', department: '', employeeRef: '',
  authorityBasis: 'board_resolution', approvalLimit: '', signatureMethod: 'wet_ink_scan',
  effectiveFrom: todayInput(), effectiveTo: '', scopeDepartments: '', scopePoTypes: [],
});

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
  </label>
);

/** Company admin: who may bind the company for procurement, within what limit/scope/period. */
const POSignatories = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { id?: string }
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [evidenceFor, setEvidenceFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPOSignatories();
      setList(res?.data ?? []);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load signatories'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm()); setModal({}); };
  const openEdit = (s) => {
    setForm({
      fullName: s.fullName, designation: s.designation, department: s.department || '', employeeRef: s.employeeRef || '',
      authorityBasis: s.authorityBasis, approvalLimit: s.approvalLimit ?? '', signatureMethod: s.signatureMethod,
      effectiveFrom: s.effectiveFrom?.slice(0, 10) || '', effectiveTo: s.effectiveTo?.slice(0, 10) || '',
      scopeDepartments: (s.scope?.departments || []).join(', '), scopePoTypes: s.scope?.poTypes || [],
    });
    setModal({ id: s.id });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      fullName: form.fullName, designation: form.designation, department: form.department, employeeRef: form.employeeRef,
      authorityBasis: form.authorityBasis, signatureMethod: form.signatureMethod,
      approvalLimit: form.approvalLimit === '' ? null : Number(form.approvalLimit),
      effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null,
      scope: { departments: csv(form.scopeDepartments), poTypes: form.scopePoTypes },
    };
    try {
      if (modal.id) await updatePOSignatory(modal.id, payload);
      else await createPOSignatory(payload);
      toast.success(modal.id ? 'Signatory updated' : 'Signatory added');
      setModal(null);
      load();
    } catch (err) {
      toast.error(errMsg(err, 'Could not save signatory'));
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn, okMsg) => {
    try {
      await fn();
      toast.success(okMsg);
      load();
    } catch (err) {
      toast.error(errMsg(err, 'Action failed'));
    }
  };

  const onEvidenceChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && evidenceFor) run(() => uploadPOSignatoryEvidence(evidenceFor, file), 'Evidence uploaded');
  };

  const verify = (s) => {
    const note = window.prompt(
      s.signatureMethod === 'wet_ink_scan'
        ? 'Mark as verified? This records a document review (not cryptographic verification). Optional note:'
        : 'Mark as verified? Optional note:',
      ''
    );
    if (note === null) return;
    run(() => setPOSignatoryVerification(s.id, { status: 'verified', note }), 'Marked as verified');
  };

  const revoke = (s) => {
    const reason = window.prompt(`Revoke ${s.fullName}'s authority? Enter a reason:`, '');
    if (reason === null) return;
    run(() => revokePOSignatory(s.id, { reason }), 'Signatory revoked');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Authorized Signatories</h1>
          <p className="text-sm text-gray-500">People who may sign Purchase Orders for your company, with their limit and scope. They do not need a login.</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D71920] text-white text-sm font-semibold hover:bg-[#B51218]">
          <FiPlus /> Add signatory
        </button>
      </div>

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onEvidenceChosen} />

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Authority</th>
              <th className="text-left px-4 py-3">Limit</th>
              <th className="text-left px-4 py-3">Valid</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Evidence</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <EmptyRow colSpan={7}>Loading…</EmptyRow> : list.length === 0 ? (
              <EmptyRow colSpan={7}>No signatories yet. Add one before activating a PO.</EmptyRow>
            ) : list.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{s.fullName}</p>
                  <p className="text-xs text-gray-500">{s.designation}{s.department ? ` · ${s.department}` : ''}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {humanize(s.authorityBasis)}
                  <p className="text-gray-400">{humanize(s.signatureMethod)}</p>
                </td>
                <td className="px-4 py-3">{s.approvalLimit == null ? 'No limit set' : money(s.approvalLimit)}</td>
                <td className="px-4 py-3 text-xs">{fmtDate(s.effectiveFrom)} → {s.effectiveTo ? fmtDate(s.effectiveTo) : 'open'}</td>
                <td className="px-4 py-3"><StatusPill value={s.effectiveStatus} tone={STATUS_TONE[s.effectiveStatus]} /></td>
                <td className="px-4 py-3 text-xs">
                  {s.evidenceDocument?.url
                    ? <a href={s.evidenceDocument.url} target="_blank" rel="noreferrer" className="text-[#D71920] underline">{s.evidenceDocument.fileName || 'View'}</a>
                    : <span className="text-gray-400">None</span>}
                </td>
                <td className="px-4 py-3">
                  {s.verificationStatus !== 'revoked' && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      <button onClick={() => openEdit(s)} className="px-2 py-1 rounded-md border border-gray-200 text-xs hover:bg-gray-50">Edit</button>
                      <button onClick={() => { setEvidenceFor(s.id); fileRef.current?.click(); }} className="px-2 py-1 rounded-md border border-gray-200 text-xs hover:bg-gray-50 inline-flex items-center gap-1"><FiUpload /> Evidence</button>
                      {s.verificationStatus !== 'verified' && (
                        <button onClick={() => verify(s)} className="px-2 py-1 rounded-md border border-green-200 text-green-700 text-xs hover:bg-green-50 inline-flex items-center gap-1"><FiCheckCircle /> Verify</button>
                      )}
                      {s.verificationStatus === 'verified' && (
                        <button onClick={() => run(() => setPOSignatoryVerification(s.id, { status: 'suspended' }), 'Signatory suspended')} className="px-2 py-1 rounded-md border border-amber-200 text-amber-700 text-xs hover:bg-amber-50 inline-flex items-center gap-1"><FiUserCheck /> Suspend</button>
                      )}
                      <button onClick={() => revoke(s)} className="px-2 py-1 rounded-md border border-red-200 text-red-600 text-xs hover:bg-red-50 inline-flex items-center gap-1"><FiSlash /> Revoke</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[20000] bg-black/50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{modal.id ? 'Edit signatory' : 'Add signatory'}</h2>
              <button type="button" onClick={() => setModal(null)} className="p-1 text-gray-500 hover:text-gray-900"><FiX /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full legal name *"><input required className={`${inputCls} w-full`} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
              <Field label="Designation *"><input required className={`${inputCls} w-full`} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
              <Field label="Department"><input className={`${inputCls} w-full`} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
              <Field label="Employee reference" hint="Internal ID only"><input className={`${inputCls} w-full`} value={form.employeeRef} onChange={(e) => setForm({ ...form, employeeRef: e.target.value })} /></Field>
              <Field label="Authority basis *">
                <select className={`${inputCls} w-full`} value={form.authorityBasis} onChange={(e) => setForm({ ...form, authorityBasis: e.target.value })}>
                  {BASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Signature method">
                <select className={`${inputCls} w-full`} value={form.signatureMethod} onChange={(e) => setForm({ ...form, signatureMethod: e.target.value })}>
                  {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Approval limit (₹)" hint="Leave empty for no limit"><input type="number" min="0" className={`${inputCls} w-full`} value={form.approvalLimit} onChange={(e) => setForm({ ...form, approvalLimit: e.target.value })} /></Field>
              <Field label="Scope: departments" hint="Comma separated. Empty = all"><input className={`${inputCls} w-full`} value={form.scopeDepartments} onChange={(e) => setForm({ ...form, scopeDepartments: e.target.value })} /></Field>
              <Field label="Effective from *"><input required type="date" className={`${inputCls} w-full`} value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></Field>
              <Field label="Effective to" hint="Empty = no end date"><input type="date" className={`${inputCls} w-full`} value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} /></Field>
            </div>
            <Field label="Scope: PO types" hint="None selected = all types">
              <div className="flex flex-wrap gap-2">
                {PO_TYPES.map((t) => (
                  <label key={t} className="inline-flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={form.scopePoTypes.includes(t)}
                      onChange={(e) => setForm({ ...form, scopePoTypes: e.target.checked ? [...form.scopePoTypes, t] : form.scopePoTypes.filter((x) => x !== t) })} />
                    {humanize(t)}
                  </label>
                ))}
              </div>
            </Field>
            <p className="text-xs text-gray-500">Changing authority details on a verified signatory sends it back for re-verification. Upload the authority evidence, then click Verify.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancel</button>
              <button disabled={busy} className="px-4 py-2 rounded-lg bg-[#D71920] text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default POSignatories;
