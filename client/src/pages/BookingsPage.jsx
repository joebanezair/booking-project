import AppLayout from "../components/AppLayout.jsx";
import BookingManager from "../components/BookingManager.jsx";

export default function BookingsPage({ user, onLogout }) {
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div><p className="eyebrow">SCHEDULING</p><h1>Bookings</h1><p className="muted">Manage appointments and receive public requests in real time.</p></div>
      <span className="live-indicator"><i /> Live</span>
    </header>
    <BookingManager />
  </AppLayout>;
}
