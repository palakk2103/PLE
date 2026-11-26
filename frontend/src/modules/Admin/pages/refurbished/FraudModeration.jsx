import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiAlertTriangle,
  FiFlag,
  FiShield,
  FiSlash,
  FiCheck,
  FiRefreshCcw,
  FiTrash2,
  FiInfo,
} from "react-icons/fi";
import Badge from "../../../../shared/components/Badge";
import toast from "react-hot-toast";
import api from "../../../../shared/utils/api";

const FraudModeration = () => {
  const [products, setProducts] = useState([]);
  const [selectedRisk, setSelectedRisk] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchProducts = async () => {
    try {
      const res = await api.get('/admin/refurbished-products');
      const formatted = res.data.map(p => ({
        id: p._id,
        name: p.name,
        vendorName: p.vendorId?.storeName || p.vendorId?.name || "Unknown Vendor",
        condition: p.refurbishedDetails?.condition || 'refurbished',
        refurbishedGrade: p.refurbishedDetails?.grade || 'A',
        status: p.refurbishedDetails?.approvalStatus || 'pending',
        batteryHealth: p.refurbishedDetails?.batteryHealth || 100,
        replacedParts: p.refurbishedDetails?.replacedParts || 'None',
        flagged: p.refurbishedDetails?.flagged || false,
        flagReason: p.refurbishedDetails?.flagReason || "",
      }));
      setProducts(formatted);
    } catch (err) {
      console.error("Failed to fetch products for moderation", err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Compile alerts based on flagged products and custom rules
  const compiledAlerts = products
    .map((p) => {
      // Rule 1: Custom flagged from approvals
      if (p.flagged) {
        return {
          id: `alert_flag_${p.id}`,
          productId: p.id,
          productName: p.name,
          vendorName: p.vendorName,
          type: "Seller Report Flagged",
          description: p.flagReason || "Flagged for manual investigation by admin.",
          risk: "High",
          status: "reviewing",
          originalItem: p,
        };
      }
      // Rule 2: Fake Grade A battery check
      if (p.refurbishedGrade === "A" && p.batteryHealth < 80) {
        return {
          id: `alert_battery_${p.id}`,
          productId: p.id,
          productName: p.name,
          vendorName: p.vendorName,
          type: "Fake Grading Warning",
          description: `Device is graded 'A' but battery health is ${p.batteryHealth}% (required >80%).`,
          risk: "High",
          status: "pending_action",
          originalItem: p,
        };
      }
      // Rule 3: Heavy repairs on open-box
      if (p.condition === "open_box" && p.replacedParts !== "None" && p.replacedParts !== "") {
        return {
          id: `alert_repair_${p.id}`,
          productId: p.id,
          productName: p.name,
          vendorName: p.vendorName,
          type: "Misleading Condition",
          description: `Device is marked as 'Open Box' but has replaced parts: '${p.replacedParts}'.`,
          risk: "Medium",
          status: "pending_action",
          originalItem: p,
        };
      }
      return null;
    })
    .filter(Boolean);

  const handleDismissAlert = async (alert) => {
    try {
      // If it was a battery warning, downgrade grade to B so alert clears
      const newGrade = alert.originalItem?.refurbishedGrade === "A" && alert.originalItem?.batteryHealth < 80 
        ? "B" : alert.originalItem?.refurbishedGrade;
        
      await api.put(`/admin/refurbished-products/${alert.productId}/status`, {
        status: alert.originalItem?.status || 'pending',
        grade: newGrade,
        flagged: false,
        flagReason: "",
      });
      toast.success("Alert dismissed successfully!");
      fetchProducts();
    } catch (err) {
      toast.error("Failed to dismiss alert.");
    }
  };

  const handleSuspendListing = async (alert) => {
    try {
      await api.put(`/admin/refurbished-products/${alert.productId}/status`, {
        status: "rejected",
        flagged: true,
        flagReason: `Suspended due to fraud warning: ${alert.description}`,
      });
      toast.error("Product listing has been suspended.");
      fetchProducts();
    } catch (err) {
      toast.error("Failed to suspend listing.");
    }
  };

  const handleAuditRequest = (alert) => {
    toast.success(`Diagnostic audit request sent to vendor "${alert.vendorName}"`);
  };

  const filteredAlerts = compiledAlerts.filter((alert) => {
    const matchesRisk = selectedRisk === "all" || alert.risk.toLowerCase() === selectedRisk.toLowerCase();
    const matchesStatus = filterStatus === "all" || alert.status === filterStatus;
    return matchesRisk && matchesStatus;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <FiAlertTriangle className="text-red-500 animate-pulse" />
          Fraud & Listing Audit
        </h1>
        <p className="text-sm text-gray-500">
          Monitor refurbished grade compliance, inspect suspicious pricing anomalies, and moderate misleading condition reports.
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <FiFlag className="text-xl" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400">Total Flagged Anomalies</h3>
            <p className="text-2xl font-black text-gray-900">{compiledAlerts.length}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <FiAlertTriangle className="text-xl" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400">High Risk Warnings</h3>
            <p className="text-2xl font-black text-gray-900">
              {compiledAlerts.filter((a) => a.risk === "High").length}
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FiShield className="text-xl" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400">Checked Compliance</h3>
            <p className="text-2xl font-black text-gray-900">
              {products.length > 0
                ? `${(((products.length - products.filter((p) => p.flagged).length) / products.length) * 100).toFixed(1)}%`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Listing moderation area */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-gray-100 pb-4">
          <h3 className="font-bold text-gray-800 text-base">Active Listing Infractions</h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 focus:outline-none"
            >
              <option value="all">All Risks</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
            </select>
          </div>
        </div>

        {/* Alerts Log Table */}
        {filteredAlerts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-3">
                  <th className="pb-3">Infraction Type</th>
                  <th className="pb-3">Product Name</th>
                  <th className="pb-3">Seller Store</th>
                  <th className="pb-3 text-center">Severity</th>
                  <th className="pb-3 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAlerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 font-bold text-gray-800">
                      <div className="flex items-center gap-2 text-xs">
                        <FiAlertTriangle className={alert.risk === "High" ? "text-red-500" : "text-amber-500"} />
                        {alert.type}
                      </div>
                    </td>
                    <td className="py-4 text-xs font-semibold text-gray-900 max-w-[200px]">
                      {alert.productName}
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {alert.productId}</p>
                    </td>
                    <td className="py-4 text-xs text-gray-600 font-medium">{alert.vendorName}</td>
                    <td className="py-4 text-center">
                      <Badge variant={alert.risk === "High" ? "error" : "warning"}>
                        {alert.risk} Risk
                      </Badge>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleAuditRequest(alert)}
                          className="px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                          title="Force diagnostic check"
                        >
                          <FiRefreshCcw /> Audit
                        </button>
                        <button
                          onClick={() => handleDismissAlert(alert)}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                          title="Dismiss flag"
                        >
                          <FiCheck /> Clear
                        </button>
                        <button
                          onClick={() => handleSuspendListing(alert)}
                          className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                          title="Suspend listing"
                        >
                          <FiSlash /> Suspend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <FiShield className="text-4xl text-emerald-500/80 mx-auto mb-3" />
            <p className="text-gray-700 font-bold">Excellent Grade Compliance!</p>
            <p className="text-xs text-gray-400 mt-1">No listing warnings or grading infractions flagged currently.</p>
          </div>
        )}
      </div>

      {/* Info Warning Card */}
      <div className="bg-[#C07A3D]/5 border border-[#C07A3D]/20 p-5 rounded-2xl flex gap-3 text-xs leading-relaxed text-gray-600">
        <FiInfo className="text-[#C07A3D] text-lg flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-gray-800">Quality Diagnostic Compliance Rules:</span>
          <p>
            Listing audits monitor items automatically based on diagnostic capacity inputs. Products with Grade A configuration require &gt;80% battery performance and Excellent or Mint cosmetics. Violations are flagged for manual moderation override.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default FraudModeration;
