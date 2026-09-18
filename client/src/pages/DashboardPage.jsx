import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiBriefcase, FiCalendar, FiMessageSquare, FiPlus, FiSearch, FiSettings, FiUser, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import { api } from "../api.js";

const businessSections = [
  { title: "Services", text: "Create and manage your public, private, or draft services.", to: "/dashboard/services", action: "Manage services", icon: FiBriefcase },
  { title: "Bookings", text: "Manage guest booking requests and mark completed appointments for verified reviews.", to: "/dashboard/bookings", action: "Manage bookings", icon: FiCalendar },
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

export default function DashboardPage({ user, onLogout }) {
  const isAdmin = user.role === "admin";
  const sections = isAdmin ? adminSections : businessSections;
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    api.admin.overview().then(setOverview).catch(error => setOverviewError(error.message));
  }, [isAdmin]);

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div>
        <p className="eyebrow">{isAdmin ? "ADMIN DASHBOARD" : "BUSINESS DASHBOARD"}</p>
        <h1>Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="muted">{isAdmin ? "Manage businesses and monitor platform activity." : user.accountStatus === "paused" ? "Your account is paused. Existing data remains available while new publishing and bookings are disabled." : "Manage your services, guest bookings, messages, reviews, and public profile."}</p>
      </div>
      {!isAdmin && user.accountStatus === "active" && <Link className="primary-button button-link icon-link" to="/dashboard/services/new"><FiPlus aria-hidden="true" />Post a service</Link>}
    </header>

    {isAdmin && <>
      {overviewError && <p className="error">{overviewError}</p>}
      <section className="stats-grid admin-platform-stats">
        <article className="stat-card"><span>Businesses</span><strong>{overview?.businesses.total ?? "—"}</strong><small>{overview ? `${overview.businesses.active} active · ${overview.businesses.paused} paused · ${overview.businesses.disabled} disabled` : "Loading activity…"}</small></article>
        <article className="stat-card"><span>Services</span><strong>{overview?.services.total ?? "—"}</strong><small>{overview ? `${overview.services.published} published` : "Loading activity…"}</small></article>
        <article className="stat-card"><span>Bookings</span><strong>{overview?.bookings.total ?? "—"}</strong><small>{overview ? `${overview.bookings.pending} pending · ${overview.bookings.completed} completed` : "Loading activity…"}</small></article>
        <article className="stat-card"><span>Verified reviews</span><strong>{overview?.reviews.verified ?? "—"}</strong><small>Completed-booking reviews</small></article>
      </section>
    </>}

    <section className="dashboard-route-grid">
      {sections.map(({ icon: Icon, ...section }) => <article className="panel route-card" key={section.to}>
        <div><span className="route-card-icon"><Icon aria-hidden="true" /></span><p className="eyebrow">{section.title.toUpperCase()}</p><h2>{section.title}</h2><p className="muted">{section.text}</p></div>
        <Link className="secondary button-link icon-link" to={section.to}>{section.action}<FiArrowRight aria-hidden="true" /></Link>
      </article>)}
    </section>
  </AppLayout>;
}
