import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiBriefcase, FiCalendar, FiEye, FiKey, FiPause, FiPlay, FiSlash, FiStar } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { api } from "../api.js";

export default function BusinessManagementPage({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems(await api.admin.businesses());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id, accountStatus) {
    const action = accountStatus === "active" ? "reactivate" : accountStatus;
    if (!confirm(`Are you sure you want to ${action} this business?`)) return;
    try {
      const updated = await api.admin.setBusinessStatus(id, accountStatus);
      setItems(current => current.map(item => String(item._id) === String(id) ? { ...item, accountStatus: updated.accountStatus } : item));
    } catch (e) {
      setError(e.message);
    }
  }

  async function resetPassword(id, name) {
    const password = prompt(`Enter a new password for ${name}. Minimum 8 characters:`);
    if (password == null) return;
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    const confirmation = prompt("Re-enter the new password:");
    if (confirmation == null) return;
    if (password !== confirmation) return setError("Passwords do not match.");
    if (!confirm(`Reset the password for ${name}? Their active realtime sessions will be disconnected.`)) return;
    try {
      await api.admin.resetBusinessPassword(id, password);
      setError("");
      alert("Password reset successfully.");
    } catch (e) {
      setError(e.message);
    }
  }

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div><p className="eyebrow">ADMIN</p><h1>Business management</h1><p className="muted">Monitor registered businesses and control account availability without an approval queue.</p></div>
    </header>
    {error && <p className="error">{error}</p>}
    <section className="panel business-directory">
      <div className="business-table-head"><span>Business</span><span>Status</span><span>Services</span><span>Bookings</span><span>Reviews</span><span>Actions</span></div>
      {items.length === 0 ? <p className="muted">No business accounts found.</p> : items.map(item => <article className="business-table-row" key={item._id}>
        <div className="business-cell-main"><ProfileAvatar profile={{ name: item.business?.name || item.name, profileImage: item.business?.logo || item.profileImage }} /><div><strong>{item.business?.name || item.name}</strong><small>{item.email}</small><small>{item.business?.category || "General"}</small></div></div>
        <span className={`status ${item.accountStatus}`}>{item.accountStatus}</span>
        <span className="metric-cell"><FiBriefcase />{item.serviceCount}</span>
        <span className="metric-cell"><FiCalendar />{item.bookingCount}</span>
        <span className="metric-cell"><FiStar />{item.reviewSummary?.averageRating || 0} ({item.reviewSummary?.count || 0})</span>
        <div className="row-actions">
          <Link className="secondary button-link small-link" to={`/dashboard/businesses/${item._id}`}><FiEye />View</Link>\n          <button className="secondary" onClick={() => resetPassword(item._id, item.business?.name || item.name)}><FiKey />Reset password</button>
          {item.accountStatus !== "paused" && item.accountStatus !== "disabled" && <button className="secondary" onClick={() => setStatus(item._id, "paused")}><FiPause />Pause</button>}
          {item.accountStatus !== "active" && <button className="secondary" onClick={() => setStatus(item._id, "active")}><FiPlay />Reactivate</button>}
          {item.accountStatus !== "disabled" && <button className="danger" onClick={() => setStatus(item._id, "disabled")}><FiSlash />Disable</button>}
        </div>
      </article>)}
    </section>
  </AppLayout>;
}
