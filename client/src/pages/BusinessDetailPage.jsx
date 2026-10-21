import { Card } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiArrowLeft, FiBriefcase, FiCalendar, FiCheckCircle, FiClock,
  FiCreditCard, FiDollarSign, FiEye, FiPause, FiPlay, FiRefreshCw,
  FiShoppingBag, FiSlash, FiStar, FiTrendingUp
} from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { api } from "../api.js";

function money(value, currency = "PHP") {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function dateLabel(date) {
  if (!date) return "—";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Metric({ icon: Icon, label, value, note }) {
  return <Card as="article" className="admin-detail-metric">
    <div className="admin-detail-metric-icon"><Icon aria-hidden="true" /></div>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  </Card>;
}

export default function BusinessDetailPage({ user, onLogout }) {
  const { businessId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result = await api.admin.business(businessId);
      setData(result);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    api.admin.business(businessId)
      .then(result => { if (active) { setData(result); setError(""); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId]);

  async function setStatus(accountStatus) {
    if (busy) return;
    const action = accountStatus === "active" ? "reactivate" : accountStatus;
    if (!confirm(`Are you sure you want to ${action} this business?`)) return;
    setBusy(true);
    try {
      await api.admin.setBusinessStatus(businessId, accountStatus);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const userInfo = data?.user;
  const business = data?.business;
  const currencies = data?.financialSummary?.totalsByCurrency || [];
  const bookingSummary = data?.bookingSummary;
  const bookingsCompleted = bookingSummary?.statuses?.completed || 0;
  const recordedTransactions = currencies.reduce((sum, row) => sum + row.transactions, 0);
  const verifiedReviews = data?.reviewSummary?.count || 0;

  return <AppLayout user={user} onLogout={onLogout}>
    <div className="admin-detail-page">
      <header className="admin-detail-header">
        <div>
          <Button asChild variant="ghost" size="sm" className="admin-detail-back">
            <Link to="/dashboard/businesses"><FiArrowLeft aria-hidden="true" /> Business directory</Link>
          </Button>
          <p className="eyebrow">ADMINISTRATION / BUSINESS INSIGHTS</p>
          <h1>{business?.name || "Business performance"}</h1>
          <p className="muted">Account overview, completed sales, and business activity.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading}
          className="admin-detail-refresh" onClick={load}>
          <FiRefreshCw aria-hidden="true" /> Refresh data
        </Button>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && !data ? <p className="admin-detail-loading" role="status">Loading business statistics...</p> :
        !data ? !error && <p>No business data available.</p> : <>
          <section className="admin-detail-profile" aria-label="Business account">
            <ProfileAvatar profile={{ name: business.name, profileImage: userInfo.profileImage || business.logo }} size="lg" />
            <div className="admin-detail-profile-text">
              <h2>{business.name}</h2>
              <p>{business.category || "General"} · {business.location || "Location not specified"}</p>
              <small>{userInfo.email}</small>
            </div>
            <span className={`status admin-detail-status ${userInfo.accountStatus}`}>{userInfo.accountStatus}</span>
            <div className="admin-detail-profile-actions">
              {userInfo.accountStatus !== "paused" && userInfo.accountStatus !== "disabled" &&
                <Button type="button" variant="outline" size="sm" disabled={busy}
                  onClick={() => setStatus("paused")}><FiPause aria-hidden="true" /> Pause</Button>}
              {userInfo.accountStatus !== "active" &&
                <Button type="button" variant="outline" size="sm" disabled={busy}
                  onClick={() => setStatus("active")}><FiPlay aria-hidden="true" /> Reactivate</Button>}
              {userInfo.accountStatus !== "disabled" &&
                <Button type="button" variant="destructive" size="sm" disabled={busy}
                  onClick={() => setStatus("disabled")}><FiSlash aria-hidden="true" /> Disable</Button>}
            </div>
          </section>

          <section className="admin-detail-section" aria-labelledby="admin-earnings-title">
            <div className="admin-detail-section-heading">
              <div>
                <p className="eyebrow">FINANCIAL ACTIVITY</p>
                <h2 id="admin-earnings-title">Recorded gross sales</h2>
                <p className="muted">Service sales, recorded POS transactions, and completed online product orders.</p>
              </div>
              <span className="admin-detail-subtle"><FiTrendingUp aria-hidden="true" /> All-time figures</span>
            </div>

            {currencies.length === 0 ?
              <div className="admin-detail-empty">No completed or recorded sales yet.</div> :
              <div className="admin-detail-currency-grid">
                {currencies.map(row => <Card as="article" key={row.currency} className="admin-detail-finance-card">
                  <div className="admin-detail-finance-head">
                    <span className="admin-detail-finance-icon"><FiDollarSign aria-hidden="true" /></span>
                    <span className="admin-detail-currency">{row.currency}</span>
                  </div>
                  <span className="admin-detail-finance-label">Gross completed/recorded sales</span>
                  <strong className="admin-detail-finance-value">{money(row.gross, row.currency)}</strong>
                  <div className="admin-detail-finance-minis">
                    <div><FiClock aria-hidden="true" /><span>Last 30 days</span><strong>{money(row.last30Days, row.currency)}</strong></div>
                    <div><FiCheckCircle aria-hidden="true" /><span>Transactions</span><strong>{row.transactions}</strong></div>
                  </div>
                  <div className="admin-detail-finance-channels">
                    <h3>Sales by channel</h3>
                    <div><span><FiCalendar aria-hidden="true" /> Services</span><strong>{money(row.services, row.currency)}</strong></div>
                    <div><span><FiCreditCard aria-hidden="true" /> POS sales</span><strong>{money(row.pos, row.currency)}</strong></div>
                    <div><span><FiShoppingBag aria-hidden="true" /> Online orders</span><strong>{money(row.online, row.currency)}</strong></div>
                  </div>
                </Card>)}
              </div>}
            <p className="admin-detail-disclaimer">
              Gross operational sales are not net profit, verified payments, or payouts. Online totals use completed orders
              (excluding fully refunded or voided orders), which may include unpaid or partially paid orders.
              Expenses, processing fees and partial refunds are not deducted. Currencies are displayed separately.
            </p>
          </section>

          <section className="admin-detail-section" aria-labelledby="admin-activity-title">
            <div className="admin-detail-section-heading">
              <div><p className="eyebrow">ACCOUNT ACTIVITY</p><h2 id="admin-activity-title">Business statistics</h2></div>
            </div>
            <div className="admin-detail-metrics">
              <Metric icon={FiBriefcase} label="Services" value={data.serviceCount ?? data.services.length} note="Created services" />
              <Metric icon={FiCalendar} label="Total bookings" value={bookingSummary?.total ?? data.recentBookings.length} note="All booking statuses" />
              <Metric icon={FiCheckCircle} label="Completed bookings" value={bookingsCompleted} note="Completed services" />
              <Metric icon={FiShoppingBag} label="Sales transactions" value={recordedTransactions} note="Recorded / completed" />
              <Metric icon={FiStar} label="Verified rating" value={verifiedReviews ? `${data.reviewSummary.averageRating.toFixed(1)} / 5` : "—"}
                note={`${verifiedReviews} verified review${verifiedReviews === 1 ? "" : "s"}`} />
            </div>
            <div className="admin-detail-booking-statuses" aria-label="Booking statuses">
              {["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"].map(status =>
                <div key={status}>
                  <span>{status.replaceAll("_", " ")}</span>
                  <strong>{bookingSummary?.statuses?.[status] || 0}</strong>
                </div>
              )}
            </div>
          </section>

          <div className="admin-detail-lists">
            <section className="admin-detail-list-panel" aria-labelledby="admin-services-title">
              <div className="admin-detail-list-heading"><h2 id="admin-services-title">Recent services</h2><span>Latest 50</span></div>
              {data.services.length === 0 ? <p className="admin-detail-empty">No services yet.</p> :
                <div className="admin-detail-rows">{data.services.map(service =>
                  <div key={service._id} className="admin-detail-row">
                    <div><strong>{service.title}</strong><small>{service.category || "General"} · {service.published ? "Published" : "Draft"} · {service.visibility || "public"}</small></div>
                    <Button asChild variant="ghost" size="sm"><Link to={`/services/${service._id}`}><FiEye aria-hidden="true" /> View</Link></Button>
                  </div>
                )}</div>}
            </section>

            <section className="admin-detail-list-panel" aria-labelledby="admin-bookings-title">
              <div className="admin-detail-list-heading"><h2 id="admin-bookings-title">Recent bookings</h2><span>Latest 20</span></div>
              {data.recentBookings.length === 0 ? <p className="admin-detail-empty">No bookings yet.</p> :
                <div className="admin-detail-rows">{data.recentBookings.map(booking =>
                  <div key={booking._id} className="admin-detail-row">
                    <div>
                      <strong>{booking.service || "Service booking"}</strong>
                      <small>{dateLabel(booking.bookingDate)} · {money(booking.servicePrice, booking.currency)}</small>
                    </div>
                    <span className={`status ${booking.status}`}>{booking.status?.replaceAll("_", " ")}</span>
                  </div>
                )}</div>}
            </section>
          </div>
        </>}
    </div>
  </AppLayout>;
}
