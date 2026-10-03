import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiFilePlus, FiGrid, FiList, FiPlus, FiSearch, FiX } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ContentCard from "../components/ContentCard.jsx";
import { api } from "../api.js";
import { Button } from "../components/ui/button.jsx";

export default function ContentManagementPage({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [serviceView, setServiceView] = useState("grid");
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
  const query = search.trim().toLowerCase();
  const filteredItems = query ? items.filter(item => [item.title,item.description,item.category,item.visibility,item.published?"published":"draft"].some(value => String(value||"").toLowerCase().includes(query))) : items;
  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">SERVICES</p><h1>Service management</h1><p className="muted">{user.accountStatus === "paused" ? "You can edit existing services and save drafts while paused, but you cannot publish new services." : "Create, publish, edit, and manage your services."}</p></div><Link className="service-create-link" to="/dashboard/services/new"><Button><span className="service-create-icon">{user.accountStatus === "paused" ? <FiFilePlus/> : <FiPlus/>}</span>{user.accountStatus === "paused" ? "Create draft" : "Post a service"}</Button></Link></header>
    <section className="stats-grid services-stats-grid"><article className="stat-card"><span>Total</span><strong>{items.length}</strong></article><article className="stat-card"><span>Published</span><strong>{published}</strong></article><article className="stat-card"><span>Drafts</span><strong>{items.length - published}</strong></article></section>
    {error && <p className="error dashboard-error">{error}</p>}
    <div className="panel services-controls-card"><div className="services-view-toolbar"><div className="services-search-wrap"><div className="realtime-search services-search"><FiSearch aria-hidden="true"/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services..." aria-label="Search services"/>{search&&<button type="button" onClick={()=>setSearch("")} aria-label="Clear service search"><FiX/></button>}</div></div><div className="service-view-toggle" role="group" aria-label="Service view"><button type="button" className={serviceView==="grid"?"active":""} onClick={()=>setServiceView("grid")} aria-label="Grid view" data-tooltip="Grid view"><FiGrid/></button><button type="button" className={serviceView==="list"?"active":""} onClick={()=>setServiceView("list")} aria-label="List view" data-tooltip="List view"><FiList/></button></div></div></div>
    <section className="dashboard-section services-list-section">{items.length === 0 ? <div className="panel empty-state"><p className="muted">No services yet. Post your first service.</p></div> : filteredItems.length===0 ? <div className="panel empty-state"><p className="muted">No services match “{search}”.</p></div> : <div className={`content-admin-list services-view-${serviceView}`}>{filteredItems.map(item => <ContentCard key={item._id} item={item} manage onDelete={remove} onToggle={toggle} />)}</div>}</section>
  </AppLayout>;
}
