import { forwardRef } from "react";

function part(tag, slot, base) {
  return forwardRef(function CardPart({ as: Tag = tag, className = "", ...props }, ref) {
    return <Tag ref={ref} data-slot={slot} className={[base, className].filter(Boolean).join(" ")} {...props} />;
  });
}
export const Card = part("div", "card", "ui-card");
export const CardHeader = part("div", "card-header", "ui-card-header");
export const CardTitle = part("h3", "card-title", "ui-card-title");
export const CardDescription = part("p", "card-description", "ui-card-description");
export const CardContent = part("div", "card-content", "ui-card-content");
export const CardFooter = part("div", "card-footer", "ui-card-footer");
