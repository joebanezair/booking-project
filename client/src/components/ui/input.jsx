import { forwardRef } from "react";

const specialTypes = new Set(["checkbox", "radio", "file", "hidden", "range", "color"]);
export const Input = forwardRef(function Input({ className = "", type = "text", ...props }, ref) {
  const base = specialTypes.has(type) ? "ui-input-control" : "ui-input";
  return <input ref={ref} data-slot="input" type={type} className={[base, className].filter(Boolean).join(" ")} {...props} />;
});
