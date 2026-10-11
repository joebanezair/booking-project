
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiBarChart2, FiBriefcase, FiCalendar, FiDollarSign, FiMessageSquare, FiPackage, FiPlus, FiSearch, FiSettings, FiTrendingUp, FiUser, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import BusinessSetupChecklist from "../components/BusinessSetupChecklist.jsx";
import { SalesTrendChart } from "../components/SalesCharts.jsx";
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

export default function DashboardPage({ user, onLogout }) {
  const isAdmin = user.role === "admin";
  const sections = isAdmin ? adminSections : businessSections;
  const [overview, setOverview] = useState(null);
  const [businessSales, setBusinessSales] = useState(null);
  const [setup, setSetup] = useState({ profile: null, business: null, services: null });
  const [overviewError, setOverviewError] = useState("");
  const [setupExpanded, setSetupExpanded] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      api.admin.overview().then(setOverview).catch(error => setOverviewError(error.message));
      return;
    }
    api.sales.analytics({
      range: "month",
      group: "weekly",
      offset: new Date().getTimezoneOffset()
    }).then(setBusinessSales).catch(error => setOverviewError(error.message));
    Promise.all([api.profile.get(), api.business.mine(), api.content.list()])
      .then(([profile, business, services]) => setSetup({ profile, business, services }))
      .catch(() => {});
  }, [isAdmin]);

  const salesCurrency = businessSales?.primaryCurrency || "PHP";
  const onboarding = !isAdmin ? [
    { label: "Business account created", description: "Your business account is ready.", done: true, to: "/dashboard/profile" },
    { label: "Complete your Business Page", description: "Add contact details and business information.", done: Boolean(setup.business?.description && setup.business?.location && setup.business?.phone), to: "/dashboard/profile/business" },
    { label: "Add profile and cover photos", description: "Make your profile look professional.", done: Boolean(setup.profile?.profileImage && setup.profile?.coverImage), to: "/dashboard/profile/edit" },
    { label: "Set your working availability", description: "Let customers know when you're available.", done: Boolean(setup.business?.workingHours?.some(row => row.enabled)), to: "/dashboard/profile/business" },
    { label: "Create your first service", description: "Add a service with pricing and details.", done: Boolean(setup.services?.length), to: "/dashboard/services/new" },
    { label: "Publish a bookable service", description: "Make your service available to customers.", done: Boolean(setup.services?.some(service => service.published && service.allowBookings !== false)), to: "/dashboard/services" },
    { label: "Share your booking link or QR", description: "Help customers book your services.", done: Boolean(localStorage.getItem("bookflow_booking_shared")), to: "/dashboard/profile" }
  ] : [];

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div>
        <p className="eyebrow">{isAdmin ? "ADMIN DASHBOARD" : "BUSINESS DASHBOARD"}</p>
        <h1>Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="muted">{isAdmin ? "Manage businesses and monitor platform activity." : user.accountStatus === "paused" ? "Your account is paused. Existing data remains available while new publishing and bookings are disabled." : "Manage services, bookings, recorded sales, messages, reviews, and your public profile."}</p>
      </div>
      {!isAdmin && user.accountStatus === "active" && <Button asChild variant="default"><Link  className="primary-button button-link icon-link" to="/dashboard/services/new"><FiPlus aria-hidden="true" />Post a service</Link></Button>}
    </header>

    <div className="dashboard-content-rail">
      {overviewError && <p className="error">{overviewError}</p>}

      {isAdmin && <section className="stats-grid admin-platform-stats">
        <Card as="article" className="stat-card"><span>Businesses</span><strong>{overview?.businesses.total ?? "—"}</strong><small>{overview ? `${overview.businesses.active} active · ${overview.businesses.paused} paused · ${overview.businesses.disabled} disabled` : "Loading activity…"}</small></Card>
        <Card as="article" className="stat-card"><span>Services</span><strong>{overview?.services.total ?? "—"}</strong><small>{overview ? `${overview.services.published} published` : "Loading activity…"}</small></Card>
        <Card as="article" className="stat-card"><span>Bookings</span><strong>{overview?.bookings.total ?? "—"}</strong><small>{overview ? `${overview.bookings.pending} pending · ${overview.bookings.completed} completed` : "Loading activity…"}</small></Card>
        <Card as="article" className="stat-card"><span>Recorded sales</span><strong>{overview?.sales?.recorded ?? "—"}</strong><small>{overview?.sales?.totalsByCurrency?.length ? overview.sales.totalsByCurrency.map(item => `${item.currency} ${Number(item.total || 0).toLocaleString()}`).join(" · ") : "Completed booking value"}</small></Card>
        <Card as="article" className="stat-card"><span>Verified reviews</span><strong>{overview?.reviews.verified ?? "—"}</strong><small>Completed-booking reviews</small></Card>
      </section>}

      {!isAdmin && <BusinessSetupChecklist
        items={onboarding}
        expanded={setupExpanded}
        onToggle={() => setSetupExpanded(value => !value)}
      />}

      {!isAdmin && <section className="business-dashboard-analytics">
        <div className="stats-grid">
          <Card as="article" className="stat-card analytics-stat"><span><FiDollarSign />This month</span><strong>{businessSales ? money(businessSales.summary.totalSales, salesCurrency) : "—"}</strong><small>Recorded completed-service sales</small></Card>
          <Card as="article" className="stat-card analytics-stat"><span><FiCalendar />Completed</span><strong>{businessSales?.summary.completedServices ?? "—"}</strong><small>Services completed this month</small></Card>
          <Card as="article" className="stat-card analytics-stat"><span><FiTrendingUp />Average sale</span><strong>{businessSales ? money(businessSales.summary.averageSale, salesCurrency) : "—"}</strong><small>Primary currency</small></Card>
          <Card as="article" className="stat-card analytics-stat"><span><FiBriefcase />Services sold</span><strong>{businessSales?.summary.servicesSold ?? "—"}</strong><small>Distinct services this month</small></Card>
        </div>
        <section className="panel dashboard-sales-chart">
          <div className="panel-title"><div><p className="eyebrow">THIS MONTH</p><h2>Sales trend</h2></div><Button asChild variant="outline"><Link  className="secondary button-link icon-link" to="/dashboard/sales">Full analytics<FiArrowRight /></Link></Button></div>
          <SalesTrendChart data={businessSales?.trend || []} currency={salesCurrency} />
        </section>
      </section>}

      <section className="dashboard-route-section">
        <div className="dashboard-section-heading">
          <div><p className="eyebrow">QUICK ACCESS</p><h2>Manage your business</h2><p className="muted">Jump straight to the tools you use most.</p></div>
        </div>
        <section className="dashboard-route-grid">
          {sections.map(({ icon: Icon, ...section }) => <Card className="dashboard-shadcn-card" key={section.to}>
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
          </Card>)}
        </section>
      </section>
    </div>
  </AppLayout>;
}
