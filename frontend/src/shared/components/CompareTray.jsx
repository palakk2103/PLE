import { useLocation, useNavigate } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { useCompareStore, MIN_COMPARE, MAX_COMPARE } from '../store/compareStore';

/** Floating tray listing the picked products with a Compare button. Hidden on the compare page. */
const CompareTray = () => {
  const items = useCompareStore((s) => s.items);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (items.length === 0 || pathname.startsWith('/compare')) return null;
  const ready = items.length >= MIN_COMPARE;

  return (
    <div className="fixed left-2 right-2 md:left-auto md:right-4 md:w-[420px] bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-4 z-[9990] bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-3" data-testid="compare-tray">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Compare ({items.length}/{MAX_COMPARE})</p>
        <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-red-600" data-testid="compare-clear">Clear</button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-2 flex-1 overflow-x-auto">
          {items.map((i) => (
            <div key={i.id} className="relative shrink-0 w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden" title={i.name} data-testid="compare-tray-item">
              {i.image ? <img src={i.image} alt={i.name} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-xs text-gray-400">{i.name.charAt(0)}</span>}
              <button type="button" onClick={() => remove(i.id)} className="absolute -top-0 -right-0 bg-black/60 text-white rounded-bl-md p-0.5" aria-label={`Remove ${i.name}`}><FiX className="text-[10px]" /></button>
            </div>
          ))}
        </div>
        <button type="button" disabled={!ready} onClick={() => navigate('/compare')} data-testid="compare-go"
          className="shrink-0 px-4 py-2.5 rounded-xl bg-[#7B0A0A] text-white text-sm font-bold disabled:opacity-50">
          {ready ? 'Compare' : `Add ${MIN_COMPARE - items.length} more`}
        </button>
      </div>
    </div>
  );
};

export default CompareTray;
