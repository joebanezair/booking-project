import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiCopy, FiDollarSign, FiMail, FiMapPin, FiPhone, FiPlay, FiRotateCcw, FiSlash, FiStar, FiTag, FiUser, FiUserX } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import PriceDisplay from "../components/PriceDisplay.jsx";
import { api } from "../api.js";

const statusLabels = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show"
};

function money(value, currency = "PHP") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

export default function BookingDetailPage({ user, onLogout }) {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      setBooking(await api.bookings.get(bookingId));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, [bookingId]);

  const hasCoordinates = booking?.locationLatitude != null && booking?.locationLongitude != null;
  const mapUrl = hasCoordinates
    ? `https://www.openstreetmap.org/?mlat=${booking.locationLatitude}&mlon=${booking.locationLongitude}#map=18/${booking.locationLatitude}/${booking.locationLongitude}`
    : "";
  const reviewUrl = booking?.reviewInvite?.token ? `${window.location.origin}/review/${booking.reviewInvite.token}` : "";

  async function copyReviewLink() {
    if (!reviewUrl) return;
    await navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function changeStatus(status) {
    try {
      if (status === "completed") {
        const ok = confirm(`Mark this service completed? BookFlow will record ${money(booking.servicePrice, booking.currency)} as a sale.`);
        if (!ok) return;
      }
      if (booking.status === "completed" && status !== "completed") {
        const ok = confirm("Reopening this booking will void its recorded sale while preserving the sales audit history. Continue?");
        if (!ok) return;
      }
      setBooking(await api.bookings.setStatus(booking._id, status));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  function actionButtons() {
    if (!booking) return null;
    if (booking.status === "pending") return <>
      <button className="primary-button compact-button" onClick={() => changeStatus("confirmed")}><FiCheckCircle />Confirm booking</button>
      <button className="danger" onClick={() => changeStatus("cancelled")}><FiSlash />Cancel</button>
    </>;
    if (booking.status === "confirmed") return <>
      <button className="primary-button compact-button" onClick={() => changeStatus("in_progress")}><FiPlay />Start service</button>
      <button className="secondary" onClick={() => changeStatus("no_show")}><FiUserX />No show</button>
      <button className="danger" onClick={() => changeStatus("cancelled")}><FiSlash />Cancel</button>
    </>;
    if (booking.status === "in_progress") return <button className="primary-button compact-button" onClick={() => changeStatus("completed")}><FiCheckCircle />Mark service completed</button>;
    if (booking.status === "completed") return <button className="secondary" onClick={() => changeStatus("in_progress")}><FiRotateCcw />Reopen booking</button>;
    return <button className="secondary" onClick={() => changeStatus("pending")}><FiRotateCcw />Reopen as pending</button>;
  }

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div><p className="eyebrow">BOOKING DETAILS</p><h1>{booking?.guestName || "Booking"}</h1></div>
      <Link className="secondary button-link icon-link" to="/dashboard/bookings"><FiArrowLeft />Back to bookings</Link>
    </header>

    {error && <p className="error">{error}</p>}
    {!booking ? !error && <p>Loading...</p> :
      <section className="panel booking-detail">
        <div className="booking-detail-actions">{actionButtons()}</div>

        <div className="booking-detail-grid">
          <div><FiUser /><span>Guest</span><strong>{booking.guestName}</strong>{booking.bookingReference && <small>{booking.bookingReference}</small>}</div>
          {booking.guestEmail && <a href={`mailto:${booking.guestEmail}`}><FiMail /><span>Email</span><strong>{booking.guestEmail}</strong></a>}
          {booking.guestPhone && <a href={`tel:${booking.guestPhone}`}><FiPhone /><span>Phone</span><strong>{booking.guestPhone}</strong></a>}
          <div><FiCalendar /><span>Date and time</span><strong>{new Date(booking.bookingDate).toLocaleString()}</strong><small>{booking.serviceDurationMinutes || 60} min service{booking.bufferMinutes ? ` · ${booking.bufferMinutes} min buffer` : ""}</small></div>
          <div><FiTag /><span>Status</span><strong className={`status ${booking.status}`}>{statusLabels[booking.status] || booking.status}</strong></div>
          <div><FiDollarSign /><span>Booked price</span><strong>{money(booking.servicePrice, booking.currency)}</strong></div>
          {(booking.locationLabel || hasCoordinates) && (hasCoordinates
            ? <a href={mapUrl} target="_blank" rel="noreferrer"><FiMapPin /><span>Location</span><strong>{booking.locationLabel || "Detected location"}</strong>{booking.locationAccuracy != null && <small>Accuracy about {Math.round(booking.locationAccuracy)} m</small>}</a>
            : <div><FiMapPin /><span>Location</span><strong>{booking.locationLabel}</strong></div>)}
        </div>

        <div className="booking-detail-service">
          <p className="eyebrow">SERVICE</p>
          <h2>{booking.content?.title || booking.service}</h2>
          {booking.content?.description && <p>{booking.content.description}</p>}
          <PriceDisplay price={booking.servicePrice ?? booking.content?.price ?? 0} currency={booking.currency || booking.content?.currency || "PHP"} />
          {booking.content?.published && booking.content?.visibility !== "private" && <Link className="primary-button button-link" to={`/services/${booking.content._id}`}>View public service</Link>}
        </div>

        {booking.saleRecord && <div className={`booking-sale-record ${booking.saleRecord.status}`}>
          <p className="eyebrow">SALE RECORD</p>
          <div className="sale-record-summary">
            <div><span>Status</span><strong>{booking.saleRecord.status === "recorded" ? "Recorded sale" : "Voided sale"}</strong></div>
            <div><span>Amount</span><strong>{money(booking.saleRecord.saleAmount, booking.saleRecord.currency)}</strong></div>
            <div><span>Completed</span><strong>{new Date(booking.saleRecord.completedAt).toLocaleString()}</strong></div>
          </div>
          {booking.saleRecord.status === "voided" && <p className="muted">Voided {booking.saleRecord.voidedAt ? new Date(booking.saleRecord.voidedAt).toLocaleString() : ""}{booking.saleRecord.voidReason ? ` · ${booking.saleRecord.voidReason}` : ""}</p>}
          {booking.saleRecord.status === "recorded" && <Link className="secondary button-link" to="/dashboard/sales">View Sales & Analytics</Link>}
        </div>}

        {booking.status === "completed" && <div className="booking-review-invite">
          <p className="eyebrow">VERIFIED REVIEW</p>
          {booking.reviewInvite?.verified ? <p className="success"><FiStar /> The guest has submitted a verified review for this booking.</p> :
            reviewUrl ? <><p>Share this one-time review link with the guest. It only works while this booking remains completed.</p><div className="review-link-row"><input value={reviewUrl} readOnly /><button className="secondary" onClick={copyReviewLink}><FiCopy />{copied ? "Copied" : "Copy link"}</button></div></> :
            <p className="muted">The review link is being prepared.</p>}
        </div>}

        {booking.customAnswers?.length > 0 && <div className="booking-detail-notes"><p className="eyebrow">BOOKING ANSWERS</p>{booking.customAnswers.map(answer => <p key={answer.questionId}><strong>{answer.label}:</strong> {answer.value}</p>)}</div>}
        {booking.notes && <div className="booking-detail-notes"><p className="eyebrow">GUEST NOTES</p><p>{booking.notes}</p></div>}
        {booking.internalNotes && <div className="booking-detail-notes"><p className="eyebrow">INTERNAL BUSINESS NOTES</p><p>{booking.internalNotes}</p></div>}
        {booking.history?.length > 0 && <div className="booking-detail-notes booking-history"><p className="eyebrow">BOOKING HISTORY</p><div className="booking-history-list">{[...booking.history].reverse().map((entry,index)=><div className="booking-history-entry" key={index}><strong>{String(entry.action||"updated").replaceAll("_"," ")}</strong><span>{new Date(entry.at).toLocaleString()}</span>{entry.note&&<p>{entry.note}</p>}{entry.fromDate&&entry.toDate&&<small>{new Date(entry.fromDate).toLocaleString()} → {new Date(entry.toDate).toLocaleString()}</small>}</div>)}</div></div>}
      </section>}
  </AppLayout>;
}
