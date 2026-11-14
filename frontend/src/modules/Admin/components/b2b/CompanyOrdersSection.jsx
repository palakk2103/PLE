import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShoppingBag, FiChevronRight } from 'react-icons/fi';
import api from '../../../../shared/utils/api';
import { getAdminPath } from '../../config/adminRoutesConfig';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const label = (s) => String(s || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS_CLS = {
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  returned: 'bg-orange-50 text-orange-700',
  pending: 'bg-amber-50 text-amber-700',
};

/**
 * Company-level order history for the super admin (the company is the buyer).
 * Employee-wise detail is intentionally not shown here; that view belongs to the B2B Admin.
 */
const CompanyOrdersSection = ({ companyId }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setPage(1); }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    setLoading(true);
    api.get(`/admin/b2b-users/${companyId}/orders`, { params: { page, limit: 5 } })
      .then((res) => alive && setData(res?.data || res))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [companyId, page]);

  const s = data?.stats;

  return (
    <div className="bg-gray-50 dark:bg-zinc-950 p-4 rounded-xl border dark:border-zinc-800 space-y-3 text-xs">
      <h4 className="font-bold text-gray-800 dark:text-zinc-100 flex items-center gap-1"><FiShoppingBag /> Company Orders</h4>

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Orders', `${s.totalOrders - s.cancelledOrders}`, s.cancelledOrders ? `${s.cancelledOrders} cancelled` : ''],
            ['Net spend', money(s.netSpent), `${money(s.grossSpent)} gross`],
            ['Returns', `${s.totalReturns}`, s.refundedAmount ? `${money(s.refundedAmount)} refunded` : ''],
            ['Last order', s.lastOrderAt ? new Date(s.lastOrderAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—', ''],
          ].map(([k, v, h]) => (
            <div key={k} className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-2.5 min-w-0">
              <p className="text-[10px] uppercase font-bold text-gray-400">{k}</p>
              <p className="text-sm font-black text-gray-800 dark:text-zinc-100 truncate">{v}</p>
              {h && <p className="text-[10px] text-gray-500 truncate">{h}</p>}
            </div>
          ))}
        </div>
      )}

      {loading && !data && <p className="text-gray-500">Loading orders…</p>}
      {!loading && !data && <p className="text-gray-500">Could not load orders.</p>}
      {data && data.orders.length === 0 && <p className="text-gray-500">This company has not placed any orders yet.</p>}

      {data?.orders?.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg divide-y dark:divide-zinc-800">
          {data.orders.map((o) => (
            <button
              key={o._id}
              type="button"
              onClick={() => navigate(getAdminPath(`orders/${o.orderId}`))}
              className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 dark:text-zinc-100 truncate">{o.orderId}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · '}{(o.items || []).map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap ${STATUS_CLS[o.status] || 'bg-blue-50 text-blue-700'}`}>{label(o.status)}</span>
              <div className="text-right whitespace-nowrap">
                <p className="font-bold text-gray-800 dark:text-zinc-100">{money(o.total)}</p>
                <p className="text-[10px] text-gray-500">{label(o.paymentMethod)} · {label(o.paymentStatus)}</p>
              </div>
              <FiChevronRight className="text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {data?.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Page {data.page} of {data.pages} · {data.total} orders</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2.5 py-1 rounded-md border dark:border-zinc-700 disabled:opacity-40">Prev</button>
            <button type="button" disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-2.5 py-1 rounded-md border dark:border-zinc-700 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyOrdersSection;
