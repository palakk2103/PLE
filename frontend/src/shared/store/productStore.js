import { create } from 'zustand';
import api from '../utils/api';
import toast from 'react-hot-toast';

export const useProductStore = create((set, get) => ({
    products: [],
    isLoading: false,
    pagination: {
        total: 0,
        page: 1,
        limit: 10,
        pages: 1
    },

    fetchProducts: async (params = {}) => {
        set({ isLoading: true });
        try {
            // storefront: public catalogue (the admin endpoint would 401 for customers)
            const response = await api.get('/products', { params: { limit: 200, ...params } });
            // Check if response.data is an array or object with products
            const productsData = Array.isArray(response.data) ? response.data : (response.data.products || []);
            const normalizedProducts = productsData.map(p => ({
                ...p,
                id: p._id,
                stockQuantity: p.stockQuantity || 0,
                price: p.price || 0,
                image: p.image || p.images?.[0] || 'https://via.placeholder.com/50x50?text=Product'
            }));

            set({
                products: normalizedProducts,
                pagination: response.data.pagination || get().pagination,
                isLoading: false
            });
        } catch (error) {
            console.error("storefront fetchProducts failed:", error);
            
            set({
                products: [],
                isLoading: false
            });
        }
    }
}));
