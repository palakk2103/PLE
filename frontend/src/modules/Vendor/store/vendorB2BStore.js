// Zustand store for B2B Enquiry / RFQ Management connected to backend
import { create } from "zustand";
import api from "../../../shared/utils/api";
import { useVendorAuthStore } from "./vendorAuthStore";

const mapRfqToEnquiry = (rfq) => {
  const vendorState = useVendorAuthStore.getState();
  const vendorId = vendorState?.vendor?.id || vendorState?.vendor?._id;

  // Find the current vendor's quote(s) in rfq.quotations
  const myQuotes = (rfq.quotations || [])
    .filter(q => String(q.vendorId) === String(vendorId))
    .map((q, idx) => ({
      id: q._id || `QT-${idx}-${rfq._id}`,
      items: [
        {
          name: rfq.productId?.name || rfq.customProductName || 'Product',
          sku: rfq.productId?._id || 'PROD-1',
          qty: rfq.quantity,
          offeredPrice: q.unitPrice,
          deliveryDays: parseInt(q.deliveryTime) || 7
        }
      ],
      totalValue: q.totalPrice,
      status: q.status.toLowerCase(), // 'submitted', 'negotiating', 'selected', 'rejected'
      notes: q.additionalNotes,
      warranty: q.warranty,
      taxDetails: q.taxDetails,
      attachments: q.attachments || [],
      messages: q.messages || [],
      createdAt: q.createdAt || new Date().toISOString(),
      validUntil: new Date(new Date(q.createdAt || Date.now()).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString()
    }));

  const myActiveQuote = myQuotes[0]; // Active quote submitted by this vendor

  // Determine UI status based on RFQ status and vendor's quote
  let mappedStatus = "new";
  if (myActiveQuote) {
    if (myActiveQuote.status === "selected") {
      mappedStatus = "accepted";
    } else if (myActiveQuote.status === "rejected") {
      mappedStatus = "rejected";
    } else {
      mappedStatus = "quoted";
    }
  } else {
    if (rfq.status === "Rejected") {
      mappedStatus = "rejected";
    } else if (['Completed', 'Purchase Order Generated', 'Vendor Selected'].includes(rfq.status)) {
      mappedStatus = "expired";
    } else if (rfq.status === "Sent To Vendors" || rfq.status === "Quotation Received" || rfq.status === "Quotation Review" || rfq.status === "Vendor Negotiation") {
      mappedStatus = "new";
    } else {
      mappedStatus = "new";
    }
  }

  // Fallback for company/buyer information
  const buyerName = rfq.createdByAdminId?.adminName || rfq.buyerId?.name || 'Business Buyer';
  const buyerCompany = rfq.companyName || rfq.buyerId?.companyName || 'B2B Client Company';
  const buyerEmail = rfq.createdByAdminId?.adminEmail || rfq.buyerId?.email || 'buyer@company.com';
  const buyerPhone = rfq.createdByAdminId?.adminPhone || rfq.buyerId?.phone || '9876543210';
  const buyerAddress = rfq.buyerId?.businessAddress || 'Default Company Address';

  // Map timeline events from approvalHistory
  const mappedTimeline = (rfq.approvalHistory || []).map(h => ({
    action: h.action,
    timestamp: h.createdAt || new Date().toISOString(),
    by: h.updaterType === 'SuperAdmin' ? 'Super Admin' : h.updaterType,
    notes: h.notes
  }));

  // If there's no history, populate with a default "RFQ Received" event
  if (mappedTimeline.length === 0) {
    mappedTimeline.push({
      action: "RFQ Invitation Received",
      timestamp: rfq.createdAt || new Date().toISOString(),
      by: "System",
      notes: "Sourcing request dispatched to vendor."
    });
  }

  return {
    id: rfq._id,
    _id: rfq._id,
    enquiryNumber: rfq.rfqId,
    rfqId: rfq.rfqId,
    createdAt: rfq.createdAt,
    status: mappedStatus,
    priority: rfq.priority ? rfq.priority.toLowerCase() : (rfq.quantity > 500 ? 'high' : rfq.quantity > 100 ? 'medium' : 'low'),
    message: rfq.requirementDetails || 'No buyer message or specifications provided.',
    totalEstimatedValue: rfq.targetPrice * rfq.quantity,
    buyer: {
      name: buyerName,
      company: buyerCompany,
      email: buyerEmail,
      phone: buyerPhone,
      address: buyerAddress,
      businessType: "Wholesaler",
      gstNumber: rfq.buyerId?.gstNumber || "27AAPCG9838F1Z1",
      verificationStatus: "Approved"
    },
    products: [
      {
        name: rfq.productId?.name || rfq.customProductName || 'Product',
        sku: rfq.productId?._id || 'PROD-1',
        qty: rfq.quantity,
        unit: 'pcs',
        targetPrice: rfq.targetPrice,
      }
    ],
    timeline: mappedTimeline,
    quotes: myQuotes,
    originalRfq: rfq
  };
};

export const useVendorB2BStore = create((set, get) => ({
  // State - start with empty, will be populated from real API
  enquiries: [],
  settings: {
    defaultQuoteValidity: 15,
    defaultPaymentTerms: "Net 30 days",
    defaultShippingTerms: "FOB Origin",
    minimumOrderValue: 50000,
    autoResponse: false,
    autoResponseMessage: "",
    notifyOnNewEnquiry: true,
    notifyOnQuoteResponse: true,
    notifyOnEnquiryExpiring: true,
  },
  analytics: null,
  isLoading: false,

  // Enquiries
  fetchEnquiries: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/vendor/rfq');
      const payload = res?.data ?? res;
      const mapped = Array.isArray(payload) ? payload.map(mapRfqToEnquiry) : [];
      set({ enquiries: mapped });
    } catch (error) {
      console.error('Error fetching vendor RFQs:', error);
      // On error show empty — vendor should only see real data, not mock
      set({ enquiries: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  getEnquiryById: (id) => {
    return get().enquiries.find((e) => e.id === id) || null;
  },

  updateEnquiryStatus: async (id, status, notes = 'Vendor rejected the RFQ request.') => {
    if (status === 'rejected') {
      try {
        await api.post(`/vendor/rfq/${id}/reject`, { notes });
        await get().fetchEnquiries();
      } catch (error) {
        console.error('Error rejecting RFQ:', error);
        throw error;
      }
    }
  },

  // Quotes
  createQuote: async (enquiryId, quoteData) => {
    try {
      const firstItem = quoteData.items[0];
      const res = await api.post(`/vendor/rfq/${enquiryId}/quote`, {
        unitPrice: Number(firstItem.offeredPrice),
        totalPrice: Number(quoteData.totalValue),
        deliveryTime: `${firstItem.deliveryDays} days`,
        warranty: quoteData.warranty || "N/A",
        taxDetails: quoteData.taxDetails || "Excluding Taxes",
        additionalNotes: quoteData.notes || "",
        attachments: quoteData.attachments || []
      });
      await get().fetchEnquiries();
      const backendRfq = res?.data || res;
      const vendorState = useVendorAuthStore.getState();
      const vendorId = vendorState?.vendor?.id || vendorState?.vendor?._id;
      const myQuote = backendRfq?.quotations?.find(q => String(q.vendorId) === String(vendorId));
      return myQuote?._id || `QT-${Date.now()}`;
    } catch (error) {
      console.error('Error submitting quote:', error);
      throw error;
    }
  },

  updateQuote: (enquiryId, quoteId, data) => {
    // Local no-op
  },

  sendNegotiationMessage: async (rfqId, message) => {
    try {
      await api.post(`/vendor/rfq/${rfqId}/message`, { message });
      await get().fetchEnquiries();
    } catch (error) {
      console.error('Error sending negotiation message:', error);
      throw error;
    }
  },

  // Settings
  fetchSettings: async () => {
    try {
      const res = await api.get('/vendor/b2b/settings');
      set({ settings: res.data });
    } catch (error) {
      console.error('Error fetching B2B settings:', error);
    }
  },

  updateSettings: async (newSettings) => {
    try {
      const res = await api.put('/vendor/b2b/settings', newSettings);
      set({ settings: res.data });
    } catch (error) {
      console.error('Error updating B2B settings:', error);
      throw error;
    }
  },

  // Analytics
  fetchAnalytics: async () => {
    try {
      const res = await api.get('/vendor/b2b/analytics');
      set({ analytics: res.data });
    } catch (error) {
      console.error('Error fetching B2B analytics:', error);
    }
  },

  getAnalytics: () => {
    return get().analytics;
  },
}));
