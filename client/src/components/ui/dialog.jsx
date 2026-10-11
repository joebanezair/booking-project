import { forwardRef, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Native modal <dialog> with the locally styled, shadcn-style API.
 * showModal() handles focus containment and background inertness;
 * Escape and programmatic closure are synchronized with React state.
 */
export function Dialog({ open = false, onOpenChange, title, children, className = "", dismissible = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={ref} className={["ui-dialog", className].filter(Boolean).join(" ")}
    aria-label={title}
    onCancel={event => { if (!dismissible) event.preventDefault(); else onOpenChange?.(false); }}
    onClose={() => { if (open) onOpenChange?.(false); }}
    onMouseDown={event => {
      if (dismissible && event.target === event.currentTarget) onOpenChange?.(false);
    }}>
    {children}
  </dialog>, document.body);
}
export const DialogContent = forwardRef(function DialogContent({ className = "", ...props }, ref) {
  return <div ref={ref} className={["ui-dialog-content", className].filter(Boolean).join(" ")} {...props} />;
});
export const DialogHeader = forwardRef(function DialogHeader({ className = "", ...props }, ref) {
  return <div ref={ref} className={["ui-dialog-header", className].filter(Boolean).join(" ")} {...props} />;
});
export const DialogTitle = forwardRef(function DialogTitle({ className = "", ...props }, ref) {
  return <h2 ref={ref} className={["ui-dialog-title", className].filter(Boolean).join(" ")} {...props} />;
});
export const DialogDescription = forwardRef(function DialogDescription({ className = "", ...props }, ref) {
  return <p ref={ref} className={["ui-dialog-description", className].filter(Boolean).join(" ")} {...props} />;
});
export const DialogFooter = forwardRef(function DialogFooter({ className = "", ...props }, ref) {
  return <div ref={ref} className={["ui-dialog-footer", className].filter(Boolean).join(" ")} {...props} />;
});
