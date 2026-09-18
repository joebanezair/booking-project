import { Link, NavLink } from "react-router-dom";
import { FiBell, FiBriefcase, FiCalendar, FiHome, FiLogOut, FiMessageCircle, FiMessageSquare, FiSearch, FiSettings, FiUser, FiUsers } from "react-icons/fi";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: FiHome, end: true },
  { to: "/dashboard/services", label: "Services", icon: FiBriefcase, end: true, adminOnly: true },
  { to: "/dashboard/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/dashboard/customers", label: "Customers", icon: FiUsers, adminOnly: true },
  { to: "/dashboard/messages", label: "Messages", icon: FiMessageSquare },
  { to: "/dashboard/profile", label: "Profile", icon: FiUser },
  { to: "/dashboard/notifications", label: "Notifications", icon: FiBell },
  { to: "/forum", label: "Forum", icon: FiMessageCircle },
  { to: "/dashboard/settings", label: "Settings", icon: FiSettings },
  { to: "/search", label: "Search", icon: FiSearch }
];

export default function AppLayout({ children, user, onLogout }) {
  const [unread,setUnread]=useState(0);
  useEffect(()=>{api.notifications.list().then(data=>setUnread(data.unread)).catch(()=>{});const socket=getRealtimeSocket();if(!socket)return;const incoming=()=>setUnread(value=>value+1);socket.on("notification:new",incoming);return()=>socket.off("notification:new",incoming);},[]);
  return <main className="page-shell">
    <aside className="sidebar">
      <div>
        <Link to="/dashboard" className="sidebar-brand"><span className="brand-mark small"><FiCalendar aria-hidden="true" /></span><strong>BookFlow</strong></Link>
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {navigation.filter(item => !item.adminOnly || user?.role === "admin").map(({ to, label, icon: Icon, end }) => <NavLink to={to} end={end} key={to}><Icon aria-hidden="true" /><span>{label}</span>{label==="Notifications"&&unread>0&&<b className="nav-badge">{unread>99?"99+":unread}</b>}</NavLink>)}
        </nav>
      </div>
      <div><small className="sidebar-email">{user?.role === "admin" ? "Admin" : "Customer"} · {user?.email}</small><button className="secondary signout-button" onClick={onLogout}><FiLogOut aria-hidden="true" /><span>Sign out</span></button></div>
    </aside>
    <section className="content-shell">{children}</section>
  </main>;
}
