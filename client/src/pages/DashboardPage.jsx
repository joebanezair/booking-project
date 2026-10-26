
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiBarChart2, FiBriefcase, FiCalendar, FiCheckSquare, FiChevronDown, FiDollarSign, FiMessageSquare, FiPackage, FiPlus, FiRotateCcw, FiSave, FiSearch, FiSettings, FiStar, FiUser, FiUsers, FiX } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import BusinessSetupChecklist from "../components/BusinessSetupChecklist.jsx";
import DashboardAnalytics from "../components/DashboardAnalytics.jsx";
import { api } from "../api.js";
import { hasBusinessFeature } from "../featureAccess.js";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog.jsx";

const businessSections = [
  { title: "Services", text: "Create and manage your public, private, or draft services.", to: "/dashboard/services", action: "Manage services", icon: FiBriefcase, widgetKey: "quickServices", feature: "booking" },
  { title: "Bookings", text: "Manage guest booking requests and service status.", to: "/dashboard/bookings", action: "Manage bookings", icon: FiCalendar, widgetKey: "quickBookings", feature: "booking" },
  { title: "Products", text: "Manage products, inventory, pricing, and items available for sale.", to: "/dashboard/products", action: "Manage products", icon: FiPackage, widgetKey: "quickProducts", feature: "pos" },
  { title: "Sales & Analytics", text: "Track completed-service sales, trends, and spreadsheet reports.", to: "/dashboard/sales", action: "View sales", icon: FiBarChart2, widgetKey: "quickSales" },
  { title: "Messages", text: "Chat with other registered businesses and administrators.", to: "/dashboard/messages", action: "Open messages", icon: FiMessageSquare, widgetKey: "quickMessages" },
  { title: "Business profile", text: "Update your public profile, contact details, photos, and business information.", to: "/dashboard/profile", action: "Manage profile", icon: FiUser, widgetKey: "quickProfile" },
  { title: "Search", text: "Explore other businesses and public services.", to: "/search", action: "Browse BookFlow", icon: FiSearch, widgetKey: "quickSearch" }
];

const adminSections = [
  { title: "Businesses", text: "View registered businesses, activity, and account status.", to: "/dashboard/businesses", action: "Manage businesses", icon: FiUsers },
  { title: "Messages", text: "Communicate with registered businesses.", to: "/dashboard/messages", action: "Open messages", icon: FiMessageSquare },
  { title: "Search", text: "Inspect public business profiles and services.", to: "/search", action: "Browse BookFlow", icon: FiSearch },
  { title: "Settings", text: "Manage your administrator appearance settings.", to: "/dashboard/settings", action: "Open settings", icon: FiSettings }
];

function money(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

function PlatformMetric({ icon: Icon, label, value, note, className = "", title }) {
  return <div className={["business-admin-platform-metric", className].filter(Boolean).join(" ")} title={title}>
    <span className="business-admin-platform-icon"><Icon aria-hidden="true" /></span>
    <strong>{value ?? "—"}</strong>
    <span className="business-admin-platform-label">{label}</span>
    <small>{note}</small>
  </div>;
}

function BreakdownMetric({ label, value }) {
  return <div className="business-admin-breakdown-metric">
    <span>{label}</span>
    <strong>{value ?? "—"}</strong>
  </div>;
}

function formatRevenue(amount, currency = "PHP") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}


const metricGroups = [
  { title: "Main statistics", metrics: [
    ["revenue","Total platform revenue"],["products","Total products"],
    ["services","Total services"],["bookings","Total bookings"],
    ["reviews","Verified reviews"],["rating","Average rating"]
  ] },
  { title: "Booking status", metrics: [
    ["pending","Pending"],["confirmed","Confirmed"],["inProgress","In progress"],
    ["completed","Completed"],["cancelled","Cancelled"],["noShow","No-show"]
  ] },
  { title: "Sales and orders", metrics: [
    ["serviceSales","Service sales recorded"],["posSales","POS sales recorded"],
    ["onlineOrders","Online orders"],["completedOrders","Orders completed"]
  ] }
];
const businessWidgetGroups = [
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
const defaultBusinessWidgets = () => Object.fromEntries(
  businessWidgetGroups.flatMap(group => group.widgets.map(([key]) => [key, true]))
);
function readBusinessWidgets(key) {
  const defaults = defaultBusinessWidgets();
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaults;
    for (const widgetKey of Object.keys(defaults)) {
      if (typeof saved[widgetKey] === "boolean") defaults[widgetKey] = saved[widgetKey];
    }
  } catch { /* Browser storage may be disabled; preferences remain in memory. */ }
  return defaults;
}

const defaultVisibleMetrics = () => Object.fromEntries(metricGroups.flatMap(g => g.metrics.map(([key]) => [key, true])));
function readVisibleMetrics(key) {
  const value = defaultVisibleMetrics();
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return value;
    for (const metric of Object.keys(value)) if (typeof stored[metric] === "boolean") value[metric] = stored[metric];
  } catch { /* Session-only preference if browser storage is unavailable. */ }
  return value;
}

export default function DashboardPage({ user, onLogout }) {
  const isAdmin = user.role === "admin";
  const [overview, setOverview] = useState(null);
  const [businessSales, setBusinessSales] = useState(null);
  const [bookingSummary, setBookingSummary] = useState(null);
  const dashboardRange = "month";
  const [salesLoading, setSalesLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const [setup, setSetup] = useState({ profile: null, business: null, services: null });
  const [setupLoaded, setSetupLoaded] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [setupExpanded, setSetupExpanded] = useState(false);
  const visibilityKey = `bookflow:admin-metrics:v1:${user._id || user.id || user.email}`;
  const [visibleMetrics, setVisibleMetrics] = useState(() => readVisibleMetrics(visibilityKey));
  const [draftMetrics, setDraftMetrics] = useState(() => readVisibleMetrics(visibilityKey));
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // One expanded group at a time prevents metrics from being clipped by a nested scroll area.
  const [expandedMetricGroup, setExpandedMetricGroup] = useState("Main statistics");
  const businessWidgetKey = `bookflow:business-dashboard:v1:${user._id || user.id || user.email}`;
  const [visibleBusinessWidgets, setVisibleBusinessWidgets] = useState(() => readBusinessWidgets(businessWidgetKey));
  const [draftBusinessWidgets, setDraftBusinessWidgets] = useState(() => readBusinessWidgets(businessWidgetKey));
  const [businessCustomizeOpen, setBusinessCustomizeOpen] = useState(false);
  const [expandedBusinessGroups, setExpandedBusinessGroups] = useState({ "Key metrics": true });
  const sections = isAdmin ? adminSections : businessSections.filter(section =>
    (!section.feature || hasBusinessFeature(user, section.feature)) &&
    visibleBusinessWidgets[section.widgetKey] !== false
  );
  useEffect(() => {
    const stored = readBusinessWidgets(businessWidgetKey);
    setVisibleBusinessWidgets(stored);
    setDraftBusinessWidgets(stored);
    setBusinessCustomizeOpen(false);
  }, [businessWidgetKey]);
  function openBusinessCustomize() {
    setDraftBusinessWidgets({ ...visibleBusinessWidgets });
    setExpandedBusinessGroups({ "Key metrics": true });
    setBusinessCustomizeOpen(true);
  }
  function saveBusinessCustomize() {
    setVisibleBusinessWidgets({ ...draftBusinessWidgets });
    try { window.localStorage.setItem(businessWidgetKey, JSON.stringify(draftBusinessWidgets)); }
    catch { /* Keep browser-session preference when storage is unavailable. */ }
    setBusinessCustomizeOpen(false);
  }
  useEffect(() => {
    const saved = readVisibleMetrics(visibilityKey);
    setVisibleMetrics(saved);
    setDraftMetrics(saved);
    setCustomizeOpen(false);
  }, [visibilityKey]);
  function saveMetrics() {
    setVisibleMetrics({ ...draftMetrics });
    try { window.localStorage.setItem(visibilityKey, JSON.stringify(draftMetrics)); }
    catch { /* The customization still works for this browser session. */ }
    setCustomizeOpen(false);
  }
  function openMetricsDialog() {
    setDraftMetrics({ ...visibleMetrics });
    setExpandedMetricGroup("Main statistics");
    setCustomizeOpen(true);
  }

  useEffect(() => {
    if (isAdmin) {
      api.admin.overview().then(setOverview).catch(error => setOverviewError(error.message));
      return;
    }
    let current = true;
    Promise.all([api.profile.get(), api.business.mine(), api.content.list()])
      .then(([profile, business, services]) => {
        if (current) setSetup({ profile, business, services });
      })
      .catch(() => {})
      .finally(() => { if (current) setSetupLoaded(true); });
    return () => { current = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    let active = true;
    const params = { range: dashboardRange, group: dashboardRange === "year" || dashboardRange === "all" ? "monthly" : dashboardRange === "month" ? "weekly" : "daily", offset: new Date().getTimezoneOffset() };
    setSalesLoading(true);
    setStatusLoading(true);
    api.sales.analytics(params).then(data => {
      if (active) { setBusinessSales(data); setOverviewError(""); }
    }).catch(error => { if (active) { setBusinessSales(null); setOverviewError(error.message); } })
      .finally(() => { if (active) setSalesLoading(false); });
    api.bookings.statusSummary({ range: dashboardRange, offset: params.offset }).then(data => {
      if (active) setBookingSummary(data);
    }).catch(() => { if (active) setBookingSummary(null); })
      .finally(() => { if (active) setStatusLoading(false); });
    return () => { active = false; };
  }, [dashboardRange, isAdmin]);

  const onboarding = !isAdmin ? [
    { label: "Business account created", description: "Your business account is ready.", done: true, to: "/dashboard/profile" },
    { label: "Complete your Business Page", description: "Add contact details and business information.", done: Boolean(setup.business?.description && setup.business?.location && setup.business?.phone), to: "/dashboard/profile/business" },
    { label: "Add profile and cover photos", description: "Make your profile look professional.", done: Boolean(setup.profile?.profileImage && setup.profile?.coverImage), to: "/dashboard/profile/edit" },
    { label: "Set your working availability", description: "Let customers know when you're available.", done: Boolean(setup.business?.workingHours?.some(row => row.enabled)), to: "/dashboard/profile/business" },
    { label: "Create your first service", description: "Add a service with pricing and details.", done: Boolean(setup.services?.length), to: "/dashboard/services/new" },
    { label: "Publish a bookable service", description: "Make your service available to customers.", done: Boolean(setup.services?.some(service => service.published && service.allowBookings !== false)), to: "/dashboard/services" },
    { label: "Share your booking link or QR", description: "Help customers book your services.", done: Boolean(localStorage.getItem("bookflow_booking_shared")), to: "/dashboard/profile" }
  ] : [];

  // Once all seven real onboarding checks pass, the setup card no longer
  // belongs on the dashboard. Wait for the data to load to avoid briefly
  // flashing an incomplete checklist for a fully configured business.
  const setupComplete = onboarding.length > 0 && onboarding.every(step => step.done);
  const revenueRows = Array.isArray(overview?.revenue?.totalsByCurrency) ? overview.revenue.totalsByCurrency : null;
  const revenueDisplay = revenueRows === null ? "—"
    : revenueRows.length === 0 ? formatRevenue(0, "PHP")
    : revenueRows.length === 1 ? formatRevenue(revenueRows[0].gross, revenueRows[0].currency)
    : "By currency";
  const revenueBreakdown = revenueRows?.map(row => formatRevenue(row.gross, row.currency)).join(" · ");
  const mainVisible = metricGroups[0].metrics.some(([key]) => visibleMetrics[key]);
  const bookingsVisible = metricGroups[1].metrics.some(([key]) => visibleMetrics[key]);
  const salesVisible = metricGroups[2].metrics.some(([key]) => visibleMetrics[key]);
  // The modal displays the same database-backed values as the administrator dashboard.
  // A hidden statistic still shows its current value here; visibility is presentation-only.
  const countText = value => typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-PH") : "—";
  const metricValues = {
    revenue: revenueRows?.length > 1 ? revenueBreakdown : revenueDisplay,
    products: countText(overview?.products?.total),
    services: countText(overview?.services?.total),
    bookings: countText(overview?.bookings?.total),
    reviews: countText(overview?.reviews?.verified),
    rating: typeof overview?.reviews?.averageRating === "number"
      ? `${overview.reviews.averageRating.toFixed(1)} / 5` : "—",
    pending: countText(overview?.bookings?.pending),
    confirmed: countText(overview?.bookings?.confirmed),
    inProgress: countText(overview?.bookings?.inProgress),
    completed: countText(overview?.bookings?.completed),
    cancelled: countText(overview?.bookings?.cancelled),
    noShow: countText(overview?.bookings?.noShow),
    serviceSales: countText(overview?.sales?.recorded),
    posSales: countText(overview?.sales?.posRecorded),
    onlineOrders: countText(overview?.sales?.onlineOrders),
    completedOrders: countText(overview?.sales?.completedOnlineOrders)
  };

  const businessSummary = businessSales?.summary;
  const liveBusinessValues = {
    setupChecklist: setupLoaded ? (setupComplete ? "Complete" : `${onboarding.filter(item => item.done).length}/${onboarding.length} done`) : "Loading…",
    statSales: businessSummary ? money(businessSummary.totalSales, businessSales?.primaryCurrency || "PHP") : salesLoading ? "Loading…" : "—",
    statCompleted: businessSummary?.completedServices ?? (salesLoading ? "Loading…" : "—"),
    statAverage: businessSummary ? money(businessSummary.averageSale, businessSales?.primaryCurrency || "PHP") : salesLoading ? "Loading…" : "—",
    statServices: businessSummary?.servicesSold ?? (salesLoading ? "Loading…" : "—"),
    salesOverview: "Chart",
    serviceStatus: statusLoading ? "Loading…" : `${bookingSummary?.total ?? 0} bookings`,
    topServices: "Top 5"
  };
  const businessWidgetCount = Object.values(visibleBusinessWidgets).filter(Boolean).length;
  const businessWidgetTotal = businessWidgetGroups.reduce((count, group) => count + group.widgets.length, 0);
  const draftBusinessWidgetCount = Object.values(draftBusinessWidgets).filter(Boolean).length;
  const businessAnalyticsVisible = businessWidgetGroups[1].widgets.concat(businessWidgetGroups[2].widgets)
    .some(([key]) => visibleBusinessWidgets[key] !== false);
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div>
        <p className="eyebrow">{isAdmin ? "ADMIN DASHBOARD" : "BUSINESS DASHBOARD"}</p>
        <h1>Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="muted">{isAdmin ? "Manage businesses and monitor platform activity." : user.accountStatus === "paused" ? "Your account is paused. Existing data remains available while new publishing and bookings are disabled." : "Manage services, bookings, recorded sales, messages, reviews, and your public profile."}</p>
      </div>
      {!isAdmin && <div className="business-dashboard-header-actions">
        <Button type="button" size="sm" variant="outline"
          className="business-dashboard-customize-button" aria-haspopup="dialog"
          onClick={openBusinessCustomize}>
          <FiSettings aria-hidden="true" /> Customize
        </Button>
        {user.accountStatus === "active" && hasBusinessFeature(user, "booking") &&
          <Button asChild variant="secondary">
            <Link className="secondary button-link icon-link dashboard-post-service" to="/dashboard/services/new">
              <FiPlus aria-hidden="true" /> Post a service
            </Link>
          </Button>}
      </div>}
    </header>

    <div className="dashboard-content-rail">
      {overviewError && <p className="error">{overviewError}</p>}

      {isAdmin && <div className="business-admin-page admin-dashboard-platform">
      <section className="business-admin-activity" aria-labelledby="platform-activity-title" aria-busy={!overview && !overviewError}>
        <div className="business-admin-activity-heading">
          <div>
            <h2 id="platform-activity-title">Platform statistics</h2>
            <p>All registered businesses · lifetime totals</p>
          </div>
          <div className="admin-stats-heading-actions">
            <span aria-live="polite" className="business-admin-activity-updated">
              {overview?.generatedAt ? `Updated ${new Date(overview.generatedAt).toLocaleString()}` : !overviewError ? "Loading live totals…" : "Statistics unavailable"}
            </span>
            <Button type="button" size="sm" variant="outline" className="admin-stats-customize-button"
              onClick={openMetricsDialog} aria-haspopup="dialog">
              <FiSettings aria-hidden="true" /> Customize
            </Button>
          </div>
        </div>
        {mainVisible && <div className="business-admin-platform-grid">
          {visibleMetrics.revenue && <PlatformMetric icon={FiDollarSign} label="Total platform revenue"
            value={revenueDisplay}
            note={revenueRows === null ? "Revenue unavailable" : revenueRows.length > 1
              ? revenueBreakdown : "Gross sales · not platform fees"}
            className="business-admin-platform-metric--revenue"
            title="Gross recorded service and POS sales plus completed online order value; excludes voided and fully refunded orders. Not verified payments or platform commissions." />}
          {visibleMetrics.products && <PlatformMetric icon={FiPackage} label="Total products"
            value={overview?.products?.total}
            note={overview ? `${overview.products.published} published` : "—"} />}
          {visibleMetrics.services && <PlatformMetric icon={FiBriefcase} label="Total services"
            value={overview?.services?.total}
            note={overview ? `${overview.services.published} published` : "—"} />}
          {visibleMetrics.bookings && <PlatformMetric icon={FiCalendar} label="Total bookings"
            value={overview?.bookings?.total}
            note="All booking statuses" />}
          {visibleMetrics.reviews && <PlatformMetric icon={FiStar} label="Verified reviews"
            value={overview?.reviews?.verified}
            note="Submitted and verified" />}
          {visibleMetrics.rating && <PlatformMetric icon={FiStar} label="Average rating"
            value={overview?.reviews?.averageRating != null ? `${overview.reviews.averageRating.toFixed(1)} / 5` : "—"}
            note={overview ? `${overview.reviews.ratingsCount} verified ratings` : "—"} />}
        </div>}
        {(bookingsVisible || salesVisible) && <div className={"business-admin-breakdowns" + (bookingsVisible !== salesVisible ? " business-admin-breakdowns--single" : "")}>
          {bookingsVisible && <div className="business-admin-breakdown-group">
            <h3>Booking status</h3>
            <div className="business-admin-breakdown-grid">
              {visibleMetrics.pending && <BreakdownMetric label="Pending" value={overview?.bookings?.pending} />}
              {visibleMetrics.confirmed && <BreakdownMetric label="Confirmed" value={overview?.bookings?.confirmed} />}
              {visibleMetrics.inProgress && <BreakdownMetric label="In progress" value={overview?.bookings?.inProgress} />}
              {visibleMetrics.completed && <BreakdownMetric label="Completed" value={overview?.bookings?.completed} />}
              {visibleMetrics.cancelled && <BreakdownMetric label="Cancelled" value={overview?.bookings?.cancelled} />}
              {visibleMetrics.noShow && <BreakdownMetric label="No-show" value={overview?.bookings?.noShow} />}
            </div>
          </div>}
          {salesVisible && <div className="business-admin-breakdown-group">
            <h3>Sales and orders</h3>
            <div className="business-admin-breakdown-grid">
              {visibleMetrics.serviceSales && <BreakdownMetric label="Service sales recorded" value={overview?.sales?.recorded} />}
              {visibleMetrics.posSales && <BreakdownMetric label="POS sales recorded" value={overview?.sales?.posRecorded} />}
              {visibleMetrics.onlineOrders && <BreakdownMetric label="Online orders" value={overview?.sales?.onlineOrders} />}
              {visibleMetrics.completedOrders && <BreakdownMetric label="Orders completed" value={overview?.sales?.completedOnlineOrders} />}
            </div>
          </div>}
        </div>}
        {!mainVisible && !bookingsVisible && !salesVisible &&
          <p className="admin-stats-empty">No statistics selected. Click Customize to choose what appears here.</p>}
      </section>
      </div>}

      {isAdmin && <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen} className="admin-stats-dialog"
        title="Customize platform statistics">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize statistics</DialogTitle>
            <DialogDescription>Select which statistics appear on your Dashboard. Unchecking hides a number; it never deletes data.</DialogDescription>
          </DialogHeader>
          <div className="admin-stats-checklist">
            {metricGroups.map(group => {
              const groupId = `admin-stats-${group.title.toLowerCase().replaceAll(" ", "-")}`;
              const expanded = expandedMetricGroup === group.title;
              const checkedCount = group.metrics.filter(([key]) => draftMetrics[key] !== false).length;
              return <section key={group.title} className="admin-stats-table-section" aria-label={group.title}>
                <button type="button" className="admin-stats-group-trigger"
                  aria-expanded={expanded} aria-controls={groupId}
                  onClick={() => setExpandedMetricGroup(current => current === group.title ? null : group.title)}>
                  <span className="admin-stats-group-heading">{group.title}</span>
                  <span className="admin-stats-group-count">{checkedCount}/{group.metrics.length} shown</span>
                  <FiChevronDown aria-hidden="true" className={expanded ? "is-expanded" : ""} />
                </button>
                <div id={groupId} className="admin-stats-table-wrap" hidden={!expanded}>
                  <table className="admin-stats-table">
                    <thead className="admin-stats-sr-only">
                      <tr>
                        <th scope="col">Show statistic</th>
                        <th scope="col">Current value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.metrics.map(([key, label]) => <tr key={key}>
                        <th scope="row" className="admin-stats-row-name">
                          <label htmlFor={`admin-stat-show-${key}`} className="admin-stats-metric-option">
                            <input type="checkbox" id={`admin-stat-show-${key}`}
                              aria-label={`Show ${label}`}
                              checked={draftMetrics[key] !== false}
                              onChange={event => setDraftMetrics(current => ({ ...current, [key]: event.target.checked }))} />
                            <span>{label}</span>
                          </label>
                        </th>
                        <td className="admin-stats-metric-value" title={String(metricValues[key] ?? "—")}>
                          {metricValues[key] ?? "—"}
                        </td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </section>;
            })}
          </div>
          <DialogFooter className="admin-stats-checklist-footer">
            <div className="admin-stats-checklist-helpers">
              <Button type="button" variant="ghost" size="sm"
                onClick={() => setDraftMetrics(defaultVisibleMetrics())}>
                <FiCheckSquare aria-hidden="true" /> Select all
              </Button>
              <Button type="button" variant="ghost" size="sm"
                onClick={() => setDraftMetrics({ ...visibleMetrics })}>
                <FiRotateCcw aria-hidden="true" /> Reset changes
              </Button>
            </div>
            <div className="admin-stats-checklist-actions">
              <Button type="button" variant="outline" size="sm"
                onClick={() => setCustomizeOpen(false)}>
                <FiX aria-hidden="true" /> Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveMetrics}>
                <FiSave aria-hidden="true" /> Save changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

      {!isAdmin && <Dialog open={businessCustomizeOpen} onOpenChange={setBusinessCustomizeOpen}
        className="business-dashboard-dialog" title="Customize business dashboard">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize dashboard</DialogTitle>
            <DialogDescription>Show only what matters to you. Hidden items can be restored anytime.</DialogDescription>
          </DialogHeader>
          <div className="business-dashboard-widget-summary" aria-live="polite">
            <span><strong>{draftBusinessWidgetCount}</strong> of {businessWidgetTotal} widgets selected</span>
            <span>Changes apply when saved</span>
          </div>
          <div className="business-dashboard-widget-list">
            {businessWidgetGroups.map(group => {
              const id = `business-widget-${group.title.toLowerCase().replaceAll(" ", "-")}`;
              const expanded = Boolean(expandedBusinessGroups[group.title]);
              const shown = group.widgets.filter(([key]) => draftBusinessWidgets[key] !== false).length;
              return <section className="business-dashboard-widget-group" key={group.title}>
                <button className="business-dashboard-widget-trigger" type="button"
                  aria-controls={id} aria-expanded={expanded}
                  onClick={() => setExpandedBusinessGroups(current => ({
                    ...current, [group.title]: !current[group.title]
                  }))}>
                  <span>{group.title}</span>
                  <span className="business-dashboard-widget-count">{shown} / {group.widgets.length}</span>
                  <FiChevronDown className={expanded ? "is-expanded" : ""} aria-hidden="true" />
                </button>
                <div id={id} className="business-dashboard-widget-rows" hidden={!expanded}>
                  {group.widgets.map(([key, label]) => {
                    const related = businessSections.find(item => item.widgetKey === key);
                    const value = related?.feature && !hasBusinessFeature(user, related.feature)
                      ? "Plan inactive" : (liveBusinessValues[key] ?? "Shortcut");
                    return <label className="business-dashboard-widget-row" key={key}>
                      <span className="business-dashboard-widget-name">
                        <input type="checkbox"
                          checked={draftBusinessWidgets[key] !== false}
                          onChange={event => setDraftBusinessWidgets(current => ({ ...current, [key]: event.target.checked }))}
                          aria-label={`Show ${label}`} />
                        <span>{label}</span>
                      </span>
                      <span className="business-dashboard-widget-value" title={String(value)}>{value}</span>
                    </label>;
                  })}
                </div>
              </section>;
            })}
          </div>
          <DialogFooter className="business-dashboard-widget-footer">
            <div className="business-dashboard-widget-helpers">
              <Button type="button" variant="ghost" size="sm"
                onClick={() => setDraftBusinessWidgets(defaultBusinessWidgets())}>
                <FiCheckSquare aria-hidden="true" /> Select all
              </Button>
              <Button type="button" variant="ghost" size="sm"
                onClick={() => setDraftBusinessWidgets({ ...visibleBusinessWidgets })}>
                <FiRotateCcw aria-hidden="true" /> Undo changes
              </Button>
            </div>
            <div className="business-dashboard-widget-actions">
              <Button type="button" variant="outline" size="sm" onClick={() => setBusinessCustomizeOpen(false)}>
                <FiX aria-hidden="true" /> Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveBusinessCustomize}>
                <FiSave aria-hidden="true" /> Save changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

            {!isAdmin && visibleBusinessWidgets.setupChecklist !== false && setupLoaded && !setupComplete && <BusinessSetupChecklist
        items={onboarding}
        expanded={setupExpanded}
        onToggle={() => setSetupExpanded(value => !value)}
      />}

      {!isAdmin && businessAnalyticsVisible && <DashboardAnalytics
        visibility={visibleBusinessWidgets}
        data={businessSales}
        statusSummary={bookingSummary}
        range={dashboardRange}
        loading={salesLoading}
        statusLoading={statusLoading}
      />}

      {(isAdmin || sections.length > 0) && <section className={"dashboard-route-section" + (isAdmin ? " dashboard-route-section--admin" : "")}>
        <div className="dashboard-section-heading">
          <div>
            <p className="eyebrow">QUICK ACCESS</p>
            <h2>{isAdmin ? "Administration" : "Manage your business"}</h2>
            <p className="muted">{isAdmin ? "Your platform tools, all in one place." : "Jump straight to the tools you use most."}</p>
          </div>
        </div>
        <section className="dashboard-route-grid">
          {sections.map(({ icon: Icon, ...section }) => isAdmin ? (
            <Card as={Link} to={section.to} className="dashboard-shadcn-card admin-tool-link" key={section.to}
              aria-label={section.action}>
              <CardHeader className="dashboard-shadcn-card-header">
                <span className="route-card-icon"><Icon aria-hidden="true" /></span>
                <div>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.text}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ) : (
            <Card className="dashboard-shadcn-card" key={section.to}>
              <CardHeader className="dashboard-shadcn-card-header">
                <span className="route-card-icon"><Icon aria-hidden="true" /></span>
                <div>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.text}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="dashboard-shadcn-card-content">
                <Button asChild variant="outline" size="sm">
                  <Link to={section.to} aria-label={section.action}>{section.action}<FiArrowRight aria-hidden="true" /></Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </section>}
      {!isAdmin && businessWidgetCount === 0 && <div className="business-dashboard-all-hidden">
        <FiSettings aria-hidden="true" />
        <strong>Your dashboard is customized</strong>
        <p>No sections are selected. Use Customize to choose what you want to see.</p>
        <Button size="sm" variant="outline" type="button" onClick={openBusinessCustomize}>Customize dashboard</Button>
      </div>}
    </div>
  </AppLayout>;
}
