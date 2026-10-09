import { useRef } from "react";
import { FiSearch, FiX } from "react-icons/fi";

/** Search this business's already-loaded public services and products. */
export default function ProfileCatalogSearch({
  value,
  onChange,
  classification,
  onClassificationChange,
  minRating,
  onRatingChange,
  matchingCount,
  totalCount
}) {
  const inputRef = useRef(null);
  const hasFilters = Boolean(value.trim() || classification !== "all" || minRating !== "0");

  return (
    <div className="profile-catalog-search" role="search" aria-label="Search this business's products and services">
      <div className="profile-catalog-search-field">
        <FiSearch className="profile-catalog-search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className="ui-input profile-catalog-search-input"
          aria-label="Search products or services"
          placeholder="Search products or services..."
          autoComplete="off"
          value={value}
          onChange={event => onChange(event.target.value)}
        />
        {value && (
          <button
            type="button"
            className="profile-catalog-search-clear"
            aria-label="Clear search"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
          >
            <FiX aria-hidden="true" />
          </button>
        )}
      </div>
      <label className="profile-catalog-search-filter">
        <span>Classification</span>
        <select
          className="ui-input"
          value={classification}
          onChange={event => onClassificationChange(event.target.value)}
        >
          <option value="all">All offerings</option>
          <option value="services">Services</option>
          <option value="products">Products</option>
        </select>
      </label>
      <label className="profile-catalog-search-filter">
        <span>Service rating</span>
        <select
          className="ui-input"
          value={minRating}
          onChange={event => onRatingChange(event.target.value)}
          disabled={classification === "products"}
          aria-describedby="profile-service-rating-help"
        >
          <option value="0">Any rating</option>
          <option value="3">3+ stars</option>
          <option value="4">4+ stars</option>
          <option value="5">5 stars</option>
        </select>
      </label>
      <p id="profile-service-rating-help" className="profile-catalog-search-help muted">
        {classification === "products"
          ? "Products do not have individual ratings."
          : "Rating filters services only; products remain visible under All offerings."}
      </p>
      {hasFilters && (
        <p className="profile-catalog-search-count muted" role="status" aria-live="polite">
          {matchingCount} of {totalCount} offerings shown
        </p>
      )}
    </div>
  );
}
