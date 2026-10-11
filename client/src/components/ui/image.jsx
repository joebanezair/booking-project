import { forwardRef } from "react";

/** Neutral image primitive; preserve sizing, crop and existing fallbacks. */
export const Image = forwardRef(function Image({ className = "", alt = "", decoding = "async", ...props }, ref) {
  return <img ref={ref} data-slot="image" className={["ui-image", className].filter(Boolean).join(" ")} alt={alt} decoding={decoding} {...props} />;
});
