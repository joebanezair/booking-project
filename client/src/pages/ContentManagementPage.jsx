import { SearchField } from "../components/ui/search-field.jsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiFilePlus, FiFileText, FiGrid, FiList, FiPackage, FiPlus, FiSearch, FiX } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ContentCard from "../components/ContentCard.jsx";
import { api } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog.jsx";

export default function ContentManagementPage({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [serviceView, setServiceView] = useState("grid");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [deleting,setDeleting]=useState(false);
  useEffect(() => { api.content.list().then(setItems).catch(e => setError(e.message)); }, []);

  async function toggle(item) {
    try { const updated = await api.content.publish(item._id, !item.published); setItems(current => current.map(entry => entry._id === item._id ? updated : entry)); }
    catch (e) { setError(e.message); }
  }
  async function remove() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await api.content.remove(deleteTarget);
      setItems(current => current.filter(item => item._id !== deleteTarget));
      setDeleteTarget(null);
      setError("");
    } catch (e) { setError(e.message); }
    finally { setDeleting(false); }
  }

  const published = items.filter(item => item.published).length;
  const query = search.trim().toLowerCase();
  const searchedItems = query ? items.filter(item => [item.title,item.description,item.category,item.visibility,item.published?"published":"draft"].some(value => String(value||"").toLowerCase().includes(query))) : items;
  const filteredItems = searchedItems.filter(item => statusFilter === "all" ? true : statusFilter === "published" ? item.published : !item.published);
  return <AppLayout user={user} onLogout={onLogout}>
    <Dialog open={Boolean(deleteTarget)} title="Delete service" dismissible={!deleting}
      onOpenChange={open=>{if(!open&&!deleting)setDeleteTarget(null);}}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete service?</DialogTitle>
          <DialogDescription>
            {items.find(item=>item._id===deleteTarget)?.title||"This service"} will be permanently deleted. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter><Button type="button" variant="outline" disabled={deleting} onClick={()=>setDeleteTarget(null)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={deleting} onClick={remove}>{deleting?"Deleting...":"Delete service"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <header className="topbar"><div><p className="eyebrow">SERVICES</p><h1>Service management</h1><p className="muted">{user.accountStatus === "paused" ? "You can edit existing services and save drafts while paused, but you cannot publish new services." : "Create, publish, edit, and manage your services."}</p></div><Button asChild className="service-create-link"><Link to="/dashboard/services/new"><span className="service-create-icon">{user.accountStatus === "paused" ? <FiFilePlus/> : <FiPlus/>}</span>{user.accountStatus === "paused" ? "Create draft" : "Post a service"}</Link></Button></header>
    <section className="stats-grid services-stats-grid" role="group" aria-label="Filter services by publication status"><Button variant="outline" size="sm" type="button" className={`stat-card service-stat-card ${statusFilter==="all"?"active":""}`} onClick={()=>setStatusFilter("all")} aria-pressed={statusFilter==="all"}><FiPackage aria-hidden="true"/><div><span>Total</span><strong>{items.length}</strong></div></Button><Button variant="outline" size="sm" type="button" className={`stat-card service-stat-card ${statusFilter==="published"?"active":""}`} onClick={()=>setStatusFilter("published")} aria-pressed={statusFilter==="published"}><FiCheckCircle aria-hidden="true"/><div><span>Published</span><strong>{published}</strong></div></Button><Button variant="outline" size="sm" type="button" className={`stat-card service-stat-card ${statusFilter==="draft"?"active":""}`} onClick={()=>setStatusFilter("draft")} aria-pressed={statusFilter==="draft"}><FiFileText aria-hidden="true"/><div><span>Drafts</span><strong>{items.length - published}</strong></div></Button></section>
    {error && <p className="error dashboard-error">{error}</p>}
    <div className="panel services-controls-card"><div className="services-view-toolbar"><div className="services-search-wrap"><SearchField className="services-search" value={search} onValueChange={setSearch} placeholder="Search services..." aria-label="Search services" /></div><div className="service-view-toggle" role="group" aria-label="Service view"><Button variant="plain" type="button" className={serviceView==="grid"?"active":""} onClick={()=>setServiceView("grid")} aria-label="Grid view" data-tooltip="Grid view"><FiGrid/></Button><Button variant="plain" type="button" className={serviceView==="list"?"active":""} onClick={()=>setServiceView("list")} aria-label="List view" data-tooltip="List view"><FiList/></Button></div></div>
    <section className="dashboard-section services-list-section">{items.length === 0 ? <div className="panel empty-state"><p className="muted">No services yet. Post your first service.</p></div> : filteredItems.length===0 ? <div className="panel empty-state"><p className="muted">No services match “{search}”.</p></div> : <div className={`content-admin-list services-view-${serviceView}`}>{filteredItems.map(item => <ContentCard key={item._id} item={item} manage onDelete={setDeleteTarget} onToggle={toggle} />)}</div>}</section></div>
  </AppLayout>;
}
