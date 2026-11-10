import { forwardRef } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

/**
 * Compact shadcn-style button group primitive.
 * Visual sizing and selected-state styles are supplied by the consuming page.
 */
export const ButtonGroup = forwardRef(function ButtonGroup({
  className = "",
  orientation = "horizontal",
  role = "group",
  ...props
}, ref) {
  return <div
    ref={ref}
    role={role}
    data-slot="button-group"
    data-orientation={orientation}
    className={cx("ui-button-group", className)}
    {...props}
  />;
});
