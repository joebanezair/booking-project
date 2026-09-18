import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";

const services = ["Consultation", "Technical Support", "Product Demo", "Project Meeting", "Discovery Call", "Other"];
const empty = { guestName: "", service: "Consultation", bookingDate: "", notes: "", status: "pending" };

export default function BookingManager({ user }) {
  const isAdmin = user.role === "admin";
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.bookings.list().then(setItems).catch(e => setError(e.message));
    const socket = getRealtimeSocket();
    if (!socket) return;
    const upsert = booking => setItems(current => current.some(item => item._id === booking._id) ? current.map(item => item._id === booking._id ? booking : item) : [...current, booking]);
    const remove = ({ id }) => setItems(current => current.filter(item => item._id !== id));
    socket.on("booking:created", upsert); socket.on("booking:updated", upsert); socket.on("booking:deleted", remove);
    return () => { socket.off("booking:created", upsert); socket.off("booking:updated", upsert); socket.off("booking:deleted", remove); };
  }, []);

  const stats = useMemo(() => ({ total: items.length, pending: items.filter(item => item.status === "pending").length, confirmed: items.filter(item => item.status === "confirmed").length }), [items]);
  async function save(e) { e.preventDefault(); try { const updated = editing ? await api.bookings.update(editing, form) : await api.bookings.create(form); setItems(current => editing ? current.map(item => item._id === editing ? updated : item) : (current.some(item => item._id === updated._id) ? current : [...current, updated])); setForm(empty); setEditing(null); setError(""); } catch (e) { setError(e.message); } }
  function edit(booking) { setEditing(booking._id); setForm({ guestName: booking.guestName, service: booking.service, bookingDate: new Date(booking.bookingDate).toISOString().slice(0, 16), notes: booking.notes || "", status: booking.status }); }
  async function remove(id) { if (!confirm("Delete this booking?")) return; await api.bookings.remove(id); setItems(current => current.filter(item => item._id !== id)); }
  async function cancel(id) { if (!confirm("Cancel this booking request?")) return; try { const updated = await api.bookings.cancel(id); setItems(current => current.map(item => item._id === id ? updated : item)); } catch (e) { setError(e.message); } }

  return <section id="bookings"><div className="stats-grid"><article className="stat-card"><span>Total bookings</span><strong>{stats.total}</strong></article><article className="stat-card"><span>Pending</span><strong>{stats.pending}</strong></article><article className="stat-card"><span>Confirmed</span><strong>{stats.confirmed}</strong></article></div>{error && <p className="error">{error}</p>}<div className={isAdmin ? "workspace-grid" : "panel"}>{isAdmin && <form className="panel" onSubmit={save}><div className="panel-title"><h2>{editing ? "Edit booking" : "New booking"}</h2></div><label>Guest name<input value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} required /></label><label>Service<select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>{services.map(service => <option key={service}>{service}</option>)}</select></label><label>Date and time<input type="datetime-local" value={form.bookingDate} onChange={e => setForm({ ...form, bookingDate: e.target.value })} required /></label><label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>pending</option><option>confirmed</option><option>cancelled</option></select></label><label>Notes<textarea rows="4" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label><button className="primary-button">{editing ? "Save changes" : "Create booking"}</button></form>}<section className={isAdmin ? "panel" : ""}><div className="panel-title"><h2>{isAdmin ? "Business bookings" : "My bookings"}</h2></div><div className="booking-list">{items.length === 0 ? <p className="muted">{isAdmin ? "No bookings yet." : "You have not booked a service yet."}</p> : items.map(booking => <article className="booking-card" key={booking._id}><div><h3><Link className="entity-link" to={`/dashboard/bookings/${booking._id}`}>{booking.service}</Link></h3><p>{isAdmin && `${booking.guestName} · `}{new Date(booking.bookingDate).toLocaleString()}</p></div><div className="booking-card-right"><span className={`status ${booking.status}`}>{booking.status}</span><div className="row-actions"><Link className="secondary button-link small-link" to={`/dashboard/bookings/${booking._id}`}>View</Link>{isAdmin ? <><button className="secondary" onClick={() => edit(booking)}>Edit</button><button className="danger" onClick={() => remove(booking._id)}>Delete</button></> : booking.status !== "cancelled" && <button className="danger" onClick={() => cancel(booking._id)}>Cancel</button>}</div></div></article>)}</div></section></div></section>;
}
