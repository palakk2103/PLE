import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiAlertCircle, FiArrowLeft, FiCheckCircle, FiClock, FiEye, FiLock, FiMessageSquare,
  FiPackage, FiRefreshCw, FiSearch, FiSend, FiShoppingBag, FiXCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import socketService from '../../utils/socket';
import { formatPrice } from '../../utils/helpers';

/**
 * Shared Consumer RFQ screens. One implementation, three panels:
 *   role "customer" -> /user/consumer-rfq
 *   role "seller"   -> /vendor/consumer-rfq
 *   role "admin"    -> /admin/consumer-rfq   (read-only for seller-owned RFQs; backend enforces it)
 */
const API = { customer: '/user/consumer-rfq', seller: '/vendor/consumer-rfq', admin: '/admin/consumer-rfq' };

const STATUS_STYLE = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Negotiating: 'bg-blue-100 text-blue-800',
  'Quotation Sent': 'bg-indigo-100 text-indigo-800',
  'Counter Offer': 'bg-orange-100 text-orange-800',
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  'Converted To Order': 'bg-emerald-100 text-emerald-800',
};
const STATUSES = Object.keys(STATUS_STYLE);

export const StatusChip = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-700'}`}>
    {status}
  </span>
);

const awaitingText = (rfq, role) => {
  if (!rfq.awaiting) return null;
  if (role === 'customer') {
    return rfq.awaiting === 'customer'
      ? (rfq.status === 'Accepted' ? 'Your confirmation is needed to place the order' : 'Waiting for your response')
      : `Waiting for ${rfq.targetType === 'admin' ? 'PLE (Admin)' : rfq.ownerLabel} to respond`;
  }
  if (rfq.awaiting === 'customer') return 'Waiting for customer';
  return rfq.targetType === 'vendor' && role === 'admin' ? 'Waiting for seller' : 'Your response is needed';
};

const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';
const dt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const useLiveRefresh = (role, onEvent) => {
  useEffect(() => {
    let socket;
    try {
      socketService.connect();
      socket = socketService.getSocket();
      if (role === 'admin') socket?.emit('join_admin_room');
      socket?.on('consumer_rfq_updated', onEvent);
    } catch { /* realtime is best-effort; data still loads over HTTP */ }
    return () => { try { socket?.off('consumer_rfq_updated', onEvent); } catch { /* ignore */ } };
  }, [role, onEvent]);
};

/* ───────────────────────────── LIST ───────────────────────────── */

export const ConsumerRFQList = ({ role, detailBase, title, subtitle }) => {
  const navigate = useNavigate();
  const [state, setState] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [scope, setScope] = useState(role === 'admin' ? 'admin' : '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (status !== 'all') params.set('status', status);
      if (scope) params.set('scope', scope);
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get(`${API[role]}?${params}`);
      setState(res.data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [role, status, scope, search, page]);

  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [load, search]);
  const onLive = useCallback(() => load(true), [load]);
  useLiveRefresh(role, onLive);

  const readOnlyScope = role === 'admin' && scope === 'vendor';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-extrabold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      {role === 'admin' && (
        <div className="flex flex-wrap gap-2 mb-4" role="tablist">
          {[['admin', 'Admin-Owned (Full Management)'], ['vendor', 'Seller-Owned (Read-Only Monitoring)']].map(([key, label]) => (
            <button
              key={key} role="tab" aria-selected={scope === key}
              onClick={() => { setScope(key); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${scope === key ? 'bg-[#7B0A0A] text-white border-[#7B0A0A]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {readOnlyScope && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          <FiLock className="mt-0.5 shrink-0" />
          <span>Read-only monitoring. These RFQs are negotiated directly between the customer and the product's seller; admins cannot quote, message, accept or reject on their behalf.</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by RFQ ID..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[#AE020B]"
          />
        </div>
        <select
          value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#AE020B]"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => load()} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-white hover:bg-gray-50">
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-red-800 flex items-center gap-3">
          <FiAlertCircle className="shrink-0" /> <span className="flex-1">{error}</span>
          <button onClick={() => load()} className="font-bold underline">Retry</button>
        </div>
      ) : state.items.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-dashed border-gray-300 bg-white">
          <FiPackage className="mx-auto text-3xl text-gray-400 mb-2" />
          <p className="font-bold text-gray-800">No RFQs found</p>
          <p className="text-sm text-gray-500 mt-1">
            {role === 'customer' ? 'Open a product and tap "Request Quote" to start negotiating a price.' : 'New customer requests will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {state.items.map((r) => (
            <button
              key={r._id} onClick={() => navigate(`${detailBase}/${r._id}`)}
              className="w-full text-left bg-white border border-gray-200 hover:border-[#AE020B]/50 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {r.productId?.image
                  ? <img src={r.productId.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-100 shrink-0" />
                  : <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center"><FiPackage className="text-gray-400" /></div>}
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{r.productId?.name || 'Product unavailable'}</p>
                  <p className="text-xs text-gray-500">{r.rfqId} · {dt(r.createdAt)}</p>
                  {role !== 'customer' && <p className="text-xs text-gray-600 mt-0.5 truncate">Customer: {r.buyerId?.name || '-'}</p>}
                  {role !== 'seller' && <p className="text-xs text-gray-600 truncate">Owner: {r.ownerLabel}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm md:w-[26rem]">
                <div><p className="text-[10px] uppercase font-bold text-gray-400">Qty</p><p className="font-bold">{r.quantity}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-gray-400">Expected</p><p className="font-bold">{r.expectedPrice ? formatPrice(r.expectedPrice) : '-'}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-gray-400">{r.finalAgreedPrice ? 'Agreed' : 'Quoted'}</p><p className="font-bold">{(r.finalAgreedPrice || r.quotedPrice) ? formatPrice(r.finalAgreedPrice || r.quotedPrice) : '-'}</p></div>
              </div>
              <div className="flex md:flex-col items-center md:items-end gap-2 md:w-48">
                <StatusChip status={r.status} />
                {awaitingText(r, role) && <span className="text-xs text-gray-500 flex items-center gap-1"><FiClock /> {awaitingText(r, role)}</span>}
                {r.permissions?.readOnly && <span className="text-xs text-amber-700 flex items-center gap-1"><FiEye /> View only</span>}
              </div>
            </button>
          ))}
          {state.pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Prev</button>
              <span className="text-sm text-gray-600">Page {state.page} of {state.pages}</span>
              <button disabled={page >= state.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ───────────────────────────── DETAIL ───────────────────────────── */

const ACTION_LABEL = {
  rfq_created: 'RFQ submitted', quotation: 'Quotation', counter_offer: 'Counter offer',
  message: 'Message', accepted: 'Accepted', rejected: 'Rejected', converted: 'Order created',
};

export const ConsumerRFQDetail = ({ role, rfqId, backPath, orderLink }) => {
  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [chat, setChat] = useState('');
  const [addressHint, setAddressHint] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`${API[role]}/${rfqId}`);
      setRfq(res.data);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [role, rfqId]);

  useEffect(() => { load(); }, [load]);
  const onLive = useCallback((evt) => { if (!evt || evt.id === rfqId) load(true); }, [load, rfqId]);
  useLiveRefresh(role, onLive);

  const act = async (path, body, okMsg) => {
    setBusy(true);
    try {
      const res = await api.post(`${API[role]}/${rfqId}/${path}`, body || {});
      toast.success(okMsg || res.message || 'Done');
      setPrice(''); setQty(''); setNote(''); setChat(''); setAddressHint(false);
      await load(true);
      return res.data;
    } catch (e) {
      const m = errMsg(e);
      if (/address/i.test(m)) setAddressHint(true);
      toast.error(m);
      if (e?.response?.status === 409) load(true);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const timeline = useMemo(() => rfq?.consumerTimeline || [], [rfq]);
  const myType = role === 'customer' ? 'customer' : (role === 'admin' ? 'admin' : 'seller');

  if (loading) return <div className="p-6 max-w-5xl mx-auto"><div className="h-64 rounded-2xl bg-gray-100 animate-pulse" aria-busy="true" /></div>;
  if (error || !rfq) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center">
        <FiAlertCircle className="mx-auto text-3xl text-red-500 mb-2" />
        <p className="font-bold text-gray-900">{error || 'RFQ not found'}</p>
        <Link to={backPath} className="inline-block mt-4 px-4 py-2 rounded-xl bg-[#7B0A0A] text-white font-bold text-sm">Back to RFQs</Link>
      </div>
    );
  }

  const p = rfq.permissions || {};
  const offer = rfq.currentOffer || {};
  const offerTotal = offer.price && offer.quantity ? offer.price * offer.quantity : null;
  const submitQuote = (e) => {
    e.preventDefault();
    act('quote', { price: Number(price), ...(qty ? { quantity: Number(qty) } : {}), message: note }, 'Quotation sent');
  };
  const submitCounter = (e) => {
    e.preventDefault();
    act('counter', { price: Number(price), ...(qty ? { quantity: Number(qty) } : {}), message: note }, 'Counter offer sent');
  };
  const submitChat = (e) => { e.preventDefault(); if (chat.trim()) act('message', { message: chat.trim() }, 'Message sent'); };
  const confirmAccept = () => {
    if (window.confirm(`Accept ${formatPrice(offer.price)} x ${offer.quantity} (total ${formatPrice(offerTotal)} + GST) and place the order? Payment is Cash on Delivery.`)) {
      act('accept', { offerVersion: offer.version }, 'Order placed');
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#AE020B]';

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <Link to={backPath} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"><FiArrowLeft /> Back</Link>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">RFQ</p>
            <h1 className="text-xl font-extrabold text-gray-900">{rfq.rfqId}</h1>
            <p className="text-xs text-gray-500 mt-1">Created {dt(rfq.createdAt)} · Updated {dt(rfq.updatedAt)}</p>
          </div>
          <StatusChip status={rfq.status} />
        </div>
        {awaitingText(rfq, role) && (
          <p className="mt-3 text-sm font-semibold text-[#7B0A0A] flex items-center gap-2"><FiClock /> {awaitingText(rfq, role)}</p>
        )}
        {p.readOnly && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <FiLock className="mt-0.5 shrink-0" />
            <span>Read-only monitoring: this RFQ belongs to seller <b>{rfq.ownerLabel}</b>. Only the seller and customer can negotiate or change it.</span>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5">
          <h2 className="font-bold text-gray-900 mb-3">Product</h2>
          <div className="flex items-center gap-3">
            {rfq.productId?.image
              ? <img src={rfq.productId.image} alt="" className="w-16 h-16 rounded-xl object-cover bg-gray-100" />
              : <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center"><FiPackage className="text-gray-400" /></div>}
            <div className="min-w-0">
              <p className="font-bold text-gray-900">{rfq.productId?.name || 'Product unavailable'}</p>
              {rfq.productId?.price != null && <p className="text-sm text-gray-500">List price {formatPrice(rfq.productId.price)} / {rfq.productId.unit || 'unit'}</p>}
              <p className="text-sm text-gray-500">Sold by: {rfq.ownerLabel}</p>
            </div>
          </div>
          {role !== 'customer' && (
            <div className="mt-4 pt-3 border-t text-sm text-gray-700">
              <p className="font-semibold">Customer</p>
              <p>{rfq.buyerId?.name || '-'}</p>
              {role === 'admin' && rfq.buyerId?.email && <p className="text-gray-500">{rfq.buyerId.email}{rfq.buyerId.phone ? ` · ${rfq.buyerId.phone}` : ''}</p>}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5">
          <h2 className="font-bold text-gray-900 mb-3">Deal summary</h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-gray-500">Requested qty</dt><dd className="font-bold text-right">{rfq.quantity}</dd>
            <dt className="text-gray-500">Customer expected price</dt><dd className="font-bold text-right">{rfq.expectedPrice ? formatPrice(rfq.expectedPrice) : '-'}</dd>
            <dt className="text-gray-500">Latest quotation</dt><dd className="font-bold text-right">{rfq.quotedPrice ? formatPrice(rfq.quotedPrice) : '-'}</dd>
            <dt className="text-gray-500">Current offer ({offer.by === 'customer' ? 'customer' : 'seller'})</dt>
            <dd className="font-bold text-right">{offer.price ? `${formatPrice(offer.price)} x ${offer.quantity}` : '-'}</dd>
            {rfq.finalAgreedPrice != null && (<><dt className="text-gray-500">Final agreed price</dt><dd className="font-extrabold text-right text-emerald-700">{formatPrice(rfq.finalAgreedPrice)} x {rfq.finalAgreedQuantity || rfq.quantity}</dd></>)}
          </dl>
          {rfq.convertedOrderId && (
            <Link to={orderLink(rfq.convertedOrderId)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">
              <FiShoppingBag /> View order {rfq.convertedOrderId.orderId}
            </Link>
          )}
        </div>
      </div>

      {(p.canQuote || p.canCounter || p.canAccept || p.canConvert || p.canAcceptOffer || p.canReject) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 space-y-4">
          <h2 className="font-bold text-gray-900">Actions</h2>

          {p.canAccept && (
            <button disabled={busy} onClick={confirmAccept} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <FiCheckCircle /> Accept {formatPrice(offer.price)} x {offer.quantity} &amp; place order
            </button>
          )}
          {p.canConvert && (
            <div>
              <p className="text-sm text-gray-600 mb-2">The seller accepted your offer of <b>{formatPrice(rfq.finalAgreedPrice)}</b>. Confirm to place the order (Cash on Delivery).</p>
              <button disabled={busy} onClick={() => act('convert', {}, 'Order placed')} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                <FiShoppingBag /> Confirm &amp; place order
              </button>
            </div>
          )}
          {addressHint && (
            <p className="text-sm text-red-700">Please add a default delivery address in <Link to="/addresses" className="underline font-bold">My Addresses</Link>, then try again.</p>
          )}
          {p.canAcceptOffer && (
            <button disabled={busy} onClick={() => act('accept-offer', { message: note }, 'Customer offer accepted')} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
              <FiCheckCircle /> Accept customer's offer ({formatPrice(offer.price)} x {offer.quantity})
            </button>
          )}

          {(p.canQuote || p.canCounter) && (
            <form onSubmit={p.canQuote ? submitQuote : submitCounter} className="grid sm:grid-cols-6 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">{p.canQuote ? 'Quote price / unit (₹)' : 'Counter price / unit (₹)'}</label>
                <input type="number" min="0.01" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Qty</label>
                <input type="number" min="1" step="1" placeholder={String(offer.quantity || rfq.quantity)} value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Message (optional)</label>
                <input value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} className={inputCls} />
              </div>
              <button disabled={busy} type="submit" className="sm:col-span-6 sm:justify-self-start px-5 py-2.5 rounded-xl bg-[#7B0A0A] hover:bg-[#AE020B] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                <FiSend /> {p.canQuote ? (rfq.status === 'Quotation Sent' ? 'Update quotation' : 'Send quotation') : 'Send counter offer'}
              </button>
            </form>
          )}

          {p.canReject && (
            <button disabled={busy} onClick={() => window.confirm('Reject this RFQ? This cannot be undone.') && act('reject', { message: note }, 'RFQ rejected')} className="px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 font-bold text-sm flex items-center gap-2 disabled:opacity-50">
              <FiXCircle /> Reject RFQ
            </button>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><FiMessageSquare /> Negotiation timeline</h2>
        <ol className="space-y-3">
          {timeline.map((t) => {
            const mine = t.senderType === myType;
            const system = t.senderType === 'system';
            return (
              <li key={t._id} className={`flex ${system ? 'justify-center' : mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${system ? 'bg-gray-100 text-gray-600' : mine ? 'bg-[#7B0A0A] text-white' : 'bg-gray-100 text-gray-900'}`}>
                  <p className={`text-[11px] font-bold uppercase ${mine ? 'text-red-100' : 'text-gray-500'}`}>
                    {system ? 'System' : `${t.senderName || t.senderType} · ${t.senderType}`} · {ACTION_LABEL[t.action] || t.action}
                  </p>
                  {t.priceOffer != null && <p className="font-extrabold text-base mt-0.5">{formatPrice(t.priceOffer)} <span className="text-xs font-semibold">x {t.quantity}</span></p>}
                  {t.message && <p className="mt-0.5 whitespace-pre-wrap break-words">{t.message}</p>}
                  <p className={`text-[10px] mt-1 ${mine ? 'text-red-100' : 'text-gray-400'}`}>{dt(t.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
        {p.canMessage && (
          <form onSubmit={submitChat} className="mt-4 flex gap-2">
            <input value={chat} maxLength={2000} onChange={(e) => setChat(e.target.value)} placeholder="Write a message..." className={inputCls} />
            <button disabled={busy || !chat.trim()} className="px-4 rounded-xl bg-[#7B0A0A] text-white disabled:opacity-50" aria-label="Send message"><FiSend /></button>
          </form>
        )}
        {p.canMessage && <p className="text-[11px] text-gray-400 mt-2">For your safety, phone numbers, emails and payment details are not allowed in messages.</p>}
      </div>
    </div>
  );
};
