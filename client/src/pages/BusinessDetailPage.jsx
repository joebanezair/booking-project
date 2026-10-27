import { Card } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiAlertCircle, FiArrowLeft, FiBarChart2, FiCalendar, FiCheckCircle, FiClock,
  FiCreditCard, FiEye, FiInbox, FiLayers, FiPause, FiPlay, FiRefreshCw,
  FiShoppingBag, FiSlash, FiStar, FiTrendingUp, FiX
} from "react-icons/fi";
import { PiCoin } from "react-icons/pi";
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

function Metric({ icon: Icon, label, value, note, tone = "neutral" }) {
  return <Card as="article" className={`admin-detail-metric admin-detail-metric--${tone}`}>
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
  const [featureDays, setFeatureDays] = useState({ pos: 30, booking: 30 });
  const [featureSaving, setFeatureSaving] = useState("");
  const [featureToast, setFeatureToast] = useState(null);

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

  useEffect(() => {
    if (!featureToast) return undefined;
    const timeout = window.setTimeout(() => setFeatureToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [featureToast]);

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

  async function updateFeature(feature, enabled) {
    if (featureSaving) return;
    if (!enabled && !window.confirm(`Deactivate ${feature === "pos" ? "POS" : "Bookings & Services"} access for this business? ${feature === "pos" ? "New POS checkouts" : "Service posting and new bookings"} will be blocked until reactivated.`)) return;
    setFeatureSaving(feature);
    setFeatureToast(null);
    setError("");
    try {
      const response = await api.admin.setBusinessFeature(businessId, feature, enabled, featureDays[feature]);
      setData(current => current ? { ...current, user: { ...current.user, featureAccess: response.featureAccess } } : current);
      setFeatureToast({ message: `${feature === "pos" ? "POS" : "Booking"} access ${enabled ? "activated for " + featureDays[feature] + " days" : "deactivated"}.`, enabled });
    } catch (e) {
      setError(e.message || "Could not update feature access.");
    } finally {
      setFeatureSaving("");
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
          <p className="eyebrow">Business account</p>
          <h1>Business insights</h1>
          <p className="muted">Sales, bookings, activity and account controls.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading}
          className={`admin-detail-refresh ${loading ? "is-loading" : ""}`} onClick={load}>
          <FiRefreshCw aria-hidden="true" /> Refresh
        </Button>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && !data ? <p className="admin-detail-loading" role="status">Loading business statistics...</p> :
        !data ? !error && <p>No business data available.</p> : <>
          <section className="admin-detail-profile" aria-label="Business account">
            <ProfileAvatar profile={{ name: business.name, profileImage: userInfo.profileImage || business.logo }} size="lg" />
            <div className="admin-detail-profile-text">
              <div className="admin-detail-profile-identity-heading">
                <h2>{business.name}</h2>
                <span className={`status admin-detail-status ${userInfo.accountStatus}`}>{userInfo.accountStatus}</span>
              </div>
              <p>{business.category || "General"} <span aria-hidden="true">·</span> {business.location || "Location not specified"}</p>
              <small>{userInfo.email}</small>
            </div>
            <div className="admin-detail-profile-controls">
              <div className="admin-detail-profile-actions">
                {userInfo.username && <Button asChild variant="outline" size="sm" className="admin-detail-view-profile">
                  <Link to={`/profile/${encodeURIComponent(userInfo.username)}`} target="_blank" rel="noopener noreferrer"
                    aria-label={`View ${business.name} public business profile`}>
                    <FiEye aria-hidden="true" /> View Business Profile
                  </Link>
                </Button>}
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
            </div>
          </section>

          <section className="admin-detail-section admin-detail-sales-section" aria-labelledby="admin-earnings-title">
            <div className="admin-detail-section-heading">
              <div>
                <p className="eyebrow">FINANCIAL ACTIVITY</p>
                <h2 id="admin-earnings-title">Recorded gross sales</h2>
                <p className="muted">Service sales, recorded POS transactions, and completed online product orders.</p>
              </div>
              <details className="admin-detail-financial-info">
                <summary className="admin-detail-subtle"><FiTrendingUp aria-hidden="true" /> All-time figures</summary>
                <p>Gross sales represent recorded operational activity, not net profit or verified payouts. Completed online orders may include unpaid or partially paid orders. Expenses, fees, and partial refunds are not deducted; currencies remain separate.</p>
              </details>
            </div>

            {currencies.length === 0 ?
              <div className="admin-detail-sales-empty" role="status"><span className="admin-detail-empty-icon"><PiCoin aria-hidden="true" /></span><div><strong>No sales recorded yet</strong><p>Gross sales and channel breakdowns will appear here after transactions are recorded.</p></div></div> :
              <div className="admin-detail-currency-grid">
                {currencies.map(row => <Card as="article" key={row.currency} className="admin-detail-finance-card">
                  <div className="admin-detail-finance-head">
                    <span className="admin-detail-finance-icon"><PiCoin aria-hidden="true" /></span>
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
           </section>

          <section className="admin-detail-section" aria-labelledby="admin-activity-title">
            <div className="admin-detail-section-heading">
              <div><p className="eyebrow">BUSINESS STATISTICS</p><h2 id="admin-activity-title">Business statistics</h2></div>
            </div>
            <div className="admin-detail-metrics">
              <Metric tone="blue" icon={FiBarChart2} label="Services" value={data.serviceCount ?? data.services.length} note="Created services" />
              <Metric tone="purple" icon={FiCalendar} label="Total bookings" value={bookingSummary?.total ?? data.recentBookings.length} note="All booking statuses" />
              <Metric tone="green" icon={FiCheckCircle} label="Completed bookings" value={bookingsCompleted} note="Completed services" />
              <Metric tone="blue" icon={FiCreditCard} label="Sales transactions" value={recordedTransactions} note="Recorded / completed" />
              <Metric tone="neutral" icon={FiStar} label="Verified rating" value={verifiedReviews ? `${data.reviewSummary.averageRating.toFixed(1)} / 5` : "—"}
                note={`${verifiedReviews} verified review${verifiedReviews === 1 ? "" : "s"}`} />
            </div>
            <div className="admin-detail-booking-breakdown">
              <h3>Booking breakdown</h3>
              <div className="admin-detail-booking-statuses" aria-label="Booking statuses">
                {["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"].map(status =>
                  <div key={status} className={`admin-detail-booking-status admin-detail-booking-status--${status}`}>
                    <span>{status.replaceAll("_", " ")}</span>
                    <strong>{bookingSummary?.statuses?.[status] || 0}</strong>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="admin-detail-section admin-detail-feature-plan" aria-labelledby="feature-plan-title">
            <div className="admin-detail-section-heading">
              <div>
                <p className="eyebrow">ACCESS MANAGEMENT</p>
                <h2 id="feature-plan-title">Feature plan</h2>
                <p className="muted">Control access independently for each feature. Changes take effect immediately.</p>
              </div>
            </div>
            <div className="admin-detail-feature-grid">
              {[
                { key: "pos", label: "Point of sale", Icon: FiCreditCard, description: "Controls Products, POS and Online Orders access." },
                { key: "booking", label: "Bookings & services", Icon: FiCalendar, description: "Manage services, post listings, and accept bookings." }
              ].map(({ key, label, Icon, description }) => {
                const plan = userInfo.featureAccess?.[key] || { enabled: true, active: true, expiresAt: null, expired: false };
                const pastExpiry = plan.expiresAt && new Date(plan.expiresAt).getTime() <= Date.now();
                const active = plan.enabled !== false && plan.active !== false && !pastExpiry;
                const expired = plan.enabled !== false && (plan.expired || pastExpiry);
                const status = active ? "Active" : expired ? "Expired" : "Inactive";
                return <article className={`admin-detail-feature-card ${active ? "is-active" : "is-inactive"}`} key={key}>
                  <div className="admin-detail-feature-head">
                    <span className="admin-detail-feature-icon"><Icon aria-hidden="true" /></span>
                    <div className="admin-detail-feature-info">
                      <h3>{label}</h3>
                      <p>{description}</p>
                    </div>
                    <span className={`admin-detail-feature-badge ${active ? "active" : expired ? "expired" : "inactive"}`}>{status}</span>
                  </div>
                  {plan.expiresAt && <div className="admin-detail-feature-expiry">
                    <FiClock aria-hidden="true" />
                    <span>{expired ? "Expired" : "Expires"} on {dateLabel(plan.expiresAt)}</span>
                  </div>}
                  <div className="admin-detail-feature-controls">
                    <div className="admin-detail-feature-duration">
                      <label htmlFor={`feature-duration-${key}`}>Access duration</label>
                      <select id={`feature-duration-${key}`} value={featureDays[key]}
                        disabled={Boolean(featureSaving)}
                        onChange={event => setFeatureDays(current => ({ ...current, [key]: Number(event.target.value) }))}>
                        {[7, 30, 90, 365].map(days => <option key={days} value={days}>{days === 365 ? "1 year" : `${days} days`}</option>)}
                      </select>
                    </div>
                    <div className="admin-detail-feature-buttons">
                      <Button type="button" variant="default" size="sm"
                        disabled={Boolean(featureSaving)}
                        onClick={() => updateFeature(key, true)}>
                        <FiPlay aria-hidden="true" /> {featureSaving === key ? "Saving..." : active ? "Renew" : "Activate"}
                      </Button>
                      <Button type="button" variant="outline" size="sm"
                        disabled={Boolean(featureSaving) || plan.enabled === false}
                        onClick={() => updateFeature(key, false)}>
                        <FiSlash aria-hidden="true" /> Deactivate
                      </Button>
                    </div>
                  </div>
                </article>;
              })}
            </div>
          </section>

          <section className="admin-detail-section admin-detail-recent" aria-labelledby="admin-recent-title">
            <div className="admin-detail-section-heading">
              <div>
                <p className="eyebrow">RECENT ACTIVITY</p>
                <h2 id="admin-recent-title">Services & bookings</h2>
                <p className="muted">Review the business's latest services and booking activity.</p>
              </div>
            </div>
            <div className="admin-detail-lists">
              <section className="admin-detail-list-panel" aria-labelledby="admin-services-title">
                <div className="admin-detail-list-heading"><h3 id="admin-services-title">Recent services</h3><span>Latest 50</span></div>
                {data.services.length === 0 ?
                  <div className="admin-detail-list-empty">
                    <span className="admin-detail-empty-icon"><FiLayers aria-hidden="true" /></span>
                    <div><strong>No services yet</strong><p>Created services will appear here.</p></div>
                  </div>
                  : <div className="admin-detail-rows">{data.services.map(service =>
                    <div key={service._id} className="admin-detail-row">
                      <div>
                        <strong>{service.title}</strong>
                        <small>{service.category || "General"} · {service.published ? "Published" : "Draft"} · {service.visibility || "public"}</small>
                      </div>
                      {service.published && service.visibility !== "private" &&
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/services/${service._id}`}><FiEye aria-hidden="true" /> View</Link>
                        </Button>}
                    </div>
                  )}</div>}
              </section>
              <section className="admin-detail-list-panel" aria-labelledby="admin-bookings-title">
                <div className="admin-detail-list-heading"><h3 id="admin-bookings-title">Recent bookings</h3><span>Latest 20</span></div>
                {data.recentBookings.length === 0 ?
                  <div className="admin-detail-list-empty">
                    <span className="admin-detail-empty-icon"><FiInbox aria-hidden="true" /></span>
                    <div><strong>No bookings yet</strong><p>New bookings will appear here.</p></div>
                  </div>
                  : <div className="admin-detail-rows">{data.recentBookings.map(booking =>
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
          </section>

        </>}
      {featureToast && <div className="admin-detail-feature-toast" role="status" aria-live="polite">
        <span className="admin-detail-feature-toast-icon" aria-hidden="true">
          {featureToast.enabled ? <FiCheckCircle /> : <FiAlertCircle />}
        </span>
        <div className="admin-detail-feature-toast-copy">
          <strong>{featureToast.message}</strong>
          <span>Feature plan updated successfully.</span>
        </div>
        <Button type="button" variant="plain" size="icon-sm"
          className="admin-detail-feature-toast-close" aria-label="Dismiss feature plan notification"
          onClick={() => setFeatureToast(null)}>
          <FiX aria-hidden="true" />
        </Button>
      </div>}
    </div>
  </AppLayout>;
}
