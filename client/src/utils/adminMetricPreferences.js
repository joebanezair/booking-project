// Shared administrator metric visibility settings for Dashboard and Settings.
export const metricGroups = [
  { title: "Main statistics", metrics: [
    ["revenue", "Total platform revenue"], ["products", "Total products"],
    ["services", "Total services"], ["bookings", "Total bookings"],
    ["reviews", "Verified reviews"], ["rating", "Average rating"]
  ] },
  { title: "Booking status", metrics: [
    ["pending", "Pending"], ["confirmed", "Confirmed"], ["inProgress", "In progress"],
    ["completed", "Completed"], ["cancelled", "Cancelled"], ["noShow", "No-show"]
  ] },
  { title: "Sales and orders", metrics: [
    ["serviceSales", "Service sales recorded"], ["posSales", "POS sales recorded"],
    ["onlineOrders", "Online orders"], ["completedOrders", "Orders completed"]
  ] }
];

export const defaultVisibleMetrics = () =>
  Object.fromEntries(metricGroups.flatMap(group => group.metrics.map(([key]) => [key, true])));

export function normalizeVisibleMetrics(saved) {
  const metrics = defaultVisibleMetrics();
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return metrics;
  for (const key of Object.keys(metrics)) {
    if (typeof saved[key] === "boolean") metrics[key] = saved[key];
  }
  return metrics;
}

export function adminMetricsKey(user) {
  return `bookflow:admin-metrics:v1:${user._id || user.id || user.email}`;
}

export function readVisibleMetrics(key) {
  try {
    return normalizeVisibleMetrics(JSON.parse(window.localStorage.getItem(key) || "null"));
  } catch {
    return defaultVisibleMetrics();
  }
}

// Display current server-backed totals in the Settings visibility checklist.
export function adminMetricValues(overview) {
  const count = value => typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-PH") : "—";
  const currency = (amount, code = "PHP") => {
    if (!Number.isFinite(Number(amount))) return "—";
    try {
      return new Intl.NumberFormat("en-PH", {
        style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2
      }).format(Number(amount));
    } catch {
      return `${code} ${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };
  const revenues = Array.isArray(overview?.revenue?.totalsByCurrency)
    ? overview.revenue.totalsByCurrency : null;
  const gross = revenues === null ? "—"
    : revenues.length === 0 ? currency(0)
    : revenues.map(row => currency(row.gross, row.currency)).join(" · ");
  return {
    revenue: gross,
    products: count(overview?.products?.total),
    services: count(overview?.services?.total),
    bookings: count(overview?.bookings?.total),
    reviews: count(overview?.reviews?.verified),
    rating: typeof overview?.reviews?.averageRating === "number"
      ? `${overview.reviews.averageRating.toFixed(1)} / 5` : "—",
    pending: count(overview?.bookings?.pending),
    confirmed: count(overview?.bookings?.confirmed),
    inProgress: count(overview?.bookings?.inProgress),
    completed: count(overview?.bookings?.completed),
    cancelled: count(overview?.bookings?.cancelled),
    noShow: count(overview?.bookings?.noShow),
    serviceSales: count(overview?.sales?.recorded),
    posSales: count(overview?.sales?.posRecorded),
    onlineOrders: count(overview?.sales?.onlineOrders),
    completedOrders: count(overview?.sales?.completedOnlineOrders)
  };
}
