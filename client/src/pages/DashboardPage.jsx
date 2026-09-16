import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";

const sections = [
  { title: "Content", text: "Create and manage published content or drafts.", to: "/dashboard/content", action: "Manage content" },
  { title: "Bookings", text: "Review appointments and incoming public requests.", to: "/dashboard/bookings", action: "Open bookings" },
  { title: "Messages", text: "Continue your real-time conversations.", to: "/dashboard/messages", action: "Open messages" },
  { title: "Profile", text: "Update your profile photo, cover photo, bio, and public details.", to: "/dashboard/profile", action: "Manage profile" }
];

export default function DashboardPage({ user, onLogout }) {
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">DASHBOARD</p><h1>Welcome back, {user.name.split(" ")[0]}</h1><p className="muted">Choose an area to manage. Each feature has its own page.</p></div><Link className="primary-button button-link" to="/dashboard/content/new">Create content</Link></header>
    <section className="dashboard-route-grid">{sections.map(section => <article className="panel route-card" key={section.to}><div><p className="eyebrow">{section.title.toUpperCase()}</p><h2>{section.title}</h2><p className="muted">{section.text}</p></div><Link className="secondary button-link" to={section.to}>{section.action}</Link></article>)}</section>
  </AppLayout>;
}
