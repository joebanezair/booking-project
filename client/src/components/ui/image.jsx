import { forwardRef, useEffect, useState } from "react";
import { FiImage } from "react-icons/fi";

/** Shadcn-style media primitive with a layout-preserving unavailable-image state. */
export const Image = forwardRef(function Image({
  className = "", alt = "", decoding = "async", loading = "lazy",
  src, onError, ...props
}, ref) {
  const [failed,setFailed] = useState(false);
  useEffect(()=>setFailed(false),[src]);
  const classes = ["ui-image",className].filter(Boolean).join(" ");
  if (!src || failed) return <span data-slot="image-fallback"
    className={classes+" ui-image-fallback"} role="img"
    aria-label={alt ? alt+" image unavailable" : "Image unavailable"}>
    <FiImage aria-hidden="true" />
  </span>;
  return <img ref={ref} data-slot="image" className={classes} alt={alt}
    decoding={decoding} loading={loading} src={src}
    onError={event=>{setFailed(true);onError?.(event);}} {...props} />;
});
