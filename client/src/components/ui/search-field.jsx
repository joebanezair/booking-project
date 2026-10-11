import { forwardRef, useRef } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import { Button } from "./button.jsx";
import { Input } from "./input.jsx";

/**
 * Compact shadcn-style search field shared by discovery, inventory, services,
 * customer lists and chat. Search behavior lives with the calling page.
 */
export const SearchField = forwardRef(function SearchField({
  value = "", onValueChange, onChange, placeholder = "Search...",
  className = "", inputClassName = "", "aria-label": ariaLabel = "Search",
  id, autoComplete = "off", ...props
}, forwardedRef) {
  const internalRef = useRef(null);
  const inputRef = forwardedRef || internalRef;
  function clear() {
    if (onValueChange) onValueChange("");
    else onChange?.({ target: { value: "" } });
    // Allow controlled value to update before restoring focus.
    const input = typeof inputRef === "function" ? null : inputRef.current;
    input?.focus();
  }
  return <div className={["ui-search-field", className].filter(Boolean).join(" ")}>
    <FiSearch className="ui-search-icon" aria-hidden="true" />
    <Input {...props} id={id} ref={inputRef} type="search"
      className={["ui-search-input", inputClassName].filter(Boolean).join(" ")}
      aria-label={ariaLabel} autoComplete={autoComplete}
      placeholder={placeholder} value={value}
      onChange={event => onValueChange ? onValueChange(event.target.value) : onChange?.(event)} />
    {Boolean(value) && <Button type="button" variant="ghost" size="icon-sm"
      className="ui-search-clear" aria-label={"Clear " + ariaLabel.toLowerCase()}
      onClick={clear}><FiX aria-hidden="true" /></Button>}
  </div>;
});
