import { Button } from "../components/ui/button.jsx";
import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import BusinessProfileSection from "../components/BusinessProfileSection.jsx";

export default function BusinessPage({ user, onLogout, onUserUpdate }) {
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar business-page-topbar">
      <div>
        <p className="eyebrow">PROFILE · BUSINESS PAGE</p>
        <h1>Business Page</h1>
        <p className="muted">Manage your business identity, contact details and branding in one place.</p>
      </div>
      <Button asChild variant="outline"><Link  className="secondary button-link icon-link" to="/dashboard/profile"><FiArrowLeft aria-hidden="true" />Back to Profile</Link></Button>
    </header>
    <div className="business-page-shell">
      <BusinessProfileSection user={user} onUserUpdate={onUserUpdate} />
    </div>
  </AppLayout>;
}
