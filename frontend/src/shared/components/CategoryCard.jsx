import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const CategoryCard = ({ category }) => {
  const categoryLink = `/category/${category.id}`;

  return (
    <Link to={categoryLink} className="block h-full">
      <motion.div
        whileHover={{ scale: 1.05, y: -5 }}
        className="glass-card rounded-2xl overflow-hidden cursor-pointer hover-lift group h-full flex flex-col">
        <div className="w-full h-24 md:h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden relative">
          <img
            src={category.image}
            alt={category.name}
            className="w-full h-full object-contain scale-50 group-hover:scale-65 transition-transform duration-500"
            onError={(e) => {
              e.target.src =
                "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f3f4f6%22/%3E%3Ccircle cx=%2234%22 cy=%2236%22 r=%228%22 fill=%22%23d1d5db%22/%3E%3Cpath d=%22M12 80l24-28 16 18 12-13 24 23z%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
        <div className="p-3 flex-1 flex items-center justify-center">
          <h3 className="text-sm font-bold text-gray-800 text-center group-hover:text-gradient transition-colors">
            {category.name}
          </h3>
        </div>
      </motion.div>
    </Link>
  );
};

export default CategoryCard;
