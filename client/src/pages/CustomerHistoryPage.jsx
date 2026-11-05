import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft, FiArrowUpRight, FiCalendar, FiClock,
  FiCreditCard, FiMapPin, FiPackage, FiRefreshCw, FiSearch,
  FiShoppingBag, FiTruck
} from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import AppLayout from "../components/AppLayout.jsx";
import { api } from "../api.js";

const purchaseStatuses = [
  ["all", "All purchases"], ["pending", "Pending"], ["confirmed", "Confirmed"],
  ["processing", "Processing"], ["ready", "Ready"], ["out_for_delivery", "Out for delivery"],
  ["completed", "Completed"], ["cancelled", "Cancelled"]
];
const bookingStatuses = [
  ["all", "All bookings"], ["pending", "Pending"], ["confirmed", "Confirmed"],
  ["in_progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["no_show", "No show"]
];

function money(value, currency = "PHP") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

function dateTime(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  }).format(date);
}

function statusClass(value) {
  const status = String(value || "").toLowerCase();
  if (["completed", "paid", "ready", "confirmed"].includes(status)) return "customer-history-status positive";
  if (["cancelled", "no_show", "refunded", "voided"].includes(status)) return "customer-history-status negative";
  if (["out_for_delivery", "processing", "in_progress"].includes(status)) return "customer-history-status info";
  return "customer-history-status neutral";
}

function labelStatus(value) {
  return String(value || "pending").replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export default function CustomerHistoryPage({ user, onLogout, kind = "purchases" }) {
  const isPurchases = kind === "purchases";
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = { limit: 20, status, search };
        const result = isPurchases
          ? await api.customerHistory.purchases(params)
          : await api.customerHistory.bookings(params);
        if (!active) return;
        setItems(result.items || []);
        setCursor(result.nextCursor || "");
        setHasMore(Boolean(result.hasMore));
      } catch (loadError) {
        if (active) {
          setItems([]);
          setCursor("");
          setHasMore(false);
          setError(loadError.message || "Unable to load your history.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, search ? 260 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [isPurchases, status, search]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const params = { limit: 20, status, search, cursor };
      const result = isPurchases
        ? await api.customerHistory.purchases(params)
        : await api.customerHistory.bookings(params);
      setItems(current => [...current, ...(result.items || [])]);
      setCursor(result.nextCursor || "");
      setHasMore(Boolean(result.hasMore));
    } catch (loadError) {
      setError(loadError.message || "Unable to load more history.");
    } finally {
      setLoadingMore(false);
    }
  }

  const title = isPurchases ? "Purchase History" : "Booking History";
  const subtitle = isPurchases
    ? "Products you've ordered from other businesses on BookFlow."
    : "Services and appointments you've booked with other businesses.";
  const statuses = isPurchases ? purchaseStatuses : bookingStatuses;

  return <AppLayout user={user} onLogout={onLogout}>
    <div className="customer-history-page">
      <header className="customer-history-header">
        <div>
          <Link className="customer-history-back" to="/dashboard/profile"><FiArrowLeft/> Back to Profile</Link>
          <p className="eyebrow">MY ACTIVITY</p>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <div className="customer-history-header-links">
          <Link to="/dashboard/profile/purchases" className={isPurchases ? "active" : ""}><FiShoppingBag/> Purchases</Link>
          <Link to="/dashboard/profile/booking-history" className={!isPurchases ? "active" : ""}><FiCalendar/> Bookings</Link>
        </div>
      </header>

      <section className="customer-history-toolbar" aria-label="History filters">
        <div className="customer-history-search">
          <FiSearch aria-hidden="true"/>
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={isPurchases ? "Search order or product..." : "Search booking or service..."}
            aria-label={isPurchases ? "Search purchases" : "Search bookings"}
          />
        </div>
        <label className="customer-history-status-filter">
          <span>Status</span>
          <select value={status} onChange={event => setStatus(event.target.value)}>
            {statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" onClick={() => { setSearch(""); setStatus("all"); }} disabled={loading && !items.length}>
          <FiRefreshCw/> Reset
        </Button>
      </section>

      {error && <p className="error customer-history-error" role="alert">{error}</p>}
      {loading ? <div className="customer-history-empty"><FiRefreshCw className="customer-history-spin"/><p>Loading your {isPurchases ? "purchases" : "bookings"}…</p></div>
        : items.length === 0 ? <div className="customer-history-empty">
          {isPurchases ? <FiShoppingBag/> : <FiCalendar/>}
          <strong>No {isPurchases ? "purchases" : "bookings"} found</strong>
          <p>{search || status !== "all"
            ? "Try changing your search or status filter."
            : `When you ${isPurchases ? "order products" : "book a service"} from another business while signed in, it will appear here.`}</p>
          <Link to="/search" className="customer-history-discover">Explore BookFlow <FiArrowUpRight/></Link>
        </div> : <div className="customer-history-list">
          {isPurchases ? items.map(order => <article className="customer-history-card" key={order.id}>
            <div className="customer-history-card-top">
              <div className="customer-history-reference">
                <span className="customer-history-icon"><FiPackage/></span>
                <div><strong>{order.orderNumber}</strong><small>Ordered {dateTime(order.createdAt)}</small></div>
              </div>
              <span className={statusClass(order.status)}>{labelStatus(order.status)}</span>
            </div>
            <div className="customer-history-seller">
              <span>Purchased from</span>
              {order.seller?.username
                ? <Link to={`/profile/${encodeURIComponent(order.seller.username)}`}>{order.seller.name}</Link>
                : <strong>{order.seller?.name || "BookFlow business"}</strong>}
            </div>
            <div className="customer-history-lines">
              {(order.items || []).map((item, index) => <div className="customer-history-product" key={`${order.id}-${index}`}>
                {item.image
                  ? <img src={item.image} alt="" loading="lazy"/>
                  : <span className="customer-history-product-placeholder"><FiPackage/></span>}
                <div className="customer-history-product-copy">
                  <strong>{item.name}</strong>
                  <small>Qty {item.quantity} · {money(item.unitPrice, order.currency)} each</small>
                </div>
                <span>{money(item.lineTotal, order.currency)}</span>
              </div>)}
            </div>
            <div className="customer-history-card-bottom">
              <div className="customer-history-meta-group">
                <span><FiCreditCard/> Payment: <b>{labelStatus(order.paymentStatus)}</b></span>
                {order.trackingNumber && <span><FiTruck/> Tracking: <b>{order.trackingNumber}</b></span>}
                {order.deliveryLocation && <span><FiMapPin/> {order.deliveryLocation}</span>}
              </div>
              <div className="customer-history-total"><small>Total</small><strong>{money(order.total, order.currency)}</strong></div>
            </div>
            {order.trackingUrl && <a className="customer-history-tracking" href={order.trackingUrl} target="_blank" rel="noreferrer">Track delivery <FiArrowUpRight/></a>}
          </article>) : items.map(booking => <article className="customer-history-card" key={booking.id}>
            <div className="customer-history-card-top">
              <div className="customer-history-reference">
                <span className="customer-history-icon"><FiCalendar/></span>
                <div><strong>{booking.bookingReference || "Booking"}</strong><small>Requested {dateTime(booking.createdAt)}</small></div>
              </div>
              <span className={statusClass(booking.status)}>{labelStatus(booking.status)}</span>
            </div>
            <div className="customer-history-seller">
              <span>Booked with</span>
              {booking.provider?.username
                ? <Link to={`/profile/${encodeURIComponent(booking.provider.username)}`}>{booking.provider.name}</Link>
                : <strong>{booking.provider?.name || "BookFlow business"}</strong>}
            </div>
            <div className="customer-history-booking-detail">
              <div><small>Service</small><strong>{booking.service}</strong></div>
              <div><small>Date & time</small><strong><FiClock/> {dateTime(booking.bookingDate)}</strong></div>
              {booking.locationLabel && <div><small>Location</small><strong><FiMapPin/> {booking.locationLabel}</strong></div>}
              <div><small>Price</small><strong>{money(booking.servicePrice, booking.currency)}</strong></div>
            </div>
          </article>)}
        </div>}

      {!loading && hasMore && <div className="customer-history-load-more">
        <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      </div>}
      <p className="customer-history-footnote">Only activity linked to your signed-in account appears here. Guest checkouts and bookings, including activity created before this feature was added, are not automatically linked to your profile.</p>
    </div>
  </AppLayout>;
}
