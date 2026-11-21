import { useState } from 'react';
import { FiX } from 'react-icons/fi';

/**
 * Thumbnails for the photos attached to a review; click one to view it full size.
 * size: 'sm' (table cells) | 'md' (detail views)
 */
const ReviewPhotos = ({ images, size = 'md', className = '' }) => {
  const [open, setOpen] = useState(null);
  const urls = (Array.isArray(images) ? images : []).filter((u) => typeof u === 'string' && u);
  if (!urls.length) return null;

  const box = size === 'sm' ? 'w-10 h-10 rounded-md' : 'w-20 h-20 rounded-lg';

  return (
    <>
      <div className={`flex ${size === 'sm' ? 'flex-nowrap gap-1' : 'flex-wrap gap-2'} ${className}`} data-testid="review-photos">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(url);
            }}
            className={`${box} overflow-hidden border border-gray-200 bg-gray-50 hover:ring-2 hover:ring-primary-400 transition`}
            title="View photo"
          >
            <img src={url} alt={`Review photo ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(null);
          }}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-gray-800"
            onClick={() => setOpen(null)}
            aria-label="Close photo"
          >
            <FiX />
          </button>
          <img src={open} alt="Review photo" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
        </div>
      )}
    </>
  );
};

export default ReviewPhotos;
