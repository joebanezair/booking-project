import AppLayout from "../components/AppLayout.jsx";
import BookingManager from "../components/BookingManager.jsx";

export default function BookingsPage({ user, onLogout }) {
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div><p className="eyebrow">BOOKINGS</p><h1>Business bookings</h1><p className="muted">Manage appointments in list, calendar, and customer-history views. Rescheduling follows your availability rules, and completed services create sales records and verified-review links.</p></div>
      <span className="live-indicator"><i /> Live</span>
    </header>
    <BookingManager user={user} />
  </AppLayout>;
}
