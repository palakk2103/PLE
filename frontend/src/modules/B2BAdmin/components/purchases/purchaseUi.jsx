// Small shared UI helpers for the employee purchase pages.
import React from 'react';

export const money = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const fmtDate = (d, withTime = false) => {
  if (!d) return '—';
  const date = new Date(d);
  return withTime
    ? date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ACRONYMS = { cod: 'COD', upi: 'UPI', gst: 'GST' };

export const humanize = (s) =>
  String(s || '—')
    .replace(/_/g, ' ')
    .replace(/\b\w+/g, (w) => ACRONYMS[w.toLowerCase()] || w.charAt(0).toUpperCase() + w.slice(1));

const TONES = {
  green: 'bg-green-50 text-green-700 border-green-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  gray: 'bg-gray-50 text-gray-600 border-gray-200',
};

const STATUS_TONE = {
  delivered: 'green', paid: 'green', success: 'green', captured: 'green', completed: 'green',
  processed: 'green', refund_processed: 'green', approved: 'green', active: 'green', credit: 'green',
  cancelled: 'red', failed: 'red', rejected: 'red', claim_rejected: 'red', inactive: 'red', debit: 'red',
  pending: 'amber', authorized: 'amber', return_initiated: 'amber',
  processing: 'blue', shipped: 'blue', out_for_delivery: 'blue', in_transit: 'blue', qc_center: 'blue',
  refunded: 'purple', returned: 'purple',
};

export const StatusPill = ({ value, tone }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${TONES[tone || STATUS_TONE[String(value).toLowerCase()] || 'gray']}`}>
    {humanize(value)}
  </span>
);

export const StatCard = ({ label, value, hint, icon: Icon, accent = 'text-gray-900' }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
      {Icon && <Icon className="text-gray-400 flex-shrink-0" />}
    </div>
    <p className={`mt-2 text-xl font-bold ${accent} truncate`}>{value}</p>
    {hint && <p className="mt-0.5 text-xs text-gray-500 truncate">{hint}</p>}
  </div>
);

export const Pager = ({ page, pages, total, onChange }) => {
  if (!pages || pages <= 1) return total ? <p className="text-xs text-gray-500 px-4 py-3">{total} record{total === 1 ? '' : 's'}</p> : null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
      <span className="text-gray-500">Page {page} of {pages} · {total} records</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
      </div>
    </div>
  );
};

export const EmptyRow = ({ colSpan, children }) => (
  <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-gray-500">{children}</td></tr>
);

export const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#D71920] focus:border-transparent outline-none bg-white';
