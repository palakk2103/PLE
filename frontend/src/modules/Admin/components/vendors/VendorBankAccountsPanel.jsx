import { useEffect, useState } from 'react';
import { FiCopy, FiStar, FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../../../shared/utils/api';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const copy = (text, label) => navigator.clipboard?.writeText(String(text)).then(() => toast.success(`${label} copied`)).catch(() => {});

/** Every payout account of a vendor (full numbers: admins need them to pay), most-paid highlighted. */
const VendorBankAccountsPanel = ({ vendorId, legacy }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!vendorId) return undefined;
    api.get(`/admin/vendors/${vendorId}/bank-accounts`)
      .then((res) => { if (alive) setData(res?.data ?? res); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [vendorId]);

  if (error) {
    return (
      <div>
        <h3 className="font-bold text-gray-800 text-sm mb-3">Bank Details</h3>
        <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl border">
          {legacy?.accountNumber ? `Account ${legacy.accountNumber} · ${legacy.bankName || 'bank'} · ${legacy.ifscCode || ''}` : 'Could not load payout accounts.'}
        </p>
      </div>
    );
  }
  if (!data) return <p className="text-sm text-gray-500">Loading payout accounts…</p>;

  const accounts = data.accounts || [];
  return (
    <div data-testid="admin-bank-accounts">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-gray-800 text-sm">Bank Details · {accounts.length} payout account{accounts.length === 1 ? '' : 's'}</h3>
        {data.totalPayouts > 0 && <p className="text-xs text-gray-500">{data.totalPayouts} payouts paid · {inr(data.totalAmountPaid)}</p>}
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl border">No bank details submitted.</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {accounts.map((a) => (
            <div key={a.id} className={`rounded-xl border p-4 space-y-2 ${a.isMostUsed ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-200 bg-white'}`} data-testid="admin-bank-account">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-gray-800">{a.label || a.bankName || 'UPI'}</p>
                {a.isPreferred && <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white" data-testid="admin-preferred"><FiStar /> Preferred (receives payouts)</span>}
                {a.isMostUsed && <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white" data-testid="admin-most-used"><FiTrendingUp /> Most payments</span>}
                {a.recentlyChanged && <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300" data-testid="admin-recent"><FiAlertTriangle /> Changed recently</span>}
              </div>
              <dl className="text-sm space-y-1 text-gray-700">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">Account holder</dt><dd className="font-semibold">{a.accountName}</dd></div>
                {(a.accountNumber || a.maskedAccountNumber) && (
                  <div className="flex justify-between gap-3 items-center"><dt className="text-gray-500">Account number</dt>
                    <dd className="font-mono font-semibold flex items-center gap-1.5">{a.accountNumber || a.maskedAccountNumber}{a.accountNumber && <button type="button" onClick={() => copy(a.accountNumber, 'Account number')} className="text-gray-400 hover:text-purple-600" title="Copy"><FiCopy /></button>}</dd></div>
                )}
                {a.bankName && <div className="flex justify-between gap-3"><dt className="text-gray-500">Bank / branch</dt><dd>{a.bankName}{a.branchName ? ` · ${a.branchName}` : ''}</dd></div>}
                {a.ifscCode && <div className="flex justify-between gap-3"><dt className="text-gray-500">IFSC</dt><dd className="font-mono font-semibold">{a.ifscCode}</dd></div>}
                {a.accountType && <div className="flex justify-between gap-3"><dt className="text-gray-500">Type</dt><dd className="capitalize">{a.accountType}</dd></div>}
                {a.upiId && <div className="flex justify-between gap-3"><dt className="text-gray-500">UPI ID</dt><dd className="font-mono font-semibold">{a.upiId}</dd></div>}
                {a.proofUrl && (
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">{a.proofType === 'bank_statement' ? 'Bank statement' : 'Cancelled cheque'}</dt>
                    <dd><a href={a.proofUrl} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline font-semibold">{a.proofName || 'View file'}</a></dd></div>
                )}
              </dl>
              <div className="flex flex-wrap gap-x-4 text-xs text-gray-500 pt-1 border-t border-gray-100">
                <span data-testid="admin-payments">{a.paymentsReceived} payout{a.paymentsReceived === 1 ? '' : 's'} · {inr(a.amountReceived)}</span>
                {a.lastPaidAt && <span>last paid {day(a.lastPaidAt)}</span>}
                <span>added {day(a.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorBankAccountsPanel;
