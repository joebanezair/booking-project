import { forwardRef } from "react";
export const Separator = forwardRef(function Separator({ className = "", orientation = "horizontal", decorative = true, ...props }, ref) {
  return <div ref={ref} data-slot="separator" className={["ui-separator", "ui-separator-" + orientation, className].filter(Boolean).join(" ")} role={decorative ? "none" : "separator"} aria-orientation={decorative ? undefined : orientation} {...props} />;
});
