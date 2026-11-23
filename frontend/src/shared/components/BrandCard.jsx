import { motion } from 'framer-motion';

const BrandCard = ({ brand }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.08, y: -5 }}
      className="glass-card rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover-lift group h-full"
    >
      <div className="w-full h-20 flex items-center justify-center mb-2">
        <img
          src={brand.logo}
          alt={brand.name}
          className="max-w-full max-h-full object-contain scale-60 group-hover:scale-75 transition-transform duration-300 filter group-hover:brightness-110"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/%3E%3Ccircle cx=%2234%22 cy=%2236%22 r=%228%22 fill=%22%23d1d5db%22/%3E%3Cpath d=%22M12 80l24-28 16 18 12-13 24 23z%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E';
          }}
        />
      </div>
      <p className="text-xs font-bold text-gray-800 text-center group-hover:text-gradient transition-colors">{brand.name}</p>
    </motion.div>
  );
};

export default BrandCard;

