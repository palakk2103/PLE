import { useCallback, useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiStar, FiShield, FiX, FiCreditCard, FiSmartphone } from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  getVendorBankAccounts,
  addVendorBankAccount,
  editVendorBankAccount,
  makeVendorBankAccountPreferred,
  removeVendorBankAccount,
} from '../../services/vendorService';

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER = /^\d{9,18}$/;
const UPI = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const EMPTY = { label: '', accountName: '', accountNumber: '', ifscCode: '', bankName: '', branchName: '', accountType: '', upiId: '', isPreferred: false };
const field = 'w-full px-3 py-2 border border-gray-300 dark:border-white/10 dark:bg-[#222] dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';
const errText = (e, fb) => e?.response?.data?.message || e?.message || fb;

/** Several payout accounts per vendor, one preferred. Account numbers are always shown masked. */
const BankAccountsManager = ({ isManaged = false }) => {
  const [state, setState] = useState({ loading: true, accounts: [], max: 5, canAddMore: true });
  const [editing, setEditing] = useState(null); // null | { id?: string, ...fields }
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const apply = (data) => setState({ loading: false, accounts: data?.accounts || [], max: data?.max || 5, canAddMore: data?.canAddMore !== false });

  const load = useCallback(async () => {
    try {
      const res = await getVendorBankAccounts();
      apply(res?.data ?? res);
    } catch (e) {
      setState((s) => ({ ...s, loading: false }));
      toast.error(errText(e, 'Could not load payout accounts'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setErrors({});
    setForm({ ...EMPTY, isPreferred: state.accounts.length === 0 });
    setEditing({});
  };
  const openEdit = (a) => {
    setErrors({});
    setForm({ ...EMPTY, label: a.label, accountName: a.accountName, ifscCode: a.ifscCode, bankName: a.bankName, branchName: a.branchName, accountType: a.accountType, upiId: a.upiId });
    setEditing(a);
  };

  const validate = (isEdit) => {
    const e = {};
    if (!form.accountName.trim() || form.accountName.trim().length < 2) e.accountName = 'Enter the account holder name.';
    const num = form.accountNumber.replace(/\s+/g, '');
    const ifsc = form.ifscCode.trim().toUpperCase();
    const touchedBank = !isEdit || num || ifsc !== (editing?.ifscCode || '');
    if (num && !ACCOUNT_NUMBER.test(num)) e.accountNumber = 'Account number must be 9 to 18 digits.';
    if (ifsc && !IFSC.test(ifsc)) e.ifscCode = 'IFSC looks wrong (for example HDFC0001234).';
    if (form.upiId && !UPI.test(form.upiId.trim())) e.upiId = 'UPI ID should look like name@bank.';
    if (!isEdit) {
      if (Boolean(num) !== Boolean(ifsc)) e[num ? 'ifscCode' : 'accountNumber'] = 'A bank account needs both the number and the IFSC.';
      if (num && !form.bankName.trim()) e.bankName = 'Enter the bank name.';
      if (!num && !form.upiId.trim()) e.accountNumber = 'Add a bank account or a UPI ID.';
    } else if (touchedBank && num && !ifsc) {
      e.ifscCode = 'Enter the IFSC code.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (ev) => {
    ev.preventDefault();
    const isEdit = Boolean(editing?.id);
    if (!validate(isEdit) || busy) return;
    const payload = {
      label: form.label.trim(),
      accountName: form.accountName.trim(),
      bankName: form.bankName.trim(),
      branchName: form.branchName.trim(),
      accountType: form.accountType,
      ifscCode: form.ifscCode.trim().toUpperCase(),
      upiId: form.upiId.trim(),
    };
    const num = form.accountNumber.replace(/\s+/g, '');
    if (num || !isEdit) payload.accountNumber = num;
    if (!isEdit && form.isPreferred) payload.isPreferred = true;
    setBusy(true);
    try {
      const res = isEdit ? await editVendorBankAccount(editing.id, payload) : await addVendorBankAccount(payload);
      apply(res?.data ?? res);
      setEditing(null);
      toast.success(isEdit ? 'Payout account updated.' : 'Payout account added.');
    } catch (e) {
      setErrors({ form: errText(e, 'Could not save the account') });
    } finally {
      setBusy(false);
    }
  };

  const makePreferred = async (a) => {
    try {
      const res = await makeVendorBankAccountPreferred(a.id);
      apply(res?.data ?? res);
      toast.success('Payouts will now go to this account.');
    } catch (e) { toast.error(errText(e, 'Could not change the preferred account')); }
  };

  const remove = async () => {
    if (!confirmRemove) return;
    try {
      const res = await removeVendorBankAccount(confirmRemove.id);
      apply(res?.data ?? res);
      toast.success('Payout account removed.');
    } catch (e) { toast.error(errText(e, 'Could not remove the account')); }
    setConfirmRemove(null);
  };

  if (state.loading) return <p className="text-sm text-gray-500 py-6">Loading payout accounts…</p>;

  return (
    <div className="space-y-5" data-testid="bank-accounts-manager">
      {isManaged && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-800 dark:text-amber-200 flex items-start gap-3">
          <FiShield className="text-xl mt-0.5 flex-shrink-0 text-amber-600" />
          <p className="text-sm">Your payout accounts are managed by the Shop Administrator. Editing is disabled for managed accounts.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Payout accounts</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Payouts are sent to your <strong>preferred</strong> account. You can keep up to {state.max}.</p>
        </div>
        {!isManaged && (
          <button type="button" onClick={openAdd} disabled={!state.canAddMore} className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed" data-testid="add-bank-account">
            <FiPlus /> Add account
          </button>
        )}
      </div>

      {state.accounts.length === 0 ? (
        <div className="p-6 border border-dashed border-gray-300 dark:border-white/15 rounded-xl text-center text-sm text-gray-600 dark:text-gray-400" data-testid="no-bank-accounts">
          No payout account yet. Add a bank account or a UPI ID to receive payouts.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {state.accounts.map((a) => (
            <div key={a.id} className={`rounded-xl border p-4 space-y-3 ${a.isPreferred ? 'border-purple-400 bg-purple-50/50 dark:bg-purple-950/20' : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#1f1f1f]'}`} data-testid="bank-account-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {a.maskedAccountNumber ? <FiCreditCard className="text-gray-500 flex-shrink-0" /> : <FiSmartphone className="text-gray-500 flex-shrink-0" />}
                  <p className="font-semibold text-gray-800 dark:text-white truncate">{a.label || a.bankName || 'UPI'}</p>
                </div>
                {a.isPreferred && <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white whitespace-nowrap" data-testid="preferred-badge"><FiStar /> Preferred</span>}
              </div>
              <dl className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Holder</dt><dd className="font-medium text-right truncate">{a.accountName}</dd></div>
                {a.maskedAccountNumber && <div className="flex justify-between gap-3"><dt className="text-gray-500">Account</dt><dd className="font-mono">{a.maskedAccountNumber}</dd></div>}
                {a.bankName && <div className="flex justify-between gap-3"><dt className="text-gray-500">Bank</dt><dd className="text-right">{a.bankName}{a.branchName ? ` · ${a.branchName}` : ''}</dd></div>}
                {a.ifscCode && <div className="flex justify-between gap-3"><dt className="text-gray-500">IFSC</dt><dd className="font-mono">{a.ifscCode}</dd></div>}
                {a.upiId && <div className="flex justify-between gap-3"><dt className="text-gray-500">UPI</dt><dd className="font-mono">{a.upiId}</dd></div>}
              </dl>
              {a.paymentsReceived > 0 && <p className="text-xs text-gray-500">{a.paymentsReceived} payout{a.paymentsReceived === 1 ? '' : 's'} received</p>}
              {!isManaged && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {!a.isPreferred && <button type="button" onClick={() => makePreferred(a)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/30" data-testid="make-preferred">Make preferred</button>}
                  <button type="button" onClick={() => openEdit(a)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-white/15 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 inline-flex items-center gap-1" data-testid="edit-account"><FiEdit2 /> Edit</button>
                  <button type="button" onClick={() => setConfirmRemove(a)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 inline-flex items-center gap-1" data-testid="remove-account"><FiTrash2 /> Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-3 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800/40 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
        For your security we email you whenever a payout account is added, changed, removed or made preferred. A withdrawal request is sent to the account that is preferred <em>at that moment</em>.
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4" data-testid="bank-account-form">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-gray-800 dark:text-white">{editing.id ? 'Edit payout account' : 'Add payout account'}</h4>
              <button type="button" onClick={() => setEditing(null)} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Close"><FiX /></button>
            </div>
            {errors.form && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2" data-testid="bank-form-error">{errors.form}</p>}

            {[
              ['label', 'Nickname (optional)', 'e.g. HDFC current account'],
              ['accountName', 'Account holder name *', ''],
              ['accountNumber', editing.id && editing.maskedAccountNumber ? `Account number (now ${editing.maskedAccountNumber}; leave blank to keep)` : 'Account number', '9 to 18 digits'],
              ['ifscCode', 'IFSC code', 'HDFC0001234'],
              ['bankName', 'Bank name', ''],
              ['branchName', 'Branch (optional)', ''],
              ['upiId', 'UPI ID (optional)', 'name@bank'],
            ].map(([name, label, ph]) => (
              <div key={name}>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                <input value={form[name]} onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))} placeholder={ph} className={field} data-testid={`bank-${name}`} autoComplete="off" />
                {errors[name] && <p className="text-xs text-red-600 mt-1" data-testid={`bank-${name}-error`}>{errors[name]}</p>}
              </div>
            ))}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Account type (optional)</label>
              <select value={form.accountType} onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))} className={field}>
                <option value="">—</option><option value="savings">Savings</option><option value="current">Current</option>
              </select>
            </div>
            {!editing.id && state.accounts.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.isPreferred} onChange={(e) => setForm((f) => ({ ...f, isPreferred: e.target.checked }))} data-testid="bank-isPreferred" /> Make this my preferred account
              </label>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/15 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-60" data-testid="bank-save">{busy ? 'Saving…' : 'Save account'}</button>
            </div>
          </form>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmRemove(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3" data-testid="confirm-remove">
            <h4 className="text-lg font-bold text-gray-800 dark:text-white">Remove this account?</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {confirmRemove.label || confirmRemove.bankName || 'UPI'} {confirmRemove.maskedAccountNumber ? `(${confirmRemove.maskedAccountNumber})` : ''}.
              {confirmRemove.isPreferred && state.accounts.length > 1 ? ' It is your preferred account: the most recently added other account will become preferred.' : ''}
              {confirmRemove.isPreferred && state.accounts.length === 1 ? ' It is your only account: you will not be able to withdraw until you add another.' : ''}
              {' '}Withdrawals you already requested are not affected.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRemove(null)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/15 text-sm">Keep</button>
              <button onClick={remove} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700" data-testid="confirm-remove-yes">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccountsManager;
