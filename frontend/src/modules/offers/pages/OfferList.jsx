import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useOffers } from "../hooks/useOffers";
import { OfferTable } from "../components/OfferTable";
import { OfferFilterBar } from "../components/OfferFilterBar";
import { OfferModal } from "../components/OfferModal";
import { OfferEmptyState } from "../components/OfferEmptyState";
import { CREATOR_TYPES } from "../constants/offerTypes";
import { useVendorAuthStore } from "../../Vendor/store/vendorAuthStore";
import { ADMIN_BASE_ROUTE, getAdminPath } from "../../Admin/config/adminRoutesConfig";
import toast from "react-hot-toast";

export const OfferList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith(ADMIN_BASE_ROUTE) || location.pathname.startsWith("/admin");
  const baseRoute = isAdmin ? getAdminPath("offers-management") : "/vendor/my-offers";

  const { vendor } = useVendorAuthStore();
  const sellerName = vendor?.storeName || vendor?.name || "Fashion Hub";

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedCreator, setSelectedCreator] = useState("");
  const [previewOffer, setPreviewOffer] = useState(null);

  // Offers hook
  const { offers, deleteOffer, toggleOfferStatus } = useOffers(
    isAdmin ? {} : { creatorType: CREATOR_TYPES.SELLER, creatorName: sellerName }
  );

  // Filtered offers
  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      const matchSearch =
        offer.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        offer.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (offer.couponCode && offer.couponCode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = selectedType ? offer.offerType === selectedType : true;
      const matchStatus = selectedStatus ? offer.status === selectedStatus : true;
      const matchCreator = selectedCreator ? offer.creatorType === selectedCreator : true;

      return matchSearch && matchType && matchStatus && matchCreator;
    });
  }, [offers, searchQuery, selectedType, selectedStatus, selectedCreator]);

  // Actions
  const handleView = (id) => {
    const offer = offers.find((o) => o.id === id);
    if (offer) {
      setPreviewOffer(offer);
    }
  };

  const handleEdit = (id) => {
    navigate(`${baseRoute}/edit/${id}`);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this offer?")) {
      deleteOffer(id);
      toast.success("Offer deleted successfully");
    }
  };

  const handleToggle = (id) => {
    toggleOfferStatus(id);
    toast.success("Offer status updated");
  };

  return (
    <div className="p-6 bg-[#1A1310] min-h-screen text-white space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            {isAdmin ? "Offer Promotions List" : "My Offers"}
          </h1>
          <p className="text-sm text-[#8E7768] mt-1">
            {isAdmin
              ? "View and manage all active, expired, and scheduled promotions."
              : "Monitor your store-specific discount campaigns and customer coupon codes."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`${baseRoute}/dashboard`)}
            className="px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-sm font-bold transition-all text-[#C8B3A3]"
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate(`${baseRoute}/create`)}
            className="px-5 py-2.5 bg-[#C07A3D] hover:bg-[#C07A3D]/90 rounded-xl text-sm font-bold transition-all shadow-md"
          >
            Create Offer
          </button>
        </div>
      </div>

      {/* Filters */}
      <OfferFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedCreator={selectedCreator}
        setSelectedCreator={setSelectedCreator}
        showCreatorFilter={isAdmin}
      />

      {/* Table / Empty State */}
      {filteredOffers.length > 0 ? (
        <OfferTable
          offers={filteredOffers}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleStatus={handleToggle}
        />
      ) : (
        <OfferEmptyState
          title="No Matching Offers"
          message="We couldn't find any offers matching your search criteria. Try modifying your filter settings."
        />
      )}

      {/* Offer details modal preview */}
      <OfferModal
        isOpen={!!previewOffer}
        onClose={() => setPreviewOffer(null)}
        offer={previewOffer}
      />
    </div>
  );
};

export default OfferList;
