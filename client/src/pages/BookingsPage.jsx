import AppLayout from "../components/AppLayout.jsx";
import BookingManager from "../components/BookingManager.jsx";

export default function BookingsPage({ user, onLogout, accountMode, onAccountModeChange }) {
  const isProvider=["admin","business"].includes(user.role)||(user.business?.status==="approved"&&accountMode==="business");
  return <AppLayout user={user} onLogout={onLogout} accountMode={accountMode} onAccountModeChange={onAccountModeChange}>
    <header className="topbar">
      <div><p className="eyebrow">SCHEDULING</p><h1>{isProvider ? "Business bookings" : "My bookings"}</h1><p className="muted">{isProvider ? "Manage appointments and receive customer requests in real time." : "Review and manage only your own booking requests."}</p></div>
      {isProvider && <span className="live-indicator"><i /> Live</span>}
    </header>
    <BookingManager user={user} accountMode={accountMode}/>
  </AppLayout>;
}
