const Badge = ({ children, variant = 'flash', className = '' }) => {
  const variants = {
    flash: 'bg-primary-500 text-white',
    discount: 'bg-discount-500 text-white',
    sale: 'bg-accent-500 text-black',
    warning: 'bg-orange-500 text-white',
    error: 'bg-discount-500 text-white',
    success: 'bg-success-500 text-white',
    info: 'bg-primary-500 text-white',
    pending: 'bg-yellow-500 text-white',
    processing: 'bg-red-500 text-white',
    shipped: 'bg-[#7B0A0A] text-white',
    out_for_delivery: 'bg-purple-600 text-white',
    'out for delivery': 'bg-purple-600 text-white',
    delivered: 'bg-success-500 text-white',
    cancelled: 'bg-discount-500 text-white',
    returned: 'bg-orange-500 text-white',
    approved: 'bg-green-500 text-white',
    rejected: 'bg-red-500 text-white',
    completed: 'bg-success-500 text-white',
    'return-pending': 'bg-yellow-500 text-white',
    'return-approved': 'bg-green-500 text-white',
    'return-rejected': 'bg-red-500 text-white',
    'return-processing': 'bg-blue-500 text-white',
    'return-completed': 'bg-success-500 text-white',
    refurbished: 'bg-gradient-to-r from-[#7B0A0A] to-[#AE020B] text-white shadow-sm',
    renewed: 'bg-gradient-to-r from-red-700 to-rose-600 text-white shadow-sm',
    'open-box': 'bg-gradient-to-r from-red-500 to-[#7B0A0A] text-white shadow-sm',
    default: 'bg-gray-100 text-gray-700 border border-gray-200',
    danger: 'bg-red-500 text-white',
  };

  return (
    <div
      className={`px-3 py-1 rounded-md text-xs font-bold ${variants[variant]} ${className}`}
    >
      {children}
    </div>
  );
};

export default Badge;

