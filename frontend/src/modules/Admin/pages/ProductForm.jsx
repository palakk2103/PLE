import { useNavigate, useParams } from "react-router-dom";
import ProductFormModal from "../components/ProductFormModal";
import { getAdminPath } from "../config/adminRoutesConfig";

const ProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <ProductFormModal
      isOpen={true}
      productId={id || "new"}
      onClose={() => navigate(getAdminPath("products/manage-products"))}
      onSuccess={() => navigate(getAdminPath("products/manage-products"))}
    />
  );
};

export default ProductForm;
