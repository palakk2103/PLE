import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const MAX_COMPARE = 4;
export const MIN_COMPARE = 2;

const normId = (v) => String(v ?? '').trim();

/**
 * Products picked for comparison (up to 4). Kept in the browser, no login needed. Only what the
 * tray needs is stored; the comparison page always loads fresh prices and availability from the server.
 */
export const useCompareStore = create(
  persist(
    (set, get) => ({
      items: [],
      has: (id) => get().items.some((i) => i.id === normId(id)),
      /** @returns {{ok: boolean, reason?: 'full'|'invalid'}} */
      add: (product) => {
        const id = normId(product?.id || product?._id);
        if (!/^[a-f0-9]{24}$/i.test(id)) return { ok: false, reason: 'invalid' };
        const { items } = get();
        if (items.some((i) => i.id === id)) return { ok: true };
        if (items.length >= MAX_COMPARE) return { ok: false, reason: 'full' };
        set({ items: [...items, { id, name: product.name || 'Product', image: product.image || product.images?.[0] || '', price: Number(product.price) || 0 }] });
        return { ok: true };
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== normId(id)) }),
      clear: () => set({ items: [] }),
    }),
    { name: 'compare-storage', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ items: s.items }) }
  )
);
