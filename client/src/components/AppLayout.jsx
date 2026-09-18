import { Link, NavLink } from "react-router-dom";
import { FiBell, FiBriefcase, FiCalendar, FiHome, FiLogOut, FiMessageCircle, FiMessageSquare, FiSearch, FiSettings, FiUser, FiUsers } from "react-icons/fi";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: FiHome, end: true },
  { to: "/dashboard/services", label: "Services", icon: FiBriefcase, end: true, providerOnly: true },
  { to: "/dashboard/bookings", label: "Bookings", icon: FiCalendar },
  { to: "/dashboard/customers", label: "Customers", icon: FiUsers, adminOnly: true },
  { to: "/dashboard/business-requests", label: "Business requests", icon: FiBriefcase, adminOnly: true },
  { to: "/dashboard/messages", label: "Messages", icon: FiMessageSquare },
  { to: "/dashboard/profile", label: "Profile", icon: FiUser },
  { to: "/dashboard/notifications", label: "Notifications", icon: FiBell },
  { to: "/forum", label: "Forum", icon: FiMessageCircle },
  { to: "/dashboard/settings", label: "Settings", icon: FiSettings },
  { to: "/search", label: "Search", icon: FiSearch }
];

export default function AppLayout({ children, user, onLogout, accountMode, onAccountModeChange }) {
  const [unread,setUnread]=useState(0);
  const effectiveMode=accountMode||localStorage.getItem("booking_account_mode")||"personal";
  function changeMode(mode){localStorage.setItem("booking_account_mode",mode);if(onAccountModeChange)onAccountModeChange(mode);else window.location.assign("/dashboard");}
  useEffect(()=>{api.notifications.list().then(data=>setUnread(data.unread)).catch(()=>{});const socket=getRealtimeSocket();if(!socket)return;const incoming=()=>setUnread(value=>value+1);socket.on("notification:new",incoming);return()=>socket.off("notification:new",incoming);},[]);
  return <main className="page-shell">
    <aside className="sidebar">
      <div>
        <Link to="/dashboard" className="sidebar-brand"><span className="brand-mark small"><FiCalendar aria-hidden="true" /></span><strong>BookFlow</strong></Link>
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {navigation.filter(item => (!item.adminOnly || user?.role === "admin") && (!item.providerOnly || ["admin", "business"].includes(user?.role) || (user?.business?.status==="approved"&&effectiveMode==="business"))).map(({ to, label, icon: Icon, end }) => <NavLink to={to} end={end} key={to}><Icon aria-hidden="true" /><span>{label}</span>{label==="Notifications"&&unread>0&&<b className="nav-badge">{unread>99?"99+":unread}</b>}</NavLink>)}
        </nav>
      </div>
      <div>{user?.role==="customer"&&user?.business?.status==="approved"&&<label className="mode-switch">Account mode<select value={effectiveMode} onChange={e=>changeMode(e.target.value)}><option value="personal">Personal</option><option value="business">Business</option></select></label>}<small className="sidebar-email">{user?.role === "admin" ? "Admin" : user?.role === "business" || effectiveMode==="business" ? "Business" : "Customer"} · {user?.email}</small><button className="secondary signout-button" onClick={onLogout}><FiLogOut aria-hidden="true" /><span>Sign out</span></button></div>
    </aside>
    <section className="content-shell">{children}</section>
  </main>;
}
