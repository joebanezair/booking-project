import { forwardRef } from "react";
const variants={default:"ui-button ui-button-default",secondary:"ui-button ui-button-secondary",destructive:"ui-button ui-button-destructive",ghost:"ui-button ui-button-ghost",outline:"ui-button ui-button-outline"};
const sizes={default:"",sm:"ui-button-sm",lg:"ui-button-lg",icon:"ui-button-icon"};
export const Button=forwardRef(function Button({className="",variant="default",size="default",children,...props},ref){return <button ref={ref} className={[variants[variant]||variants.default,sizes[size]||"",className].filter(Boolean).join(" ")} {...props}>{children}</button>;});
