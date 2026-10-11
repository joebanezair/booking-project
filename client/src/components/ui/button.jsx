import { Children, cloneElement, forwardRef, isValidElement } from "react";

const variants = {
  default: "ui-button-default",
  secondary: "ui-button-secondary",
  destructive: "ui-button-destructive",
  outline: "ui-button-outline",
  ghost: "ui-button-ghost",
  link: "ui-button-link",
  plain: "ui-button-plain"
};
const sizes = { default: "", sm: "ui-button-sm", lg: "ui-button-lg", icon: "ui-button-icon", "icon-sm": "ui-button-icon-sm" };
const cx = (...parts) => parts.filter(Boolean).join(" ");

/** Compact shadcn-style button: same existing BookFlow color tokens. */
export const Button = forwardRef(function Button({
  className = "", variant = "default", size = "default", asChild = false, fullWidth = false, children, ...props
}, ref) {
  const classes = cx("ui-button", variants[variant] || variants.default, sizes[size] || "", fullWidth && "ui-button-full", className);
  if (asChild) {
    const child = Children.only(children);
    if (!isValidElement(child)) throw new Error("Button asChild expects exactly one React element.");
    return cloneElement(child, {
      ...props, ...child.props,
      "data-slot": "button",
      "data-variant": variant,
      "data-size": size,
      className: cx(classes, child.props.className),
      ref
    });
  }
  return <button ref={ref} data-slot="button" data-variant={variant} data-size={size} className={classes} {...props}>{children}</button>;
});
