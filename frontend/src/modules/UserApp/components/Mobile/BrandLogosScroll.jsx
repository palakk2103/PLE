import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getCatalogBrands } from '../../data/catalogData';

const BrandLogosScroll = ({ brands = null }) => {
    const navigate = useNavigate();
    const fallbackBrands = getCatalogBrands().slice(0, 10);
    const displayBrands = Array.isArray(brands) && brands.length > 0
        ? brands.slice(0, 10)
        : fallbackBrands;

    return (
        <section className="bg-transparent w-full overflow-hidden">
            {/* Desktop Layout - White card container */}
            <div className="hidden md:block bg-white rounded-lg mb-4 p-4">
                <div className="w-full overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex gap-4 min-w-max pb-2">
                        {displayBrands.map((brand, index) => (
                            <motion.div
                                key={brand.id}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ delay: index * 0.05, duration: 0.3 }}
                                className="flex-shrink-0 flex flex-col items-center"
                                style={{ width: '64px' }}
                            >
                                <div
                                    onClick={() => navigate(`/brand/${brand.id}`)}
                                    className="bg-gray-50 dark:bg-[#000000] dark:border-[rgba(123,10,10,0.3)] dark:hover:border-[#7B0A0A] rounded-lg p-2 shadow-sm transition-all duration-300 flex items-center justify-center w-16 h-16 group cursor-pointer border border-gray-100 mb-2 hover:shadow-md hover:border-gray-200 dark:hover:shadow-[0_0_12px_rgba(123,10,10,0.4)]">
                                    <img
                                        src={brand.logo}
                                        alt={brand.name}
                                        draggable={false}
                                        onDragStart={(e) => e.preventDefault()}
                                        className="w-full h-full object-contain dark:invert pointer-events-none select-none"
                                        onError={(e) => {
                                            e.target.src = 'https://via.placeholder.com/120x80?text=Brand';
                                        }}
                                        loading="lazy"
                                    />
                                </div>
                                <p className="text-xs font-medium text-gray-700 text-center truncate w-full">
                                    {brand.name}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden w-full">
                <div className="w-full overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <div className="flex gap-2.5 xs:gap-3 sm:gap-4 min-w-max px-2 xs:px-3 sm:px-4 pb-2">
                        {displayBrands.map((brand, index) => (
                            <motion.div
                                key={brand.id}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ delay: index * 0.05, duration: 0.3 }}
                                className="flex-shrink-0 flex flex-col items-center w-16 xs:w-20 sm:w-24"
                            >
                                <div
                                    onClick={() => navigate(`/brand/${brand.id}`)}
                                    className="bg-white dark:bg-[#000000] dark:border dark:border-[rgba(123,10,10,0.3)] dark:hover:border-[#7B0A0A] rounded-2xl p-2 shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_0_12px_rgba(123,10,10,0.2)] transition-all duration-300 flex items-center justify-center w-full aspect-square group cursor-pointer mb-1.5 hover:shadow-md dark:hover:shadow-[0_0_18px_rgba(123,10,10,0.4)]">
                                    <img
                                        src={brand.logo}
                                        alt={brand.name}
                                        draggable={false}
                                        onDragStart={(e) => e.preventDefault()}
                                        className="w-[85%] h-[85%] object-contain dark:brightness-90 pointer-events-none select-none"
                                        onError={(e) => {
                                             e.target.src = 'https://via.placeholder.com/120x80?text=Brand';
                                        }}
                                        loading="lazy"
                                    />
                                </div>
                                <p className="text-[10px] xs:text-[11px] font-bold text-gray-800 dark:text-white text-center transition-colors truncate w-full px-0.5 mt-0.5">
                                    {brand.name}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default BrandLogosScroll;
