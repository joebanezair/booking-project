import { useEffect, useId, useRef, useState } from "react";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import { SearchField } from "./ui/search-field.jsx";

function CatalogSelect({
  id,
  labelId,
  value,
  onValueChange,
  options,
  disabled = false,
  describedBy
}) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();
  const selectedOption = options[selectedIndex] || options[0];

  useEffect(() => {
    if (!open) return undefined;

    function handleOutsidePointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleDocumentKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function openMenu(index = selectedIndex) {
    setActiveIndex(index);
    setOpen(true);
  }

  function moveActive(index) {
    const next = Math.max(0, Math.min(options.length - 1, index));
    setActiveIndex(next);
  }

  function handleTriggerKeyDown(event) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu(selectedIndex);
    }
  }

  function handleOptionKeyDown(event, index) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveActive(options.length - 1);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function choose(option) {
    onValueChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="profile-catalog-select-root">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="profile-catalog-select-trigger"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="profile-catalog-select-value">{selectedOption?.label || ""}</span>
        <FiChevronDown aria-hidden="true" className={open ? "is-open" : ""} />
      </button>

      {open && (
        <div
          id={listboxId}
          className="profile-catalog-select-menu"
          role="listbox"
          aria-labelledby={labelId}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={node => { optionRefs.current[index] = node; }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="profile-catalog-select-option"
              onClick={() => choose(option)}
              onKeyDown={event => handleOptionKeyDown(event, index)}
            >
              <span>{option.label}</span>
              {option.value === value && <FiCheck aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Search this business's already-loaded public services and products. */
export default function ProfileCatalogSearch({
  value,
  onChange,
  classification,
  onClassificationChange,
  minRating,
  onRatingChange,
  matchingCount,
  totalCount,
  hasProducts = true,
  hasServices = true
}) {
  const hasFilters = Boolean(value.trim() || classification !== "all" || minRating !== "0");
  const classificationOptions = [
    { value: "all", label: "All offerings" },
    ...(hasServices ? [{ value: "services", label: "Services" }] : []),
    ...(hasProducts ? [{ value: "products", label: "Products" }] : [])
  ];
  const ratingOptions = [
    { value: "0", label: "Any rating" },
    { value: "3", label: "3+ stars" },
    { value: "4", label: "4+ stars" },
    { value: "5", label: "5 stars" }
  ];

  return (
    <div className="profile-catalog-search" role="search" aria-label="Search this business's published offerings">
      <div className="profile-catalog-search-field">
        <span id="profile-catalog-keyword-label" className="ui-label">Search</span>
        <SearchField
          id="profile-catalog-keyword"
          className="profile-catalog-shadcn-search"
          placeholder={hasServices && hasProducts ? "Search products or services..." : hasServices ? "Search services..." : "Search products..."}
          aria-label="Search published offerings"
          value={value}
          onValueChange={onChange}
        />
      </div>

      <div className="profile-catalog-search-filter">
        <span id="profile-catalog-classification-label" className="ui-label">Classification</span>
        <CatalogSelect
          id="profile-catalog-classification"
          labelId="profile-catalog-classification-label"
          value={classification}
          onValueChange={onClassificationChange}
          options={classificationOptions}
        />
      </div>

      {hasServices && (
        <div className="profile-catalog-search-filter">
          <span id="profile-catalog-service-rating-label" className="ui-label">Service rating</span>
          <CatalogSelect
            id="profile-catalog-service-rating"
            labelId="profile-catalog-service-rating-label"
            value={minRating}
            onValueChange={onRatingChange}
            options={ratingOptions}
            disabled={classification === "products"}
            describedBy="profile-service-rating-help"
          />
        </div>
      )}

      {hasServices && (
        <p id="profile-service-rating-help" className="profile-catalog-search-help muted">
          {classification === "products"
            ? "Products do not have individual ratings."
            : hasProducts ? "Rating filters services only; products remain visible under All offerings." : "Rating filters services only."}
        </p>
      )}

      {hasFilters && (
        <p className="profile-catalog-search-count muted" role="status" aria-live="polite">
          {matchingCount} of {totalCount} offerings shown
        </p>
      )}
    </div>
  );
}
