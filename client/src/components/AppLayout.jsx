import { Button } from "./ui/button.jsx";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { FiBarChart2, FiBell, FiBriefcase, FiCalendar, FiHome, FiMessageCircle, FiMessageSquare, FiPackage, FiSearch, FiSettings, FiUser, FiUsers, FiMenu, FiX, FiChevronDown, FiMoreHorizontal, FiLogOut, FiArrowRight } from "react-icons/fi";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";
import ProfileAvatar from "./ProfileAvatar.jsx";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: FiHome, end: true },
  { to: "/dashboard/services", label: "Services", icon: FiBriefcase, businessOnly: true },
  { to: "/dashboard/bookings", label: "Bookings", icon: FiCalendar, businessOnly: true },
  { to: "/dashboard/sales", label: "Sales", icon: FiBarChart2, businessOnly: true },
  { to: "/dashboard/products", label: "Products", icon: FiPackage, businessOnly: true },
  { to: "/dashboard/businesses", label: "Businesses", icon: FiUsers, adminOnly: true },
  { to: "/dashboard/messages", label: "Messages", icon: FiMessageSquare },
  { to: "/dashboard/profile", label: "Profile", icon: FiUser, businessOnly: true },
  { to: "/dashboard/notifications", label: "Notifications", icon: FiBell },
  { to: "/forum", label: "Forum", icon: FiMessageCircle },
  { to: "/dashboard/settings", label: "Settings", icon: FiSettings },
  { to: "/search", label: "Search", icon: FiSearch }
];

// Keep every route; secondary destinations live in an accessible disclosure.
const workspaceLabels = new Set(["Dashboard", "Services", "Bookings", "Sales", "Products", "Businesses"]);
const activityLabels = new Set(["Messages", "Notifications"]);
const moreLabels = new Set(["Profile", "Forum", "Settings", "Search"]);
const moreRoutePaths = ["/dashboard/profile", "/forum", "/dashboard/settings", "/search"];
function isNestedRoute(pathname, base) {
  return pathname === base || pathname.startsWith(base + "/");
}

const mobileQuery = "(max-width: 800px)";
const drawerFocusSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AppLayout({ children, user, onLogout }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState("");
  const [profile, setProfile] = useState(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const profileMenuRef = useRef(null);
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(mobileQuery).matches);
  const drawerRef = useRef(null);
  const menuTriggerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    api.profile.get().then(result => { if (mounted) setProfile(result); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    api.notifications.list().then(data => setUnread(data.unread)).catch(() => {});
    const socket = getRealtimeSocket();
    if (!socket) return;
    const incoming = () => setUnread(value => value + 1);
    socket.on("notification:new", incoming);
    return () => socket.off("notification:new", incoming);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    const updateMobile = () => setIsMobile(media.matches);
    updateMobile();
    media.addEventListener("change", updateMobile);
    return () => media.removeEventListener("change", updateMobile);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const closeOnOutside = event => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target))
        profileMenuRef.current.open = false;
    };
    const closeOnEscape = event => {
      if (event.key === "Escape" && profileMenuRef.current) profileMenuRef.current.open = false;
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  useEffect(() => {
    if (profileMenuRef.current) profileMenuRef.current.open = false;
  }, [pathname]);

  useEffect(() => { if (moreRoutePaths.some(path => isNestedRoute(pathname, path))) setMoreOpen(true); }, [pathname]);
  useEffect(() => { if (!isMobile) setMobileOpen(false); }, [isMobile]);

  const visibleNavigation = navigation.filter(item => {
    if (item.adminOnly) return user?.role === "admin";
    if (item.businessOnly) return user?.role === "business";
    return true;
  });

  const workspaceNavigation = visibleNavigation.filter(item => workspaceLabels.has(item.label));
  const activityNavigation = visibleNavigation.filter(item => activityLabels.has(item.label));
  const moreNavigation = visibleNavigation.filter(item => moreLabels.has(item.label));
  const moreActive = moreNavigation.some(item => isNestedRoute(pathname, item.to));

  function renderSidebarLink({ to, label, icon: Icon, end }) {
    return <NavLink className="sidebar-nav-link" to={to} end={end} key={to} title={label}
      onClick={() => closeMobileNavigation()}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      {label === "Notifications" && unread > 0 && <b className="nav-badge">{unread > 99 ? "99+" : unread}</b>}
    </NavLink>;
  }

  const mobilePaths = user?.role === "admin"
    ? ["/dashboard", "/dashboard/businesses", "/dashboard/messages", "/search"]
    : ["/dashboard", "/dashboard/bookings", "/dashboard/messages", "/search"];
  const mobileShortcuts = mobilePaths
    .map(path => visibleNavigation.find(item => item.to === path))
    .filter(Boolean);

  function toggleMobileNavigation(event) {
    if (!mobileOpen) menuTriggerRef.current = event.currentTarget;
    setMobileOpen(value => !value);
  }

  function closeMobileNavigation(restoreFocus = false) {
    setMobileOpen(false);
    if (restoreFocus) menuTriggerRef.current?.focus();
  }

  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector(".mobile-drawer-close")?.focus();

    const onKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNavigation(true);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll(drawerFocusSelector));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawerRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawerRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, isMobile]);

  return <main className="page-shell">
    <header className="mobile-app-header">
      <Link to="/dashboard" className="sidebar-brand"><span className="brand-mark small"><FiCalendar aria-hidden="true" /></span><strong>BookFlow</strong></Link>
      <Button variant="plain" type="button" className="mobile-menu-button" aria-label="Open navigation" aria-controls="mobile-dashboard-drawer" aria-expanded={mobileOpen} onClick={toggleMobileNavigation}><FiMenu aria-hidden="true" /></Button>
    </header>

    {isMobile && mobileOpen && <Button variant="plain" type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => closeMobileNavigation(true)} />}
    <aside id="mobile-dashboard-drawer" ref={drawerRef} className={"sidebar " + (mobileOpen ? "mobile-open" : "")} inert={isMobile && !mobileOpen} role={isMobile && mobileOpen ? "dialog" : undefined} aria-modal={isMobile && mobileOpen ? "true" : undefined} aria-label={isMobile && mobileOpen ? "Mobile navigation" : undefined}>
      <div className="sidebar-main">
        <div className="mobile-drawer-heading"><strong>Menu</strong><Button variant="plain" type="button" className="mobile-menu-button mobile-drawer-close" aria-label="Close navigation" onClick={() => closeMobileNavigation(true)}><FiX aria-hidden="true" /></Button></div>
        <Link to="/dashboard" className="sidebar-brand" onClick={() => closeMobileNavigation()}>
          <span className="brand-mark small"><FiCalendar aria-hidden="true" /></span>
          <strong>BookFlow</strong>
        </Link>

        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          <div className="sidebar-nav-group">
            <span className="sidebar-section-label" aria-hidden="true">WORKSPACE</span>
            {workspaceNavigation.map(renderSidebarLink)}
          </div>
          <div className="sidebar-nav-group sidebar-activity-group">
            <span className="sidebar-section-label" aria-hidden="true">ACTIVITY</span>
            {activityNavigation.map(renderSidebarLink)}
          </div>
          {moreNavigation.length > 0 && <div className="sidebar-nav-group sidebar-more-group">
            <Button variant="ghost" type="button"
              className={"sidebar-nav-toggle" + (moreActive ? " current-section" : "")}
              title="More pages" aria-label={moreOpen ? "Collapse more pages" : "Expand more pages"}
              aria-controls="sidebar-more-links" aria-expanded={moreOpen}
              onClick={() => setMoreOpen(value => !value)}>
              <FiMoreHorizontal aria-hidden="true" />
              <span>More</span>
              <FiChevronDown className="sidebar-nav-chevron" aria-hidden="true" />
            </Button>
            {moreOpen && <div id="sidebar-more-links" className="sidebar-more-links">
              {moreNavigation.map(renderSidebarLink)}
            </div>}
          </div>}
        </nav>
      </div>

      <div className="sidebar-footer">
        {user?.role === "business" && user?.accountStatus === "paused" && <p className="sidebar-status-note">Business paused</p>}
        <div className="sidebar-footer-person">
          <span className="sidebar-footer-avatar" aria-hidden="true"><ProfileAvatar profile={profile || user} size="sm" /></span>
          <div className="sidebar-footer-account">
            <strong>{user?.role === "admin" ? "Administrator" : "Business"}</strong>
            <small className="sidebar-email">{user?.email}</small>
          </div>
        </div>
      </div>
    </aside>

    <header className="workspace-topbar" aria-label="Workspace tools">
      <form className="workspace-global-search" role="search"
        onSubmit={event => {
          event.preventDefault();
          navigate("/search" + (globalSearch.trim() ? "?q=" + encodeURIComponent(globalSearch.trim()) : ""));
        }}>
        <FiSearch aria-hidden="true" />
        <input type="search" value={globalSearch} onChange={event => setGlobalSearch(event.target.value)}
          placeholder="Search businesses, services, products..." aria-label="Search BookFlow" />
        <Button variant="ghost" type="submit" className="workspace-search-submit" aria-label="Submit search"><FiArrowRight aria-hidden="true"/></Button>
      </form>
      <div className="workspace-topbar-actions">
        <details className="workspace-account-menu" ref={profileMenuRef}>
          <summary aria-label="Account menu">
            <span className="workspace-user-avatar-wrap">
              <ProfileAvatar profile={profile || user} size="sm"/>
              <span className={isOnline ? "workspace-presence-dot" : "workspace-presence-dot offline"} aria-hidden="true" />
            </span>
            <span className="workspace-user-text">
              <strong>{profile?.name || user?.name || "Account"}</strong>
              <span className={isOnline ? "workspace-online-chip" : "workspace-online-chip offline"}>
                <span className="workspace-chip-dot" aria-hidden="true" />{isOnline ? "Online" : "Offline"}
              </span>
            </span>
            <FiChevronDown aria-hidden="true"/>
          </summary>
          <div className="workspace-account-popover">
            <div className="workspace-account-identity"><strong>{profile?.name || user?.name}</strong><span>{user?.email}</span><span className={isOnline ? "workspace-account-connection" : "workspace-account-connection offline"}>{isOnline ? "Connected to network" : "Network offline"}</span></div>
            {user?.role === "business" && <Link to="/dashboard/profile" onClick={() => { profileMenuRef.current.open = false; }}><FiUser aria-hidden="true"/>My profile</Link>}
            <Link to="/dashboard/settings" onClick={() => { profileMenuRef.current.open = false; }}><FiSettings aria-hidden="true"/>Settings</Link>
            <Button variant="ghost" type="button" onClick={() => { profileMenuRef.current.open = false; onLogout?.(); }}><FiLogOut aria-hidden="true"/>Sign out</Button>
          </div>
        </details>
      </div>
    </header>

    <section className="content-shell">
      {user?.role === "business" && user?.accountStatus === "paused" && <div className="account-status-banner">Your business is temporarily paused. Existing data stays available, but publishing services and new guest bookings are disabled.</div>}
      {children}
    </section>

    <nav className="mobile-bottom-nav" aria-label="Mobile shortcuts">
      {mobileShortcuts.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => closeMobileNavigation()}>
        <Icon aria-hidden="true" /><span>{to === "/dashboard" ? "Home" : label}</span>
      </NavLink>)}
      <Button variant="plain" type="button" className={"mobile-nav-more" + (mobileOpen ? " active" : "")} aria-label={unread ? "More navigation, " + unread + " unread notifications" : "More navigation"} aria-controls="mobile-dashboard-drawer" aria-expanded={mobileOpen} onClick={toggleMobileNavigation}>
        <FiMenu aria-hidden="true" /><span>More</span>{unread > 0 && <b className="mobile-nav-badge">{unread > 99 ? "99+" : unread}</b>}
      </Button>
    </nav>
  </main>;
}
