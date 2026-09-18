import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiPlay, FiRotateCcw, FiSlash, FiUserX } from "react-icons/fi";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";

const services = ["Consultation", "Technical Support", "Product Demo", "Project Meeting", "Discovery Call", "Other"];
const statuses = [
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["in_progress", "In Progress"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
  ["no_show", "No Show"]
];

const empty = {
  guestName: "",
  guestEmail: "",
  guestPhone: "",
  locationLabel: "",
  locationLatitude: null,
  locationLongitude: null,
  locationAccuracy: null,
  service: "Consultation",
  servicePrice: 0,
  currency: "PHP",
  bookingDate: "",
  notes: "",
  status: "pending"
};

function money(value, currency = "PHP") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

export default function BookingManager({ user }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.bookings.list().then(setItems).catch(e => setError(e.message));
    const socket = getRealtimeSocket();
    if (!socket) return;
    const upsert = booking => setItems(current => current.some(item => item._id === booking._id)
      ? current.map(item => item._id === booking._id ? { ...item, ...booking } : item)
      : [...current, booking]);
    const remove = ({ id }) => setItems(current => current.filter(item => item._id !== id));
    socket.on("booking:created", upsert);
    socket.on("booking:updated", upsert);
    socket.on("booking:deleted", remove);
    return () => {
      socket.off("booking:created", upsert);
      socket.off("booking:updated", upsert);
      socket.off("booking:deleted", remove);
    };
  }, []);

  const stats = useMemo(() => ({
    total: items.length,
    pending: items.filter(item => item.status === "pending").length,
    confirmed: items.filter(item => item.status === "confirmed").length,
    inProgress: items.filter(item => item.status === "in_progress").length,
    completed: items.filter(item => item.status === "completed").length
  }), [items]);

  async function save(event) {
    event.preventDefault();
    try {
      const original = editing ? items.find(item => item._id === editing) : null;
      if (form.status === "completed" && original?.status !== "completed") {
        const ok = confirm(`Mark this service completed? This will record ${money(form.servicePrice, form.currency)} as a sale.`);
        if (!ok) return;
      }
      if (original?.status === "completed" && form.status !== "completed") {
        const ok = confirm("Reopening this completed booking will void its recorded sale while keeping the sales history. Continue?");
        if (!ok) return;
      }

      const updated = editing ? await api.bookings.update(editing, form) : await api.bookings.create(form);
      setItems(current => editing
        ? current.map(item => item._id === editing ? updated : item)
        : (current.some(item => item._id === updated._id) ? current : [...current, updated]));
      setForm(empty);
      setEditing(null);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  function edit(booking) {
    setEditing(booking._id);
    setForm({
      guestName: booking.guestName,
      guestEmail: booking.guestEmail || "",
      guestPhone: booking.guestPhone || "",
      locationLabel: booking.locationLabel || "",
      locationLatitude: booking.locationLatitude ?? null,
      locationLongitude: booking.locationLongitude ?? null,
      locationAccuracy: booking.locationAccuracy ?? null,
      service: booking.service,
      servicePrice: Number(booking.servicePrice || 0),
      currency: booking.currency || "PHP",
      bookingDate: new Date(booking.bookingDate).toISOString().slice(0, 16),
      notes: booking.notes || "",
      status: booking.status
    });
  }

  async function changeStatus(booking, status) {
    try {
      if (status === "completed") {
        const ok = confirm(`Mark this service completed? BookFlow will record ${money(booking.servicePrice, booking.currency)} as a sale.`);
        if (!ok) return;
      }
      if (booking.status === "completed" && status !== "completed") {
        const ok = confirm("Reopening this completed booking will void its recorded sale while keeping an audit trail. Continue?");
        if (!ok) return;
      }
      const updated = await api.bookings.setStatus(booking._id, status);
      setItems(current => current.map(item => item._id === booking._id ? updated : item));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this booking? Bookings that already have a sales audit record cannot be deleted.")) return;
    try {
      await api.bookings.remove(id);
      setItems(current => current.filter(item => item._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  function statusActions(booking) {
    if (booking.status === "pending") return <>
      <button className="secondary" onClick={() => changeStatus(booking, "confirmed")}><FiCheckCircle />Confirm</button>
      <button className="danger" onClick={() => changeStatus(booking, "cancelled")}><FiSlash />Cancel</button>
    </>;
    if (booking.status === "confirmed") return <>
      <button className="primary-button compact-button" onClick={() => changeStatus(booking, "in_progress")}><FiPlay />Start service</button>
      <button className="secondary" onClick={() => changeStatus(booking, "no_show")}><FiUserX />No show</button>
      <button className="danger" onClick={() => changeStatus(booking, "cancelled")}><FiSlash />Cancel</button>
    </>;
    if (booking.status === "in_progress") return <button className="primary-button compact-button" onClick={() => changeStatus(booking, "completed")}><FiCheckCircle />Complete service</button>;
    if (booking.status === "completed") return <button className="secondary" onClick={() => changeStatus(booking, "in_progress")}><FiRotateCcw />Reopen</button>;
    return <button className="secondary" onClick={() => changeStatus(booking, "pending")}><FiRotateCcw />Reopen</button>;
  }

  const canCreate = user.accountStatus === "active";

  return <section id="bookings">
    <div className="stats-grid booking-stats-grid">
      <article className="stat-card"><span>Total bookings</span><strong>{stats.total}</strong></article>
      <article className="stat-card"><span>Pending</span><strong>{stats.pending}</strong></article>
      <article className="stat-card"><span>Confirmed</span><strong>{stats.confirmed}</strong></article>
      <article className="stat-card"><span>In progress</span><strong>{stats.inProgress}</strong></article>
      <article className="stat-card"><span>Completed</span><strong>{stats.completed}</strong></article>
    </div>
    {error && <p className="error">{error}</p>}

    <div className="workspace-grid booking-workspace-grid">
      <section className="panel booking-editor-panel">
        <div className="panel-title"><h2>{editing ? "Edit booking" : "New booking"}</h2></div>
        {!editing && !canCreate ? <p className="warning-note">New bookings cannot be created while this business is paused.</p> :
          <form onSubmit={save}>
            <div className="two-col">
              <label>Guest name<input value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} required /></label>
              <label>Guest email<input type="email" value={form.guestEmail} onChange={e => setForm({ ...form, guestEmail: e.target.value })} /></label>
            </div>
            <div className="two-col">
              <label>Phone number<input type="tel" value={form.guestPhone} onChange={e => setForm({ ...form, guestPhone: e.target.value })} placeholder="+63 912 345 6789" /></label>
              <label>Location / service address<input value={form.locationLabel} onChange={e => setForm({ ...form, locationLabel: e.target.value })} placeholder="Address, city, or area" maxLength="200" /></label>
            </div>
            <label>Service<select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>{services.map(service => <option key={service}>{service}</option>)}</select></label>
            <div className="two-col">
              <label>Service price<input type="number" min="0" step="0.01" value={form.servicePrice} onChange={e => setForm({ ...form, servicePrice: e.target.value })} /></label>
              <label>Currency<input maxLength="3" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) })} /></label>
            </div>
            <div className="two-col">
              <label>Date and time<input type="datetime-local" value={form.bookingDate} onChange={e => setForm({ ...form, bookingDate: e.target.value })} required /></label>
              <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <label>Notes<textarea rows="4" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="row-actions"><button className="primary-button">{editing ? "Save changes" : "Create booking"}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}</div>
          </form>}
      </section>

      <section className="panel booking-list-panel">
        <div className="panel-title"><h2>Guest bookings</h2></div>
        <div className="booking-list">
          {items.length === 0 ? <p className="muted">No bookings yet.</p> : items.map(booking => <article className="booking-card booking-lifecycle-card" key={booking._id}>
            <div className="booking-main">
              <h3><Link className="entity-link" to={`/dashboard/bookings/${booking._id}`}>{booking.service}</Link></h3>
              <p>{booking.guestName}{booking.guestPhone ? ` · ${booking.guestPhone}` : ""}</p>
              <small>{new Date(booking.bookingDate).toLocaleString()} · {money(booking.servicePrice, booking.currency)}</small>
              {booking.status === "completed" && <small className="sale-recorded-note">Sale recorded when completed</small>}
            </div>
            <div className="booking-card-right">
              <span className={`status ${booking.status}`}>{statuses.find(([value]) => value === booking.status)?.[1] || booking.status}</span>
              <div className="row-actions booking-status-actions">{statusActions(booking)}</div>
              <div className="row-actions booking-secondary-actions">
                <Link className="secondary button-link small-link" to={`/dashboard/bookings/${booking._id}`}>View</Link>
                <button className="secondary" onClick={() => edit(booking)}>Edit</button>
                <button className="danger" onClick={() => remove(booking._id)}>Delete</button>
              </div>
            </div>
          </article>)}
        </div>
      </section>
    </div>
  </section>;
}
