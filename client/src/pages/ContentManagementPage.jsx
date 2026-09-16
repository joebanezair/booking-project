import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import ContentCard from "../components/ContentCard.jsx";
import { api } from "../api.js";

export default function ContentManagementPage({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api.content.list().then(setItems).catch(e => setError(e.message)); }, []);

  async function toggle(item) {
    try { const updated = await api.content.publish(item._id, !item.published); setItems(current => current.map(entry => entry._id === item._id ? updated : entry)); }
    catch (e) { setError(e.message); }
  }
  async function remove(id) {
    if (!confirm("Delete this content permanently?")) return;
    try { await api.content.remove(id); setItems(current => current.filter(item => item._id !== id)); }
    catch (e) { setError(e.message); }
  }

  const published = items.filter(item => item.published).length;
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">SERVICES</p><h1>Service management</h1><p className="muted">Create, publish, edit, and manage your services.</p></div><Link className="primary-button button-link" to="/dashboard/services/new">Post a service</Link></header>
    <section className="stats-grid"><article className="stat-card"><span>Total</span><strong>{items.length}</strong></article><article className="stat-card"><span>Published</span><strong>{published}</strong></article><article className="stat-card"><span>Drafts</span><strong>{items.length - published}</strong></article></section>
    {error && <p className="error dashboard-error">{error}</p>}
    <section className="dashboard-section">{items.length === 0 ? <div className="panel empty-state"><p className="muted">No services yet. Post your first service.</p></div> : <div className="content-admin-list">{items.map(item => <ContentCard key={item._id} item={item} manage onDelete={remove} onToggle={toggle} />)}</div>}</section>
  </AppLayout>;
}
