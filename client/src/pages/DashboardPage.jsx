
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiBarChart2, FiBriefcase, FiCalendar, FiChevronRight, FiDollarSign, FiInfo, FiMessageSquare, FiPackage, FiPlus, FiSearch, FiSettings, FiStar, FiUser, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import BusinessSetupChecklist from "../components/BusinessSetupChecklist.jsx";
import DashboardAnalytics from "../components/DashboardAnalytics.jsx";
import { api } from "../api.js";
import { hasBusinessFeature } from "../featureAccess.js";
import { Button } from "../components/ui/button.jsx";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { adminMetricsKey, defaultVisibleMetrics, metricGroups, normalizeVisibleMetrics, readVisibleMetrics } from "../utils/adminMetricPreferences.js";
import { businessDashboardPreferenceKey, businessWidgetGroups, defaultBusinessWidgets, normalizeBusinessWidgets, readBusinessWidgets } from "../utils/businessDashboardPreferences.js";

const businessSections = [
  { title: "Services", text: "Create and manage your services.", to: "/dashboard/services", action: "Manage services", icon: FiBriefcase, widgetKey: "quickServices", feature: "booking", countKey: "services" },
  { title: "Bookings", text: "Manage booking requests and status.", to: "/dashboard/bookings", action: "Manage bookings", icon: FiCalendar, widgetKey: "quickBookings", feature: "booking", countKey: "bookings" },
  { title: "Products", text: "Manage products, pricing and inventory.", to: "/dashboard/products", action: "Manage products", icon: FiPackage, widgetKey: "quickProducts", feature: "pos", countKey: "products" },
  { title: "Sales & Analytics", text: "Track sales, revenue and reports.", to: "/dashboard/sales", action: "View sales", icon: FiBarChart2, widgetKey: "quickSales" },
  { title: "Messages", text: "Chat with businesses and administrators.", to: "/dashboard/messages", action: "Open messages", icon: FiMessageSquare, widgetKey: "quickMessages", countKey: "messages" },
  { title: "Business profile", text: "Update your public business information.", to: "/dashboard/profile", action: "Manage profile", icon: FiUser, widgetKey: "quickProfile" },
  { title: "Search", text: "Explore businesses and public services.", to: "/search", action: "Browse BookFlow", icon: FiSearch, widgetKey: "quickSearch" }
];

const adminSections = [
  { title: "Businesses", text: "View registered businesses, activity, and account status.", to: "/dashboard/businesses", action: "Manage businesses", icon: FiUsers },
  { title: "Messages", text: "Communicate with registered businesses.", to: "/dashboard/messages", action: "Open messages", icon: FiMessageSquare },
  { title: "Search", text: "Inspect public business profiles and services.", to: "/search", action: "Browse BookFlow", icon: FiSearch },
  { title: "Settings", text: "Manage your administrator appearance settings.", to: "/dashboard/settings", action: "Open settings", icon: FiSettings }
];

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
  const visibilityKey = adminMetricsKey(user);
  const [visibleMetrics, setVisibleMetrics] = useState(() => readVisibleMetrics(visibilityKey));
  const businessWidgetKey = businessDashboardPreferenceKey(user);
  const [visibleBusinessWidgets, setVisibleBusinessWidgets] = useState(() => readBusinessWidgets(businessWidgetKey));
  const [quickAccessCounts, setQuickAccessCounts] = useState(null);
  useEffect(() => {
    if (isAdmin) return;
    let active = true;
    setQuickAccessCounts(null);
    api.business.quickAccessCounts()
      .then(counts => { if (active) setQuickAccessCounts(counts); })
      .catch(() => { if (active) setQuickAccessCounts(null); });
    return () => { active = false; };
  }, [isAdmin, user._id, user.id, user.email]);
  const sections = isAdmin ? adminSections : businessSections.filter(section =>
    (!section.feature || hasBusinessFeature(user, section.feature)) &&
    visibleBusinessWidgets[section.widgetKey] !== false
  );
  useEffect(() => {
    let active = true;
    const localBusiness = readBusinessWidgets(businessWidgetKey);
    const localMetrics = readVisibleMetrics(visibilityKey);
    const kind = isAdmin ? "adminMetrics" : "businessWidgets";
    const storageKey = isAdmin ? visibilityKey : businessWidgetKey;
    const localPreferences = isAdmin ? localMetrics : localBusiness;
    const originalToken = window.localStorage.getItem("booking_token");
    setVisibleBusinessWidgets(localBusiness);
    setVisibleMetrics(localMetrics);

    async function loadPreferences() {
      try {
        const remote = await api.profile.getDashboardPreferences();
        if (!active || originalToken !== window.localStorage.getItem("booking_token")) return;
        if (remote[kind] && typeof remote[kind] === "object" && !Array.isArray(remote[kind])) {
          const defaults = isAdmin ? defaultVisibleMetrics() : defaultBusinessWidgets();
          const stored = Object.fromEntries(Object.keys(defaults).map(key =>
            [key, typeof remote[kind][key] === "boolean" ? remote[kind][key] : defaults[key]]
          ));
          if (isAdmin) setVisibleMetrics(normalizeVisibleMetrics(stored));
          else setVisibleBusinessWidgets(normalizeBusinessWidgets(stored));
          try { window.localStorage.setItem(storageKey, JSON.stringify(stored)); }
          catch { /* Database values remain the source of truth. */ }
        } else {
          // Import older browser-only settings once, then use the database on future sign-ins.
          let hasLocalSettings = false;
          try { hasLocalSettings = window.localStorage.getItem(storageKey) !== null; }
          catch { /* No browser storage available. */ }
          if (hasLocalSettings) await api.profile.saveDashboardPreferences(kind, localPreferences);
        }
      } catch {
        // Keep locally saved preferences when the account API is temporarily unavailable.
      }
    }
    loadPreferences();
    return () => { active = false; };
  }, [businessWidgetKey, visibilityKey, isAdmin]);
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
  const businessWidgetCount = Object.values(visibleBusinessWidgets).filter(Boolean).length;
  const businessAnalyticsVisible = businessWidgetGroups[1].widgets.concat(businessWidgetGroups[2].widgets)
    .some(([key]) => visibleBusinessWidgets[key] !== false);
  return <AppLayout user={user} onLogout={onLogout}>
    <header className={isAdmin ? "topbar" : undefined}>
      <div>
        <p className={isAdmin ? "eyebrow" : undefined}>{isAdmin ? "ADMIN DASHBOARD" : "BUSINESS DASHBOARD"}</p>
        <h1>{isAdmin ? `Welcome back, ${user.name.split(" ")[0]}` : `Welcome ${user.name.split(" ")[0]}`}</h1>
        <p className={isAdmin ? "muted" : undefined}>{isAdmin ? "Manage businesses and monitor platform activity." : user.accountStatus === "paused" ? "Your account is paused. Existing data remains available while new publishing and bookings are disabled." : "Manage services, bookings, recorded sales, messages, reviews, and your public profile."}</p>
      </div>
      {!isAdmin && user.accountStatus === "active" && hasBusinessFeature(user, "booking") &&
        <div>
          <Button asChild variant="secondary">
            <Link to="/dashboard/services/new">
              <FiPlus aria-hidden="true" /> Post a service
            </Link>
          </Button>
        </div>}
    </header>

    <div className={isAdmin ? "dashboard-content-rail" : undefined}>
      {overviewError && <p className={isAdmin ? "error" : undefined}>{overviewError}</p>}

      {!isAdmin && user.accountStatus === "active" &&
        (!hasBusinessFeature(user, "booking") || !hasBusinessFeature(user, "pos")) && <section role="status">
          <span><FiInfo aria-hidden="true"/></span>
          <div>
            <strong>Feature activation required</strong>
            <p>
              {[
                !hasBusinessFeature(user, "booking") ? "Bookings" : "",
                !hasBusinessFeature(user, "pos") ? "POS" : ""
              ].filter(Boolean).join(" and ")} {(!hasBusinessFeature(user, "booking") && !hasBusinessFeature(user, "pos")) ? "are" : "is"} not enabled on your account yet.
              Contact a BookFlow administrator to request activation.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/messages">Contact administrator</Link>
          </Button>
        </section>}

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
          <p className="admin-stats-empty">No statistics selected. Choose which statistics to show in <Link to="/dashboard/settings">Settings</Link>.</p>}
      </section>
      </div>}

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

      {(isAdmin || sections.length > 0) && <section className={isAdmin ? "dashboard-route-section dashboard-route-section--admin" : undefined}>
        <div className={isAdmin ? "dashboard-section-heading" : undefined}>
          <div>
            <p className={isAdmin ? "eyebrow" : undefined}>QUICK ACCESS</p>
            <h2>{isAdmin ? "Administration" : "Manage your business"}</h2>
            <p className={isAdmin ? "muted" : undefined}>{isAdmin ? "Your platform tools, all in one place." : "Jump straight to the tools you use most."}</p>
          </div>
        </div>
        <section className={isAdmin ? "dashboard-route-grid" : undefined}>
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
            <Link to={section.to} key={section.to}
              aria-label={section.action}>
              <span><Icon aria-hidden="true" /></span>
              <span>
                <span><strong>{section.title}</strong></span>
                <small>{section.text}</small>
              </span>
              {section.countKey && <span aria-label={`Total ${section.title.toLowerCase()}`}>
                {typeof quickAccessCounts?.[section.countKey] === "number" ? quickAccessCounts[section.countKey].toLocaleString() : "—"}
              </span>}
              <FiChevronRight aria-hidden="true" />
            </Link>
          ))}
        </section>
      </section>}
      {!isAdmin && businessWidgetCount === 0 && <div>
        <FiSettings aria-hidden="true" />
        <strong>Your dashboard is customized</strong>
        <p>No sections are selected. Choose which sections to display in Settings.</p>
        <Button asChild size="sm" variant="outline">
          <Link to="/dashboard/settings">Open Settings</Link>
        </Button>
      </div>}
    </div>
  </AppLayout>;
}
