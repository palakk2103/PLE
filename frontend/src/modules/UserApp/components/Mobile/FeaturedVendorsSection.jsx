import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import VendorShowcaseCard from './VendorShowcaseCard';
import { getApprovedVendors } from '../../data/catalogData';

const FeaturedVendorsSection = ({ vendors = null }) => {
  const approvedVendors = Array.isArray(vendors) && vendors.length > 0
    ? vendors
    : getApprovedVendors();
  const featuredVendors = approvedVendors
    .filter(v => v.isVerified)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 10);

  if (featuredVendors.length === 0) return null;

  return (
    <div className="px-1 sm:px-2 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Best Sellers</h2>
          <p className="text-xs text-gray-600 dark:text-[#888888] mt-0.5">Shop from trusted stores</p>
        </div>
        <Link
          to="/search"
          className="flex items-center gap-1 text-sm text-[#7B0A0A] dark:text-[#7B0A0A] font-semibold hover:text-[#AE020B] dark:hover:text-[#FF3333] transition-colors"
        >
          <span>See All</span>
          <FiArrowRight className="text-sm" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-1">
        {featuredVendors.map((vendor, index) => (
          <VendorShowcaseCard key={vendor.id} vendor={vendor} index={index} />
        ))}
      </div>
    </div>
  );
};

export default FeaturedVendorsSection;

