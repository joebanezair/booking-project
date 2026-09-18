import { Link, NavLink, useLocation } from "react-router-dom";
import { FiBarChart2, FiBell, FiBriefcase, FiCalendar, FiHome, FiLogOut, FiMenu, FiMessageCircle, FiMessageSquare, FiSearch, FiSettings, FiUser, FiUsers, FiX } from "react-icons/fi";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: FiHome, end: true },
  { to: "/dashboard/services", label: "Services", icon: FiBriefcase, businessOnly: true },
  { to: "/dashboard/bookings", label: "Bookings", icon: FiCalendar, businessOnly: true },
  { to: "/dashboard/sales", label: "Sales", icon: FiBarChart2, businessOnly: true },
  { to: "/dashboard/businesses", label: "Businesses", icon: FiUsers, adminOnly: true },
  { to: "/dashboard/messages", label: "Messages", icon: FiMessageSquare },
  { to: "/dashboard/profile", label: "Profile", icon: FiUser, businessOnly: true },
  { to: "/dashboard/notifications", label: "Notifications", icon: FiBell },
  { to: "/forum", label: "Forum", icon: FiMessageCircle },
  { to: "/dashboard/settings", label: "Settings", icon: FiSettings },
  { to: "/search", label: "Search", icon: FiSearch }
];

export default function AppLayout({ children, user, onLogout }) {
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.notifications.list().then(data => setUnread(data.unread)).catch(() => {});
    const socket = getRealtimeSocket();
    if (!socket) return;
    const incoming = () => setUnread(value => value + 1);
    socket.on("notification:new", incoming);
    return () => socket.off("notification:new", incoming);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const visibleNavigation = navigation.filter(item => {
    if (item.adminOnly) return user?.role === "admin";
    if (item.businessOnly) return user?.role === "business";
    return true;
  });

  const mobilePrimary = user?.role === "admin"
    ? visibleNavigation.filter(item => ["/dashboard", "/dashboard/businesses", "/dashboard/messages", "/dashboard/notifications", "/dashboard/settings"].includes(item.to))
    : visibleNavigation.filter(item => ["/dashboard", "/dashboard/bookings", "/dashboard/sales", "/dashboard/messages", "/dashboard/settings"].includes(item.to));

  return <main className="page-shell">
    <header className="mobile-app-header">
      <Link to="/dashboard" className="sidebar-brand"><span className="brand-mark small"><FiCalendar aria-hidden="true" /></span><strong>BookFlow</strong></Link>
      <button className="mobile-menu-button" type="button" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen}>
        {menuOpen ? <FiX /> : <FiMenu />}
      </button>
    </header>

    {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

    <aside className={menuOpen ? "sidebar mobile-open" : "sidebar"}>
      <div>
        <Link to="/dashboard" className="sidebar-brand desktop-sidebar-brand"><span className="brand-mark small"><FiCalendar aria-hidden="true" /></span><strong>BookFlow</strong></Link>
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {visibleNavigation.map(({ to, label, icon: Icon, end }) => <NavLink to={to} end={end} key={to}>
            <Icon aria-hidden="true" /><span>{label}</span>{label === "Notifications" && unread > 0 && <b className="nav-badge">{unread > 99 ? "99+" : unread}</b>}
          </NavLink>)}
        </nav>
      </div>
      <div>
        {user?.role === "business" && user?.accountStatus === "paused" && <p className="sidebar-status-note">Business paused</p>}
        <small className="sidebar-email">{user?.role === "admin" ? "Admin" : "Business"} · {user?.email}</small>
        <button className="secondary signout-button" onClick={onLogout}><FiLogOut aria-hidden="true" /><span>Sign out</span></button>
      </div>
    </aside>

    <section className="content-shell">
      {user?.role === "business" && user?.accountStatus === "paused" && <div className="account-status-banner">Your business is temporarily paused. Existing data stays available, but publishing services and new guest bookings are disabled.</div>}
      {children}
    </section>

    <nav className="mobile-bottom-nav" aria-label="Mobile dashboard navigation">
      {mobilePrimary.map(({ to, label, icon: Icon, end }) => <NavLink to={to} end={end} key={to}>
        <Icon aria-hidden="true" />
        <span>{label}</span>
        {label === "Notifications" && unread > 0 && <b className="mobile-nav-badge">{unread > 9 ? "9+" : unread}</b>}
      </NavLink>)}
    </nav>
  </main>;
}
