import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FiPlus, FiTrash2, FiTag, FiShoppingBag, FiInfo } from "react-icons/fi";
import { useCampaignStore } from "../../../shared/store/campaignStore";
import { useVendorProductStore } from "../store/vendorProductStore";
import { useVendorAuthStore } from "../store/vendorAuthStore";
import { formatPrice } from "../../../shared/utils/helpers";
import toast from "react-hot-toast";

const FestivalCampaigns = () => {
  const { campaigns, initialize: initCampaigns, updateCampaign } = useCampaignStore();
  const { products: vendorProducts, fetchProducts, isLoading: productsLoading } = useVendorProductStore();
  const { vendor, isAuthenticated } = useVendorAuthStore();
  const vendorId = vendor?._id || vendor?.id || (localStorage.getItem('vendor-token') ? 'vendor' : null);

  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  useEffect(() => {
    initCampaigns();
    fetchProducts({ fetchAll: true, limit: 200 });
  }, [initCampaigns, fetchProducts]);

  // Active / Upcoming festival campaigns
  const activeFestivalCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const isFestival = c.type === 'festival' || c.type === 'special_offer' || c.type === 'flash_sale';
      if (!isFestival) return false;
      if (!c.endDate) return true;
      const now = new Date();
      const end = new Date(c.endDate);
      return isNaN(end.getTime()) || end >= now; // Show active and upcoming
    });
  }, [campaigns]);

  // Auto-select first active campaign
  useEffect(() => {
    if (activeFestivalCampaigns.length > 0 && !selectedCampaignId) {
      const active = activeFestivalCampaigns.find(c => c.isActive);
      if (active) {
        setSelectedCampaignId(active._id);
      } else {
        setSelectedCampaignId(activeFestivalCampaigns[0]._id);
      }
    }
  }, [activeFestivalCampaigns, selectedCampaignId]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find(c => String(c._id) === String(selectedCampaignId));
  }, [campaigns, selectedCampaignId]);

  // Products currently added to the selected campaign
  const campaignProductIds = useMemo(() => {
    if (!selectedCampaign || !selectedCampaign.productIds) return new Set();
    return new Set(selectedCampaign.productIds.map(String));
  }, [selectedCampaign]);

  // Vendor's products added to the campaign
  const addedProducts = useMemo(() => {
    return vendorProducts.filter(p => campaignProductIds.has(String(p.id || p._id)));
  }, [vendorProducts, campaignProductIds]);

  // Vendor's products NOT added to the campaign
  const availableProducts = useMemo(() => {
    return vendorProducts.filter(p => !campaignProductIds.has(String(p.id || p._id)));
  }, [vendorProducts, campaignProductIds]);

  const handleAddProduct = async (productId) => {
    if (!selectedCampaign) return;
    try {
      const updatedProductIds = [...selectedCampaign.productIds, String(productId)];
      await updateCampaign(selectedCampaign._id, {
        ...selectedCampaign,
        productIds: updatedProductIds,
      });
      toast.success("Product added to campaign");
    } catch (error) {
      toast.error("Failed to add product");
    }
  };

  const handleRemoveProduct = async (productId) => {
    if (!selectedCampaign) return;
    try {
      const updatedProductIds = selectedCampaign.productIds.filter(id => String(id) !== String(productId));
      await updateCampaign(selectedCampaign._id, {
        ...selectedCampaign,
        productIds: updatedProductIds,
      });
      toast.success("Product removed from campaign");
    } catch (error) {
      toast.error("Failed to remove product");
    }
  };

  if (!vendorId && !isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to manage campaign products.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-6xl mx-auto p-4 md:p-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-1.5 flex items-center gap-2">
          <FiTag className="text-[#C07A3D]" /> Festival Campaign Products
        </h1>
        <p className="text-sm text-gray-500">
          Participate in active festival sales and list your products to boost visibility and sales.
        </p>
      </div>

      {activeFestivalCampaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <FiInfo className="text-4xl text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800 mb-1">No Active Campaigns</h3>
          <p className="text-gray-500 text-sm">
            There are currently no active or upcoming festival campaigns from the admin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Selector & Details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <label className="block text-sm font-bold text-gray-700">Select Campaign</label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D] text-sm"
              >
                {activeFestivalCampaigns.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.isActive ? "(Active)" : "(Upcoming)"}
                  </option>
                ))}
              </select>

              {selectedCampaign && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-gray-50 relative">
                    <img
                      src={selectedCampaign.bannerConfig?.image || "https://images.unsplash.com/photo-1605152276897-4f618f831968?w=500&auto=format&fit=crop&q=80"}
                      alt={selectedCampaign.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/45 flex items-end p-3">
                      <span className="bg-[#C07A3D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        Flat {selectedCampaign.discountValue}% OFF
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-base">{selectedCampaign.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{selectedCampaign.description}</p>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-2.5 rounded-xl">
                    <p><strong>Start Date:</strong> {new Date(selectedCampaign.startDate).toLocaleDateString()}</p>
                    <p><strong>End Date:</strong> {new Date(selectedCampaign.endDate).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Associations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Added Products Section */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <FiShoppingBag className="text-green-600" />
                Products In Campaign ({addedProducts.length})
              </h3>
              {addedProducts.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No products added yet. Choose from available products below.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {addedProducts.map(product => (
                    <div
                      key={product.id || product._id}
                      className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={product.image || "https://via.placeholder.com/50x50?text=Product"}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded-lg"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{product.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{formatPrice(product.price)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveProduct(product.id || product._id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove from campaign"
                      >
                        <FiTrash2 className="text-base" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available Products Section */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800 text-base">Available Products ({availableProducts.length})</h3>
              {productsLoading ? (
                <p className="text-sm text-gray-400 py-4 text-center">Loading products...</p>
              ) : availableProducts.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">All your products are already in the campaign.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                  {availableProducts.map(product => (
                    <div
                      key={product.id || product._id}
                      className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50/55 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={product.image || "https://via.placeholder.com/50x50?text=Product"}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded-lg"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{product.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{formatPrice(product.price)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddProduct(product.id || product._id)}
                        className="p-1.5 text-[#C07A3D] hover:bg-[#C07A3D]/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                        title="Add to campaign"
                      >
                        <FiPlus className="text-base" /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FestivalCampaigns;
