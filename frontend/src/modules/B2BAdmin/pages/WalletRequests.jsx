import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiClock, FiCreditCard, FiInbox } from 'react-icons/fi';
import { getWalletRequests, approveWalletRequest, rejectWalletRequest } from '../services/b2bAdminService';
import { money, fmtDate, StatCard, StatusPill, EmptyRow, inputCls } from '../components/purchases/purchaseUi';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: '', label: 'All' },
];

const errMsg = (e, fallback) => e?.response?.data?.message || e?.message || fallback;

/** Company admin: review employees' wallet top-up requests (approve full/partial, or reject). */
const WalletRequests = () => {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null); // { mode: 'approve'|'reject', request }
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWalletRequests(status ? { status } : {});
      setData(res?.data ?? res);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to load wallet requests'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const openDialog = (mode, request) => {
    setDialog({ mode, request });
    setAmount(mode === 'approve' ? String(request.amount) : '');
    setNote('');
  };

  const submit = async () => {
    if (!dialog || busy) return;
    const { mode, request } = dialog;
    if (mode === 'reject' && note.trim().length < 3) {
      toast.error('Please give a reason for rejecting.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'approve') {
        const res = await approveWalletRequest(request.id, { amount: Number(amount), note: note.trim() });
        const d = res?.data ?? res;
        toast.success(`Approved. ${money(d?.request?.approvedAmount)} sent to ${request.employeeId?.name || 'employee'}.`);
      } else {
        await rejectWalletRequest(request.id, { note: note.trim() });
        toast.success('Request rejected. The employee has been notified.');
      }
      setDialog(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Action failed'));
      if (e?.response?.status === 409) { setDialog(null); load(); }
    } finally {
      setBusy(false);
    }
  };

  const summary = data?.summary || {};
  const requests = data?.requests || [];
  const companyBalance = data?.companyWalletBalance ?? 0;
  const approveAmount = Number(amount);
  const approveTooMuch = dialog?.mode === 'approve' && approveAmount > companyBalance;

  return (
    <div className="space-y-6" data-testid="wallet-requests-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wallet Requests</h1>
        <p className="text-sm text-gray-600">Employees ask for wallet funds here. Approving moves money from the company wallet to the employee.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Pending" icon={FiClock} value={summary.pending || 0} hint={`${money(summary.pendingAmount)} requested`} accent="text-amber-600" />
        <StatCard label="Company wallet" icon={FiCreditCard} value={money(companyBalance)} hint="Available to approve" />
        <StatCard label="Approved" icon={FiCheck} value={summary.approved || 0} />
        <StatCard label="Rejected" icon={FiX} value={summary.rejected || 0} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => setStatus(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${status === t.value ? 'bg-[#D71920] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t.label}{t.value === 'pending' && summary.pending ? ` (${summary.pending})` : ''}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Request</th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <EmptyRow colSpan={6}>Loading…</EmptyRow>
              ) : requests.length === 0 ? (
                <EmptyRow colSpan={6}><span className="inline-flex items-center gap-2"><FiInbox /> No {status || ''} requests</span></EmptyRow>
              ) : requests.map((r) => (
                <tr key={r.id} className="align-top" data-testid="wallet-request-row">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-gray-800">{r.requestNumber}</p>
                    <p className="text-xs text-gray-500">{fmtDate(r.createdAt, true)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{r.employeeId?.name || '—'}</p>
                    <p className="text-xs text-gray-500">{r.employeeId?.email}</p>
                    <p className="text-xs text-gray-500">Balance: {money(r.employeeId?.b2bWalletBalance)}</p>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <p className="font-bold text-gray-900">{money(r.amount)}</p>
                    {r.status === 'approved' && r.approvedAmount !== r.amount && (
                      <p className="text-xs text-green-700">Approved {money(r.approvedAmount)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-gray-700 whitespace-pre-wrap break-words">{r.reason}</p>
                    {r.decisionNote && <p className="mt-1 text-xs text-gray-500">Note: {r.decisionNote}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={r.status} />
                    {r.decidedAt && r.status !== 'pending' && (
                      <p className="text-xs text-gray-500 mt-1">{r.decidedBy?.name ? `${r.decidedBy.name} · ` : ''}{fmtDate(r.decidedAt)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === 'pending' ? (
                      <div className="inline-flex gap-2">
                        <button onClick={() => openDialog('approve', r)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700">Approve</button>
                        <button onClick={() => openDialog('reject', r)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50">Reject</button>
                      </div>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setDialog(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()} data-testid="wallet-request-dialog">
            <h2 className="text-lg font-bold text-gray-900">
              {dialog.mode === 'approve' ? 'Approve request' : 'Reject request'} · {dialog.request.requestNumber}
            </h2>
            <p className="text-sm text-gray-600">
              <strong>{dialog.request.employeeId?.name}</strong> asked for <strong>{money(dialog.request.amount)}</strong>: “{dialog.request.reason}”
            </p>
            {dialog.mode === 'approve' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to send (₹)</label>
                <input type="number" min={1} max={dialog.request.amount} value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} w-full`} data-testid="approve-amount" />
                <p className={`text-xs mt-1 ${approveTooMuch ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                  Company wallet: {money(companyBalance)}{approveTooMuch ? ' — not enough for this amount' : ''}. You can approve less than requested.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{dialog.mode === 'approve' ? 'Note to employee (optional)' : 'Reason for rejecting'}</label>
              <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} w-full`} data-testid="decision-note" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDialog(null)} disabled={busy} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">Cancel</button>
              <button
                onClick={submit}
                disabled={busy || (dialog.mode === 'approve' && (!(approveAmount > 0) || approveAmount > dialog.request.amount || approveTooMuch))}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${dialog.mode === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                data-testid="decision-confirm"
              >
                {busy ? 'Working…' : dialog.mode === 'approve' ? `Send ${money(approveAmount)}` : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletRequests;
