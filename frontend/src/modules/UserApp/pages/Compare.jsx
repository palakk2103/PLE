import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiStar, FiX, FiMapPin, FiShare2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import MobileLayout from '../components/Layout/MobileLayout';
import PageTransition from '../../../shared/components/PageTransition';
import api from '../../../shared/utils/api';
import { useCompareStore, MIN_COMPARE, MAX_COMPARE } from '../../../shared/store/compareStore';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const STOCK = { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock' };
const CONDITION = { brand_new: 'Brand new', refurbished: 'Refurbished', renewed: 'Renewed', open_box: 'Open box' };
const yesNo = (v) => (v ? 'Yes' : 'No');
const list = (a) => (a && a.length ? a.join(', ') : null);
const since = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : null);

/** Rows built from the product itself; `best` marks which cell wins (lowest price, highest rating). */
const baseRows = (products) => {
  const minPrice = Math.min(...products.map((p) => p.price));
  const maxRating = Math.max(...products.map((p) => p.rating));
  return [
    { key: 'price', label: 'Price', cells: products.map((p) => ({ text: inr(p.price), sub: p.originalPrice ? `${inr(p.originalPrice)} · ${p.discountPercent}% off` : null, best: products.length > 1 && p.price === minPrice, bestLabel: 'Lowest price' })) },
    { key: 'rating', label: 'Rating', cells: products.map((p) => ({ text: p.rating > 0 ? `${p.rating.toFixed(1)} ★` : 'No ratings', sub: p.reviewCount ? `${p.reviewCount} reviews` : null, best: maxRating > 0 && p.rating === maxRating && products.length > 1, bestLabel: 'Top rated' })) },
    { key: 'availability', label: 'Availability', cells: products.map((p) => ({ text: STOCK[p.stock] || p.stock, tone: p.stock === 'out_of_stock' ? 'bad' : p.stock === 'low_stock' ? 'warn' : 'good' })) },
    { key: 'brand', label: 'Brand', cells: products.map((p) => ({ text: p.brand || null })) },
    { key: 'category', label: 'Category', cells: products.map((p) => ({ text: p.category || null })) },
    { key: 'condition', label: 'Condition', cells: products.map((p) => ({ text: CONDITION[p.condition] || p.condition })) },
    { key: 'warranty', label: 'Warranty', cells: products.map((p) => ({ text: p.warranty || null })) },
    { key: 'colors', label: 'Colours', cells: products.map((p) => ({ text: list(p.variants?.colors) })) },
    { key: 'sizes', label: 'Sizes', cells: products.map((p) => ({ text: list(p.variants?.sizes) })) },
    { key: 'materials', label: 'Materials', cells: products.map((p) => ({ text: list(p.variants?.materials) })) },
    { key: 'moq', label: 'Minimum order', cells: products.map((p) => ({ text: `${p.minimumOrderQuantity} ${p.unit}` })) },
    { key: 'returns', label: 'Returnable', cells: products.map((p) => ({ text: yesNo(p.returnable) })) },
    { key: 'cod', label: 'Cash on delivery', cells: products.map((p) => ({ text: yesNo(p.codAllowed) })) },
  ];
};

const sellerRows = (products) => [
  { key: 's-name', label: 'Sold by', cells: products.map((p) => ({ seller: p.seller })) },
  { key: 's-rating', label: 'Seller rating', cells: products.map((p) => ({ text: p.seller.rating > 0 ? `${p.seller.rating.toFixed(1)} ★` : null, sub: p.seller.reviewCount ? `${p.seller.reviewCount} reviews` : null })) },
  { key: 's-loc', label: 'Location', cells: products.map((p) => ({ text: p.seller.location || null })) },
  { key: 's-since', label: 'Selling since', cells: products.map((p) => ({ text: since(p.seller.memberSince) })) },
  { key: 's-verified', label: 'Verified', cells: products.map((p) => ({ text: p.seller.isVerified ? (p.seller.gstVerified ? 'Verified · GST verified' : 'Verified') : 'Not verified', tone: p.seller.isVerified ? 'good' : 'warn' })) },
];

const differs = (cells) => new Set(cells.map((c) => (c.seller ? c.seller.id : (c.text ?? '—').toString().toLowerCase()))).size > 1;
const toneCls = { good: 'text-green-700', warn: 'text-amber-700', bad: 'text-red-600' };

const Cell = ({ cell, highlight }) => {
  if (cell.seller) {
    const s = cell.seller;
    const inner = (
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-gray-500">
          {s.logo ? <img src={s.logo} alt="" className="w-full h-full object-cover" /> : (s.name || '?').charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 inline-flex items-center gap-1 break-words">{s.name}{s.isVerified && <FiCheckCircle className="text-blue-500 shrink-0" />}</p>
          {s.tagline && <p className="text-xs text-gray-500 break-words">{s.tagline}</p>}
        </div>
      </div>
    );
    return s.id ? <Link to={`/seller/${s.id}`} className="hover:underline" data-testid="compare-seller-link">{inner}</Link> : inner;
  }
  if (cell.text === null || cell.text === undefined || cell.text === '') return <span className="text-gray-300">—</span>;
  // dark: variant needed: dark mode turns the text white but had no dark version of this pale
  // highlight, so differing values were white-on-yellow (the "comparison text not visible" bug).
  return (
    <div className={highlight ? 'bg-amber-50 dark:bg-amber-500/20 -mx-1 px-1 rounded' : ''}>
      <span className={`${cell.tone ? toneCls[cell.tone] : 'text-gray-800'} break-words`}>{cell.text}</span>
      {cell.sub && <span className="block text-xs text-gray-500">{cell.sub}</span>}
      {cell.best && <span className="inline-block mt-0.5 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5" data-testid="compare-best">{cell.bestLabel}</span>}
    </div>
  );
};

const Compare = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const items = useCompareStore((s) => s.items);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);
  const urlIds = (params.get('ids') || '').split(',').map((x) => x.trim()).filter(Boolean);
  const ids = urlIds.length ? urlIds : items.map((i) => i.id);
  const key = ids.join(',');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);

  useEffect(() => {
    let alive = true;
    if (ids.length < MIN_COMPARE) { setData(null); setLoading(false); setError(''); return undefined; }
    setLoading(true); setError('');
    api.get('/products/compare', { params: { ids: key } })
      .then((res) => {
        if (!alive) return;
        const d = res?.data ?? res;
        setData(d);
        // products that are no longer available drop out of the picked list too
        (d.unavailable || []).forEach((id) => remove(id));
        if ((d.unavailable || []).length) toast.error(`${d.unavailable.length} product${d.unavailable.length > 1 ? 's are' : ' is'} no longer available and was removed.`);
      })
      .catch((err) => { if (alive) { setData(null); setError(err?.response?.data?.message || 'Could not load the comparison.'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const products = data?.products || [];
  const rows = useMemo(() => {
    if (products.length < 1) return { basics: [], specs: [], seller: [] };
    const specs = (data.specRows || []).map((r) => ({ key: `spec-${r.label}`, label: r.label, cells: r.values.map((v) => ({ text: v })), diff: r.differs }));
    return { basics: baseRows(products), specs, seller: sellerRows(products) };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    const url = `${window.location.origin}/compare?ids=${products.map((p) => p.id).join(',')}`;
    try { await navigator.clipboard.writeText(url); toast.success('Comparison link copied'); } catch { toast.error('Could not copy the link'); }
  };
  const dropProduct = (id) => {
    remove(id);
    if (urlIds.length) navigate(`/compare?ids=${urlIds.filter((x) => x !== id).join(',')}`, { replace: true });
  };

  const Section = ({ title, list: rowList, testId }) => {
    // a row that is empty for every product says nothing, so it is not shown
    const empty = (r) => r.cells.every((c) => !c.seller && (c.text === null || c.text === undefined || c.text === ''));
    const visible = rowList.filter((r) => !empty(r) && (!onlyDiff || (r.diff ?? differs(r.cells))));
    if (visible.length === 0) return null;
    return (
      <>
        <tr><th colSpan={products.length + 1} className="bg-gray-100 text-left text-xs font-bold uppercase tracking-wide text-gray-500 px-3 py-2" data-testid={testId}>{title}</th></tr>
        {visible.map((r) => {
          const isDiff = r.diff ?? differs(r.cells);
          return (
            <tr key={r.key} className="border-t border-gray-100 align-top" data-testid="compare-row" data-differs={isDiff}>
              <th className="sticky left-0 bg-white text-left text-xs font-semibold text-gray-500 px-3 py-3 w-28 sm:w-40 z-[1]">{r.label}</th>
              {r.cells.map((c, i) => <td key={products[i].id} className="px-3 py-3 text-sm min-w-[150px]"><Cell cell={c} highlight={isDiff && !c.seller && !onlyDiff} /></td>)}
            </tr>
          );
        })}
      </>
    );
  };

  return (
    <PageTransition>
      <MobileLayout showBottomNav={true} showCartBar={false}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 pb-28">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100" aria-label="Back"><FiArrowLeft /></button>
              <h1 className="text-xl font-bold text-gray-800">Compare products</h1>
            </div>
            {products.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <label className="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} data-testid="only-differences" /> Differences only</label>
                <button type="button" onClick={share} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Copy link" aria-label="Copy link"><FiShare2 /></button>
              </div>
            )}
          </div>

          {loading ? <p className="text-center text-gray-500 py-16">Loading comparison…</p>
            : error ? <p className="text-center text-red-600 py-16">{error}</p>
              : ids.length < MIN_COMPARE || products.length < 1 ? (
                <div className="text-center py-16" data-testid="compare-empty">
                  <p className="text-gray-700 font-semibold mb-1">Pick at least {MIN_COMPARE} products to compare</p>
                  <p className="text-sm text-gray-500 mb-4">Tap the compare icon on any product (up to {MAX_COMPARE}).</p>
                  <Link to="/home" className="inline-block px-5 py-2.5 rounded-xl bg-[#7B0A0A] text-white font-semibold">Browse products</Link>
                </div>
              ) : (
                <>
                  {data && !data.sameCategory && <p className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-testid="mixed-category">These products are in different categories, so some details won't match up.</p>}
                  {rows.specs.length === 0 && <p className="mb-3 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2" data-testid="no-specs">No detailed specifications have been added for these products yet, so only the general details are compared.</p>}
                  <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                    <table className="w-full border-collapse" data-testid="compare-table">
                      <thead>
                        <tr>
                          <th className="sticky left-0 bg-white w-28 sm:w-40 z-[2]" />
                          {products.map((p) => (
                            <th key={p.id} className="px-3 py-3 text-left align-top min-w-[150px]" data-testid="compare-col">
                              <div className="relative">
                                <button type="button" onClick={() => dropProduct(p.id)} className="absolute -top-1 -right-1 p-1 rounded-full bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600" aria-label={`Remove ${p.name}`}><FiX className="text-xs" /></button>
                                <Link to={`/product/${p.id}`}>
                                  <div className="w-full h-28 sm:h-36 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center mb-2">
                                    {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-contain" /> : <FiStar className="text-gray-300 text-3xl" />}
                                  </div>
                                  <p className="text-sm font-semibold text-gray-800 line-clamp-2">{p.name}</p>
                                </Link>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <Section title="Overview" list={rows.basics} testId="sec-overview" />
                        <Section title="Seller" list={rows.seller} testId="sec-seller" />
                        <Section title="Specifications" list={rows.specs} testId="sec-specs" />
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <p className="text-gray-500 inline-flex items-center gap-1"><FiMapPin /> Tap a seller name to see their store.</p>
                    <button type="button" onClick={() => { clear(); navigate('/home'); }} className="text-gray-500 hover:text-red-600" data-testid="compare-clear-all">Clear comparison</button>
                  </div>
                </>
              )}
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default Compare;
