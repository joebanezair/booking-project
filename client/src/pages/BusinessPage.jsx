import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import BusinessProfileSection from "../components/BusinessProfileSection.jsx";

export default function BusinessPage({ user, onLogout, onUserUpdate }) {
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div>
        <p className="eyebrow">PROFILE · BUSINESS PAGE</p>
        <h1>Business Page</h1>
        <p className="muted">Manage the business information shown across BookFlow.</p>
      </div>
      <Link className="secondary button-link icon-link" to="/dashboard/profile"><FiArrowLeft aria-hidden="true" />Back to Profile</Link>
    </header>
    <div className="business-page-shell">
      <BusinessProfileSection user={user} onUserUpdate={onUserUpdate} />
    </div>
  </AppLayout>;
}
