import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowLeft,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUser,
  FiPhone,
  FiUnlock,
  FiInfo,
  FiCheck,
  FiX,
  FiShield,
  FiPackage,
  FiSearch,
} from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";
import ProductFormModal from "../../components/ProductFormModal";
import Badge from "../../../../shared/components/Badge";
import { formatPrice } from "../../../../shared/utils/helpers";

const ManagedShopDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [shop, setShop] = useState(null);
  const [vendorUsers, setVendorUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vendors"); // "vendors" or "products"
  const [shopProducts, setShopProducts] = useState([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [selectedProductStatus, setSelectedProductStatus] = useState("all");
  const [productFormModal, setProductFormModal] = useState({
    isOpen: false,
    productId: null,
  });
  const [reviewProduct, setReviewProduct] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewChannel, setReviewChannel] = useState("B2C");
  const [reviewB2bPrice, setReviewB2bPrice] = useState(0);
  const [reviewB2bMinQty, setReviewB2bMinQty] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const handleReviewSubmit = async (status) => {
    if (status === "rejected" && !rejectionReason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }

    try {
      await api.patch(`/admin/products/${reviewProduct._id}/review`, {
        status,
        reason: rejectionReason,
        salesChannel: reviewChannel,
        b2bWholesalePrice: reviewB2bPrice,
        b2bMinOrderQty: reviewB2bMinQty,
      });
      toast.success(`Product ${status === "approved" ? "approved" : "rejected"} successfully`);
      setReviewProduct(null);
      setRejectionReason("");
      fetchShopProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    username: "",
    password: "",
    role: "managed_vendor",
    status: "active",
    companyName: "",
    gstNumber: "",
    address: "",
  });

  const filteredShopProducts = useMemo(() => {
    let filtered = shopProducts;
    if (selectedProductStatus !== "all") {
      filtered = filtered.filter((p) => p.approvalStatus === selectedProductStatus);
    }
    if (!productSearchQuery) return filtered;
    return filtered.filter((product) =>
      product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
    );
  }, [shopProducts, productSearchQuery, selectedProductStatus]);

  const productStats = useMemo(() => {
    const total = shopProducts.length;
    const pending = shopProducts.filter((p) => p.approvalStatus === "pending").length;
    const approved = shopProducts.filter((p) => p.approvalStatus === "approved").length;
    const rejected = shopProducts.filter((p) => p.approvalStatus === "rejected").length;
    return { total, pending, approved, rejected };
  }, [shopProducts]);

  useEffect(() => {
    fetchShopAndUsers();
    fetchShopProducts();
  }, [id]);

  const fetchShopAndUsers = async () => {
    try {
      setIsLoading(true);
      const shopRes = await api.get(`/admin/managed-shops/${id}`);
      setShop(shopRes.data?.data || shopRes.data);

      const usersRes = await api.get(`/admin/managed-vendors?shopId=${id}`);
      setVendorUsers(usersRes.data?.data || usersRes.data || []);
    } catch (err) {
      toast.error("Failed to load details");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShopProducts = async () => {
    try {
      setIsProductsLoading(true);
      const res = await api.get(`/admin/products?shopId=${id}&includeInactive=true`);
      const products = res.data?.products || res.data || [];
      setShopProducts(products);
    } catch (err) {
      console.error("Failed to load shop products", err);
    } finally {
      setIsProductsLoading(false);
    }
  };

  const handleDeleteProduct = async (prodId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await api.delete(`/admin/products/${prodId}`);
      toast.success("Product deleted successfully");
      fetchShopProducts();
    } catch (err) {
      toast.error("Failed to delete product");
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      phone: "",
      username: "",
      password: "",
      role: "managed_vendor",
      status: "active",
      companyName: "",
      gstNumber: "",
      address: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || "",
      phone: user.phone || "",
      username: user.username || "",
      password: "", // blank, optional for edit password reset
      role: user.role || "managed_vendor",
      status: user.status || "active",
      companyName: user.companyName || "",
      gstNumber: user.gstNumber || "",
      address: user.address || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.username) {
      toast.error("Name and Username are required");
      return;
    }
    if (!editingUser && !formData.password) {
      toast.error("Password is required for new users");
      return;
    }

    try {
      if (editingUser) {
        // Update user
        const updatePayload = {
          name: formData.name,
          phone: formData.phone,
          role: formData.role,
          status: formData.status,
          companyName: formData.companyName,
          gstNumber: formData.gstNumber,
          address: formData.address,
        };
        if (formData.password) {
          updatePayload.password = formData.password;
        }
        await api.put(`/admin/managed-vendors/${editingUser._id}`, updatePayload);
        toast.success("User updated successfully");
      } else {
        // Create user
        await api.post("/admin/managed-vendors", {
          ...formData,
          shopId: id,
        });
        toast.success("Vendor User created successfully");
      }
      setIsModalOpen(false);
      fetchShopAndUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this vendor user?")) return;
    try {
      await api.delete(`/admin/managed-vendors/${userId}`);
      toast.success("User deleted successfully");
      fetchShopAndUsers();
    } catch (err) {
      toast.error("Failed to delete user");
    }
  };

  if (isLoading && !shop) {
    return <div className="text-center py-12 text-gray-500">Loading details...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <button
          onClick={() => navigate("/admin/vendors/managed-shops")}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-all"
        >
          <FiArrowLeft /> Back to Shops
        </button>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#C07A3D] hover:bg-[#A8642C] text-white rounded-xl font-semibold shadow-md transition-all text-sm"
        >
          <FiPlus className="text-lg" />
          Add Vendor User
        </button>
      </div>

      {/* Shop Info Card */}
      {shop && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
          <img
            src={shop.logo || "https://via.placeholder.com/120"}
            alt={shop.name}
            className="w-24 h-24 object-contain rounded-2xl border border-gray-100 bg-gray-50"
          />
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  shop.status === "active"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {shop.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-500">{shop.description || "No description listed."}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2 text-xs text-gray-500">
              <div>Phone: <span className="font-bold text-gray-700">{shop.phone || "N/A"}</span></div>
              <div>GST: <span className="font-bold text-gray-700">{shop.gst || "N/A"}</span></div>
              <div>Warehouse: <span className="font-bold text-gray-700">{shop.warehouse || "N/A"}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Shop Stats Overview */}
      {shop && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-400 uppercase">Total Products</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{productStats.total}</p>
          </div>
          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-amber-600 uppercase">Pending Review</h3>
            <p className="text-2xl font-bold text-amber-700 mt-1">{productStats.pending}</p>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-emerald-600 uppercase">Approved / Active</h3>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{productStats.approved}</p>
          </div>
          <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-rose-600 uppercase">Rejected</h3>
            <p className="text-2xl font-bold text-rose-700 mt-1">{productStats.rejected}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab("vendors")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === "vendors"
              ? "border-[#C07A3D] text-[#C07A3D]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          In-House Staff / Users ({vendorUsers.length})
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === "products"
              ? "border-[#C07A3D] text-[#C07A3D]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Shop Products ({shopProducts.length})
        </button>
      </div>

      {activeTab === "vendors" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800">Shop Vendor Users</h2>
          {vendorUsers.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase">
                      <th className="p-4 pl-6">Name & Company</th>
                      <th className="p-4">Username</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">GST Number</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                    {vendorUsers.map((user) => (
                      <tr key={user._id} className="hover:bg-gray-50/50">
                        <td className="p-4 pl-6 font-bold text-gray-850 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                            <FiUser />
                          </div>
                          <div>
                            <div>{user.name}</div>
                            {user.companyName && (
                              <div className="text-[11px] font-medium text-[#C07A3D]">
                                {user.companyName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs">{user.username}</td>
                        <td className="p-4">{user.phone || "N/A"}</td>
                        <td className="p-4 font-mono text-xs text-gray-500">{user.gstNumber || "N/A"}</td>
                        <td className="p-4">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-semibold capitalize">
                            {user.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              user.status === "active"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-rose-50 text-rose-600"
                            }`}
                          >
                            {user.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Edit User"
                          >
                            <FiEdit2 className="text-xs" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id)}
                            className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                            title="Delete User"
                          >
                            <FiTrash2 className="text-xs" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-3xl py-12 text-center text-gray-400">
              <FiInfo className="text-3xl text-gray-300 mx-auto mb-2" />
              <p className="font-semibold">No vendor users generated for this shop yet.</p>
              <p className="text-xs mt-1">Generate login credentials above to grant access.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-bold text-gray-800">Shop Products</h2>
            <div className="relative w-full sm:w-64">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D]/40 text-sm"
              />
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { id: "all", label: "All Status" },
              { id: "pending", label: "Pending Review" },
              { id: "approved", label: "Approved / Active" },
              { id: "rejected", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedProductStatus(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  selectedProductStatus === tab.id
                    ? "bg-[#C07A3D] text-white shadow-sm font-semibold"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isProductsLoading ? (
            <div className="text-center py-12 text-gray-500">Loading products...</div>
          ) : filteredShopProducts.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase">
                      <th className="p-4 pl-6">Product</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Approval</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                    {filteredShopProducts.map((product) => (
                      <tr key={product._id} className="hover:bg-gray-50/50">
                        <td className="p-4 pl-6 font-medium text-gray-800 flex items-center gap-3">
                          <img
                            src={product.image || product.images?.[0] || "https://via.placeholder.com/50x50?text=Product"}
                            alt={product.name}
                            className="w-10 h-10 object-cover rounded-lg border border-gray-100 bg-gray-50"
                            onError={(e) => {
                              e.target.src = "https://via.placeholder.com/50x50?text=Product";
                            }}
                          />
                          <span className="font-semibold text-gray-800">{product.name}</span>
                        </td>
                        <td className="p-4 text-xs font-medium text-gray-500">
                          {product.categoryId?.name || "N/A"}
                        </td>
                        <td className="p-4 font-semibold text-gray-700">
                          {formatPrice(product.price)}
                        </td>
                        <td className="p-4">
                          {product.stockQuantity || 0}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              product.approvalStatus === "approved"
                                ? "bg-emerald-50 text-emerald-600"
                                : product.approvalStatus === "rejected"
                                ? "bg-rose-50 text-rose-600"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {product.approvalStatus?.toUpperCase() || "PENDING"}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right space-x-2">
                          {product.approvalStatus === "pending" && (
                            <button
                              onClick={() => {
                                setReviewProduct(product);
                                setReviewChannel(product.salesChannel || "B2C");
                                setReviewB2bPrice(product.b2bWholesalePrice !== undefined && product.b2bWholesalePrice !== null ? product.b2bWholesalePrice : product.price || 0);
                                setReviewB2bMinQty(product.b2bMinOrderQty || 1);
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                              title="Review Product"
                            >
                              Review
                            </button>
                          )}
                          <button
                            onClick={() => setProductFormModal({ isOpen: true, productId: product._id })}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Edit Product"
                          >
                            <FiEdit2 className="text-xs" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product._id)}
                            className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                            title="Delete Product"
                          >
                            <FiTrash2 className="text-xs" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-3xl py-12 text-center text-gray-400">
              <FiPackage className="text-3xl text-gray-300 mx-auto mb-2" />
              <p className="font-semibold">No products found.</p>
              <p className="text-xs mt-1">Products added by this shop's vendors will appear here.</p>
            </div>
          )}
        </div>
      )}

      <ProductFormModal
        isOpen={productFormModal.isOpen}
        onClose={() => setProductFormModal({ isOpen: false, productId: null })}
        productId={productFormModal.productId}
        onSuccess={() => {
          fetchShopProducts();
        }}
      />

      {/* Add / Edit Modal */}
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
                {editingUser ? "Edit Vendor User" : "Create Vendor User"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D]/40 text-sm"
                      placeholder="Rahul Kumar"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Username / Login ID *</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingUser}
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none disabled:opacity-50 text-sm"
                      placeholder="e.g. rahul"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Company Name</label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-sm"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">GST Number</label>
                    <input
                      type="text"
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-sm"
                      placeholder="e.g. 27AAAAA1111A1Z1"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-sm"
                    placeholder="Enter Address"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    {editingUser ? "Reset Password (Optional)" : "Password *"}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-sm"
                    placeholder={editingUser ? "Leave blank to keep current" : "••••••••"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-xs"
                      placeholder="9999999999"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-xs"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
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

      {/* Product Review Modal */}
      <AnimatePresence>
        {reviewProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewProduct(null)}
              className="fixed inset-0 bg-black"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 shadow-2xl relative w-full max-w-lg z-10 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-bold text-gray-800">Review Product</h2>
                <button
                  onClick={() => setReviewProduct(null)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FiX className="text-gray-500" />
                </button>
              </div>

              {/* Product Info Preview */}
              <div className="flex gap-4 border border-gray-100 p-3 rounded-2xl bg-gray-50/50">
                <img
                  src={reviewProduct.image || reviewProduct.images?.[0] || "https://via.placeholder.com/100"}
                  alt={reviewProduct.name}
                  className="w-20 h-20 object-cover rounded-xl border border-gray-200"
                />
                <div className="space-y-1">
                  <h3 className="font-bold text-gray-900 text-sm">{reviewProduct.name}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-xs">{reviewProduct.description}</p>
                  <div className="text-xs font-semibold text-gray-700">
                    Retail Price: <span className="text-primary-600">{formatPrice(reviewProduct.price)}</span>
                  </div>
                </div>
              </div>

              {/* Target Sales Channel Selector */}
              <div className="bg-amber-50/60 border border-amber-200/80 p-3.5 rounded-2xl space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1 flex items-center justify-between">
                    <span>Target Sales Channel *</span>
                    <span className="text-[10px] text-amber-800 font-semibold uppercase">Admin Publish Destination</span>
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Select where this product will be visible upon approval:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'B2C', label: 'B2C Only', desc: 'Retail' },
                      { id: 'B2B', label: 'B2B Only', desc: 'Wholesale' },
                      { id: 'BOTH', label: 'Both', desc: 'B2C + B2B' },
                    ].map((chan) => (
                      <button
                        key={chan.id}
                        type="button"
                        onClick={() => setReviewChannel(chan.id)}
                        className={`p-2 rounded-xl text-center border transition-all ${
                          reviewChannel === chan.id
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-50/50'
                        }`}
                      >
                        <div className="text-xs font-bold">{chan.label}</div>
                        <div className={`text-[10px] ${reviewChannel === chan.id ? 'text-amber-100' : 'text-gray-400'}`}>
                          {chan.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {(reviewChannel === 'B2B' || reviewChannel === 'BOTH') && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-800">B2B Wholesale Price (₹)</label>
                      <input
                        type="number"
                        value={reviewB2bPrice}
                        onChange={(e) => setReviewB2bPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none"
                        placeholder="Wholesale price"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-800">Min Order Qty (MOQ)</label>
                      <input
                        type="number"
                        min="1"
                        value={reviewB2bMinQty}
                        onChange={(e) => setReviewB2bMinQty(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none"
                        placeholder="e.g. 10"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Rejection Form Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Rejection Reason (Required only if rejecting)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Image resolution is low, or incorrect category selected."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/35 text-xs text-gray-750"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleReviewSubmit("rejected")}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold"
                >
                  Reject Product
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewSubmit("approved")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  Approve & Make Live
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ManagedShopDetails;
