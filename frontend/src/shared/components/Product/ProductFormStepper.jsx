import { FiCheck } from 'react-icons/fi';

const DEFAULT_STEPS = ['Basic Information', 'Specifications & Details'];

/** Step indicator for the two-step product form. `step` is 1-based. */
const ProductFormStepper = ({ step, steps = DEFAULT_STEPS, onStepClick }) => (
  <nav aria-label="Product form steps" data-testid="product-form-stepper" className="mb-3">
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <li key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onStepClick?.(n)}
              aria-current={active ? 'step' : undefined}
              data-testid={`product-step-${n}`}
              className="flex items-center gap-2 min-w-0 text-left"
            >
              <span
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                  active || done ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-300'
                }`}
              >
                {done ? <FiCheck /> : n}
              </span>
              <span className={`text-xs sm:text-sm font-semibold truncate ${active ? 'text-gray-900' : 'text-gray-500'}`}>
                <span className="hidden sm:inline">{n}. </span>
                {label}
              </span>
            </button>
            {n < steps.length && <span className={`flex-1 h-px ${done ? 'bg-primary-600' : 'bg-gray-200'}`} />}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default ProductFormStepper;
