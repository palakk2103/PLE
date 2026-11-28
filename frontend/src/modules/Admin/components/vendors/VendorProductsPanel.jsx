import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiExternalLink, FiEdit2, FiRefreshCw } from 'react-icons/fi';
import api from '../../../../shared/utils/api';
import { ADMIN_BASE_ROUTE } from '../../config/adminRoutesConfig';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const APPROVAL_STYLE = {
  approved: 'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
};
const imageOf = (p) => {
  const first = p.image || (Array.isArray(p.images) ? p.images[0] : '');
  return typeof first === 'string' ? first : first?.url || '';
};

/** Admin > Vendor detail > Products: every product this vendor has listed, with a link to open each one. */
const VendorProductsPanel = ({ vendorId }) => {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: '', products: [], total: 0, pages: 1 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api.get('/admin/products', { params: { vendorId, includeInactive: 'true', page, limit: 20, ...(query ? { search: query } : {}) } })
      .then((res) => {
        const d = res?.data ?? res;
        if (alive) setState({ loading: false, error: '', products: d.products || [], total: d.total || 0, pages: d.pages || 1 });
      })
      .catch((err) => {
        if (alive) setState({ loading: false, error: err?.response?.data?.message || 'Could not load products.', products: [], total: 0, pages: 1 });
      });
    return () => { alive = false; };
  }, [vendorId, page, query, tick]);

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  return (
    <div className="space-y-4" data-testid="vendor-products">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this vendor's products"
              className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg w-64"
            />
          </div>
          <button type="submit" className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Search</button>
        </form>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{state.total} product{state.total === 1 ? '' : 's'}</span>
          <button type="button" onClick={() => setTick((t) => t + 1)} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50" aria-label="Refresh"><FiRefreshCw /></button>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading products…</p>
      ) : state.products.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">{query ? 'No products match this search.' : 'This vendor has not listed any products yet.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">Approval</th>
                <th className="px-3 py-2">Live</th>
                <th className="px-3 py-2 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((p) => {
                const id = p._id || p.id;
                const approval = p.approvalStatus || 'approved';
                return (
                  <tr key={id} className="border-t border-gray-100" data-testid="vendor-product-row">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {imageOf(p) && <img src={imageOf(p)} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate max-w-[280px]">{p.name}</p>
                          {p.sku && <p className="text-xs text-gray-500">SKU {p.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{inr(p.price)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.stock === 'out_of_stock' ? <span className="text-red-600">Out of stock</span> : (p.stockQuantity ?? '—')}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full border ${APPROVAL_STYLE[approval] || APPROVAL_STYLE.draft}`}>{approval}</span></td>
                    <td className="px-3 py-2">{p.isActive === false ? <span className="text-gray-500">Hidden</span> : <span className="text-green-700">Yes</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`${ADMIN_BASE_ROUTE}/products/${id}`} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="Open product details" aria-label={`Open ${p.name}`}><FiEdit2 /></Link>
                        <a href={`/product/${id}`} target="_blank" rel="noreferrer" className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50" title="View on store" aria-label={`View ${p.name} on store`}><FiExternalLink /></a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {state.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50">Previous</button>
          <span className="text-gray-500">Page {page} of {state.pages}</span>
          <button type="button" disabled={page >= state.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
};

export default VendorProductsPanel;
