import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiBell,
  FiCalendar,
  FiCheck,
  FiChevronRight,
  FiMessageCircle,
  FiMessageSquare,
  FiStar,
  FiUserPlus,
  FiBriefcase,
  FiInbox
} from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card } from "../components/ui/card.jsx";
import AppLayout from "../components/AppLayout.jsx";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";

const OTHER_CATEGORY = { id: "other", label: "Other", icon: FiInbox, types: [] };
const CATEGORIES = [
  { id: "all", label: "All", icon: FiBell },
  { id: "message", label: "Messages", icon: FiMessageSquare, types: ["message"] },
  { id: "friend_request", label: "Friends", icon: FiUserPlus, types: ["friend_request"] },
  { id: "booking", label: "Bookings & Orders", icon: FiCalendar, types: ["booking"] },
  { id: "verified-review", label: "Reviews", icon: FiStar, types: ["verified-review"] },
  { id: "comment", label: "Comments", icon: FiMessageCircle, types: ["comment"] },
  { id: "business-status", label: "Business updates", icon: FiBriefcase, types: ["business-status"] },
  OTHER_CATEGORY
];

function categoryFor(item) {
  return CATEGORIES.find(category => category.types?.includes(item?.type)) || OTHER_CATEGORY;
}

function notificationHref(item) {
  return item.title === "New product order" && item.link === "/dashboard/sales"
    ? "/dashboard/online-orders"
    : (item.link || "/dashboard/notifications");
}

function notificationDate(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString();
}

export default function NotificationsPage({ user, onLogout }) {
  const [data, setData] = useState({ items: [], unread: 0 });
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  async function load() {
    try {
      const result = await api.notifications.list();
      setData({
        items: Array.isArray(result?.items) ? result.items : [],
        unread: Number(result?.unread) || 0
      });
      setError("");
    } catch (e) {
      setError(e.message || "Unable to load notifications.");
    }
  }

  useEffect(() => {
    load();
    const socket = getRealtimeSocket();
    if (!socket) return undefined;
    socket.on("notification:new", load);
    return () => socket.off("notification:new", load);
  }, []);

  async function read(item) {
    try {
      if (!item.readAt) await api.notifications.read(item._id);
      await load();
    } catch (e) {
      setError(e.message || "Unable to mark notification as read.");
    }
  }

  async function all() {
    try {
      await api.notifications.readAll();
      await load();
    } catch (e) {
      setError(e.message || "Unable to mark notifications as read.");
    }
  }

  const visibleCategories = CATEGORIES.filter(category => {
    if (category.id === "all" || category.id === "other") return true;
    return data.items.some(item => categoryFor(item).id === category.id);
  });
  const visibleItems = activeCategory === "all"
    ? data.items
    : data.items.filter(item => categoryFor(item).id === activeCategory);
  const activeLabel = CATEGORIES.find(category => category.id === activeCategory)?.label || "Other";

  return (
    <AppLayout user={user} onLogout={onLogout}>
      <header className="topbar notifications-page-header">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1><FiBell aria-hidden="true" /> Notification center</h1>
          <p className="muted">{data.unread} unread notification{data.unread === 1 ? "" : "s"}</p>
        </div>
        <Button variant="outline" size="sm" type="button" className="icon-link" disabled={!data.unread} onClick={all}>
          <FiCheck aria-hidden="true" /> Mark all read
        </Button>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="notifications-center" aria-label="Notification center">
        <div className="notification-category-toolbar" aria-label="Filter notifications by category">
          {visibleCategories.map(category => {
            const Icon = category.icon;
            const count = category.id === "all"
              ? data.items.length
              : data.items.filter(item => categoryFor(item).id === category.id).length;
            const unreadCount = category.id === "all"
              ? data.unread
              : data.items.filter(item => categoryFor(item).id === category.id && !item.readAt).length;
            const active = activeCategory === category.id;

            return (
              <Button
                key={category.id}
                type="button"
                size="sm"
                variant={active ? "secondary" : "outline"}
                className={`notification-category-button${active ? " active" : ""}`}
                aria-pressed={active}
                onClick={() => setActiveCategory(category.id)}
              >
                <Icon aria-hidden="true" />
                <span>{category.label}</span>
                {count > 0 && <Badge variant={unreadCount > 0 ? "default" : "secondary"}>{count}</Badge>}
              </Button>
            );
          })}
        </div>

        <div className="notification-results-heading">
          <div>
            <h2>{activeCategory === "all" ? "All notifications" : activeLabel}</h2>
            <p>{visibleItems.length} notification{visibleItems.length === 1 ? "" : "s"}</p>
          </div>
          {visibleItems.some(item => !item.readAt) && (
            <Badge variant="outline">{visibleItems.filter(item => !item.readAt).length} unread</Badge>
          )}
        </div>

        {visibleItems.length === 0 ? (
          <Card className="notification-empty-state">
            <span className="notification-empty-icon"><FiInbox aria-hidden="true" /></span>
            <strong>{data.items.length ? `No ${activeLabel.toLowerCase()} notifications` : "No notifications yet"}</strong>
            <p>{data.items.length ? "Notifications in this category will appear here." : "You're all caught up. New activity will appear here."}</p>
            {activeCategory !== "all" && (
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveCategory("all")}>View all notifications</Button>
            )}
          </Card>
        ) : (
          <div className="notification-card-list">
            {visibleItems.map(item => {
              const category = categoryFor(item);
              const Icon = category.icon;
              const unread = !item.readAt;
              return (
                <Card
                  as={Link}
                  to={notificationHref(item)}
                  onClick={() => read(item)}
                  className={`notification-card${unread ? " unread" : ""}`}
                  key={item._id}
                >
                  <span className="notification-card-icon"><Icon aria-hidden="true" /></span>
                  <span className="notification-card-content">
                    <span className="notification-card-heading">
                      <strong>{item.title}</strong>
                      {unread && <Badge variant="default">New</Badge>}
                    </span>
                    {item.body && <span className="notification-card-body">{item.body}</span>}
                    <span className="notification-card-meta">
                      <Badge variant="outline">{category.label}</Badge>
                      <time dateTime={item.createdAt || undefined}>{notificationDate(item.createdAt)}</time>
                    </span>
                  </span>
                  <FiChevronRight className="notification-card-chevron" aria-hidden="true" />
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </AppLayout>
  );
}
