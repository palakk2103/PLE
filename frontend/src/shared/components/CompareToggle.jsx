import { FiBarChart2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useCompareStore, MAX_COMPARE } from '../store/compareStore';

/** "Compare" button for a product card / page. `variant="icon"` is the small round one for cards. */
const CompareToggle = ({ product, variant = 'icon', className = '' }) => {
  const id = String(product?.id || product?._id || '');
  const selected = useCompareStore((s) => s.items.some((i) => i.id === id));
  const add = useCompareStore((s) => s.add);
  const remove = useCompareStore((s) => s.remove);

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selected) {
      remove(id);
      toast.success('Removed from compare');
      return;
    }
    const res = add(product);
    if (res.ok) toast.success('Added to compare');
    else if (res.reason === 'full') toast.error(`You can compare up to ${MAX_COMPARE} products. Remove one first.`);
    else if (res.reason === 'invalid') toast.error('This product cannot be compared.');
  };

  if (variant === 'button') {
    return (
      <button type="button" onClick={onClick} data-testid="compare-toggle" aria-pressed={selected}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${selected ? 'bg-[#7B0A0A] text-white border-[#7B0A0A]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} ${className}`}>
        <FiBarChart2 /> {selected ? 'Added to compare' : 'Compare'}
      </button>
    );
  }
  return (
    <button type="button" data-interactive="true" onClick={onClick} data-testid="compare-toggle" aria-pressed={selected}
      title={selected ? 'Remove from compare' : 'Add to compare'}
      className={`p-1.5 glass rounded-full shadow-lg transition-all duration-300 hover:bg-white ${className}`}>
      <FiBarChart2 className={`text-xs md:text-sm ${selected ? 'text-[#7B0A0A]' : 'text-gray-400'}`} />
    </button>
  );
};

export default CompareToggle;
