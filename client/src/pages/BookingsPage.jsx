import AppLayout from "../components/AppLayout.jsx";
import BookingManager from "../components/BookingManager.jsx";

export default function BookingsPage({ user, onLogout }) {
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div><p className="eyebrow">SCHEDULING</p><h1>{user.role === "admin" ? "Business bookings" : "My bookings"}</h1><p className="muted">{user.role === "admin" ? "Manage appointments and receive customer requests in real time." : "Review and manage only your own booking requests."}</p></div>
      {user.role === "admin" && <span className="live-indicator"><i /> Live</span>}
    </header>
    <BookingManager user={user} />
  </AppLayout>;
}
