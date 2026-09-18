import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";

const services = ["Consultation", "Technical Support", "Product Demo", "Project Meeting", "Discovery Call", "Other"];
const empty = {
  guestName: "",
  guestPhone: "",
  locationLabel: "",
  locationLatitude: null,
  locationLongitude: null,
  locationAccuracy: null,
  service: "Consultation",
  bookingDate: "",
  notes: "",
  status: "pending"
};

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
      ? current.map(item => item._id === booking._id ? booking : item)
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
    completed: items.filter(item => item.status === "completed").length
  }), [items]);

  async function save(event) {
    event.preventDefault();
    try {
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
      guestPhone: booking.guestPhone || "",
      locationLabel: booking.locationLabel || "",
      locationLatitude: booking.locationLatitude ?? null,
      locationLongitude: booking.locationLongitude ?? null,
      locationAccuracy: booking.locationAccuracy ?? null,
      service: booking.service,
      bookingDate: new Date(booking.bookingDate).toISOString().slice(0, 16),
      notes: booking.notes || "",
      status: booking.status
    });
  }

  async function remove(id) {
    if (!confirm("Delete this booking?")) return;
    try {
      await api.bookings.remove(id);
      setItems(current => current.filter(item => item._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  const canCreate = user.accountStatus === "active";

  return <section id="bookings">
    <div className="stats-grid">
      <article className="stat-card"><span>Total bookings</span><strong>{stats.total}</strong></article>
      <article className="stat-card"><span>Pending</span><strong>{stats.pending}</strong></article>
      <article className="stat-card"><span>Confirmed</span><strong>{stats.confirmed}</strong></article>
      <article className="stat-card"><span>Completed</span><strong>{stats.completed}</strong></article>
    </div>
    {error && <p className="error">{error}</p>}
    <div className="workspace-grid">
      <section className="panel">
        <div className="panel-title"><h2>{editing ? "Edit booking" : "New booking"}</h2></div>
        {!editing && !canCreate ? <p className="warning-note">New bookings cannot be created while this business is paused.</p> :
          <form onSubmit={save}>
            <label>Guest name<input value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} required /></label>
            <label>Phone number<input type="tel" value={form.guestPhone} onChange={e => setForm({ ...form, guestPhone: e.target.value })} placeholder="+63 912 345 6789" /></label>
            <label>Location / service address<input value={form.locationLabel} onChange={e => setForm({ ...form, locationLabel: e.target.value })} placeholder="Address, city, or area" maxLength="200" /></label>
            <label>Service<select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>{services.map(service => <option key={service}>{service}</option>)}</select></label>
            <label>Date and time<input type="datetime-local" value={form.bookingDate} onChange={e => setForm({ ...form, bookingDate: e.target.value })} required /></label>
            <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="pending">pending</option><option value="confirmed">confirmed</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select></label>
            <label>Notes<textarea rows="4" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="row-actions"><button className="primary-button">{editing ? "Save changes" : "Create booking"}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}</div>
          </form>}
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Guest bookings</h2></div>
        <div className="booking-list">
          {items.length === 0 ? <p className="muted">No bookings yet.</p> : items.map(booking => <article className="booking-card" key={booking._id}>
            <div><h3><Link className="entity-link" to={`/dashboard/bookings/${booking._id}`}>{booking.service}</Link></h3><p>{booking.guestName}{booking.guestPhone ? ` · ${booking.guestPhone}` : ""} · {new Date(booking.bookingDate).toLocaleString()}</p></div>
            <div className="booking-card-right"><span className={`status ${booking.status}`}>{booking.status}</span><div className="row-actions"><Link className="secondary button-link small-link" to={`/dashboard/bookings/${booking._id}`}>View</Link><button className="secondary" onClick={() => edit(booking)}>Edit</button><button className="danger" onClick={() => remove(booking._id)}>Delete</button></div></div>
          </article>)}
        </div>
      </section>
    </div>
  </section>;
}
