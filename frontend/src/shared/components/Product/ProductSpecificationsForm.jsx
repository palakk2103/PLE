import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import api from '../../utils/api';
import { SPEC_GROUP_META, normalizeSpecifications } from '../../utils/productSpecs';

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white';

/**
 * Step 2 of the product form: dynamic, category-aware specification fields.
 * Used by Admin/Managed-vendor and Third-party vendor forms (same data shape for both).
 *
 * Props: categoryId, value (specifications object), onChange(specs), onTemplateLoaded(fields[]), errors({[key]: msg})
 */
const ProductSpecificationsForm = ({ categoryId, value, onChange, onTemplateLoaded, errors = {} }) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const specs = useMemo(() => normalizeSpecifications(value), [value]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/spec-template', { params: categoryId ? { categoryId } : {} })
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.fields || res?.data?.data?.fields || [];
        setFields(list);
        onTemplateLoaded?.(list);
      })
      .catch(() => {
        if (cancelled) return;
        setFields([]);
        onTemplateLoaded?.([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);

  const setGroup = (group, rows) => onChange({ ...specs, [group]: rows });

  const setFieldValue = (field, patch) => {
    const rows = specs[field.group] || [];
    const idx = rows.findIndex((r) => r.key === field.key);
    const prev = idx >= 0 ? rows[idx] : { key: field.key, label: field.label, type: field.type, unit: field.unit };
    const next = { ...prev, ...patch };
    const empty =
      next.value === undefined || next.value === '' || next.value === null || (Array.isArray(next.value) && !next.value.length);
    let updated;
    if (empty) updated = rows.filter((r) => r.key !== field.key);
    else if (idx >= 0) updated = rows.map((r, i) => (i === idx ? next : r));
    else updated = [...rows, next];
    setGroup(field.group, updated);
  };

  const renderInput = (field, entry) => {
    const id = `spec-${field.key}`;
    const val = entry?.value;
    const common = { id, 'data-testid': id };
    switch (field.type) {
      case 'textarea':
        return <textarea {...common} rows={2} className={inputCls} placeholder={field.placeholder} value={val ?? ''} onChange={(e) => setFieldValue(field, { value: e.target.value })} />;
      case 'select':
        return (
          <select {...common} className={inputCls} value={val ?? ''} onChange={(e) => setFieldValue(field, { value: e.target.value })}>
            <option value="">Select…</option>
            {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'multiselect': {
        const selected = Array.isArray(val) ? val : [];
        return (
          <div {...common} className="flex flex-wrap gap-2">
            {(field.options || []).map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  type="button"
                  key={o}
                  onClick={() => setFieldValue(field, { value: on ? selected.filter((x) => x !== o) : [...selected, o] })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${on ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        );
      }
      case 'boolean':
        return (
          <select {...common} className={inputCls} value={val === undefined ? '' : val ? 'true' : 'false'} onChange={(e) => setFieldValue(field, { value: e.target.value === '' ? '' : e.target.value === 'true' })}>
            <option value="">Select…</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      case 'date':
        return <input {...common} type="date" className={inputCls} value={val ?? ''} onChange={(e) => setFieldValue(field, { value: e.target.value })} />;
      case 'number':
        return (
          <div className="flex gap-2">
            <input {...common} type="number" min="0" step="any" className={inputCls} placeholder={field.placeholder} value={val ?? ''} onChange={(e) => setFieldValue(field, { value: e.target.value })} />
            {field.units?.length > 1 ? (
              <select aria-label={`${field.label} unit`} className={`${inputCls} !w-24`} value={entry?.unit || field.unit || ''} onChange={(e) => setFieldValue(field, { unit: e.target.value })}>
                {field.units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            ) : field.unit ? (
              <span className="self-center text-xs text-gray-500 whitespace-nowrap">{field.unit}</span>
            ) : null}
          </div>
        );
      default:
        return (
          <div className="flex gap-2">
            <input {...common} type="text" className={inputCls} placeholder={field.placeholder} value={val ?? ''} onChange={(e) => setFieldValue(field, { value: e.target.value })} />
            {field.units?.length > 1 && (
              <select aria-label={`${field.label} unit`} className={`${inputCls} !w-24`} value={entry?.unit || field.unit || ''} onChange={(e) => setFieldValue(field, { unit: e.target.value })}>
                {field.units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
          </div>
        );
    }
  };

  // Custom (non-template) rows, including legacy entries whose key isn't in the template
  const customRows = (group) => (specs[group] || []).map((r, i) => ({ r, i })).filter(({ r }) => !fieldKeys.has(r.key));

  const addCustom = (group) =>
    setGroup(group, [...(specs[group] || []), { key: `custom_${Date.now().toString(36)}`, label: '', type: 'text', value: '' }]);
  const updateCustom = (group, index, patch) =>
    setGroup(group, (specs[group] || []).map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const removeCustom = (group, index) => setGroup(group, (specs[group] || []).filter((_, i) => i !== index));

  const box = specs.whatsInBox;
  const setBox = (list) => onChange({ ...specs, whatsInBox: list });

  return (
    <div className="space-y-4" data-testid="product-specs-form">
      {loading && <p className="text-xs text-gray-500">Loading specification fields…</p>}

      {SPEC_GROUP_META.map((group) => {
        const groupFields = fields.filter((f) => f.group === group.id);
        const custom = customRows(group.id);
        return (
          <section key={group.id} className="bg-white border border-gray-200 rounded-xl p-4" data-testid={`spec-group-${group.id}`}>
            <h3 className="text-sm font-bold text-gray-900">{group.title}</h3>
            <p className="text-xs text-gray-500 mb-3">{group.hint}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groupFields.map((field) => {
                const entry = (specs[group.id] || []).find((r) => r.key === field.key);
                return (
                  <div key={field.key} className={field.type === 'textarea' || field.type === 'multiselect' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={`spec-${field.key}`} className="block text-xs font-semibold text-gray-700 mb-1">
                      {field.label}{field.required && <span className="text-red-500"> *</span>}
                    </label>
                    {renderInput(field, entry)}
                    {errors[field.key] && <p className="text-xs text-red-600 mt-1">{errors[field.key]}</p>}
                  </div>
                );
              })}
            </div>

            {custom.map(({ r, i }) => (
              <div key={r.key} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mt-3 items-center" data-testid={`spec-custom-${group.id}`}>
                <input className={inputCls} placeholder="Specification name" value={r.label || ''} onChange={(e) => updateCustom(group.id, i, { label: e.target.value })} />
                <input className={inputCls} placeholder="Value" value={Array.isArray(r.value) ? r.value.join(', ') : r.value ?? ''} onChange={(e) => updateCustom(group.id, i, { value: e.target.value })} />
                <button type="button" aria-label="Remove specification" onClick={() => removeCustom(group.id, i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg justify-self-end"><FiTrash2 /></button>
              </div>
            ))}

            <button type="button" onClick={() => addCustom(group.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
              <FiPlus /> Add custom specification
            </button>
          </section>
        );
      })}

      <section className="bg-white border border-gray-200 rounded-xl p-4" data-testid="spec-group-whatsInBox">
        <h3 className="text-sm font-bold text-gray-900">What&apos;s in the Box?</h3>
        <p className="text-xs text-gray-500 mb-3">Box contents, included accessories and components.</p>
        <div className="space-y-2">
          {box.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input className={inputCls} placeholder="e.g. Power Cable" value={item} data-testid="spec-box-item" onChange={(e) => setBox(box.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" aria-label="Remove item" onClick={() => setBox(box.filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><FiTrash2 /></button>
            </div>
          ))}
        </div>
        <button type="button" data-testid="spec-box-add" onClick={() => setBox([...box, ''])} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
          <FiPlus /> Add item
        </button>
      </section>
    </div>
  );
};

export default ProductSpecificationsForm;
