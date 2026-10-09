import { useState } from "react";
import { Link } from "react-router-dom";
import { FiPackage } from "react-icons/fi";

// Public discovery cards use the same image fields as product inventory and profiles.
export default function SearchProductCard({ product }) {
  const [failedImage, setFailedImage] = useState("");
  const uploadedImages = Array.isArray(product.images)
    ? product.images.filter(image => typeof image === "string" && image.trim())
    : [];
  const imageSrc = uploadedImages[0] || (typeof product.image === "string" ? product.image : "");
  const showImage = Boolean(imageSrc && failedImage !== imageSrc);

  return (
    <Link
      to={`/profile/${product.user?.username}?product=${product._id}`}
      className="panel search-product-card"
    >
      <div className="search-product-media">
        {showImage ? (
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setFailedImage(imageSrc)}
          />
        ) : (
          <span className="search-product-placeholder" role="img" aria-label="Product image unavailable">
            <FiPackage aria-hidden="true" />
          </span>
        )}
        {showImage && uploadedImages.length > 1 && (
          <span className="search-product-image-count">
            {uploadedImages.length} photos
          </span>
        )}
      </div>

      <div className="search-product-body">
        <h3>{product.name}</h3>
        <p>{product.description || "Product"}</p>
        <strong className="search-product-price">
          {new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: product.currency || "PHP"
          }).format(product.price || 0)}
        </strong>
        <small className="search-product-meta">
          {product.user?.name || "Business"} · {product.stock || 0} in stock
        </small>
      </div>
    </Link>
  );
}
