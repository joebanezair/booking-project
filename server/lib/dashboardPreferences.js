// Dashboard visibility is account-specific. Only known boolean keys may be stored.
export const DASHBOARD_PREFERENCE_KEYS = Object.freeze({
  businessWidgets: Object.freeze([
    "setupChecklist", "statSales", "statCompleted", "statAverage", "statServices",
    "salesOverview", "serviceStatus", "topServices", "quickServices", "quickBookings",
    "workspaceTopbar", "quickProducts", "quickSales", "quickMessages", "quickProfile", "quickSearch"
  ]),
  adminMetrics: Object.freeze([
    "revenue", "products", "services", "bookings", "reviews", "rating",
    "pending", "confirmed", "inProgress", "completed", "cancelled", "noShow",
    "serviceSales", "posSales", "onlineOrders", "completedOrders"
  ])
});

export function normalizeDashboardPreferences(kind, input) {
  if (!Object.hasOwn(DASHBOARD_PREFERENCE_KEYS, kind)) return null;
  const allowed = DASHBOARD_PREFERENCE_KEYS[kind];
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const allowedKeys = new Set(allowed);
  if (Object.entries(input).some(([key, value]) => !allowedKeys.has(key) || typeof value !== "boolean")) return null;
  return Object.fromEntries(allowed.map(key => [key, input[key] !== false]));
}
