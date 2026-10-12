import AppLayout from "../components/AppLayout.jsx";
import BookingManager from "../components/BookingManager.jsx";

export default function BookingsPage({ user, onLogout }) {
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar booking-page-header">
      <div className="booking-page-heading">
        <p className="eyebrow booking-page-eyebrow">BOOKINGS</p>
        <h1>Business bookings</h1>
        <p className="muted booking-page-subtitle">Manage appointments, check availability, and track completed services in one place.</p>
      </div>
      <span className="live-indicator booking-page-live"><i aria-hidden="true" /> Live</span>
    </header>
    <BookingManager user={user} />
  </AppLayout>;
}
