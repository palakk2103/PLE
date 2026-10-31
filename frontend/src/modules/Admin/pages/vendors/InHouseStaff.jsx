import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUser,
  FiPhone,
  FiInfo,
  FiSearch,
  FiShoppingBag,
  FiCheckCircle,
  FiXCircle,
  FiUsers,
} from "react-icons/fi";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

const InHouseStaff = () => {
  const navigate = useNavigate();

  const [staffUsers, setStaffUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShopFilter, setSelectedShopFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [formData, setFormData] = useState({
    shopId: "",
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [usersRes, shopsRes] = await Promise.all([
        api.get("/admin/managed-vendors"),
        api.get("/admin/managed-shops"),
      ]);
      setStaffUsers(usersRes.data?.data || usersRes.data || []);
      setShops(shopsRes.data?.data || shopsRes.data || []);
    } catch (err) {
      toast.error("Failed to load in-house staff data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      shopId: shops.length > 0 ? shops[0]._id : "",
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
      shopId: user.shopId?._id || user.shopId || "",
      name: user.name || "",
      phone: user.phone || "",
      username: user.username || "",
      password: "",
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
    if (!formData.name.trim() || !formData.username.trim()) {
      toast.error("Name and Username are required");
      return;
    }
    if (!formData.shopId) {
      toast.error("Please select a Managed Shop");
      return;
    }
    if (!editingUser && !formData.password) {
      toast.error("Password is required for new users");
      return;
    }

    try {
      if (editingUser) {
        const updatePayload = {
          name: formData.name,
          phone: formData.phone,
          shopId: formData.shopId,
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
        toast.success("Staff user updated successfully");
      } else {
        await api.post("/admin/managed-vendors", formData);
        toast.success("In-House Staff user created successfully");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this in-house staff user?")) return;
    try {
      await api.delete(`/admin/managed-vendors/${userId}`);
      toast.success("Staff user deleted successfully");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete user");
    }
  };

  const filteredUsers = useMemo(() => {
    return staffUsers.filter((user) => {
      // Filter by Shop
      if (selectedShopFilter !== "all") {
        const userShopId = user.shopId?._id || user.shopId;
        if (userShopId !== selectedShopFilter) return false;
      }

      // Filter by Status
      if (selectedStatusFilter !== "all") {
        if (user.status !== selectedStatusFilter) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = user.name?.toLowerCase().includes(query);
        const usernameMatch = user.username?.toLowerCase().includes(query);
        const phoneMatch = user.phone?.toLowerCase().includes(query);
        const companyMatch = user.companyName?.toLowerCase().includes(query);
        const shopNameMatch = user.shopId?.name?.toLowerCase().includes(query);
        return nameMatch || usernameMatch || phoneMatch || companyMatch || shopNameMatch;
      }

      return true;
    });
  }, [staffUsers, selectedShopFilter, selectedStatusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = staffUsers.length;
    const active = staffUsers.filter((u) => u.status === "active").length;
    const inactive = total - active;
    const uniqueShops = new Set(
      staffUsers.map((u) => u.shopId?._id || u.shopId).filter(Boolean)
    ).size;
    return { total, active, inactive, uniqueShops };
  }, [staffUsers]);

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
            In-House Staff
          </h1>
          <p className="text-sm text-gray-500">
            Manage login credentials and vendor users for in-house managed shops.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/ple-ops-desk/vendors/managed-shops")}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all text-sm"
          >
            <FiShoppingBag className="text-base" />
            Managed Shops
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C07A3D] hover:bg-[#A8642C] text-white rounded-xl font-semibold shadow-md transition-all text-sm"
          >
            <FiPlus className="text-lg" />
            Add In-House Staff
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase">Total Staff</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#C07A3D] flex items-center justify-center text-lg">
            <FiUsers />
          </div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-emerald-600 uppercase">Active</h3>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">
            <FiCheckCircle />
          </div>
        </div>
        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-rose-600 uppercase">Inactive</h3>
            <p className="text-2xl font-bold text-rose-700 mt-1">{stats.inactive}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-lg">
            <FiXCircle />
          </div>
        </div>
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-blue-600 uppercase">Managed Shops</h3>
            <p className="text-2xl font-bold text-blue-700 mt-1">{shops.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
            <FiShoppingBag />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, username, phone, company, or shop..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D]/40 text-sm"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          {/* Shop Selector Filter */}
          <select
            value={selectedShopFilter}
            onChange={(e) => setSelectedShopFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none text-gray-700"
          >
            <option value="all">All Managed Shops</option>
            {shops.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none text-gray-700"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Staff Users Table */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">
            Shop Vendor Users ({filteredUsers.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-3xl py-12 text-center text-gray-500">
            Loading in-house staff users...
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase">
                    <th className="p-4 pl-6">Name & Company</th>
                    <th className="p-4">Assigned Shop</th>
                    <th className="p-4">Username</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">GST Number</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50/50">
                      {/* Name & Company */}
                      <td className="p-4 pl-6 font-bold text-gray-850">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                            <FiUser className="text-base" />
                          </div>
                          <div>
                            <div className="text-gray-900 font-semibold">{user.name}</div>
                            {user.companyName && (
                              <div className="text-[11px] font-medium text-[#C07A3D]">
                                {user.companyName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Assigned Shop */}
                      <td className="p-4">
                        {user.shopId ? (
                          <button
                            onClick={() =>
                              navigate(
                                `/ple-ops-desk/vendors/managed-shops/${user.shopId._id || user.shopId}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50/80 hover:bg-orange-100 text-[#C07A3D] font-medium text-xs transition-colors"
                            title="View Shop Details"
                          >
                            <FiShoppingBag className="text-xs" />
                            <span>{user.shopId.name || "Managed Shop"}</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Unassigned</span>
                        )}
                      </td>

                      {/* Username */}
                      <td className="p-4 font-mono text-xs text-gray-700">{user.username}</td>

                      {/* Phone */}
                      <td className="p-4 text-xs">{user.phone || "N/A"}</td>

                      {/* GST Number */}
                      <td className="p-4 font-mono text-xs text-gray-500">
                        {user.gstNumber || "N/A"}
                      </td>

                      {/* Role */}
                      <td className="p-4">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-semibold capitalize">
                          {user.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            user.status === "active"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {user.status?.toUpperCase() || "ACTIVE"}
                        </span>
                      </td>

                      {/* Actions */}
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
          <div className="bg-white border border-gray-200 rounded-3xl py-14 text-center text-gray-400">
            <FiInfo className="text-3xl text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-600">No in-house staff users found.</p>
            <p className="text-xs text-gray-400 mt-1">
              Add new staff members or clear your search filters.
            </p>
          </div>
        )}
      </div>

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
                {editingUser ? "Edit In-House Staff" : "Add In-House Staff"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Shop Assignment */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Assigned Managed Shop *
                  </label>
                  <select
                    required
                    value={formData.shopId}
                    onChange={(e) => setFormData({ ...formData, shopId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D]/40 text-sm"
                  >
                    <option value="" disabled>
                      Select Managed Shop
                    </option>
                    {shops.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} {s.gst ? `(${s.gst})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C07A3D]/40 text-sm"
                      placeholder="e.g. Rahul Kumar"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">
                      Username / Login ID *
                    </label>
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
                      placeholder="e.g. corpo"
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
                      placeholder="0987654321"
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
    </motion.div>
  );
};

export default InHouseStaff;
