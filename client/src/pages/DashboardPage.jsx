import { Link } from "react-router-dom";
import { FiArrowRight, FiBriefcase, FiCalendar, FiMessageSquare, FiPlus, FiUser } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";

const sections = [
  { title: "Services", text: "Create and manage public, private, or draft services.", to: "/dashboard/services", action: "Manage services", icon: FiBriefcase },
  { title: "Bookings", text: "Review appointments and incoming public requests.", to: "/dashboard/bookings", action: "Open bookings", icon: FiCalendar },
  { title: "Messages", text: "Continue your real-time conversations.", to: "/dashboard/messages", action: "Open messages", icon: FiMessageSquare },
  { title: "Profile", text: "Update your profile photo, cover photo, bio, and public details.", to: "/dashboard/profile", action: "Manage profile", icon: FiUser }
];

export default function DashboardPage({ user, onLogout }) {
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">DASHBOARD</p><h1>Welcome back, {user.name.split(" ")[0]}</h1><p className="muted">Choose an area to manage. Each feature has its own page.</p></div><Link className="primary-button button-link icon-link" to="/dashboard/services/new"><FiPlus aria-hidden="true" />Post a service</Link></header>
    <section className="dashboard-route-grid">{sections.map(({ icon: Icon, ...section }) => <article className="panel route-card" key={section.to}><div><span className="route-card-icon"><Icon aria-hidden="true" /></span><p className="eyebrow">{section.title.toUpperCase()}</p><h2>{section.title}</h2><p className="muted">{section.text}</p></div><Link className="secondary button-link icon-link" to={section.to}>{section.action}<FiArrowRight aria-hidden="true" /></Link></article>)}</section>
  </AppLayout>;
}
