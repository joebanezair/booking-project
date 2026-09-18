import { Link } from "react-router-dom";
import { FiArrowRight, FiBriefcase, FiCalendar, FiMessageSquare, FiPlus, FiSearch, FiUser, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";

const adminSections = [
  { title: "Services", text: "Create and manage public, private, or draft services.", to: "/dashboard/services", action: "Manage services", icon: FiBriefcase },
  { title: "Bookings", text: "Review appointments and incoming customer requests.", to: "/dashboard/bookings", action: "Manage bookings", icon: FiCalendar },
  { title: "Customers", text: "View registered customers and their booking activity.", to: "/dashboard/customers", action: "View customers", icon: FiUsers },
  { title: "Messages", text: "Continue your real-time conversations.", to: "/dashboard/messages", action: "Open messages", icon: FiMessageSquare },
  { title: "Profile", text: "Update your business profile and public details.", to: "/dashboard/profile", action: "Manage profile", icon: FiUser }
];

const customerSections = [
  { title: "Find services", text: "Browse available services and business profiles.", to: "/search", action: "Browse services", icon: FiSearch },
  { title: "My bookings", text: "Review and manage only your own booking requests.", to: "/dashboard/bookings", action: "View my bookings", icon: FiCalendar },
  { title: "Messages", text: "Continue your conversations with service providers.", to: "/dashboard/messages", action: "Open messages", icon: FiMessageSquare },
  { title: "Profile", text: "Update your personal profile and account details.", to: "/dashboard/profile", action: "Manage profile", icon: FiUser }
];

export default function DashboardPage({ user, onLogout }) {
  const isAdmin = user.role === "admin";
  const isProvider = ["admin", "business"].includes(user.role);
  const sections = isProvider ? (isAdmin ? adminSections : adminSections.filter(section => section.to !== "/dashboard/customers")) : customerSections;
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">{isAdmin ? "ADMIN DASHBOARD" : isProvider ? "BUSINESS DASHBOARD" : "CUSTOMER DASHBOARD"}</p><h1>Welcome back, {user.name.split(" ")[0]}</h1><p className="muted">{isAdmin ? "Manage the platform, your services, customers, and bookings." : isProvider ? "Manage your business services and bookings." : "Find services and keep track of your bookings."}</p></div>{isProvider && <Link className="primary-button button-link icon-link" to="/dashboard/services/new"><FiPlus aria-hidden="true" />Post a service</Link>}</header>
    <section className="dashboard-route-grid">{sections.map(({ icon: Icon, ...section }) => <article className="panel route-card" key={section.to}><div><span className="route-card-icon"><Icon aria-hidden="true" /></span><p className="eyebrow">{section.title.toUpperCase()}</p><h2>{section.title}</h2><p className="muted">{section.text}</p></div><Link className="secondary button-link icon-link" to={section.to}>{section.action}<FiArrowRight aria-hidden="true" /></Link></article>)}</section>
  </AppLayout>;
}
