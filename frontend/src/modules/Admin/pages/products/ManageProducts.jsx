import { useState, useMemo, useEffect } from "react";
import { FiSearch, FiEdit, FiTrash2, FiPlus } from "react-icons/fi";
import { motion } from "framer-motion";
import DataTable from "../../components/DataTable";
import ExportButton from "../../components/ExportButton";
import Badge from "../../../../shared/components/Badge";
import ConfirmModal from "../../components/ConfirmModal";
import ProductFormModal from "../../components/ProductFormModal";
import AnimatedSelect from "../../components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";

import { useCategoryStore } from "../../../../shared/store/categoryStore";
import { useBrandStore } from "../../../../shared/store/brandStore";
import { getAllProducts, deleteProduct } from "../../services/adminService";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

const ManageProducts = () => {
  const [products, setProducts] = useState([]);
  const { categories, initialize: initCategories } = useCategoryStore();
  const { brands, initialize: initBrands } = useBrandStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [shops, setShops] = useState([]);
  const [selectedSellerType, setSelectedSellerType] = useState("all");
  const [selectedShop, setSelectedShop] = useState("all");
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    productId: null,
  });
  const [productFormModal, setProductFormModal] = useState({
    isOpen: false,
    productId: null,
  });

  useEffect(() => {
    initCategories();
    initBrands();
    loadProducts();
    loadShops();
  }, []);

  const loadShops = async () => {
    try {
      const response = await api.get("/admin/managed-shops");
      setShops(response.data?.data || response.data || []);
    } catch (error) {
      console.error("Failed to load managed shops", error);
    }
  };

  const loadProducts = async () => {
    try {
      let currentPage = 1;
      let totalPages = 1;
      const products = [];

      do {
        const response = await getAllProducts({ page: currentPage, limit: 100 });
        const pageProducts = Array.isArray(response.data)
          ? response.data
          : (response.data?.products || []);
        products.push(...pageProducts);

        totalPages = Number(response.data?.pages || 1);
        currentPage += 1;
      } while (currentPage <= totalPages);

      const normalizedProducts = products.map(p => ({
        ...p,
        id: p._id, // Map backend _id to frontend id
        image: p.image || p.images?.[0] || "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/%3E%3Ccircle cx=%2234%22 cy=%2236%22 r=%228%22 fill=%22%23d1d5db%22/%3E%3Cpath d=%22M12 80l24-28 16 18 12-13 24 23z%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E",
        stock: p.stock || (p.stockQuantity > 5 ? "in_stock" : p.stockQuantity > 0 ? "low_stock" : "out_of_stock"),
      }));
      setProducts(normalizedProducts);
    } catch (error) {
      // Error is handled in interceptor
    }
  };

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
        (product) => String(product.categoryId?._id || product.categoryId) === String(selectedCategory)
      );
    }

    if (selectedBrand !== "all") {
      filtered = filtered.filter(
        (product) => String(product.brandId?._id || product.brandId) === String(selectedBrand)
      );
    }

    if (selectedChannel !== "all") {
      filtered = filtered.filter((product) => {
        const chan = product.salesChannel || (product.b2bEnabled ? "BOTH" : "B2C");
        return chan === selectedChannel;
      });
    }

    if (selectedSellerType !== "all") {
      filtered = filtered.filter((product) => {
        const isManaged = !!product.shopId;
        return selectedSellerType === "managed" ? isManaged : !isManaged;
      });
    }

    if (selectedShop !== "all") {
      filtered = filtered.filter(
        (product) => String(product.shopId?._id || product.shopId) === String(selectedShop)
      );
    }

    return filtered;
  }, [products, searchQuery, selectedStatus, selectedCategory, selectedBrand, selectedChannel, selectedSellerType, selectedShop]);

  const columns = [
    {
      key: "id",
      label: "ID",
      sortable: true,
    },
    {
      key: "name",
      label: "Product Name",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <img
            src={row.image}
            alt={value}
            className="w-10 h-10 object-cover rounded-lg"
            onError={(e) => {
              e.target.src = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/%3E%3Ccircle cx=%2234%22 cy=%2236%22 r=%228%22 fill=%22%23d1d5db%22/%3E%3Cpath d=%22M12 80l24-28 16 18 12-13 24 23z%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E";
            }}
          />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: "owner",
      label: "Seller/Owner",
      sortable: true,
      render: (_, row) => {
        if (row.shopId) {
          return (
            <div className="flex flex-col">
              <span className="font-semibold text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                Managed Shop
              </span>
              <span className="text-sm font-medium text-gray-700 mt-1">
                {row.shopId.name || "Managed Shop"}
              </span>
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-xs text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
              Independent Seller
            </span>
            <span className="text-sm font-medium text-gray-700 mt-1">
              {row.vendorId?.storeName || row.vendorId?.name || "Independent"}
            </span>
          </div>
        );
      },
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      render: (value) => formatPrice(value),
    },
    {
      key: "stockQuantity",
      label: "Stock",
      sortable: true,
      render: (value) => Number(value || 0).toLocaleString(),
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
          {value.replace("_", " ").toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "salesChannel",
      label: "Sales Channel",
      sortable: true,
      render: (_, row) => {
        const channel = row.salesChannel || (row.b2bEnabled ? "BOTH" : "B2C");
        return (
          <Badge variant={channel === 'B2C' ? 'success' : channel === 'B2B' ? 'warning' : 'info'}>
            {channel}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setProductFormModal({ isOpen: true, productId: row.id });
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <FiEdit />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteModal({ isOpen: true, productId: row.id });
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <FiTrash2 />
          </button>
        </div>
      ),
    },
  ];

  const confirmDelete = async () => {
    try {
      await deleteProduct(deleteModal.productId);
      setProducts(products.filter((p) => p.id !== deleteModal.productId));
      setDeleteModal({ isOpen: false, productId: null });
      toast.success("Product deleted successfully");
    } catch (error) {
      setDeleteModal({ isOpen: false, productId: null });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Manage Products
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            View, edit, and manage your product catalog
          </p>
        </div>
        <button
          onClick={() => setProductFormModal({ isOpen: true, productId: "new" })}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-semibold"
        >
          <FiPlus />
          Add Product
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        {/* Filters Section */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative flex-1 w-full sm:min-w-[200px]">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
              />
            </div>

            <AnimatedSelect
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: "all", label: "All Status" },
                { value: "in_stock", label: "In Stock" },
                { value: "low_stock", label: "Low Stock" },
                { value: "out_of_stock", label: "Out of Stock" },
              ]}
              className="w-full sm:w-auto min-w-[140px]"
            />

            <AnimatedSelect
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { value: "all", label: "All Categories" },
                ...categories
                  .filter((cat) => cat.isActive !== false)
                  .map((cat) => ({ value: String(cat.id), label: cat.name })),
              ]}
              className="w-full sm:w-auto min-w-[160px]"
            />

            <AnimatedSelect
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              options={[
                { value: "all", label: "All Brands" },
                ...brands
                  .filter((brand) => brand.isActive !== false)
                  .map((brand) => ({ value: String(brand.id), label: brand.name })),
              ]}
              className="w-full sm:w-auto min-w-[160px]"
            />

            <AnimatedSelect
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              options={[
                { value: "all", label: "All Channels" },
                { value: "B2C", label: "B2C" },
                { value: "B2B", label: "B2B" },
                { value: "BOTH", label: "Both" },
              ]}
              className="w-full sm:w-auto min-w-[140px]"
            />

            <AnimatedSelect
              value={selectedSellerType}
              onChange={(e) => {
                setSelectedSellerType(e.target.value);
                setSelectedShop("all");
              }}
              options={[
                { value: "all", label: "All Sellers" },
                { value: "independent", label: "Independent Sellers" },
                { value: "managed", label: "Managed Shops" },
              ]}
              className="w-full sm:w-auto min-w-[160px]"
            />

            {selectedSellerType === "managed" && (
              <AnimatedSelect
                value={selectedShop}
                onChange={(e) => setSelectedShop(e.target.value)}
                options={[
                  { value: "all", label: "All Managed Shops" },
                  ...shops.map((shop) => ({ value: String(shop._id), label: shop.name })),
                ]}
                className="w-full sm:w-auto min-w-[180px]"
              />
            )}



            <div className="w-full sm:w-auto">
              <ExportButton
                data={filteredProducts}
                headers={[
                  { label: "ID", accessor: (row) => row.id },
                  { label: "Name", accessor: (row) => row.name },
                  {
                    label: "Price",
                    accessor: (row) => formatPrice(row.price),
                  },
                  { label: "Stock", accessor: (row) => row.stockQuantity },
                  { label: "Status", accessor: (row) => row.stock },
                ]}
                filename="products"
              />
            </div>
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          data={filteredProducts}
          columns={columns}
          pagination={true}
          itemsPerPage={10}
          onRowClick={(row) =>
            setProductFormModal({ isOpen: true, productId: row.id })
          }
        />
      </div>

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

      <ProductFormModal
        isOpen={productFormModal.isOpen}
        onClose={() => setProductFormModal({ isOpen: false, productId: null })}
        productId={productFormModal.productId}
        onSuccess={() => {
          loadProducts();
        }}
      />
    </motion.div>
  );
};

export default ManageProducts;
