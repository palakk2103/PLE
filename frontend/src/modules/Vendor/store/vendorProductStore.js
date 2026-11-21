import { create } from 'zustand';
import {
    getVendorProducts,
    getVendorProductById,
    createVendorProduct,
    updateVendorProduct,
    deleteVendorProduct,
    updateVendorStock,
} from '../services/vendorService';
import toast from 'react-hot-toast';

export const useVendorProductStore = create((set, get) => ({
    products: [],
    total: 0,
    page: 1,
    pages: 1,
    isLoading: false,
    isSaving: false,

    // ─── READ ────────────────────────────────────────────────────────────────────

    /**
     * Fetch vendor's products from the API with optional filters.
     * @param {{ page?, limit?, search?, stock? }} params
     */
    fetchProducts: async (params = {}) => {
        set({ isLoading: true });
        try {
            const { fetchAll = false, ...queryParams } = params || {};
            const pageSize = Math.max(Number.parseInt(queryParams.limit, 10) || 100, 1);
            let currentPage = Math.max(Number.parseInt(queryParams.page, 10) || 1, 1);
            let totalPages = 1;
            let latestPagination = {
                total: 0,
                page: currentPage,
                pages: 1,
            };
            const allProducts = [];

            do {
                const res = await getVendorProducts({
                    ...queryParams,
                    page: currentPage,
                    limit: pageSize,
                });
                // api.js interceptor unwraps response.data, so res = { products, total, page, pages }
                const { products = [], total = 0, page = currentPage, pages = 1 } = res.data ?? res;
                allProducts.push(...products);
                latestPagination = { total, page, pages };
                totalPages = fetchAll ? pages : currentPage;
                currentPage += 1;
            } while (fetchAll && currentPage <= totalPages);



            set({
                products: allProducts,
                total: latestPagination.total ?? allProducts.length,
                page: fetchAll ? 1 : (latestPagination.page ?? 1),
                pages: fetchAll ? (latestPagination.pages ?? 1) : (latestPagination.pages ?? 1),
                isLoading: false,
            });
        } catch (error) {
            console.error("API products call failed:", error);
            set({
                products: [],
                total: 0,
                page: 1,
                pages: 1,
                isLoading: false,
            });
        }
    },

    /**
     * Fetch a single vendor product by id and cache it locally.
     * @param {string} id
     * @returns {object|null}
     */
    fetchProductById: async (id) => {
        try {
            const res = await getVendorProductById(id);
            const product = res.data ?? res;
            if (!product) return null;

            set((state) => {
                const idx = state.products.findIndex(
                    (p) => String(p._id ?? p.id) === String(id)
                );
                if (idx === -1) {
                    return { products: [product, ...state.products] };
                }
                const next = [...state.products];
                next[idx] = product;
                return { products: next };
            });
            return product;
        } catch {
            return null;
        }
    },

    // ─── CREATE ──────────────────────────────────────────────────────────────────

    /**
     * Create a new product and prepend it to the local list.
     * @param {object} data
     * @returns {object|null} created product or null on error
     */
    addProduct: async (data) => {
        set({ isSaving: true });
        
        try {
            const res = await createVendorProduct(data);
            const product = res.data ?? res;
            await get().fetchProducts();
            set({ isSaving: false });
            toast.success('Product submitted for admin approval. It will go live once approved.');
            return product;
        } catch (error) {
            set({ isSaving: false });
            throw error;
        }
    },

    // ─── UPDATE ──────────────────────────────────────────────────────────────────

    /**
     * Update an existing product and refresh it in the local list.
     * @param {string} id
     * @param {object} data
     * @returns {object|null} updated product or null on error
     */
    editProduct: async (id, data) => {
        set({ isSaving: true });
        
        try {
            const res = await updateVendorProduct(id, data);
            const updated = res.data ?? res;
            await get().fetchProducts();
            set({ isSaving: false });
            toast.success(
                updated?.approvalStatus === 'pending'
                    ? 'Product updated and sent for admin approval.'
                    : 'Product updated successfully'
            );
            return updated;
        } catch (error) {
            set({ isSaving: false });
            throw error;
        }
    },

    // ─── DELETE ──────────────────────────────────────────────────────────────────

    /**
     * Delete a product and remove it from the local list.
     * @param {string} id
     * @returns {boolean} success
     */
    removeProduct: async (id) => {
        set({ isLoading: true });
        
        try {
            await deleteVendorProduct(id);
            await get().fetchProducts();
            set({ isLoading: false });
            toast.success('Product deleted successfully');
            return true;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    // ─── STOCK ───────────────────────────────────────────────────────────────────

    /**
     * Update stock quantity for a product.
     * @param {string} productId
     * @param {number} stockQuantity
     * @returns {boolean} success
     */
    patchStock: async (productId, stockQuantity) => {
        set({ isSaving: true });
        try {
            const res = await updateVendorStock(productId, stockQuantity);
            const updated = res.data ?? res;
            await get().fetchProducts();
            set({ isSaving: false });
            toast.success('Stock updated successfully');
            return true;
        } catch (error) {
            set({ isSaving: false });
            throw error;
        }
    },

    // ─── HELPERS ─────────────────────────────────────────────────────────────────

    /** Find a single product in the local cache by id */
    getById: (id) => {
        return get().products.find((p) => (p._id ?? p.id) === id || (p._id ?? p.id) === String(id));
    },

    /** Clear local product list (e.g. on logout) */
    reset: () => set({ products: [], total: 0, page: 1, pages: 1 }),
}));
