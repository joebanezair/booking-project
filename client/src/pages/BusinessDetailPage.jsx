import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiDollarSign, FiPause, FiPlay, FiSlash, FiStar } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { api } from "../api.js";

function money(value, currency = "PHP") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

export default function BusinessDetailPage({ user, onLogout }) {
  const { businessId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await api.admin.business(businessId));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, [businessId]);

  async function setStatus(accountStatus) {
    const action = accountStatus === "active" ? "reactivate" : accountStatus;
    if (!confirm(`Are you sure you want to ${action} this business?`)) return;
    try {
      await api.admin.setBusinessStatus(businessId, accountStatus);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const primarySales = data?.salesSummary?.totalsByCurrency?.[0];

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">BUSINESS DETAILS</p><h1>{data?.business?.name || "Business"}</h1></div><Link className="secondary button-link icon-link" to="/dashboard/businesses"><FiArrowLeft />Back to businesses</Link></header>
    {error ? <p className="error">{error}</p> : !data ? <p>Loading...</p> : <>
      <section className="panel admin-business-hero">
        <ProfileAvatar profile={{ name: data.business.name, profileImage: data.business.logo }} size="lg" />
        <div><h2>{data.business.name}</h2><p className="muted">{data.business.category || "General"} · {data.business.location || "No location set"}</p><p>{data.user.email}</p></div>
        <span className={`status ${data.user.accountStatus}`}>{data.user.accountStatus}</span>
        <div className="row-actions admin-status-actions">
          {data.user.accountStatus !== "paused" && data.user.accountStatus !== "disabled" && <button className="secondary" onClick={() => setStatus("paused")}><FiPause />Pause</button>}
          {data.user.accountStatus !== "active" && <button className="secondary" onClick={() => setStatus("active")}><FiPlay />Reactivate</button>}
          {data.user.accountStatus !== "disabled" && <button className="danger" onClick={() => setStatus("disabled")}><FiSlash />Disable</button>}
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><span>Services</span><strong>{data.services.length}</strong></article>
        <article className="stat-card"><span>Recent bookings shown</span><strong>{data.recentBookings.length}</strong></article>
        <article className="stat-card"><span>Recorded sales</span><strong>{data.salesSummary?.recorded || 0}</strong><small>{primarySales ? money(primarySales.total, primarySales.currency) : "No completed sales"}</small></article>
        <article className="stat-card"><span>Verified review rating</span><strong>{data.reviewSummary.averageRating || 0} <FiStar /></strong></article>
      </section>

      {data.salesSummary?.totalsByCurrency?.length > 1 && <section className="panel admin-business-sales-summary">
        <div className="panel-title"><h2>Recorded sales by currency</h2></div>
        <div className="currency-total-list">{data.salesSummary.totalsByCurrency.map(item => <div key={item.currency}><strong>{item.currency}</strong><span><FiDollarSign />{money(item.total, item.currency)}</span><small>{item.count} recorded sale{item.count === 1 ? "" : "s"}</small></div>)}</div>
      </section>}

      <div className="workspace-grid admin-business-detail-grid">
        <section className="panel">
          <div className="panel-title"><h2>Services</h2></div>
          {data.services.length === 0 ? <p className="muted">No services yet.</p> : <div className="simple-admin-list">{data.services.map(service => <div key={service._id}><div><strong>{service.title}</strong><small>{service.category} · {service.published ? "Published" : "Draft"} · {service.visibility}</small></div><Link to={`/services/${service._id}`}>View</Link></div>)}</div>}
        </section>
        <section className="panel">
          <div className="panel-title"><h2>Recent bookings</h2></div>
          {data.recentBookings.length === 0 ? <p className="muted">No bookings yet.</p> : <div className="simple-admin-list">{data.recentBookings.map(booking => <div key={booking._id}><div><strong>{booking.guestName}</strong><small>{booking.service} · {money(booking.servicePrice, booking.currency)} · {new Date(booking.bookingDate).toLocaleString()}</small></div><span className={`status ${booking.status}`}><FiCalendar />{booking.status}</span></div>)}</div>}
        </section>
      </div>
    </>}
  </AppLayout>;
}
