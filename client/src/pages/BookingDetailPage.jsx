import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiCopy, FiMail, FiMapPin, FiPhone, FiStar, FiTag, FiUser } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import PriceDisplay from "../components/PriceDisplay.jsx";
import { api } from "../api.js";

export default function BookingDetailPage({ user, onLogout }) {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.bookings.get(bookingId).then(setBooking).catch(e => setError(e.message));
  }, [bookingId]);

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

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div><p className="eyebrow">BOOKING DETAILS</p><h1>{booking?.guestName || "Booking"}</h1></div>
      <Link className="secondary button-link icon-link" to="/dashboard/bookings"><FiArrowLeft />Back to bookings</Link>
    </header>

    {error ? <p className="error">{error}</p> : !booking ? <p>Loading...</p> :
      <section className="panel booking-detail">
        <div className="booking-detail-grid">
          <div><FiUser /><span>Guest</span><strong>{booking.guestName}</strong></div>
          {booking.guestEmail && <a href={`mailto:${booking.guestEmail}`}><FiMail /><span>Email</span><strong>{booking.guestEmail}</strong></a>}
          {booking.guestPhone && <a href={`tel:${booking.guestPhone}`}><FiPhone /><span>Phone</span><strong>{booking.guestPhone}</strong></a>}
          <div><FiCalendar /><span>Date and time</span><strong>{new Date(booking.bookingDate).toLocaleString()}</strong></div>
          <div><FiTag /><span>Status</span><strong className={`status ${booking.status}`}>{booking.status}</strong></div>
          {(booking.locationLabel || hasCoordinates) && (hasCoordinates
            ? <a href={mapUrl} target="_blank" rel="noreferrer"><FiMapPin /><span>Location</span><strong>{booking.locationLabel || "Detected location"}</strong>{booking.locationAccuracy != null && <small>Accuracy about {Math.round(booking.locationAccuracy)} m</small>}</a>
            : <div><FiMapPin /><span>Location</span><strong>{booking.locationLabel}</strong></div>)}
        </div>

        <div className="booking-detail-service">
          <p className="eyebrow">SERVICE</p>
          <h2>{booking.content?.title || booking.service}</h2>
          {booking.content?.description && <p>{booking.content.description}</p>}
          {booking.content && <PriceDisplay price={booking.content.price} currency={booking.content.currency} />}
          {booking.content?.published && booking.content?.visibility !== "private" && <Link className="primary-button button-link" to={`/services/${booking.content._id}`}>View public service</Link>}
        </div>

        {booking.status === "completed" && <div className="booking-review-invite">
          <p className="eyebrow">VERIFIED REVIEW</p>
          {booking.reviewInvite?.verified ? <p className="success"><FiStar /> The guest has submitted a verified review for this booking.</p> :
            reviewUrl ? <><p>Share this one-time review link with the guest. It only works for this completed booking.</p><div className="review-link-row"><input value={reviewUrl} readOnly /><button className="secondary" onClick={copyReviewLink}><FiCopy />{copied ? "Copied" : "Copy link"}</button></div></> :
            <p className="muted">The review link is being prepared.</p>}
        </div>}

        {booking.notes && <div className="booking-detail-notes"><p className="eyebrow">NOTES</p><p>{booking.notes}</p></div>}
      </section>}
  </AppLayout>;
}
