import { Card } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiBriefcase, FiCalendar, FiEye, FiGrid, FiKey, FiList, FiMoreHorizontal, FiPause, FiPlay, FiRefreshCw, FiSearch, FiSlash, FiStar, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { api } from "../api.js";

export default function BusinessManagementPage({ user, onLogout }) {
  const [items,setItems] = useState([]);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [pendingStatus,setPendingStatus] = useState(null);
  const [passwordTarget,setPasswordTarget] = useState(null);
  const [newPassword,setNewPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [isLoading,setIsLoading] = useState(true);
  const [query,setQuery] = useState("");
  const [statusFilter,setStatusFilter] = useState("all");
  const [viewMode,setViewMode] = useState(() => {
    try { return localStorage.getItem("bookflow-admin-business-view") === "list" ? "list" : "grid"; }
    catch { return "grid"; }
  });
  const [openActions,setOpenActions] = useState(null);

  useEffect(() => {
    try { localStorage.setItem("bookflow-admin-business-view", viewMode); }
    catch { /* Local storage blocked: toggle still works for this session. */ }
  }, [viewMode]);

  const activeCount = items.filter(item => (item.accountStatus || "active") === "active").length;
  const pausedCount = items.filter(item => item.accountStatus === "paused").length;
  const disabledCount = items.filter(item => item.accountStatus === "disabled").length;
  const filteredItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return items.filter(item => {
      if (statusFilter !== "all" && (item.accountStatus || "active") !== statusFilter) return false;
      if (!term) return true;
      return [item.business?.name, item.name, item.email, item.business?.category]
        .some(value => String(value || "").toLocaleLowerCase().includes(term));
    });
  }, [items, query, statusFilter]);

  useEffect(() => {
    if (!openActions) return;
    const onPointerDown = event => {
      if (!event.target.closest?.(".business-admin-actions")) setOpenActions(null);
    };
    const onEscape = event => {
      if (event.key === "Escape") setOpenActions(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [openActions]);

  async function load() {
    setIsLoading(true);
    try { setItems(await api.admin.businesses()); setError(""); }
    catch(e) { setError(e.message); }
    finally { setIsLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function applyStatus() {
    if (!pendingStatus || busy) return;
    setBusy(true);
    try {
      const {id,accountStatus} = pendingStatus;
      const updated = await api.admin.setBusinessStatus(id, accountStatus);
      setItems(current=>current.map(item=>String(item._id)===String(id)
        ? {...item,accountStatus:updated.accountStatus}:item));
      setPendingStatus(null); setMessage("Business status updated."); setError("");
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function resetPassword(e) {
    e.preventDefault();
    if (!passwordTarget || busy) return;
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      await api.admin.resetBusinessPassword(passwordTarget.id,newPassword);
      setPasswordTarget(null); setNewPassword(""); setConfirmPassword("");
      setMessage("Password reset successfully."); setError("");
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <AppLayout user={user} onLogout={onLogout}>
    <div className="business-admin-page">
      <header className="business-admin-header">
        <div className="business-admin-heading">
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Business management</h1>
          <p className="muted">Manage business accounts and their activity in one place.</p>
        </div>
        <div className="business-admin-overview" aria-label="Account overview">
          <div><strong>{items.length}</strong><span>Total</span></div>
          <div><strong>{activeCount}</strong><span>Active</span></div>
          <div><strong>{pausedCount}</strong><span>Paused</span></div>
          <div><strong>{disabledCount}</strong><span>Disabled</span></div>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      <section className="business-admin-directory" aria-labelledby="business-directory-title">
        <div className="business-admin-toolbar">
          <div className="business-admin-directory-heading">
            <h2 id="business-directory-title"><FiUsers aria-hidden="true" /> Business directory</h2>
            <span aria-live="polite">{filteredItems.length} of {items.length} businesses</span>
          </div>
          <div className="business-admin-controls">
            <div className="business-admin-search">
              <FiSearch aria-hidden="true" />
              <Input type="search" aria-label="Search businesses" placeholder="Search name, email, category..."
                value={query} onChange={event => setQuery(event.target.value)} />
            </div>
            <div className="business-admin-filter">
              <select aria-label="Filter businesses by status" value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div className="business-admin-view-toggle" role="group" aria-label="Business directory display">
              <Button type="button" size="icon-sm" variant="ghost"
                className={viewMode === "list" ? "is-selected" : ""}
                aria-label="List view" aria-pressed={viewMode === "list"} title="List view"
                onClick={() => { setViewMode("list"); setOpenActions(null); }}>
                <FiList aria-hidden="true" />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost"
                className={viewMode === "grid" ? "is-selected" : ""}
                aria-label="Grid view" aria-pressed={viewMode === "grid"} title="Grid view"
                onClick={() => { setViewMode("grid"); setOpenActions(null); }}>
                <FiGrid aria-hidden="true" />
              </Button>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={isLoading}
              className="business-admin-refresh" onClick={load} title="Refresh business accounts">
              <FiRefreshCw aria-hidden="true" /><span>Refresh</span>
            </Button>
          </div>
        </div>

        {viewMode === "list" && <div className="business-admin-columns" aria-hidden="true">
          <span>Business</span><span>Status</span><span>Services</span>
          <span>Bookings</span><span>Reviews</span><span>Actions</span>
        </div>}
        <div className={"business-admin-list" + (viewMode === "grid" ? " business-admin-list--grid" : "")}>
          {isLoading && items.length === 0 ? <p className="business-admin-empty" role="status">Loading businesses...</p> :
            filteredItems.length === 0 ?
              <div className="business-admin-empty">
                <FiUsers aria-hidden="true" />
                <strong>{items.length === 0 ? "No businesses yet" : "No matching businesses"}</strong>
                <span>{items.length === 0 ? "Registered business accounts will appear here." : "Try another search or account status."}</span>
                {items.length > 0 && <Button type="button" variant="ghost" size="sm"
                  onClick={() => { setQuery(""); setStatusFilter("all"); }}>Clear filters</Button>}
              </div> :
              filteredItems.map(item => {
                const id = String(item._id);
                const name = item.business?.name || item.name || "Unnamed business";
                const status = item.accountStatus || "active";
                return <Card as="article" className="business-admin-row" key={id}>
                  <div className="business-admin-identity">
                    <ProfileAvatar profile={{name,profileImage:item.business?.logo || item.profileImage}} />
                    <div className="business-admin-identity-text">
                      <strong>{name}</strong>
                      <small title={item.email}>{item.email}</small>
                      <span className="business-admin-category">{item.business?.category || "General"}</span>
                    </div>
                  </div>
                  <div className="business-admin-account-status">
                    <span className={`status business-admin-status ${status}`}>{status}</span>
                  </div>
                  <div className="business-admin-metric" data-label="Services">
                    <FiBriefcase aria-hidden="true" /><strong>{item.serviceCount ?? 0}</strong>
                  </div>
                  <div className="business-admin-metric" data-label="Bookings">
                    <FiCalendar aria-hidden="true" /><strong>{item.bookingCount ?? 0}</strong>
                  </div>
                  <div className="business-admin-metric" data-label="Reviews">
                    <FiStar aria-hidden="true" /><strong>{item.reviewSummary?.count ?
                      `${Number(item.reviewSummary.averageRating || 0).toFixed(1)} (${item.reviewSummary.count})` : "—"}</strong>
                  </div>
                  <div className="business-admin-actions">
                    <Button asChild variant="outline" size="sm" className="business-admin-view">
                      <Link to={`/dashboard/businesses/${id}`}><FiEye aria-hidden="true" /> View</Link>
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="business-admin-more"
                      aria-label={`More actions for ${name}`}
                      aria-expanded={openActions === id} aria-controls={`business-admin-actions-${id}`}
                      onClick={() => setOpenActions(current => current === id ? null : id)}>
                      <FiMoreHorizontal aria-hidden="true" /><span>Actions</span>
                    </Button>
                    {openActions === id && <div className="business-admin-action-popover" id={`business-admin-actions-${id}`}>
                      <Button type="button" variant="ghost" size="sm" onClick={() => {
                        setPasswordTarget({id:item._id,name}); setNewPassword(""); setConfirmPassword("");
                        setError(""); setOpenActions(null);
                      }}><FiKey aria-hidden="true" /> Reset password</Button>
                      {status !== "paused" && status !== "disabled" &&
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                          setPendingStatus({id:item._id,name,accountStatus:"paused"}); setOpenActions(null);
                        }}><FiPause aria-hidden="true" /> Pause account</Button>}
                      {status !== "active" &&
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                          setPendingStatus({id:item._id,name,accountStatus:"active"}); setOpenActions(null);
                        }}><FiPlay aria-hidden="true" /> Reactivate</Button>}
                      {status !== "disabled" &&
                        <Button type="button" variant="ghost" size="sm" className="business-admin-danger" onClick={() => {
                          setPendingStatus({id:item._id,name,accountStatus:"disabled"}); setOpenActions(null);
                        }}><FiSlash aria-hidden="true" /> Disable account</Button>}
                    </div>}
                  </div>
                </Card>;
              })}
        </div>
      </section>
    <Dialog open={Boolean(pendingStatus)} onOpenChange={open=>{if(!open&&!busy)setPendingStatus(null);}}
      title="Confirm business status" dismissible={!busy}>
      <DialogContent><DialogHeader><DialogTitle>Confirm account action</DialogTitle>
        <DialogDescription>
          Are you sure you want to {pendingStatus?.accountStatus==="active"?"reactivate":pendingStatus?.accountStatus} {pendingStatus?.name}?
        </DialogDescription></DialogHeader>
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={()=>setPendingStatus(null)}>Cancel</Button>
          <Button type="button" variant={pendingStatus?.accountStatus==="disabled"?"destructive":"default"}
            disabled={busy} onClick={applyStatus}>{busy?"Updating...":"Confirm action"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(passwordTarget)} onOpenChange={open=>{if(!open&&!busy){setPasswordTarget(null);setNewPassword("");setConfirmPassword("");}}}
      title="Reset business password" dismissible={!busy}>
      <DialogContent><DialogHeader><DialogTitle>Reset business password</DialogTitle>
        <DialogDescription>Enter a new password for {passwordTarget?.name}. This will disconnect existing realtime sessions.</DialogDescription>
      </DialogHeader>
        <form onSubmit={resetPassword}>
          <Label>New password<Input autoComplete="new-password" type="password" minLength={8} required
            value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></Label>
          <Label>Confirm password<Input autoComplete="new-password" type="password" minLength={8} required
            value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></Label>
          {error&&<p className="error" role="alert">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={()=>setPasswordTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy?"Resetting...":"Confirm password reset"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </div>
  </AppLayout>;
}
