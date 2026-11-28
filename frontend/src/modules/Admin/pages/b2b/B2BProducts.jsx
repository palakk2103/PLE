import { useState, useMemo, useEffect } from "react";
import {
  FiSearch,
  FiEye,
  FiTrendingUp,
  FiPackage,
  FiPercent,
  FiSliders,
  FiX,
  FiFileText,
  FiActivity,
  FiLayers,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import DataTable from "../../components/DataTable";
import ExportButton from "../../components/ExportButton";
import Badge from "../../../../shared/components/Badge";
import AnimatedSelect from "../../components/AnimatedSelect";
import { formatPrice } from "../../../../shared/utils/helpers";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

const B2BProducts = () => {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchB2BProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/products?b2bOnly=true');
      if (res?.data) {
        const prods = res.data.products || [];
        const mapped = prods.map(p => ({
          id: p._id,
          name: p.name,
          sku: p.slug,
          vendor: p.vendorId?.storeName || 'Unknown',
          category: p.categoryId?.name || 'Uncategorized',
          retailPrice: p.price,
          wholesalePrice: p.b2bWholesalePrice || p.price,
          moq: p.b2bMinOrderQty || 1,
          status: p.isActive ? "Active" : "Inactive",
          slabs: p.b2bBulkPricingSlabs?.map(slab => ({
            minQty: slab.minQty,
            maxQty: slab.maxQty,
            price: slab.pricePerUnit
          })) || [],
          image: p.image || '',
          stock: p.stockQuantity || 0
        }));
        setProducts(mapped);
      }
    } catch (err) {
      toast.error('Failed to fetch B2B Products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchB2BProducts();
  }, []);

  // Derive unique lists for filters
  const categories = useMemo(() => {
    const list = products.map((p) => p.category);
    return ["all", ...new Set(list)];
  }, [products]);

  const vendors = useMemo(() => {
    const list = products.map((p) => p.vendor);
    return ["all", ...new Set(list)];
  }, [products]);

  // Stats calculation
  const stats = useMemo(() => {
    const activeProducts = products.filter((p) => p.status === "Active");
    const discounts = activeProducts.map((p) => ((p.retailPrice - p.wholesalePrice) / p.retailPrice) * 100);
    const avgDiscount = discounts.reduce((a, b) => a + b, 0) / discounts.length;

    return {
      total: products.length,
      active: activeProducts.length,
      avgMoq: Math.round(products.reduce((acc, p) => acc + p.moq, 0) / products.length),
      avgDiscount: avgDiscount.toFixed(1),
    };
  }, [products]);

  // Toggle status handler
  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
    const isActive = newStatus === "Active";
    try {
      await api.put(`/admin/products/${id}`, { isActive });
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      );
      toast.success(`Product status updated to ${newStatus}`);
      if (selectedProduct && selectedProduct.id === id) {
        setSelectedProduct((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      toast.error('Failed to update product status');
    }
  };

  // Filter logic
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;

      const matchesVendor =
        selectedVendor === "all" || product.vendor === selectedVendor;

      return matchesSearch && matchesCategory && matchesVendor;
    });
  }, [products, searchQuery, selectedCategory, selectedVendor]);

  const columns = [
    {
      key: "name",
      label: "Product / SKU",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 font-bold text-xs select-none">
            {row.name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-800 line-clamp-1 max-w-[200px]">{value}</span>
            <span className="text-xs text-gray-400 font-mono select-all">{row.sku}</span>
          </div>
        </div>
      ),
    },
    {
      key: "vendor",
      label: "Vendor",
      sortable: true,
      render: (value) => <span className="text-sm font-medium text-gray-600">{value}</span>,
    },
    {
      key: "retailPrice",
      label: "Retail Price",
      sortable: true,
      render: (value) => <span className="text-xs text-gray-500 line-through">{formatPrice(value)}</span>,
    },
    {
      key: "wholesalePrice",
      label: "Wholesale Price",
      sortable: true,
      render: (value, row) => {
        const discount = (((row.retailPrice - row.wholesalePrice) / row.retailPrice) * 100).toFixed(0);
        return (
          <div className="flex flex-col">
            <span className="font-bold text-gray-900">{formatPrice(value)}</span>
            <span className="text-[10px] font-bold text-green-600">Save {discount}%</span>
          </div>
        );
      },
    },
    {
      key: "moq",
      label: "MOQ",
      sortable: true,
      render: (value) => (
        <Badge variant="warning">
          Min: {value} units
        </Badge>
      ),
    },
    {
      key: "slabs",
      label: "Bulk Slabs",
      sortable: false,
      render: (_, row) => (
        <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
          {row.slabs.length} tiers
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleStatus(row.id, value);
          }}
          className="cursor-pointer focus:outline-none"
        >
          <Badge variant={value === "Active" ? "success" : "error"}>
            {value === "Active" ? "Active" : "Inactive"}
          </Badge>
        </button>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedProduct(row)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View B2B Configuration"
          >
            <FiEye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1.5">
          B2B Products
        </h1>
        <p className="text-sm text-gray-500">
          Monitor and configure products configured with bulk wholesale pricing, tiers, and MOQ constraints.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <FiPackage className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">B2B Products</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{stats.total}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <FiActivity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Catalog</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{stats.active}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <FiSliders className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Average MOQ</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{stats.avgMoq} <span className="text-xs font-normal text-gray-500">units</span></h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <FiPercent className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Avg Discount</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">{stats.avgDiscount}%</h3>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200/80">
        {/* Filters */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
            <div className="relative flex-1 w-full sm:min-w-[260px]">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name, SKU, vendor..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium hidden md:inline">Category:</span>
              <AnimatedSelect
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={[
                  { value: "all", label: "All Categories" },
                  ...categories.filter((c) => c !== "all").map((cat) => ({ value: cat, label: cat })),
                ]}
                className="w-full sm:w-auto min-w-[150px]"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium hidden md:inline">Vendor:</span>
              <AnimatedSelect
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                options={[
                  { value: "all", label: "All Vendors" },
                  ...vendors.filter((v) => v !== "all").map((ven) => ({ value: ven, label: ven })),
                ]}
                className="w-full sm:w-auto min-w-[150px]"
              />
            </div>

            <div className="w-full sm:w-auto ml-auto">
              <ExportButton
                data={filteredProducts}
                headers={[
                  { label: "Product ID", accessor: (row) => row.id },
                  { label: "Product Name", accessor: (row) => row.name },
                  { label: "SKU", accessor: (row) => row.sku },
                  { label: "Vendor", accessor: (row) => row.vendor },
                  { label: "Category", accessor: (row) => row.category },
                  { label: "Retail Price (₹)", accessor: (row) => row.retailPrice },
                  { label: "Wholesale Price (₹)", accessor: (row) => row.wholesalePrice },
                  { label: "MOQ", accessor: (row) => row.moq },
                  { label: "Stock Available", accessor: (row) => row.stock },
                  { label: "Status", accessor: (row) => row.status },
                ]}
                filename="b2b_wholesale_products"
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
          onRowClick={(row) => setSelectedProduct(row)}
        />
      </div>

      {/* Product detail drawer */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black z-50"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-white shadow-2xl z-50 flex flex-col h-full border-l border-gray-100"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-mono">
                      {selectedProduct.id}
                    </span>
                    <Badge variant={selectedProduct.status === "Active" ? "success" : "error"}>
                      {selectedProduct.status}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mt-1 truncate max-w-[320px]">
                    {selectedProduct.name}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Meta details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FiPackage className="w-4 h-4" /> General Info
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-xs sm:text-sm">
                    <div>
                      <p className="text-gray-400 text-xs">SKU Code</p>
                      <p className="font-semibold text-gray-800 mt-0.5 font-mono select-all">{selectedProduct.sku}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Vendor Partner</p>
                      <p className="font-semibold text-gray-800 mt-0.5">{selectedProduct.vendor}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Category</p>
                      <p className="font-semibold text-gray-800 mt-0.5">{selectedProduct.category}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Current Stock</p>
                      <p className="font-semibold text-gray-800 mt-0.5">{selectedProduct.stock} units</p>
                    </div>
                  </div>
                </div>

                {/* B2B pricing config */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FiPercent className="w-4 h-4" /> Core Pricing Setup
                  </h3>
                  <div className="border border-gray-100 rounded-2xl p-4 space-y-2.5 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Regular B2C Price</span>
                      <span className="font-medium text-gray-600 line-through">{formatPrice(selectedProduct.retailPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Base B2B Wholesale Price</span>
                      <span className="font-bold text-gray-900">{formatPrice(selectedProduct.wholesalePrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Minimum Order Quantity (MOQ)</span>
                      <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{selectedProduct.moq} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Base Wholesale Savings</span>
                      <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        {(((selectedProduct.retailPrice - selectedProduct.wholesalePrice) / selectedProduct.retailPrice) * 100).toFixed(0)}% OFF
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bulk Slab Pricing */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FiLayers className="w-4 h-4" /> Bulk Discount Slabs
                  </h3>
                  <div className="overflow-hidden border border-gray-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="p-3 font-semibold text-gray-600">Qty Range</th>
                          <th className="p-3 font-semibold text-gray-600">Price Per Unit</th>
                          <th className="p-3 font-semibold text-gray-600">Slab Discount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProduct.slabs.map((slab, i) => {
                          const disc = (((selectedProduct.retailPrice - slab.price) / selectedProduct.retailPrice) * 100).toFixed(0);
                          return (
                            <tr key={i} className="border-b border-gray-100 last:border-none hover:bg-gray-50/50">
                              <td className="p-3 font-medium text-gray-800">
                                {slab.minQty} {slab.maxQty ? `- ${slab.maxQty}` : "+"} units
                              </td>
                              <td className="p-3 font-bold text-gray-900">
                                {formatPrice(slab.price)}
                              </td>
                              <td className="p-3 text-green-600 font-semibold">
                                {disc}% OFF
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-gray-400 italic">
                    * Orders below the minimum MOQ of {selectedProduct.moq} items are not processed at B2B rates.
                  </p>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-gray-100 flex items-center gap-3">
                <button
                  onClick={() => handleToggleStatus(selectedProduct.id, selectedProduct.status)}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors ${
                    selectedProduct.status === "Active"
                      ? "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                      : "bg-teal-600 hover:bg-teal-700 text-white"
                  }`}
                >
                  {selectedProduct.status === "Active" ? "Deactivate Product" : "Activate Product"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default B2BProducts;
