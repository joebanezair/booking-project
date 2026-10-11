import { forwardRef } from "react";
export const Textarea = forwardRef(function Textarea({ className = "", ...props }, ref) {
  return <textarea ref={ref} data-slot="textarea" className={["ui-textarea", className].filter(Boolean).join(" ")} {...props} />;
});
