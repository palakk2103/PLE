import { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { SPEC_GROUP_META, normalizeSpecifications, formatSpecValue } from '../../utils/productSpecs';

/** Descriptions are rendered as plain text (tags stripped) so vendor content can never inject markup. */
const toSafeText = (html) =>
  String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const Accordion = ({ id, title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200" data-testid={`product-info-${id}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`product-info-panel-${id}`}
        data-testid={`product-info-toggle-${id}`}
        className="w-full flex items-center justify-between py-4 text-left"
      >
        <span className="text-base font-bold text-gray-900">{title}</span>
        <FiChevronDown className={`text-xl text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={`product-info-panel-${id}`} className="pb-4" data-testid={`product-info-panel-${id}`}>
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Amazon-style "Product Information": three collapsible spec groups, then description and What's in the Box.
 * Everything comes from the product's saved data; empty rows/sections are hidden.
 */
const ProductInformationSection = ({ specifications, description }) => {
  const specs = normalizeSpecifications(specifications);
  const groups = SPEC_GROUP_META.map((g) => ({
    ...g,
    rows: specs[g.id].map((e) => ({ key: `${e.key}-${e.label}`, label: e.label, value: formatSpecValue(e) })).filter((r) => r.label && r.value),
  })).filter((g) => g.rows.length);
  const boxItems = specs.whatsInBox.map((x) => x.trim()).filter(Boolean);
  const descText = toSafeText(description);

  if (!groups.length && !boxItems.length && !descText) return null;

  return (
    <section data-testid="product-information" className="w-full">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Product Information</h2>

      {groups.map((g, i) => (
        <Accordion key={g.id} id={g.id} title={g.title} defaultOpen={i === 0}>
          <dl className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {g.rows.map((r) => (
              <div key={r.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 sm:gap-x-4 px-3 py-2.5 odd:bg-gray-50" data-testid="product-info-row">
                <dt className="text-sm font-semibold text-gray-700 break-words">{r.label}</dt>
                <dd className="text-sm text-gray-900 break-words whitespace-pre-line">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Accordion>
      ))}

      {descText && (
        <div className="pt-6" data-testid="product-info-description">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Product Description</h3>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line break-words">{descText}</p>
        </div>
      )}

      {boxItems.length > 0 && (
        <div className="pt-6" data-testid="product-info-box">
          <h3 className="text-lg font-bold text-gray-900 mb-3">What&apos;s in the Box?</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            {boxItems.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
};

export default ProductInformationSection;
