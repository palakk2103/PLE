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
                image: p.image || p.images?.[0] || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/%3E%3Ccircle cx=%2234%22 cy=%2236%22 r=%228%22 fill=%22%23d1d5db%22/%3E%3Cpath d=%22M12 80l24-28 16 18 12-13 24 23z%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E'
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
