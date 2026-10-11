import { forwardRef } from "react";

/** Native select keeps keyboard, form and change semantics unchanged. */
export const Select = forwardRef(function Select({ className = "", children, ...props }, ref) {
  return <select ref={ref} data-slot="select" className={["ui-select", className].filter(Boolean).join(" ")} {...props}>{children}</select>;
});
