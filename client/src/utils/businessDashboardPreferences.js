export const businessWidgetGroups = [
  { title: "Getting started", widgets: [["setupChecklist", "Business setup checklist"]] },
  { title: "Key metrics", widgets: [
    ["statSales", "This month's sales"], ["statCompleted", "Completed services"],
    ["statAverage", "Average sale"], ["statServices", "Services sold"]
  ] },
  { title: "Analytics", widgets: [
    ["salesOverview", "Sales overview"], ["serviceStatus", "Service status"],
    ["topServices", "Top services"]
  ] },
  { title: "Quick access", widgets: [
    ["quickServices", "Services"], ["quickBookings", "Bookings"], ["quickProducts", "Products"],
    ["quickSales", "Sales & analytics"], ["quickMessages", "Messages"],
    ["quickProfile", "Business profile"], ["quickSearch", "Search"]
  ] }
];

export const businessDashboardPreferenceKey = user =>
  `bookflow:business-dashboard:v1:${user?._id || user?.id || user?.email || "account"}`;

export const defaultBusinessWidgets = () => Object.fromEntries(
  businessWidgetGroups.flatMap(group => group.widgets.map(([key]) => [key, true]))
);

export function normalizeBusinessWidgets(value) {
  const defaults = defaultBusinessWidgets();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  return Object.fromEntries(Object.keys(defaults).map(key => [
    key,
    typeof value[key] === "boolean" ? value[key] : defaults[key]
  ]));
}

export function readBusinessWidgets(key) {
  try {
    if (typeof window === "undefined") return defaultBusinessWidgets();
    return normalizeBusinessWidgets(JSON.parse(window.localStorage.getItem(key) || "null"));
  } catch {
    // Browser storage may be unavailable; the caller can still use account preferences.
    return defaultBusinessWidgets();
  }
}
