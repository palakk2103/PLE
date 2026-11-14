import { useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiSearch } from "react-icons/fi";
import MobileLayout from "../components/Layout/MobileLayout";
import VendorShowcaseCard from "../components/Mobile/VendorShowcaseCard";
import PageTransition from "../../../shared/components/PageTransition";
import api from "../../../shared/utils/api";
import { useSafeBack } from "../../../shared/hooks/useSafeBack";

const normalizeVendor = (raw) => ({
  ...raw,
  id: String(raw?.id || raw?._id || ""),
  _id: String(raw?.id || raw?._id || ""),
  rating: Number(raw?.rating) || 0,
  isVerified: !!raw?.isVerified,
});

const AllSellers = () => {
  const handleBack = useSafeBack("/home");
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/vendors/all", {
          params: { status: "approved", page: 1, limit: 500 },
        });
        const payload = response?.data ?? response;
        const list = Array.isArray(payload?.vendors) ? payload.vendors : [];
        if (!cancelled) setVendors(list.map(normalizeVendor).filter((v) => v.id));
      } catch {
        if (!cancelled) setVendors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      (v.storeName || v.name || "").toLowerCase().includes(q)
    );
  }, [vendors, query]);

  return (
    <PageTransition>
      <MobileLayout showBottomNav={false} showCartBar={false}>
        <div className="px-3 sm:px-4 md:px-0 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A]"
              aria-label="Back"
            >
              <FiArrowLeft className="text-xl text-gray-800 dark:text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">All Shops</h1>
              <p className="text-xs text-gray-600 dark:text-[#888888]">
                {filtered.length} registered {filtered.length === 1 ? "shop" : "shops"}
              </p>
            </div>
          </div>

          <div className="relative mb-4">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shops"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1A1A1A] text-sm text-gray-800 dark:text-white focus:outline-none focus:border-[#7B0A0A]"
            />
          </div>

          {loading ? (
            <p className="text-center text-sm text-gray-500 py-10">Loading shops...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-10">No shops found</p>
          ) : (
            <div className="flex flex-wrap gap-3 justify-start">
              {filtered.map((vendor, index) => (
                <VendorShowcaseCard key={vendor.id} vendor={vendor} index={Math.min(index, 10)} />
              ))}
            </div>
          )}
        </div>
      </MobileLayout>
    </PageTransition>
  );
};

export default AllSellers;
