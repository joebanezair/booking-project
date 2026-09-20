import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiBarChart2, FiBriefcase, FiCalendar, FiCheckCircle, FiCircle, FiDollarSign, FiMessageSquare, FiPlus, FiSearch, FiSettings, FiTrendingUp, FiUser, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import { SalesTrendChart } from "../components/SalesCharts.jsx";
import { api } from "../api.js";

const businessSections = [
  { title: "Services", text: "Create and manage your public, private, or draft services.", to: "/dashboard/services", action: "Manage services", icon: FiBriefcase },
  { title: "Bookings", text: "Manage guest booking requests and service status.", to: "/dashboard/bookings", action: "Manage bookings", icon: FiCalendar },
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
    { label: "Business account created", done: true, to: "/dashboard/profile" },
    { label: "Complete your Business Page", done: Boolean(setup.business?.description && setup.business?.location && setup.business?.phone), to: "/dashboard/profile/business" },
    { label: "Add profile and cover photos", done: Boolean(setup.profile?.profileImage && setup.profile?.coverImage), to: "/dashboard/profile/edit" },
    { label: "Create your first service", done: Boolean(setup.services?.length), to: "/dashboard/services/new" },
    { label: "Set your working availability", done: Boolean(setup.business?.workingHours?.some(row => row.enabled)), to: "/dashboard/profile/business" },
    { label: "Publish a bookable service", done: Boolean(setup.services?.some(service => service.published && service.allowBookings !== false)), to: "/dashboard/services" },
    { label: "Share your booking link or QR", done: Boolean(localStorage.getItem("bookflow_booking_shared")), to: "/dashboard/profile" }
  ] : [];
  const onboardingDone = onboarding.filter(item => item.done).length;

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div>
        <p className="eyebrow">{isAdmin ? "ADMIN DASHBOARD" : "BUSINESS DASHBOARD"}</p>
        <h1>Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="muted">{isAdmin ? "Manage businesses and monitor platform activity." : user.accountStatus === "paused" ? "Your account is paused. Existing data remains available while new publishing and bookings are disabled." : "Manage services, bookings, recorded sales, messages, reviews, and your public profile."}</p>
      </div>
      {!isAdmin && user.accountStatus === "active" && <Link className="primary-button button-link icon-link" to="/dashboard/services/new"><FiPlus aria-hidden="true" />Post a service</Link>}
    </header>

    {overviewError && <p className="error">{overviewError}</p>}

    {isAdmin && <section className="stats-grid admin-platform-stats">
      <article className="stat-card"><span>Businesses</span><strong>{overview?.businesses.total ?? "—"}</strong><small>{overview ? `${overview.businesses.active} active · ${overview.businesses.paused} paused · ${overview.businesses.disabled} disabled` : "Loading activity…"}</small></article>
      <article className="stat-card"><span>Services</span><strong>{overview?.services.total ?? "—"}</strong><small>{overview ? `${overview.services.published} published` : "Loading activity…"}</small></article>
      <article className="stat-card"><span>Bookings</span><strong>{overview?.bookings.total ?? "—"}</strong><small>{overview ? `${overview.bookings.pending} pending · ${overview.bookings.completed} completed` : "Loading activity…"}</small></article>
      <article className="stat-card"><span>Recorded sales</span><strong>{overview?.sales?.recorded ?? "—"}</strong><small>{overview?.sales?.totalsByCurrency?.length ? overview.sales.totalsByCurrency.map(item => `${item.currency} ${Number(item.total || 0).toLocaleString()}`).join(" · ") : "Completed booking value"}</small></article>
      <article className="stat-card"><span>Verified reviews</span><strong>{overview?.reviews.verified ?? "—"}</strong><small>Completed-booking reviews</small></article>
    </section>}

    {!isAdmin && <section className="panel onboarding-panel">
      <div className="panel-title">
        <div><p className="eyebrow">GET READY TO LAUNCH</p><h2>Business setup checklist</h2><p className="muted">{onboardingDone} of {onboarding.length} completed</p></div>
        <strong className="onboarding-progress-label">{Math.round((onboardingDone / Math.max(onboarding.length, 1)) * 100)}%</strong>
      </div>
      <div className="onboarding-progress"><span style={{ width: ((onboardingDone / Math.max(onboarding.length, 1)) * 100) + "%" }} /></div>
      <div className="onboarding-list">{onboarding.map(item => <Link className={item.done ? "onboarding-item done" : "onboarding-item"} to={item.to} key={item.label}>{item.done ? <FiCheckCircle /> : <FiCircle />}<span>{item.label}</span><FiArrowRight /></Link>)}</div>
    </section>}

    {!isAdmin && <section className="business-dashboard-analytics">
      <div className="stats-grid">
        <article className="stat-card analytics-stat"><span><FiDollarSign />This month</span><strong>{businessSales ? money(businessSales.summary.totalSales, salesCurrency) : "—"}</strong><small>Recorded completed-service sales</small></article>
        <article className="stat-card analytics-stat"><span><FiCalendar />Completed</span><strong>{businessSales?.summary.completedServices ?? "—"}</strong><small>Services completed this month</small></article>
        <article className="stat-card analytics-stat"><span><FiTrendingUp />Average sale</span><strong>{businessSales ? money(businessSales.summary.averageSale, salesCurrency) : "—"}</strong><small>Primary currency</small></article>
        <article className="stat-card analytics-stat"><span><FiBriefcase />Services sold</span><strong>{businessSales?.summary.servicesSold ?? "—"}</strong><small>Distinct services this month</small></article>
      </div>
      <section className="panel dashboard-sales-chart">
        <div className="panel-title"><div><p className="eyebrow">THIS MONTH</p><h2>Sales trend</h2></div><Link className="secondary button-link icon-link" to="/dashboard/sales">Full analytics<FiArrowRight /></Link></div>
        <SalesTrendChart data={businessSales?.trend || []} currency={salesCurrency} />
      </section>
    </section>}

    <section className="dashboard-route-grid">
      {sections.map(({ icon: Icon, ...section }) => <article className="panel route-card" key={section.to}>
        <div><span className="route-card-icon"><Icon aria-hidden="true" /></span><p className="eyebrow">{section.title.toUpperCase()}</p><h2>{section.title}</h2><p className="muted">{section.text}</p></div>
        <Link className="secondary button-link icon-link" to={section.to}>{section.action}<FiArrowRight aria-hidden="true" /></Link>
      </article>)}
    </section>
  </AppLayout>;
}
