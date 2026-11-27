import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  FiUploadCloud,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiCheckCircle,
  FiAlertCircle,
  FiDownload,
  FiGrid,
  FiRefreshCw,
  FiShoppingBag,
  FiArrowRight,
} from "react-icons/fi";
import api from "../../../../shared/utils/api";
import { createBulkOrders } from "../../services/vendorService";

const SAMPLE_DATA = [
  {
    "Customer Name": "Rahul Sharma",
    "Customer Phone": "9876543210",
    "Customer Email": "rahul@example.com",
    "Shipping Address": "Flat 402, Sunshine Apartments, MG Road",
    "City": "Mumbai",
    "State": "Maharashtra",
    "Zip Code": "400001",
    "Product Name": "",
    "Quantity": 1,
    "Unit Price": 499,
    "Payment Method": "COD",
  },
  {
    "Customer Name": "Priya Patel",
    "Customer Phone": "9123456789",
    "Customer Email": "priya@example.com",
    "Shipping Address": "12/B, Park Street",
    "City": "Kolkata",
    "State": "West Bengal",
    "Zip Code": "700016",
    "Product Name": "",
    "Quantity": 2,
    "Unit Price": 999,
    "Payment Method": "Prepaid",
  },
];

const DEFAULT_ROW = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  productId: "",
  productName: "",
  quantity: 1,
  price: 0,
  paymentMethod: "cod",
};

export default function BulkOrders() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("grid"); // 'grid' | 'file'
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Manual Grid state
  const [gridRows, setGridRows] = useState([
    { ...DEFAULT_ROW, id: Date.now() },
  ]);

  // File Upload state
  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Submission Results Modal state
  const [resultModal, setResultModal] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get("/vendor/products?limit=100");
      const list = res.data?.data?.products || res.data?.data || [];
      setProducts(list);
    } catch (err) {
      console.error("Failed to load vendor products", err);
    }
  };

  // ----------------------------------------------------
  // MANUAL GRID HANDLERS
  // ----------------------------------------------------
  const handleGridChange = (id, field, value) => {
    setGridRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        if (field === "productId" && value) {
          const prod = products.find((p) => String(p._id) === String(value));
          if (prod) {
            updated.productName = prod.name;
            updated.price = prod.price || 0;
          }
        }
        return updated;
      })
    );
  };

  const addGridRow = () => {
    setGridRows((prev) => [
      ...prev,
      { ...DEFAULT_ROW, id: Date.now() + Math.random() },
    ]);
  };

  const cloneGridRow = (row) => {
    setGridRows((prev) => [
      ...prev,
      { ...row, id: Date.now() + Math.random() },
    ]);
  };

  const removeGridRow = (id) => {
    if (gridRows.length === 1) {
      alert("At least one row is required.");
      return;
    }
    setGridRows((prev) => prev.filter((r) => r.id !== id));
  };

  const clearGridRows = () => {
    setGridRows([{ ...DEFAULT_ROW, id: Date.now() }]);
  };

  const validateGridRows = () => {
    const validOrders = [];
    const validationErrors = [];

    gridRows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const errors = [];

      if (!row.customerName.trim()) errors.push("Missing Customer Name");
      if (!row.customerPhone.trim()) errors.push("Missing Customer Phone");
      if (!row.address.trim()) errors.push("Missing Address");
      if (!row.city.trim()) errors.push("Missing City");
      if (!row.state.trim()) errors.push("Missing State");
      if (!row.zipCode.trim()) errors.push("Missing Zip Code");
      if (!row.productId && !row.productName.trim()) {
        errors.push("Missing Product selection or Product Name");
      }
      if (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1) errors.push("Quantity must be a whole number of at least 1");

      if (errors.length > 0) {
        validationErrors.push({ row: rowNum, errors });
      } else {
        validOrders.push({
          customer: {
            name: row.customerName.trim(),
            phone: row.customerPhone.trim(),
            email: row.customerEmail.trim(),
          },
          shippingAddress: {
            name: row.customerName.trim(),
            phone: row.customerPhone.trim(),
            email: row.customerEmail.trim(),
            address: row.address.trim(),
            city: row.city.trim(),
            state: row.state.trim(),
            zipCode: row.zipCode.trim(),
            country: "India",
          },
          items: [
            {
              productId: row.productId || undefined,
              name: row.productName || "Product",
              quantity: Number(row.quantity),
              price: Number(row.price),
            },
          ],
          paymentMethod: row.paymentMethod,
        });
      }
    });

    return { validOrders, validationErrors };
  };

  const submitGridOrders = async () => {
    const { validOrders, validationErrors } = validateGridRows();

    if (validationErrors.length > 0) {
      alert(
        `Please fix errors in the following rows:\n` +
          validationErrors
            .map((e) => `Row #${e.row}: ${e.errors.join(", ")}`)
            .join("\n")
      );
      return;
    }

    if (validOrders.length === 0) {
      alert("No valid orders to submit.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createBulkOrders(validOrders);
      setResultModal(res.data?.data || res.data);
    } catch (err) {
      console.error("Bulk upload failed", err);
      alert(err.response?.data?.message || "Failed to submit bulk orders.");
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // EXCEL / CSV FILE UPLOAD HANDLERS
  // ----------------------------------------------------
  const downloadSampleTemplate = (format = "xlsx") => {
    const wsData = SAMPLE_DATA.map((item) => ({
      ...item,
      "Product Name": products[0]?.name || "Sample Product",
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulk_Orders_Template");

    if (format === "csv") {
      XLSX.writeFile(wb, "Sample_Bulk_Orders.csv", { bookType: "csv" });
    } else {
      XLSX.writeFile(wb, "Sample_Bulk_Orders.xlsx");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const bstr = event.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          alert("The uploaded file is empty or formatted incorrectly.");
          return;
        }

        const parsed = rawJson.map((row, index) => {
          const customerName = String(
            row["Customer Name"] || row["Customer"] || row["Name"] || ""
          ).trim();
          const customerPhone = String(
            row["Customer Phone"] || row["Phone"] || row["Mobile"] || ""
          ).trim();
          const customerEmail = String(
            row["Customer Email"] || row["Email"] || ""
          ).trim();
          const address = String(
            row["Shipping Address"] || row["Address"] || row["Street"] || ""
          ).trim();
          const city = String(row["City"] || "").trim();
          const state = String(row["State"] || "").trim();
          const zipCode = String(
            row["Zip Code"] || row["Pincode"] || row["Zip"] || ""
          ).trim();
          const productName = String(
            row["Product Name"] || row["Product"] || row["Item"] || ""
          ).trim();
          const quantity = Number(row["Quantity"] || row["Qty"] || 1);
          const price = Number(row["Unit Price"] || row["Price"] || 0);
          const paymentMethod =
            String(
              row["Payment Method"] || row["Payment"] || "COD"
            ).toLowerCase() === "prepaid"
              ? "card"
              : "cod";

          const errors = [];
          if (!customerName) errors.push("Name missing");
          if (!customerPhone) errors.push("Phone missing");
          if (!address) errors.push("Address missing");
          if (!city) errors.push("City missing");
          if (!state) errors.push("State missing");
          if (!zipCode) errors.push("Pincode missing");
          // A row without a product used to be filled with your first product without telling you.
          if (!productName) errors.push("Product name missing");
          if (!Number.isInteger(quantity) || quantity < 1) errors.push("Quantity must be a whole number");

          return {
            id: index + 1,
            customerName,
            customerPhone,
            customerEmail,
            address,
            city,
            state,
            zipCode,
            productName,
            quantity,
            price,
            paymentMethod,
            isValid: errors.length === 0,
            errors,
          };
        });

        setParsedRows(parsed);
      } catch (err) {
        console.error("File parse error", err);
        alert("Failed to parse file. Please check file format.");
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleParsedRowChange = (id, field, value) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        const errors = [];
        if (!updated.customerName.trim()) errors.push("Name missing");
        if (!updated.customerPhone.trim()) errors.push("Phone missing");
        if (!updated.address.trim()) errors.push("Address missing");
        if (!updated.city.trim()) errors.push("City missing");
        if (!updated.state.trim()) errors.push("State missing");
        if (!updated.zipCode.trim()) errors.push("Pincode missing");
        if (!String(updated.productName || "").trim()) errors.push("Product name missing");
        if (!Number.isInteger(Number(updated.quantity)) || Number(updated.quantity) < 1) errors.push("Quantity must be a whole number");

        updated.isValid = errors.length === 0;
        updated.errors = errors;
        return updated;
      })
    );
  };

  const submitParsedOrders = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert("There are no valid order rows to upload.");
      return;
    }

    const payload = validRows.map((row) => ({
      customer: {
        name: row.customerName,
        phone: row.customerPhone,
        email: row.customerEmail,
      },
      shippingAddress: {
        name: row.customerName,
        phone: row.customerPhone,
        email: row.customerEmail,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zipCode,
        country: "India",
      },
      items: [
        {
          name: row.productName,
          quantity: Number(row.quantity),
          price: Number(row.price),
        },
      ],
      paymentMethod: row.paymentMethod,
    }));

    setSubmitting(true);
    try {
      const res = await createBulkOrders(payload);
      setResultModal(res.data?.data || res.data);
    } catch (err) {
      console.error("File upload failed", err);
      alert(err.response?.data?.message || "Failed to submit bulk orders.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredParsedRows = parsedRows.filter((r) => {
    if (filterType === "valid") return r.isValid;
    if (filterType === "errors") return !r.isValid;
    return true;
  });

  const totalGridAmount = gridRows.reduce(
    (sum, r) => sum + (Number(r.price) || 0) * (Number(r.quantity) || 1),
    0
  );

  return (
    <div className="space-y-6">
      {/* HEADER SECTION - LIGHT THEME */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white border border-gray-200 p-4 sm:p-6 rounded-2xl shadow-sm min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm flex-shrink-0">
            <FiShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">
              Vendor Bulk Orders
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
              Manage and process multiple orders quickly via manual grid or sheet upload.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => downloadSampleTemplate("xlsx")}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-medium rounded-xl border border-gray-300 transition shadow-sm"
          >
            <FiDownload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
            <span>Sample Excel</span>
          </button>
          <button
            onClick={() => downloadSampleTemplate("csv")}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-medium rounded-xl border border-gray-300 transition shadow-sm"
          >
            <FiDownload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
            <span>Sample CSV</span>
          </button>
        </div>
      </div>

      {/* TAB NAVIGATION - LIGHT THEME */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200 w-full sm:w-fit">
        <button
          onClick={() => setActiveTab("grid")}
          className={`flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition flex-1 sm:flex-initial ${
            activeTab === "grid"
              ? "bg-white text-gray-900 shadow-sm border border-gray-200 font-semibold"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <FiGrid className="w-4 h-4 text-indigo-600" />
          <span>Manual Grid</span>
          <span className="ml-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
            {gridRows.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("file")}
          className={`flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition flex-1 sm:flex-initial ${
            activeTab === "file"
              ? "bg-white text-gray-900 shadow-sm border border-gray-200 font-semibold"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <FiUploadCloud className="w-4 h-4 text-emerald-600" />
          <span>Sheet Upload</span>
          {parsedRows.length > 0 && (
            <span className="ml-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              {parsedRows.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: MANUAL GRID ENTRY - LIGHT THEME */}
      {activeTab === "grid" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm overflow-hidden space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                Total Orders: <strong className="text-gray-900">{gridRows.length}</strong>
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-sm font-medium text-gray-700">
                Est. Total Amount:{" "}
                <strong className="text-emerald-600 text-base font-bold">
                  ₹{totalGridAmount.toLocaleString("en-IN")}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={addGridRow}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-lg border border-indigo-200 transition shadow-sm"
              >
                <FiPlus className="w-4 h-4 text-indigo-600" /> Add Row
              </button>
              <button
                onClick={clearGridRows}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium rounded-lg border border-gray-200 transition"
              >
                <FiRefreshCw className="w-3.5 h-3.5" /> Clear All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <th className="p-3 font-semibold min-w-[40px]">#</th>
                  <th className="p-3 font-semibold min-w-[160px]">Customer Name *</th>
                  <th className="p-3 font-semibold min-w-[130px]">Phone *</th>
                  <th className="p-3 font-semibold min-w-[180px]">Address *</th>
                  <th className="p-3 font-semibold min-w-[110px]">City *</th>
                  <th className="p-3 font-semibold min-w-[110px]">State *</th>
                  <th className="p-3 font-semibold min-w-[90px]">Zip Code *</th>
                  <th className="p-3 font-semibold min-w-[200px]">Product *</th>
                  <th className="p-3 font-semibold min-w-[70px]">Qty</th>
                  <th className="p-3 font-semibold min-w-[90px]">Price (₹)</th>
                  <th className="p-3 font-semibold min-w-[100px]">Payment</th>
                  <th className="p-3 font-semibold text-center min-w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {gridRows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="p-3 text-gray-400 font-medium">{index + 1}</td>

                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={row.customerName}
                        onChange={(e) =>
                          handleGridChange(row.id, "customerName", e.target.value)
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs outline-none"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Phone Number"
                        value={row.customerPhone}
                        onChange={(e) =>
                          handleGridChange(row.id, "customerPhone", e.target.value)
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs outline-none"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Street / House No."
                        value={row.address}
                        onChange={(e) =>
                          handleGridChange(row.id, "address", e.target.value)
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs outline-none"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="City"
                        value={row.city}
                        onChange={(e) =>
                          handleGridChange(row.id, "city", e.target.value)
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs outline-none"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="State"
                        value={row.state}
                        onChange={(e) =>
                          handleGridChange(row.id, "state", e.target.value)
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs outline-none"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Pincode"
                        value={row.zipCode}
                        onChange={(e) =>
                          handleGridChange(row.id, "zipCode", e.target.value)
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2.5 py-1.5 text-gray-900 text-xs outline-none"
                      />
                    </td>

                    <td className="p-2">
                      <select
                        value={row.productId}
                        onChange={(e) =>
                          handleGridChange(row.id, "productId", e.target.value)
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2 py-1.5 text-gray-900 text-xs outline-none"
                      >
                        <option value="">-- Select Product --</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} (₹{p.price})
                          </option>
                        ))}
                      </select>
                      {!row.productId && (
                        <input
                          type="text"
                          placeholder="Or enter product name..."
                          value={row.productName}
                          onChange={(e) =>
                            handleGridChange(row.id, "productName", e.target.value)
                          }
                          className="w-full mt-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[11px] text-gray-700 outline-none"
                        />
                      )}
                    </td>

                    <td className="p-2">
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) =>
                          handleGridChange(
                            row.id,
                            "quantity",
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2 py-1.5 text-gray-900 text-xs text-center outline-none"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        value={row.price}
                        onChange={(e) =>
                          handleGridChange(
                            row.id,
                            "price",
                            Math.max(0, parseFloat(e.target.value) || 0)
                          )
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2 py-1.5 text-gray-900 text-xs outline-none"
                      />
                    </td>

                    <td className="p-2">
                      <select
                        value={row.paymentMethod}
                        onChange={(e) =>
                          handleGridChange(row.id, "paymentMethod", e.target.value)
                        }
                        className="w-full bg-white border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-2 py-1.5 text-gray-900 text-xs outline-none"
                      >
                        <option value="cod">COD</option>
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card/Prepaid</option>
                      </select>
                    </td>

                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="Clone Row"
                          onClick={() => cloneGridRow(row)}
                          className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-800 rounded-md transition"
                        >
                          <FiCopy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Delete Row"
                          onClick={() => removeGridRow(row.id)}
                          className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-md transition"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <button
              onClick={addGridRow}
              className="flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-800 font-semibold transition"
            >
              <FiPlus className="w-4 h-4" /> Add Another Order Row
            </button>

            <button
              disabled={submitting}
              onClick={submitGridOrders}
              className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <FiRefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Orders...</span>
                </>
              ) : (
                <>
                  <span>Submit {gridRows.length} Bulk Orders</span>
                  <FiArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: EXCEL / CSV UPLOAD - LIGHT THEME */}
      {activeTab === "file" && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-2xl p-8 text-center transition group shadow-sm">
            <input
              type="file"
              id="fileInput"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="fileInput" className="cursor-pointer space-y-3 block">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto transition border border-indigo-100">
                <FiUploadCloud className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {fileName ? (
                    <span className="text-indigo-600">{fileName}</span>
                  ) : (
                    "Click to upload or drag & drop Excel / CSV file"
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Supports .xlsx, .xls, and .csv files up to 500 rows.
                </p>
              </div>
            </label>
          </div>

          {parsedRows.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      filterType === "all"
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    All ({parsedRows.length})
                  </button>
                  <button
                    onClick={() => setFilterType("valid")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      filterType === "valid"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Valid ({parsedRows.filter((r) => r.isValid).length})
                  </button>
                  <button
                    onClick={() => setFilterType("errors")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      filterType === "errors"
                        ? "bg-red-50 text-red-700 border border-red-200 font-semibold"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Errors ({parsedRows.filter((r) => !r.isValid).length})
                  </button>
                </div>

                <button
                  disabled={submitting || parsedRows.filter((r) => r.isValid).length === 0}
                  onClick={submitParsedOrders}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <FiCheckCircle className="w-4 h-4" />
                      <span>
                        Import {parsedRows.filter((r) => r.isValid).length} Valid Orders
                      </span>
                    </>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Customer</th>
                      <th className="p-3 font-semibold">Phone</th>
                      <th className="p-3 font-semibold">Address</th>
                      <th className="p-3 font-semibold">City / State / Zip</th>
                      <th className="p-3 font-semibold">Product Name</th>
                      <th className="p-3 font-semibold">Qty</th>
                      <th className="p-3 font-semibold">Price (₹)</th>
                      <th className="p-3 font-semibold">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredParsedRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          !row.isValid ? "bg-red-50/50" : ""
                        }`}
                      >
                        <td className="p-3">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <FiCheckCircle className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span
                              title={row.errors.join(", ")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200 cursor-help"
                            >
                              <FiAlertCircle className="w-3 h-3" /> Error
                            </span>
                          )}
                        </td>

                        <td className="p-2">
                          <input
                            type="text"
                            value={row.customerName}
                            onChange={(e) =>
                              handleParsedRowChange(
                                row.id,
                                "customerName",
                                e.target.value
                              )
                            }
                            className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 text-xs w-full"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="text"
                            value={row.customerPhone}
                            onChange={(e) =>
                              handleParsedRowChange(
                                row.id,
                                "customerPhone",
                                e.target.value
                              )
                            }
                            className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 text-xs w-full"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="text"
                            value={row.address}
                            onChange={(e) =>
                              handleParsedRowChange(
                                row.id,
                                "address",
                                e.target.value
                              )
                            }
                            className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 text-xs w-full"
                          />
                        </td>

                        <td className="p-2">
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="City"
                              value={row.city}
                              onChange={(e) =>
                                handleParsedRowChange(
                                  row.id,
                                  "city",
                                  e.target.value
                                )
                              }
                              className="bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-900 text-xs w-1/3"
                            />
                            <input
                              type="text"
                              placeholder="State"
                              value={row.state}
                              onChange={(e) =>
                                handleParsedRowChange(
                                  row.id,
                                  "state",
                                  e.target.value
                                )
                              }
                              className="bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-900 text-xs w-1/3"
                            />
                            <input
                              type="text"
                              placeholder="Zip"
                              value={row.zipCode}
                              onChange={(e) =>
                                handleParsedRowChange(
                                  row.id,
                                  "zipCode",
                                  e.target.value
                                )
                              }
                              className="bg-white border border-gray-300 rounded px-1.5 py-1 text-gray-900 text-xs w-1/3"
                            />
                          </div>
                        </td>

                        <td className="p-2">
                          <input
                            type="text"
                            value={row.productName}
                            onChange={(e) =>
                              handleParsedRowChange(
                                row.id,
                                "productName",
                                e.target.value
                              )
                            }
                            className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 text-xs w-full"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) =>
                              handleParsedRowChange(
                                row.id,
                                "quantity",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 text-xs w-16 text-center"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            value={row.price}
                            onChange={(e) =>
                              handleParsedRowChange(
                                row.id,
                                "price",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 text-xs w-20"
                          />
                        </td>

                        <td className="p-2">
                          <span className="text-gray-700 font-medium uppercase text-[11px]">
                            {row.paymentMethod}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESULTS MODAL - LIGHT THEME */}
      <AnimatePresence>
        {resultModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
                  <FiCheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Bulk Processing Complete
                  </h3>
                  <p className="text-xs text-gray-500">
                    Your bulk order batch has been processed successfully.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
                <div>
                  <span className="text-xs text-gray-500">Orders Created</span>
                  <p className="text-2xl font-bold text-emerald-600">
                    {resultModal.successCount || 0}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Failed / Skipped</span>
                  <p className="text-2xl font-bold text-red-600">
                    {resultModal.failedCount || 0}
                  </p>
                </div>
              </div>

              {resultModal.errors && resultModal.errors.length > 0 && (
                <div className="max-h-36 overflow-y-auto bg-red-50 border border-red-200 p-3 rounded-xl space-y-1 text-xs text-red-800">
                  <span className="font-semibold block mb-1">Errors encountered:</span>
                  {resultModal.errors.map((e, idx) => (
                    <div key={idx}>
                      • Row #{e.row}: {e.message}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setResultModal(null);
                    clearGridRows();
                    setParsedRows([]);
                    setFileName("");
                  }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
                >
                  Create More Orders
                </button>
                <button
                  onClick={() => navigate("/vendor/orders/all-orders")}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition"
                >
                  View All Orders
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
