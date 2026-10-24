
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiBarChart2, FiBriefcase, FiCalendar, FiDollarSign, FiMessageSquare, FiPackage, FiPlus, FiSearch, FiSettings, FiStar, FiUser, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import BusinessSetupChecklist from "../components/BusinessSetupChecklist.jsx";
import DashboardAnalytics from "../components/DashboardAnalytics.jsx";
import { api } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";

const businessSections = [
  { title: "Services", text: "Create and manage your public, private, or draft services.", to: "/dashboard/services", action: "Manage services", icon: FiBriefcase },
  { title: "Bookings", text: "Manage guest booking requests and service status.", to: "/dashboard/bookings", action: "Manage bookings", icon: FiCalendar },
  { title: "Products", text: "Manage products, inventory, pricing, and items available for sale.", to: "/dashboard/products", action: "Manage products", icon: FiPackage },
  { title: "Sales & Analytics", text: "Track completed-service sales, trends, and spreadsheet reports.", to: "/dashboard/sales", action: "View sales", icon: FiBarChart2 },
  { title: "Messages", text: "Chat with other registered businesses and administrators.", to: "/dashboard/messages", action: "Open messages", icon: FiMessageSquare },
  { title: "Business profile", text: "Update your public profile, contact details, photos, and business information.", to: "/dashboard/profile", action: "Manage profile", icon: FiUser },
  { title: "Search", text: "Explore other businesses and public services.", to: "/search", action: "Browse BookFlow", icon: FiSearch }
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

export default function DashboardPage({ user, onLogout }) {
  const isAdmin = user.role === "admin";
  const sections = isAdmin ? adminSections : businessSections;
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

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div>
        <p className="eyebrow">{isAdmin ? "ADMIN DASHBOARD" : "BUSINESS DASHBOARD"}</p>
        <h1>Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="muted">{isAdmin ? "Manage businesses and monitor platform activity." : user.accountStatus === "paused" ? "Your account is paused. Existing data remains available while new publishing and bookings are disabled." : "Manage services, bookings, recorded sales, messages, reviews, and your public profile."}</p>
      </div>
      {!isAdmin && user.accountStatus === "active" && <Button asChild variant="secondary"><Link className="secondary button-link icon-link dashboard-post-service" to="/dashboard/services/new"><FiPlus aria-hidden="true" />Post a service</Link></Button>}
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
          <span aria-live="polite" className="business-admin-activity-updated">
            {overview?.generatedAt ? `Updated ${new Date(overview.generatedAt).toLocaleString()}` : !overviewError ? "Loading live totals…" : "Statistics unavailable"}
          </span>
        </div>
        <div className="business-admin-platform-grid">
          <PlatformMetric icon={FiDollarSign} label="Total platform revenue"
            value={revenueDisplay}
            note={revenueRows === null ? "Revenue unavailable" : revenueRows.length > 1
              ? revenueBreakdown : "Gross sales · not platform fees"}
            className="business-admin-platform-metric--revenue"
            title="Gross recorded service and POS sales plus completed online order value; excludes voided and fully refunded orders. Not verified payments or platform commissions." />
          <PlatformMetric icon={FiPackage} label="Total products"
            value={overview?.products?.total}
            note={overview ? `${overview.products.published} published` : "—"} />
          <PlatformMetric icon={FiBriefcase} label="Total services"
            value={overview?.services?.total}
            note={overview ? `${overview.services.published} published` : "—"} />
          <PlatformMetric icon={FiCalendar} label="Total bookings"
            value={overview?.bookings?.total}
            note="All booking statuses" />
          <PlatformMetric icon={FiStar} label="Verified reviews"
            value={overview?.reviews?.verified}
            note="Submitted and verified" />
          <PlatformMetric icon={FiStar} label="Average rating"
            value={overview?.reviews?.averageRating != null ? `${overview.reviews.averageRating.toFixed(1)} / 5` : "—"}
            note={overview ? `${overview.reviews.ratingsCount} verified ratings` : "—"} />
        </div>
        <div className="business-admin-breakdowns">
          <div className="business-admin-breakdown-group">
            <h3>Booking status</h3>
            <div className="business-admin-breakdown-grid">
              <BreakdownMetric label="Pending" value={overview?.bookings?.pending} />
              <BreakdownMetric label="Confirmed" value={overview?.bookings?.confirmed} />
              <BreakdownMetric label="In progress" value={overview?.bookings?.inProgress} />
              <BreakdownMetric label="Completed" value={overview?.bookings?.completed} />
              <BreakdownMetric label="Cancelled" value={overview?.bookings?.cancelled} />
              <BreakdownMetric label="No-show" value={overview?.bookings?.noShow} />
            </div>
          </div>
          <div className="business-admin-breakdown-group">
            <h3>Sales and orders</h3>
            <div className="business-admin-breakdown-grid">
              <BreakdownMetric label="Service sales recorded" value={overview?.sales?.recorded} />
              <BreakdownMetric label="POS sales recorded" value={overview?.sales?.posRecorded} />
              <BreakdownMetric label="Online orders" value={overview?.sales?.onlineOrders} />
              <BreakdownMetric label="Orders completed" value={overview?.sales?.completedOnlineOrders} />
            </div>
          </div>
        </div>
      </section>
      </div>}

      {!isAdmin && setupLoaded && !setupComplete && <BusinessSetupChecklist
        items={onboarding}
        expanded={setupExpanded}
        onToggle={() => setSetupExpanded(value => !value)}
      />}

      {!isAdmin && <DashboardAnalytics
        data={businessSales}
        statusSummary={bookingSummary}
        range={dashboardRange}
        loading={salesLoading}
        statusLoading={statusLoading}
      />}

      <section className={"dashboard-route-section" + (isAdmin ? " dashboard-route-section--admin" : "")}>
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
      </section>
    </div>
  </AppLayout>;
}
