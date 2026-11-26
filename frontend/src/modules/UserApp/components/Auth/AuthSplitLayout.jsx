import { motion } from 'framer-motion';
import { FiCheckCircle } from 'react-icons/fi';

const PANELS = {
  customer: {
    eyebrow: 'People’s League of Electronics',
    title: 'Shop genuine electronics at the best prices.',
    points: ['Verified sellers & original products', 'Fast delivery with live order tracking', 'Easy returns and secure payments'],
  },
  business: {
    eyebrow: 'PLE Business',
    title: 'Wholesale buying built for businesses.',
    points: ['Tier-based wholesale pricing & bulk discounts', 'GST invoices with input tax credit', 'Credit terms, team accounts and RFQs'],
  },
};

/**
 * Shared shell for the customer-facing auth pages.
 * Below `lg` it renders just the centred card (mobile layout unchanged).
 * From `lg` up it becomes a two-column layout: brand panel + form.
 */
const AuthSplitLayout = ({ children, wide = false, mode = 'customer' }) => {
  const panel = PANELS[mode] || PANELS.customer;

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-zinc-950 lg:flex transition-colors duration-500">
      <aside className="hidden lg:flex lg:w-[40%] xl:w-[38%] lg:sticky lg:top-0 lg:h-screen flex-col justify-between p-10 xl:p-14 text-white bg-gradient-to-br from-[#AE020B] via-[#8d0208] to-[#4a0105] relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-black/10" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <span className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
            <img src="/PLEwhite.png" alt="PLE" className="w-full h-full object-contain" />
          </span>
          <span className="text-sm font-semibold tracking-wide text-white/90">{panel.eyebrow}</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-8">{panel.title}</h2>
          <ul className="space-y-4">
            {panel.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-base text-white/90">
                <FiCheckCircle className="mt-1 shrink-0 text-lg" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">&copy; {new Date().getFullYear()} PLE. All rights reserved.</p>
      </aside>

      <main className="flex-1 min-w-0 flex items-start lg:items-center justify-center px-3.5 py-4 sm:px-4 sm:pt-6 pb-8 lg:px-10 lg:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`w-full max-w-md ${wide ? 'lg:max-w-3xl' : 'lg:max-w-lg'}`}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default AuthSplitLayout;
