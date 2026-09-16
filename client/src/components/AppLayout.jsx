import { Link, NavLink } from "react-router-dom";
import { FiBriefcase, FiCalendar, FiHome, FiLogOut, FiMessageSquare, FiSearch, FiUser } from "react-icons/fi";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: FiHome, end: true },
  { to: "/dashboard/services", label: "Services", icon: FiBriefcase, end: true },
  { to: "/dashboard/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/dashboard/messages", label: "Messages", icon: FiMessageSquare },
  { to: "/dashboard/profile", label: "Profile", icon: FiUser },
  { to: "/search", label: "Search", icon: FiSearch }
];

export default function AppLayout({ children, user, onLogout }) {
  return <main className="page-shell">
    <aside className="sidebar">
      <div>
        <Link to="/dashboard" className="sidebar-brand"><span className="brand-mark small"><FiCalendar aria-hidden="true" /></span><strong>BookFlow</strong></Link>
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => <NavLink to={to} end={end} key={to}><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}
        </nav>
      </div>
      <div><small className="sidebar-email">{user?.email}</small><button className="secondary signout-button" onClick={onLogout}><FiLogOut aria-hidden="true" /><span>Sign out</span></button></div>
    </aside>
    <section className="content-shell">{children}</section>
  </main>;
}
