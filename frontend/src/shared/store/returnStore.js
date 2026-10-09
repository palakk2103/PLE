import { create } from 'zustand';
import api from '../utils/api';
import * as adminService from '../../modules/Admin/services/adminService';
import toast from 'react-hot-toast';
import { useAuthStore } from './authStore';
import { useAdminAuthStore } from '../../modules/Admin/store/adminStore';
import { useVendorAuthStore } from '../../modules/Vendor/store/vendorAuthStore';
import { useB2BAdminStore } from '../../modules/B2BAdmin/store/b2bAdminStore';

const getActiveRole = () => {
    const admin = useAdminAuthStore.getState().admin;
    if (admin && (admin.role === 'superadmin' || admin.role === 'admin')) return admin.role;
    
    const vendor = useVendorAuthStore.getState().vendor;
    if (vendor) return 'vendor';

    const b2bAdmin = useB2BAdminStore.getState().adminProfile;
    if (b2bAdmin && (b2bAdmin.role === 'b2bAdmin' || b2bAdmin.role === 'b2bEmployee')) return b2bAdmin.role;

    const user = useAuthStore.getState().user;
    if (user) return user.role;

    return null;
};

// Initialize returns from localStorage (no mock fallbacks)
const getInitialReturns = () => {
    try {
        const stored = localStorage.getItem('app-return-requests');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to parse stored return requests', e);
    }
    return [];
};

export const useReturnStore = create((set, get) => ({
    returnRequests: getInitialReturns(),
    isLoading: false,
    error: null,
    pagination: {
        total: 0,
        page: 1,
        limit: 10,
        pages: 1
    },

    saveToStorage: (requests) => {
        try {
            localStorage.setItem('app-return-requests', JSON.stringify(requests));
        } catch (e) {
            console.error('Failed to save returns to localStorage', e);
        }
    },

    fetchReturnRequests: async (params = {}) => {
        set({ isLoading: true });
        try {
            // Attempt API call
            const { fetchAll = true, ...queryParams } = params || {};
            const pageSize = Math.max(Number.parseInt(queryParams.limit, 10) || 100, 1);
            let currentPage = Math.max(Number.parseInt(queryParams.page, 10) || 1, 1);
            let totalPages = 1;
            let latestPagination = {
                total: 0,
                page: currentPage,
                limit: pageSize,
                pages: 1,
            };
            const allRequests = [];

            try {
                const userRole = getActiveRole();
                const endpoint = (userRole === 'superadmin' || userRole === 'admin') ? '/admin/return-requests' : userRole === 'vendor' ? '/vendor/return-requests' : '/user/returns';

                do {
                    const response = await api.get(endpoint, {
                        params: {
                            ...queryParams,
                            page: currentPage,
                            limit: pageSize,
                        }
                    });

                    const pageRequests = Array.isArray(response?.data?.returnRequests)
                        ? response.data.returnRequests
                        : [];
                    allRequests.push(...pageRequests);

                    const pagination = response?.data?.pagination || {};
                    latestPagination = {
                        total: Number.isFinite(Number(pagination.total))
                            ? Number(pagination.total)
                            : allRequests.length,
                        page: Number.isFinite(Number(pagination.page))
                            ? Number(pagination.page)
                            : currentPage,
                        limit: Number.isFinite(Number(pagination.limit))
                            ? Number(pagination.limit)
                            : pageSize,
                        pages: Math.max(Number.parseInt(pagination.pages, 10) || 1, 1),
                    };

                    totalPages = fetchAll ? latestPagination.pages : currentPage;
                    currentPage += 1;
                } while (fetchAll && currentPage <= totalPages);

                if (Array.isArray(allRequests)) {
                    set({
                        returnRequests: allRequests,
                        pagination: fetchAll
                            ? {
                                total: latestPagination.total,
                                page: 1,
                                limit: latestPagination.limit,
                                pages: latestPagination.pages,
                            }
                            : latestPagination,
                        isLoading: false
                    });
                    get().saveToStorage(allRequests);
                    return;
                }
            } catch (apiError) {
                console.warn("getAllReturnRequests API failed:", apiError);
            }

            // Fallback to local storage state
            const localRequests = getInitialReturns();
            set({
                returnRequests: localRequests,
                pagination: {
                    total: localRequests.length,
                    page: 1,
                    limit: 100,
                    pages: 1
                },
                isLoading: false
            });
        } catch (error) {
            set({ error: error.message, isLoading: false });
            toast.error(error.message || 'Failed to fetch return requests');
        }
    },

    fetchReturnRequestById: async (id) => {
        set({ isLoading: true });
        try {
            try {
                const userRole = getActiveRole();
                const endpoint = (userRole === 'superadmin' || userRole === 'admin') ? `/admin/return-requests/${id}` : userRole === 'vendor' ? `/vendor/return-requests/${id}` : `/user/returns/${id}`;
                const response = await api.get(endpoint);
                if (response?.data) {
                    set({ isLoading: false });
                    return response.data;
                }
            } catch (apiErr) {
                console.warn("getReturnRequestById API failed, checking local state:", apiErr);
            }

            const localRequests = get().returnRequests;
            const request = localRequests.find(r => String(r.id) === String(id));
            set({ isLoading: false });
            return request || null;
        } catch (error) {
            set({ isLoading: false });
            toast.error(error.message || 'Failed to fetch return request details');
            return null;
        }
    },

    createReturnRequest: async (requestData) => {
        set({ isLoading: true });
        try {
            const endpoint = `/user/orders/${requestData.orderId}/returns`;

            // Transform items to match backend expectation
            const transformedItems = (requestData.items || []).map(item => ({
                productId: item.id || item.productId,
                quantity: item.quantity,
                reason: requestData.reason,
            }));

            const response = await api.post(endpoint, {
                vendorId: requestData.vendorId,
                items: transformedItems,
                reason: requestData.reason,
                description: requestData.description,
                refundDestination: requestData.refundDestination || 'Original Payment Method',
                images: requestData.images || []
            });

            if (response?.data) {
                const newRequest = response.data;
                const updated = [newRequest, ...get().returnRequests];
                set({ returnRequests: updated, isLoading: false });
                get().saveToStorage(updated);
                
                toast.success('Return request submitted successfully');
                return newRequest;
            } else {
                throw new Error("Invalid response from server");
            }
        } catch (error) {
            console.error("Error creating return request:", error);
            set({ isLoading: false });
            toast.error(error?.response?.data?.message || error.message || 'Failed to create return request');
            return null;
        }
    },

    updateReturnStatus: async (id, statusData) => {
        set({ isLoading: true });
        try {
            try {
                const userRole = getActiveRole();
                const endpoint = (userRole === 'superadmin' || userRole === 'admin') ? `/admin/return-requests/${id}/status` : userRole === 'vendor' ? `/vendor/return-requests/${id}/status` : `/user/returns/${id}/status`;
                await api.patch(endpoint, statusData);
            } catch (apiErr) {
                console.error("updateReturnRequestStatus API failed:", apiErr);
                throw new Error(apiErr?.response?.data?.message || "Failed to update return request status on server.");
            }

            const updatedList = get().returnRequests.map((req) => {
                if (String(req.id) === String(id)) {
                    const timeline = req.timeline || [];
                    const newStatus = statusData.status || req.status;
                    const newRefundStatus = statusData.refundStatus || req.refundStatus;
                    const updatedTimeline = [...timeline];
                    
                    if (newStatus !== req.status) {
                        updatedTimeline.push({
                            status: newStatus,
                            date: new Date().toISOString(),
                            note: statusData.adminNote || statusData.rejectionReason || `Status updated to ${newStatus}`
                        });
                    }

                    // Wallet crediting is handled automatically by the backend upon status updates

                    return {
                        ...req,
                        status: newStatus,
                        refundStatus: newRefundStatus,
                        rejectionReason: statusData.rejectionReason || req.rejectionReason,
                        adminNote: statusData.adminNote || req.adminNote,
                        timeline: updatedTimeline,
                        updatedAt: new Date().toISOString()
                    };
                }
                return req;
            });

            set({ returnRequests: updatedList, isLoading: false });
            get().saveToStorage(updatedList);
            toast.success('Return status updated successfully');
            return true;
        } catch (error) {
            set({ isLoading: false });
            toast.error(error.message || 'Failed to update return status');
            return false;
        }
    }
}));

