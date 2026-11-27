import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBusinessBuyer } from '../../hooks/useBusinessBuyer';
import { useCartStore } from '../../../../shared/store/useStore';
import { getProductById } from '../../data/catalogData';
import { FiBriefcase, FiRefreshCw, FiDownload, FiInbox, FiTrendingUp, FiCreditCard, FiChevronRight } from 'react-icons/fi';
import api from '../../../../shared/utils/api';
import toast from 'react-hot-toast';

const when = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/**
 * Business buyer panel on the Profile page. Everything here is the buyer's real data:
 * company profile, their latest order (repeat / invoice) and their company's RFQs.
 * (It used to show a made-up company, a fake credit limit and a fake "repeat order" product.)
 */
export const B2BBusinessDashboard = () => {
  const navigate = useNavigate();
  const { isBusiness } = useBusinessBuyer();
  const addItem = useCartStore((state) => state.addItem);

  const [company, setCompany] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [rfqs, setRfqs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isBusiness) return undefined;
    let alive = true;
    const quiet = { skipErrorToast: true };
    Promise.allSettled([
      api.get('/b2b-user/admin/company', quiet),
      api.get('/user/orders', { ...quiet, params: { limit: 1 } }),
      api.get('/b2b-user/admin/rfq', quiet),
    ]).then(([c, o, r]) => {
      if (!alive) return;
      if (c.status === 'fulfilled') setCompany(c.value?.data || null);
      if (o.status === 'fulfilled') setLastOrder((o.value?.data?.orders || [])[0] || null);
      if (r.status === 'fulfilled') setRfqs(Array.isArray(r.value?.data) ? r.value.data : []);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [isBusiness]);

  if (!isBusiness) return null;

  // Puts the items of the latest order back in the cart. Prices are worked out again from today's
  // catalogue (and bulk slabs) by the cart and the server; unavailable products are skipped.
  const handleRepeatOrder = () => {
    if (!lastOrder) {
      toast.error('You have no previous order to repeat yet.');
      return;
    }
    let added = 0;
    const skipped = [];
    for (const item of lastOrder.items || []) {
      const productId = String(item.productId?._id || item.productId || '');
      const product = getProductById(productId);
      if (!productId || !product || product.isActive === false || product.stock === 'out_of_stock') {
        skipped.push(item.name);
        continue;
      }
      const ok = addItem({
        id: productId,
        name: item.name || product.name,
        image: item.image || product.image,
        price: item.price,
        b2bBasePrice: Number(product.price) || item.price,
        quantity: Number(item.quantity) || 1,
        variant: item.variant && Object.keys(item.variant).length ? item.variant : undefined,
        stockQuantity: product.stockQuantity,
        vendorId: product.vendorId,
        vendorName: product.vendorName,
        unit: product.unit,
      });
      if (ok) added += 1;
      else skipped.push(item.name);
    }
    if (added) toast.success(`${added} item${added === 1 ? '' : 's'} from order ${lastOrder.orderId} added to your cart.`);
    if (skipped.length) toast.error(`Not available any more: ${skipped.join(', ')}`);
  };

  const handleDownloadInvoice = async () => {
    if (!lastOrder) {
      toast.error('You have no orders with an invoice yet.');
      return;
    }
    const id = lastOrder.orderId;
    setBusy(true);
    const toastId = toast.loading(`Downloading the GST invoice for ${id}…`);
    try {
      const res = await api.get(`/user/orders/${id}/invoice/pdf`, { responseType: 'blob', skipErrorToast: true });
      const blob = res instanceof Blob ? res : new Blob([res?.data || res], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.setAttribute('download', `GST-Invoice-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { link.remove(); window.URL.revokeObjectURL(url); }, 1500);
      toast.success('GST invoice downloaded.', { id: toastId });
    } catch {
      // Say so honestly (it used to claim success even when the download failed).
      toast.error(`The invoice for ${id} is not available yet. You can find all invoices under My Orders.`, { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const openRfqs = rfqs.filter((r) => !['Completed', 'Rejected', 'Purchase Order Generated'].includes(r.status));

  return (
    <div className="space-y-6">
      {/* Business profile */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <FiBriefcase className="text-primary-600 text-xl shrink-0" />
          <h3 className="font-extrabold text-gray-800 text-base">Business Profile</h3>
        </div>

        {!loaded ? (
          <p className="text-xs text-gray-400 pb-4">Loading…</p>
        ) : !company ? (
          <p className="text-xs text-gray-500 pb-4">Company details could not be loaded right now.</p>
        ) : (
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4 border-b border-gray-100 pb-4 mb-4 text-xs">
            <div className="min-w-0">
              <span className="text-gray-400 block font-medium">Company Name</span>
              <span className="font-bold text-gray-800 break-words">{company.companyName}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block font-medium">GSTIN</span>
              <span className="font-bold text-primary-600 font-mono text-[11px] break-all">
                {company.gstNumber || 'Not GST registered'}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block font-medium">Business Email</span>
              <span className="font-bold text-gray-800 break-all">{company.businessEmail}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block font-medium">Account Status</span>
              <span className="font-bold text-gray-800 break-words">{company.verificationStatus}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs">
          <span className="text-gray-500 font-semibold flex items-center gap-1 shrink-0">
            <FiCreditCard className="shrink-0" />
            <span>Business Wallet</span>
          </span>
          <button onClick={() => navigate('/wallet')} className="text-[#7B0A0A] font-bold hover:underline shrink-0">
            Go to Wallet →
          </button>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 mt-4 pt-2 border-t border-gray-50">
          <button
            type="button"
            onClick={handleRepeatOrder}
            disabled={!loaded}
            className="w-full py-2.5 px-3 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-primary-100/50 disabled:opacity-60"
          >
            <FiRefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Repeat Last Order</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={!loaded || busy}
            className="w-full py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-gray-200 disabled:opacity-60"
          >
            <FiDownload className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Latest Invoice</span>
          </button>
        </div>
        {loaded && lastOrder && (
          <p className="text-[10px] text-gray-400 mt-2">Latest order: {lastOrder.orderId} · {when(lastOrder.createdAt)}</p>
        )}
      </div>

      {/* Company RFQs */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 bg-white">
        <div className="flex items-center gap-2 mb-4 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FiTrendingUp className="text-primary-600 text-xl shrink-0" />
            <h3 className="font-extrabold text-gray-800 text-base truncate">Open RFQs</h3>
          </div>
          <span className="text-[10px] text-gray-400 font-bold shrink-0">Total: {rfqs.length}</span>
        </div>

        {openRfqs.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center text-gray-400">
            <FiInbox className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-xs">{loaded ? 'No open RFQs.' : 'Loading…'}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {openRfqs.slice(0, 5).map((r) => (
              <button
                type="button"
                key={r._id}
                onClick={() => navigate(`/b2b-dashboard/rfqs/${r._id}`)}
                className="w-full text-left bg-gray-50 rounded-xl p-3 border border-gray-100 hover:shadow-sm transition-all text-xs flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{r.title || r.productId?.name || r.customProductName || r.rfqId}</p>
                  <p className="text-gray-500 text-[10px]">{r.rfqId} · Qty {r.quantity}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider shrink-0 bg-amber-50 text-amber-700 border border-amber-100">
                  {r.status}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate('/b2b-dashboard/rfqs')}
          className="mt-3 w-full py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1"
        >
          View all RFQs <FiChevronRight />
        </button>
      </div>
    </div>
  );
};

export default B2BBusinessDashboard;
