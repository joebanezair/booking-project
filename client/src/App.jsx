import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const services = ["Consultation", "Technical Support", "Product Demo", "Project Meeting", "Discovery Call", "Other"];

const emptyBooking = {
  guestName: "",
  service: "Consultation",
  bookingDate: "",
  notes: "",
  status: "pending"
};

function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const data = mode === "register"
        ? await api.register(form)
        : await api.login({ email: form.email, password: form.password });

      localStorage.setItem("booking_token", data.token);
      localStorage.setItem("booking_user", JSON.stringify(data.user));
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <div className="auth-hero">
          <span className="brand-mark">B</span>
          <p className="eyebrow light">BOOKFLOW</p>
          <h1>Simple scheduling.<br />Clear follow-through.</h1>
          <p>Manage appointments, track booking status, and keep every client interaction organized in one place.</p>
          <div className="feature-pills">
            <span>Secure authentication</span>
            <span>Booking CRUD</span>
            <span>MongoDB persistence</span>
          </div>
        </div>

        <section className="auth-card">
          <div className="auth-card-header">
            <p className="eyebrow">WELCOME</p>
            <h2>{mode === "login" ? "Sign in to BookFlow" : "Create your account"}</h2>
            <p className="muted">{mode === "login" ? "Continue to your booking dashboard." : "Start managing your appointments."}</p>
          </div>

          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Full name
                <input autoComplete="name" placeholder="Your name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
            )}
            <label>
              Email address
              <input type="email" autoComplete="email" placeholder="you@example.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label>
              Password
              <input type="password" minLength="8"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Minimum 8 characters" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </label>

            {error && <p className="error">{error}</p>}
            <button className="primary-button" disabled={busy}>
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button className="link-button auth-switch" onClick={() => {
            setError("");
            setMode(mode === "login" ? "register" : "login");
          }}>
            {mode === "login" ? "New to BookFlow? Create an account" : "Already registered? Sign in"}
          </button>
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value, detail }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Dashboard({ user, onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState(emptyBooking);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: bookings.length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      pending: bookings.filter((b) => b.status === "pending").length,
      upcoming: bookings.filter((b) => b.status !== "cancelled" && new Date(b.bookingDate) >= now).length
    };
  }, [bookings]);

  const visibleBookings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...bookings]
      .filter((booking) => statusFilter === "all" || booking.status === statusFilter)
      .filter((booking) => {
        if (!normalizedQuery) return true;
        return [booking.guestName, booking.service, booking.notes]
          .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => new Date(a.bookingDate) - new Date(b.bookingDate));
  }, [bookings, query, statusFilter]);

  async function loadBookings() {
    try {
      setBookings(await api.bookings.list());
      setError("");
    } catch (err) {
      setError(err.message);
      if (/token|auth/i.test(err.message)) onLogout();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editingId) {
        const updated = await api.bookings.update(editingId, form);
        setBookings((items) => items.map((item) => item._id === editingId ? updated : item));
      } else {
        const created = await api.bookings.create(form);
        setBookings((items) => [...items, created]);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function editBooking(booking) {
    setEditingId(booking._id);
    setForm({
      guestName: booking.guestName,
      service: booking.service,
      bookingDate: new Date(booking.bookingDate).toISOString().slice(0, 16),
      notes: booking.notes || "",
      status: booking.status
    });
    document.getElementById("booking-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function changeStatus(booking, status) {
    try {
      const updated = await api.bookings.update(booking._id, { ...booking, status });
      setBookings((items) => items.map((item) => item._id === booking._id ? updated : item));
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeBooking(id) {
    if (!window.confirm("Delete this booking permanently?")) return;
    try {
      await api.bookings.remove(id);
      setBookings((items) => items.filter((item) => item._id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyBooking);
  }

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <main className="page-shell">
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <span className="brand-mark small">B</span>
            <div><strong>BookFlow</strong><small>MERN Booking Manager</small></div>
          </div>
          <nav className="sidebar-nav">
            <a className="active" href="#dashboard">Dashboard</a>
            <a href="#booking-form">New booking</a>
            <a href="#bookings">Bookings</a>
          </nav>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{firstName.charAt(0).toUpperCase()}</div>
          <div><strong>{user?.name}</strong><small>{user?.email}</small></div>
          <button className="icon-button" onClick={onLogout} title="Sign out">↗</button>
        </div>
      </aside>

      <section className="content-shell" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">DASHBOARD</p>
            <h1>Good to see you, {firstName}.</h1>
            <p className="muted">Here’s what’s happening with your bookings.</p>
          </div>
          <button className="primary-button compact"
            onClick={() => document.getElementById("booking-form")?.scrollIntoView({ behavior: "smooth" })}>
            + New booking
          </button>
        </header>

        <section className="stats-grid">
          <StatCard label="Total bookings" value={stats.total} detail="All appointments" />
          <StatCard label="Upcoming" value={stats.upcoming} detail="Still on schedule" />
          <StatCard label="Confirmed" value={stats.confirmed} detail="Ready to go" />
          <StatCard label="Pending" value={stats.pending} detail="Needs attention" />
        </section>

        {error && <p className="error dashboard-error">{error}</p>}

        <section className="workspace-grid">
          <form id="booking-form" className="panel booking-form" onSubmit={submit}>
            <div className="panel-title">
              <div><p className="eyebrow">SCHEDULE</p><h2>{editingId ? "Edit booking" : "Create booking"}</h2></div>
              {editingId && <button type="button" className="link-button" onClick={resetForm}>Cancel</button>}
            </div>

            <label>
              Client / guest
              <input placeholder="e.g. Alex Johnson" value={form.guestName}
                onChange={(e) => setForm({ ...form, guestName: e.target.value })} required />
            </label>
            <label>
              Service
              <select value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
                {services.map((service) => <option key={service} value={service}>{service}</option>)}
              </select>
            </label>
            <label>
              Date and time
              <input type="datetime-local" value={form.bookingDate}
                onChange={(e) => setForm({ ...form, bookingDate: e.target.value })} required />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label>
              Notes
              <textarea rows="4" maxLength="500" placeholder="Add context, requirements, or reminders..."
                value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <small className="field-hint">{form.notes.length}/500 characters</small>
            </label>

            <button className="primary-button" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Create booking"}
            </button>
          </form>

          <section id="bookings" className="panel bookings-panel">
            <div className="bookings-toolbar">
              <div><p className="eyebrow">APPOINTMENTS</p><h2>Your bookings</h2></div>
              <span className="count">{visibleBookings.length}</span>
            </div>

            <div className="filters">
              <input className="search-input" type="search" placeholder="Search guest, service, notes..."
                value={query} onChange={(e) => setQuery(e.target.value)} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {loading ? (
              <div className="empty-state"><p className="muted">Loading bookings...</p></div>
            ) : visibleBookings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⌁</div>
                <h3>{bookings.length ? "No matching bookings" : "No bookings yet"}</h3>
                <p className="muted">{bookings.length ? "Try changing your search or filter." : "Create your first appointment to get started."}</p>
              </div>
            ) : (
              <div className="booking-list">
                {visibleBookings.map((booking) => {
                  const bookingDate = new Date(booking.bookingDate);
                  const isPast = bookingDate < new Date();
                  return (
                    <article className="booking-card" key={booking._id}>
                      <div className="date-tile">
                        <span>{bookingDate.toLocaleDateString([], { month: "short" })}</span>
                        <strong>{bookingDate.getDate()}</strong>
                      </div>
                      <div className="booking-main">
                        <div className="booking-heading">
                          <div><h3>{booking.guestName}</h3><p>{booking.service}</p></div>
                          <span className={"status " + booking.status}>{booking.status}</span>
                        </div>
                        <div className="booking-meta">
                          <span>{bookingDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>•</span>
                          <span>{isPast ? "Past booking" : "Upcoming"}</span>
                        </div>
                        {booking.notes && <p className="booking-notes">{booking.notes}</p>}
                        <div className="booking-footer">
                          <select className="status-select" value={booking.status}
                            onChange={(e) => changeStatus(booking, e.target.value)}>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <div className="row-actions">
                            <button className="secondary" onClick={() => editBooking(booking)}>Edit</button>
                            <button className="danger" onClick={() => removeBooking(booking._id)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("booking_user")); }
    catch { return null; }
  });

  function logout() {
    localStorage.removeItem("booking_token");
    localStorage.removeItem("booking_user");
    setUser(null);
  }

  return user ? <Dashboard user={user} onLogout={logout} /> : <Auth onAuthenticated={setUser} />;
}
