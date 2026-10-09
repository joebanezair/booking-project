import { useRef } from "react";
import { FiSearch, FiX } from "react-icons/fi";

/** Accessible, client-side search for one public-profile catalog section. */
export default function ProfileCatalogSearch({ label, value, onChange, matchingCount, totalCount }) {
  const inputRef = useRef(null);
  const hasQuery = Boolean(value.trim());

  return (
    <div className="profile-catalog-search">
      <div className="profile-catalog-search-field">
        <FiSearch className="profile-catalog-search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className="ui-input profile-catalog-search-input"
          aria-label={label}
          placeholder={label}
          autoComplete="off"
          value={value}
          onChange={event => onChange(event.target.value)}
        />
        {value && (
          <button
            type="button"
            className="profile-catalog-search-clear"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
          >
            <FiX aria-hidden="true" />
          </button>
        )}
      </div>
      {hasQuery && matchingCount > 0 && (
        <span className="profile-catalog-search-count muted" role="status">
          {matchingCount} of {totalCount} results
        </span>
      )}
    </div>
  );
}
