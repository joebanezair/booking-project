import { Children, cloneElement, forwardRef, isValidElement } from "react";
const variants={default:"ui-button ui-button-default",secondary:"ui-button ui-button-secondary",destructive:"ui-button ui-button-destructive",ghost:"ui-button ui-button-ghost",outline:"ui-button ui-button-outline"};
const sizes={default:"",sm:"ui-button-sm",lg:"ui-button-lg",icon:"ui-button-icon"};
export const Button=forwardRef(function Button({className="",variant="default",size="default",children,asChild=false,...props},ref){
  const classes=[variants[variant]||variants.default,sizes[size]||"",className].filter(Boolean).join(" ");
  if(asChild){
    const child=Children.only(children);
    if(!isValidElement(child)) throw new Error("Button asChild requires exactly one React element.");
    // Match shadcn-style composition: navigation links stay links, not buttons
    // containing other interactive elements.
    return cloneElement(child,{
      ...props,
      ...child.props,
      className:[classes,child.props.className].filter(Boolean).join(" "),
      ref
    });
  }
  return <button ref={ref} className={classes} {...props}>{children}</button>;
});
