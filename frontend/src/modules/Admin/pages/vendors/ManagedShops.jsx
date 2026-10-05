import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiToggleLeft,
  FiToggleRight,
  FiEye,
  FiPhone,
  FiMapPin,
  FiInfo,
} from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

const ManagedShops = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    logo: "",
    address: "",
    phone: "",
    gst: "",
    warehouse: "",
    description: "",
  });

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/admin/managed-shops");
      setShops(res.data?.data || res.data || []);
    } catch (err) {
      toast.error("Failed to load managed shops");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingShop(null);
    setFormData({
      name: "",
      logo: "",
      address: "",
      phone: "",
      gst: "",
      warehouse: "",
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (shop) => {
    setEditingShop(shop);
    setFormData({
      name: shop.name || "",
      logo: shop.logo || "",
      address: shop.address || "",
      phone: shop.phone || "",
      gst: shop.gst || "",
      warehouse: shop.warehouse || "",
      description: shop.description || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Shop Name is required");
      return;
    }

    try {
      if (editingShop) {
        await api.put(`/admin/managed-shops/${editingShop._id}`, formData);
        toast.success("Shop updated successfully");
      } else {
        await api.post("/admin/managed-shops", formData);
        toast.success("Shop created successfully");
      }
      setIsModalOpen(false);
      fetchShops();
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await api.patch(`/admin/managed-shops/${id}/status`, { status: nextStatus });
      toast.success(`Shop status changed to ${nextStatus}`);
      fetchShops();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this shop?")) return;
    try {
      await api.delete(`/admin/managed-shops/${id}`);
      toast.success("Shop deleted successfully");
      fetchShops();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete shop");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            In-House Shops & Staff
          </h1>
          <p className="text-sm text-gray-500">
            Admin-owned shops and internal staff / managed vendors.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#C07A3D] hover:bg-[#A8642C] text-white rounded-xl font-semibold shadow-md transition-all text-sm"
        >
          <FiPlus className="text-lg" />
          Create Shop
        </button>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading shops...</div>
      ) : shops.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shops.map((shop) => (
            <div
              key={shop._id}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
            >
              <div className="p-5 space-y-4">
                {/* Logo & Status */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <img
                      src={shop.logo || "https://via.placeholder.com/60"}
                      alt={shop.name}
                      className="w-12 h-12 object-contain rounded-xl border border-gray-100 bg-gray-50"
                    />
                    <div>
                      <h3 className="font-bold text-gray-800 text-base">{shop.name}</h3>
                      <span className="text-xs text-gray-400">GST: {shop.gst || "N/A"}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      shop.status === "active"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {shop.status.toUpperCase()}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-500 line-clamp-2 min-h-[32px]">
                  {shop.description || "No description provided."}
                </p>

                {/* Meta details */}
                <div className="space-y-1.5 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <FiMapPin className="text-gray-400" />
                    <span>{shop.address || "No address listed"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FiPhone className="text-gray-400" />
                    <span>{shop.phone || "No phone listed"}</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="border-t border-gray-100 p-4 bg-gray-50/50 flex justify-between items-center gap-2">
                <button
                  onClick={() => navigate(`/admin/vendors/managed-shops/${shop._id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition-colors"
                >
                  <FiEye /> View Details
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleStatus(shop._id, shop.status)}
                    title={shop.status === "active" ? "Deactivate" : "Activate"}
                    className="p-2 text-gray-500 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {shop.status === "active" ? <FiToggleRight className="text-emerald-500 text-lg" /> : <FiToggleLeft className="text-gray-400 text-lg" />}
                  </button>
                  <button
                    onClick={() => handleOpenEdit(shop)}
                    title="Edit"
                    className="p-2 text-blue-600 hover:text-blue-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FiEdit2 className="text-sm" />
                  </button>
                  <button
                    onClick={() => handleDelete(shop._id)}
                    title="Delete"
                    className="p-2 text-rose-600 hover:text-rose-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FiTrash2 className="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
          <FiInfo className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-bold">No managed shops found.</p>
          <p className="text-xs text-gray-400 mt-1">Get started by creating a new shop.</p>
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 shadow-2xl relative w-full max-w-lg z-10 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold text-gray-800">
                {editingShop ? "Edit Managed Shop" : "Create Managed Shop"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D]/40 text-sm"
                    placeholder="Enter Shop Name"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">GST Number</label>
                    <input
                      type="text"
                      value={formData.gst}
                      onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                      placeholder="e.g. 27AAAAA1111A1Z1"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Logo Image URL</label>
                  <input
                    type="text"
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Warehouse Address</label>
                  <input
                    type="text"
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                    placeholder="Mumbai, Warehouse A"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Shop Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                    placeholder="Enter Shop Address"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none"
                    placeholder="Brief description of the shop..."
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#C07A3D] hover:bg-[#A8642C] text-white rounded-xl text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ManagedShops;
