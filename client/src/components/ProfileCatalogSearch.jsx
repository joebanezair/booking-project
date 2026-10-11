import { SearchField } from "./ui/search-field.jsx";
import { Select } from "./ui/select.jsx";
import { Label } from "./ui/label.jsx";


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
  const hasFilters = Boolean(value.trim() || classification !== "all" || minRating !== "0");

  return (
    <div className="profile-catalog-search" role="search" aria-label="Search this business's products and services">
      <div className="profile-catalog-search-field">
        <Label htmlFor="profile-catalog-keyword">Search</Label>
        <SearchField id="profile-catalog-keyword" className="profile-catalog-shadcn-search"
          placeholder="Search products or services..." aria-label="Search products or services"
          value={value} onValueChange={onChange} />
      </div>
      <Label className="profile-catalog-search-filter">
        <span>Classification</span>
        <Select
          className="ui-input"
          value={classification}
          onChange={event => onClassificationChange(event.target.value)}
        >
          <option value="all">All offerings</option>
          <option value="services">Services</option>
          <option value="products">Products</option>
        </Select>
      </Label>
      <Label className="profile-catalog-search-filter">
        <span>Service rating</span>
        <Select
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
        </Select>
      </Label>
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
