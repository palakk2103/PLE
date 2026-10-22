import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiEdit, FiTrash2, FiDollarSign, FiLock } from "react-icons/fi";
import { motion } from "framer-motion";
import DataTable from "../../../Admin/components/DataTable";
import ExportButton from "../../../Admin/components/ExportButton";
import Badge from "../../../../shared/components/Badge";
import ConfirmModal from "../../../Admin/components/ConfirmModal";
import AnimatedSelect from "../../../Admin/components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";
import { useVendorAuthStore } from "../../store/vendorAuthStore";
import { useVendorProductStore } from "../../store/vendorProductStore";
import { useCategoryStore } from "../../../../shared/store/categoryStore";
import RefurbishedBadge from "../../components/Refurbished/RefurbishedBadge";
import ApprovalStatusBadge from "../../components/Refurbished/ApprovalStatusBadge";
import VendorNegotiationModal from "../../components/VendorNegotiationModal";

const ManageProducts = () => {
  const navigate = useNavigate();
  const { vendor } = useVendorAuthStore();
  const { products, isLoading, fetchProducts, removeProduct } = useVendorProductStore();
  const { categories, initialize: initCategories } = useCategoryStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedCondition, setSelectedCondition] = useState("all");
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    productId: null,
  });
  const [negotiationModal, setNegotiationModal] = useState({
    isOpen: false,
    productId: null,
    productName: "",
  });

  const vendorId = vendor?.id || vendor?._id;

  useEffect(() => {
    initCategories();
    if (vendorId) {
      fetchProducts({ fetchAll: true, limit: 200 });
    }
  }, [vendorId, initCategories, fetchProducts]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (searchQuery) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((product) => product.stock === selectedStatus);
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (product) =>
          String(product.categoryId?._id ?? product.categoryId ?? "") ===
          selectedCategory
      );
    }

    if (selectedType !== "all") {
      filtered = filtered.filter((product) => {
        const chan = product.salesChannel || (product.b2bEnabled ? "BOTH" : "B2C");
        return chan === selectedType;
      });
    }

    if (selectedCondition !== "all") {
      filtered = filtered.filter((product) => {
        if (selectedCondition === "brand_new") {
          return product.condition === "brand_new" || !product.condition;
        }
        return product.condition === selectedCondition;
      });
    }

    return filtered;
  }, [products, searchQuery, selectedStatus, selectedCategory, selectedType, selectedCondition]);

  const columns = [
    {
      key: "_id",
      label: "ID",
      sortable: true,
      render: (value) => String(value).slice(-6).toUpperCase(),
    },
    {
      key: "name",
      label: "Product Name",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <img
            src={row.image || row.images?.[0]}
            alt={value}
            className="w-10 h-10 object-cover rounded-lg"
            onError={(e) => {
              e.target.src = "https://via.placeholder.com/50x50?text=Product";
            }}
          />
          <div className="flex flex-col">
            <span className="font-medium">{value}</span>
            {(row.customBrandName || row.brandId?.name) && (
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                Brand: <strong className="text-gray-700">{row.customBrandName || row.brandId?.name}</strong>
                {row.brandApprovalStatus === 'pending' && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1 rounded">
                    Brand Review
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "price",
      label: vendor?.role === "managed_vendor" ? "Supply Price" : "Price",
      sortable: true,
      render: (value, row) => {
        const isManaged = vendor?.role === "managed_vendor" || !!row.shopId;
        const agreement = row.agreementId;
        const isLocked = agreement?.isLocked;
        const currentOffer = agreement?.currentOffer;
        const hasAdminOffer = currentOffer?.offeredByRole === "admin" && currentOffer?.status === "pending";

        if (!isManaged) return formatPrice(value);

        return (
          <div className="flex flex-col gap-0.5">
            <span className={`font-semibold ${isLocked ? "text-emerald-700" : "text-gray-900"}`}>
              {formatPrice(isLocked && agreement.finalAgreedPrice ? agreement.finalAgreedPrice : value)}
            </span>
            {isLocked ? (
              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                <FiLock className="w-2.5 h-2.5" /> Price Locked
              </span>
            ) : hasAdminOffer ? (
              <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1 py-0.5 rounded border border-amber-200/60 inline-block w-fit">
                Admin Offer: {formatPrice(currentOffer.price)}
              </span>
            ) : agreement?.status === "in_negotiation" ? (
              <span className="text-[10px] text-blue-600 font-medium">In Negotiation</span>
            ) : (
              <span className="text-[10px] text-gray-400">Asked Price</span>
            )}
          </div>
        );
      },
    },
    {
      key: "stockQuantity",
      label: "Stock",
      sortable: true,
      render: (value) => value?.toLocaleString() || 0,
    },
    {
      key: "stock",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge
          variant={
            value === "in_stock"
              ? "success"
              : value === "low_stock"
                ? "warning"
                : "error"
          }>
          {value?.replace("_", " ").toUpperCase() || "N/A"}
        </Badge>
      ),
    },
    {
      key: "condition",
      label: "Condition Status",
      sortable: true,
      render: (_, row) => {
        if (!row.condition || row.condition === "brand_new") {
          return <span className="text-xs text-gray-500 font-medium">Brand New</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            <span className="text-xs capitalize font-bold text-gray-700">
              {row.condition.replace("_", " ")} {row.refurbishedGrade ? `(Grade ${row.refurbishedGrade})` : ""}
            </span>
            {row.refurbishedApprovalStatus && (
              <ApprovalStatusBadge status={row.refurbishedApprovalStatus} />
            )}
          </div>
        );
      }
    },
    {
      key: "approvalStatus",
      label: "Approval Status",
      sortable: true,
      render: (value, row) => {
        const status = value || row.approvalStatus || (row.shopId ? "pending" : "approved");
        return (
          <div className="flex flex-col gap-1">
            <Badge
              variant={
                status === "approved"
                  ? "success"
                  : status === "pending"
                    ? "warning"
                    : status === "rejected"
                      ? "error"
                      : "neutral"
              }>
              {status.toUpperCase()}
            </Badge>
            {status === "rejected" && row.rejectionReason && (
              <span className="text-[10px] text-red-500 italic max-w-[120px] truncate" title={row.rejectionReason}>
                Reason: {row.rejectionReason}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: "salesChannel",
      label: "Sales Channel",
      sortable: true,
      render: (_, row) => {
        const channel = row.salesChannel || (row.b2bEnabled ? "BOTH" : "B2C");
        return (
          <div className="flex gap-1.5 flex-wrap items-center">
            {channel === 'B2C' && <Badge variant="success">B2C</Badge>}
            {channel === 'B2B' && <Badge variant="warning">B2B</Badge>}
            {channel === 'BOTH' && <Badge variant="info">BOTH</Badge>}
            {row.condition && row.condition !== "brand_new" && (
              <RefurbishedBadge
                condition={row.condition}
                grade={row.refurbishedGrade}
                warranty={row.refurbishedWarrantyDuration}
                showDetails={false}
              />
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => {
        const isManagedVendor = vendor?.role === 'managed_vendor';
        const isEditable = !isManagedVendor || ['pending', 'rejected'].includes(row.approvalStatus || 'pending');
        return (
          <div className="flex items-center gap-2">
            {isManagedVendor && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNegotiationModal({
                    isOpen: true,
                    productId: row._id ?? row.id,
                    productName: row.name,
                  });
                }}
                className="px-2.5 py-1 text-xs font-semibold text-[#C07A3D] bg-[#C07A3D]/10 hover:bg-[#C07A3D]/20 rounded-lg flex items-center gap-1 transition-colors"
                title="View Commercial Terms & Negotiations">
                <FiDollarSign className="w-3.5 h-3.5" /> Terms
              </button>
            )}
            {isEditable ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/vendor/products/${row._id ?? row.id}`);
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <FiEdit />
              </button>
            ) : (
              <span className="p-2 text-gray-305 cursor-not-allowed" title="Live/Approved products cannot be edited">
                <FiEdit className="opacity-40" />
              </span>
            )}
            {!isManagedVendor && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteModal({ isOpen: true, productId: row._id ?? row.id });
                }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <FiTrash2 />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const confirmDelete = async () => {
    const success = await removeProduct(deleteModal.productId);
    if (success) {
      setDeleteModal({ isOpen: false, productId: null });
    }
  };

  if (!vendorId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please log in to manage products</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 dark:text-white mb-1">
            Manage Products
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
            View, edit, and manage your product catalog
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/vendor/products/bulk-upload')}
            className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-amber-600/20 transition flex-shrink-0"
          >
            <span>+ Bulk Upload</span>
          </button>
          <button
            onClick={() => navigate("/vendor/products/add-product")}
            className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 gradient-green text-white rounded-xl hover:shadow-glow-green transition-all font-semibold text-xs sm:text-sm whitespace-nowrap flex-shrink-0">
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-white/5 min-w-0">
        {/* Filters Section */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="relative col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-2">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-white/10 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <AnimatedSelect
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "in_stock", label: "In Stock" },
                  { value: "low_stock", label: "Low Stock" },
                  { value: "out_of_stock", label: "Out of Stock" },
                ]}
                className="w-full"
              />
            </div>

            <div>
              <AnimatedSelect
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={[
                  { value: "all", label: "All Categories" },
                  ...categories
                    .filter((cat) => cat.isActive !== false)
                    .map((cat) => ({ value: String(cat._id ?? cat.id), label: cat.name })),
                ]}
                className="w-full"
              />
            </div>

            <div>
              <AnimatedSelect
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                options={[
                  { value: "all", label: "All Channels" },
                  { value: "B2C", label: "B2C" },
                  { value: "B2B", label: "B2B" },
                  { value: "BOTH", label: "Both" },
                ]}
                className="w-full"
              />
            </div>

            <div className="flex gap-2">
              <AnimatedSelect
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                options={[
                  { value: "all", label: "All Conditions" },
                  { value: "brand_new", label: "Brand New" },
                  { value: "refurbished", label: "Refurbished" },
                  { value: "renewed", label: "Renewed" },
                  { value: "open_box", label: "Open Box" },
                ]}
                className="w-full flex-1"
              />

              <ExportButton
                data={filteredProducts}
                headers={[
                  { label: "ID", accessor: (row) => String(row._id ?? row.id) },
                  { label: "Name", accessor: (row) => row.name },
                  { label: "Price", accessor: (row) => formatPrice(row.price) },
                  { label: "Stock", accessor: (row) => row.stockQuantity || 0 },
                  { label: "Status", accessor: (row) => row.stock || "N/A" },
                ]}
                filename="vendor-products"
              />
            </div>
          </div>
        </div>

        {/* DataTable */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading products...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <DataTable
            data={filteredProducts}
            columns={columns}
            pagination={true}
            itemsPerPage={10}
            onRowClick={(row) => navigate(`/vendor/products/${row._id ?? row.id}`)}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No products found</p>
            <button
              onClick={() => navigate("/vendor/products/add-product")}
              className="px-4 py-2 gradient-green text-white rounded-lg hover:shadow-glow-green transition-all font-semibold">
              Add Your First Product
            </button>
          </div>
        )}
      </div>

      <VendorNegotiationModal
        isOpen={negotiationModal.isOpen}
        onClose={() => setNegotiationModal({ isOpen: false, productId: null, productName: "" })}
        productId={negotiationModal.productId}
        productName={negotiationModal.productName}
        onNegotiationUpdated={() => fetchProducts({ fetchAll: true, limit: 200 })}
      />

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, productId: null })}
        onConfirm={confirmDelete}
        title="Delete Product?"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </motion.div>
  );
};

export default ManageProducts;
