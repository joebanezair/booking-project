import { forwardRef } from "react";
export const Label = forwardRef(function Label({ className = "", ...props }, ref) {
  return <label ref={ref} data-slot="label" className={["ui-label", className].filter(Boolean).join(" ")} {...props} />;
});
