import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft, FiArrowUpRight, FiCalendar, FiClock,
  FiCreditCard, FiEdit2, FiEye, FiMapPin, FiPackage, FiRefreshCw, FiSearch,
  FiShoppingBag, FiTruck
} from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Image } from "../components/ui/image.jsx";
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

function dateTimeLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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
  const [viewingOrderId, setViewingOrderId] = useState("");
  const [editingOrderId, setEditingOrderId] = useState("");
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [viewingBookingId, setViewingBookingId] = useState("");
  const [editingBookingId, setEditingBookingId] = useState("");
  const [bookingEditForm, setBookingEditForm] = useState(null);
  const [bookingEditSaving, setBookingEditSaving] = useState(false);
  const [bookingEditError, setBookingEditError] = useState("");

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

  function beginEditOrder(order) {
    setViewingOrderId(String(order.id));
    setEditingOrderId(String(order.id));
    setEditForm({
      customerName: order.customerName || "",
      customerPhone: order.customerPhone || "",
      customerEmail: order.customerEmail || "",
      deliveryLocation: order.deliveryLocation || "",
      notes: order.notes || ""
    });
    setEditError("");
  }

  function cancelEditOrder() {
    setEditingOrderId("");
    setEditForm(null);
    setEditError("");
  }

  async function saveOrderDetails(event) {
    event.preventDefault();
    if (!editingOrderId || !editForm || editSaving) return;
    setEditSaving(true);
    setEditError("");
    try {
      const saved = await api.customerHistory.updatePurchase(editingOrderId, editForm);
      setItems(current => current.map(order => String(order.id) === editingOrderId
        ? { ...order, ...saved }
        : order));
      cancelEditOrder();
    } catch (saveError) {
      setEditError(saveError.message || "Unable to update your order details.");
    } finally {
      setEditSaving(false);
    }
  }

  function canEditOrder(order) {
    return ["pending", "confirmed"].includes(String(order.status || "").toLowerCase());
  }

  function canEditBooking(booking) {
    return ["pending", "confirmed"].includes(String(booking.status || "").toLowerCase());
  }

  function beginEditBooking(booking) {
    setViewingBookingId(String(booking.id));
    setEditingBookingId(String(booking.id));
    setBookingEditForm({
      guestName: booking.guestName || "",
      guestEmail: booking.guestEmail || "",
      guestPhone: booking.guestPhone || "",
      bookingDate: dateTimeLocalInput(booking.bookingDate),
      locationLabel: booking.locationLabel || "",
      notes: booking.notes || ""
    });
    setBookingEditError("");
  }

  function cancelEditBooking() {
    setEditingBookingId("");
    setBookingEditForm(null);
    setBookingEditError("");
  }

  async function saveBookingDetails(event) {
    event.preventDefault();
    if (!editingBookingId || !bookingEditForm || bookingEditSaving) return;
    const selectedDate = new Date(bookingEditForm.bookingDate);
    if (Number.isNaN(selectedDate.getTime())) {
      setBookingEditError("Choose a valid booking date and time.");
      return;
    }
    setBookingEditSaving(true);
    setBookingEditError("");
    try {
      const saved = await api.customerHistory.updateBooking(editingBookingId, {
        ...bookingEditForm,
        bookingDate: selectedDate.toISOString()
      });
      setItems(current => current.map(booking => String(booking.id) === editingBookingId
        ? { ...booking, ...saved }
        : booking));
      cancelEditBooking();
    } catch (saveError) {
      setBookingEditError(saveError.message || "Unable to update your booking.");
    } finally {
      setBookingEditSaving(false);
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
        <div className="customer-history-status-filter">
          <select
            aria-label={isPurchases ? "Filter purchases by status" : "Filter bookings by status"}
            value={status}
            onChange={event => setStatus(event.target.value)}
          >
            {statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>
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
                  ? <Image src={item.image} alt={item.name || "Purchased product"} loading="lazy"/>
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
              <div className="customer-history-order-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="customer-history-view-toggle"
                  onClick={() => setViewingOrderId(current => current === String(order.id) ? "" : String(order.id))}
                  aria-expanded={viewingOrderId === String(order.id)}
                >
                  <FiEye aria-hidden="true"/>
                  {viewingOrderId === String(order.id) ? "Hide details" : "View order"}
                </Button>
                {canEditOrder(order) && <Button
                  type="button"
                  variant="outline"
                  className="customer-history-edit-toggle"
                  onClick={() => editingOrderId === String(order.id) ? cancelEditOrder() : beginEditOrder(order)}
                  aria-expanded={editingOrderId === String(order.id)}
                >
                  <FiEdit2 aria-hidden="true"/>
                  {editingOrderId === String(order.id) ? "Close editor" : "Edit details"}
                </Button>}
              </div>
            </div>
            {viewingOrderId === String(order.id) && <section className="customer-history-order-details" aria-label={`Details for ${order.orderNumber}`}>
              <div><small>Customer</small><span>{order.customerName || "—"}</span></div>
              <div><small>Phone</small><span>{order.customerPhone || "—"}</span></div>
              <div><small>Email</small><span>{order.customerEmail || "—"}</span></div>
              <div><small>Delivery address</small><span>{order.deliveryLocation || "—"}</span></div>
              <div><small>Payment method</small><span>{order.paymentMethod ? labelStatus(order.paymentMethod) : "—"}</span></div>
              <div><small>Amount paid</small><span>{money(order.amountPaid, order.currency)}</span></div>
              {order.paidAt && <div><small>Paid on</small><span>{dateTime(order.paidAt)}</span></div>}
              {order.courierName && <div><small>Courier</small><span>{order.courierName}</span></div>}
              {order.completedAt && <div><small>Completed</small><span>{dateTime(order.completedAt)}</span></div>}
              {order.notes && <div className="customer-history-order-note"><small>Order notes</small><span>{order.notes}</span></div>}
            </section>}
            {order.trackingUrl && <a className="customer-history-tracking" href={order.trackingUrl} target="_blank" rel="noreferrer">Track delivery <FiArrowUpRight/></a>}
            {editingOrderId === String(order.id) && editForm && <form className="customer-history-edit-form" onSubmit={saveOrderDetails}>
              <div className="customer-history-edit-heading">
                <div>
                  <span>ORDER CONTACT & DELIVERY</span>
                  <p>Update where the seller should contact you and deliver this order.</p>
                </div>
              </div>
              <div className="customer-history-edit-fields">
                <Label>Full name
                  <Input value={editForm.customerName} required maxLength="120" autoComplete="name"
                    onChange={event => setEditForm(current => ({ ...current, customerName: event.target.value }))}/>
                </Label>
                <Label>Phone number
                  <Input value={editForm.customerPhone} required maxLength="30" autoComplete="tel"
                    onChange={event => setEditForm(current => ({ ...current, customerPhone: event.target.value }))}/>
                </Label>
                <Label>Email address
                  <Input type="email" value={editForm.customerEmail} maxLength="150" autoComplete="email"
                    onChange={event => setEditForm(current => ({ ...current, customerEmail: event.target.value }))}/>
                </Label>
                <Label className="customer-history-edit-wide">Delivery address
                  <Input value={editForm.deliveryLocation} required maxLength="250" autoComplete="street-address"
                    onChange={event => setEditForm(current => ({ ...current, deliveryLocation: event.target.value }))}/>
                </Label>
                <Label className="customer-history-edit-wide">Order notes
                  <Textarea rows="2" maxLength="500" value={editForm.notes}
                    onChange={event => setEditForm(current => ({ ...current, notes: event.target.value }))}/>
                </Label>
              </div>
              {editError && <p className="error customer-history-edit-error" role="alert">{editError}</p>}
              <div className="customer-history-edit-actions">
                <Button type="button" variant="outline" onClick={cancelEditOrder} disabled={editSaving}>Cancel</Button>
                <Button type="submit" disabled={editSaving || !editForm.customerName.trim() || !editForm.customerPhone.trim() || !editForm.deliveryLocation.trim()}>
                  {editSaving ? "Saving…" : "Save details"}
                </Button>
              </div>
              <p className="customer-history-edit-note">Details can be changed while an order is pending or confirmed. Product quantities and prices remain unchanged.</p>
            </form>}
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
            <div className="customer-history-order-actions">
              <Button
                type="button"
                variant="outline"
                className="customer-history-view-toggle"
                onClick={() => setViewingBookingId(current => current === String(booking.id) ? "" : String(booking.id))}
                aria-expanded={viewingBookingId === String(booking.id)}
              >
                <FiEye aria-hidden="true"/>
                {viewingBookingId === String(booking.id) ? "Hide details" : "View booking"}
              </Button>
              {canEditBooking(booking) && <Button
                type="button"
                variant="outline"
                className="customer-history-edit-toggle"
                onClick={() => editingBookingId === String(booking.id) ? cancelEditBooking() : beginEditBooking(booking)}
                aria-expanded={editingBookingId === String(booking.id)}
              >
                <FiEdit2 aria-hidden="true"/>Edit booking
              </Button>}
            </div>
            {viewingBookingId === String(booking.id) && <section className="customer-history-order-details" aria-label={`Details for ${booking.bookingReference || "booking"}`}>
              <div><small>Customer</small><span>{booking.guestName || "—"}</span></div>
              <div><small>Email</small><span>{booking.guestEmail || "—"}</span></div>
              <div><small>Phone</small><span>{booking.guestPhone || "—"}</span></div>
              {booking.notes && <div className="customer-history-order-note"><small>Notes</small><span>{booking.notes}</span></div>}
            </section>}
            {editingBookingId === String(booking.id) && bookingEditForm && <form className="customer-history-edit-form" onSubmit={saveBookingDetails}>
              <div className="customer-history-edit-heading">
                <div>
                  <span>BOOKING DETAILS</span>
                  <p>Update your contact information, location, notes or preferred appointment time.</p>
                </div>
              </div>
              <div className="customer-history-edit-fields">
                <Label>Full name
                  <Input value={bookingEditForm.guestName} required maxLength="100" autoComplete="name"
                    onChange={event => setBookingEditForm(current => ({ ...current, guestName: event.target.value }))}/>
                </Label>
                <Label>Email address
                  <Input type="email" value={bookingEditForm.guestEmail} required maxLength="150" autoComplete="email"
                    onChange={event => setBookingEditForm(current => ({ ...current, guestEmail: event.target.value }))}/>
                </Label>
                <Label>Phone number
                  <Input value={bookingEditForm.guestPhone} required maxLength="30" autoComplete="tel"
                    onChange={event => setBookingEditForm(current => ({ ...current, guestPhone: event.target.value }))}/>
                </Label>
                <Label>Appointment date & time
                  <Input type="datetime-local" value={bookingEditForm.bookingDate} required
                    onChange={event => setBookingEditForm(current => ({ ...current, bookingDate: event.target.value }))}/>
                </Label>
                <Label className="customer-history-edit-wide">Location
                  <Input value={bookingEditForm.locationLabel} maxLength="200" autoComplete="street-address"
                    onChange={event => setBookingEditForm(current => ({ ...current, locationLabel: event.target.value }))}/>
                </Label>
                <Label className="customer-history-edit-wide">Notes for the business
                  <Textarea rows="2" maxLength="500" value={bookingEditForm.notes}
                    onChange={event => setBookingEditForm(current => ({ ...current, notes: event.target.value }))}/>
                </Label>
              </div>
              {bookingEditError && <p className="error customer-history-edit-error" role="alert">{bookingEditError}</p>}
              <div className="customer-history-edit-actions">
                <Button type="button" variant="outline" onClick={cancelEditBooking} disabled={bookingEditSaving}>Cancel</Button>
                <Button type="submit" disabled={bookingEditSaving || !bookingEditForm.guestName.trim() || !bookingEditForm.guestEmail.trim() || !bookingEditForm.guestPhone.trim()}>
                  {bookingEditSaving ? "Saving…" : "Save booking"}
                </Button>
              </div>
              <p className="customer-history-edit-note">Bookings can be edited while pending or confirmed. New appointment times are checked against the provider’s availability.</p>
            </form>}
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
