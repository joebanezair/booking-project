import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { api } from "../api.js";

export default function PublicBookingPage({ user }) {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const contentId = params.get("content") || "";
  const requestedService = params.get("service") || "Consultation";
  const [page, setPage] = useState(null);
  const [form, setForm] = useState({ guestName: user?.name || "", guestEmail: user?.email || "", service: requestedService, contentId, bookingDate: "", notes: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api.publicBooking.get(userId).then(setPage).catch(e => setError(e.message)); }, [userId]);
  async function submit(e) {
    e.preventDefault();
    try { setError(""); const result = await api.publicBooking.create(userId, form); setMessage(result.message); }
    catch (e) { setError(e.message); }
  }

  return <main className="public-shell"><section className="public-card">
    <Link className="brand-row" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link>
    {error && !page ? <p className="error">{error}</p> : !page ? <p>Loading...</p> : <>
      <p className="eyebrow">PUBLIC BOOKING</p><h1>Book time with {page.owner.name}</h1>
      {contentId && <p className="selected-content">Booking for <strong>{requestedService}</strong></p>}
      <form onSubmit={submit}><div className="two-col"><label>Your name<input value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} required /></label><label>Email<input type="email" value={form.guestEmail} onChange={e => setForm({ ...form, guestEmail: e.target.value })} required /></label></div>
        {!contentId && <label>Service<select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>{page.services.map(service => <option key={service}>{service}</option>)}</select></label>}
        <label>Date & time<input type="datetime-local" value={form.bookingDate} onChange={e => setForm({ ...form, bookingDate: e.target.value })} required /></label><label>Notes<textarea rows="4" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
        {error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}<button className="primary-button">Request booking</button>
      </form>
    </>}
  </section></main>;
}
