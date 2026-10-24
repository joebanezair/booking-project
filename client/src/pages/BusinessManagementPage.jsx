import { Card } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Image } from "../components/ui/image.jsx";
import { Label } from "../components/ui/label.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiBriefcase, FiCalendar, FiCheck, FiCheckCircle, FiCopy, FiEye, FiGrid, FiKey, FiList, FiMoreHorizontal, FiPause, FiPackage, FiPauseCircle, FiPlay, FiRefreshCw, FiSearch, FiSlash, FiStar, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { api } from "../api.js";

// The display is deliberately abbreviated; the complete immutable MongoDB ID is copied.
function UserIdControl({ id, compact = false }) {
  const [copyState, setCopyState] = useState("idle");
  async function copyFullId(event) {
    event.preventDefault();
    event.stopPropagation();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(id);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }
  return <span className={"business-admin-user-id" + (compact ? " business-admin-user-id--compact" : "")}>
    {compact && <span className="business-admin-id-label">ID:</span>}
    <code>{id.slice(0, 8)}…</code>
    <Button type="button" variant="ghost" size="icon-sm"
      className="business-admin-id-copy"
      title={copyState === "copied" ? "Full ID copied" : "Copy full user ID"}
      aria-label={copyState === "copied" ? "Full user ID copied" : "Copy full user ID"}
      onClick={copyFullId}>
      {copyState === "copied" ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
    </Button>
    {copyState === "copied" && <span className="business-admin-copy-feedback" role="status">Copied</span>}
    {copyState === "error" && <span className="business-admin-copy-feedback" role="alert">Copy unavailable</span>}
  </span>;
}

export default function BusinessManagementPage({ user, onLogout }) {
  const [items,setItems] = useState([]);
  const [overview,setOverview] = useState(null);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [pendingStatus,setPendingStatus] = useState(null);
  const [passwordTarget,setPasswordTarget] = useState(null);
  const [newPassword,setNewPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [isLoading,setIsLoading] = useState(true);
  const [hasLoaded,setHasLoaded] = useState(false);
  const [query,setQuery] = useState("");
  const [statusFilter,setStatusFilter] = useState("all");
  // Always enter Business Management in the approved grid layout.
  // The list/grid buttons still switch views for the current visit.
  const [viewMode,setViewMode] = useState("grid");
  const [openActions,setOpenActions] = useState(null);

  useEffect(() => {
    // Drop the legacy persisted list preference that overrode the new grid default.
    try { localStorage.removeItem("bookflow-admin-business-view"); }
    catch { /* Storage can be blocked; the local view switch remains functional. */ }
  }, []);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return items.filter(item => {
      if (statusFilter !== "all" && (item.accountStatus || "active") !== statusFilter) return false;
      if (!term) return true;
      return [item._id, item.business?.name, item.name, item.email, item.business?.category]
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
    setHasLoaded(false);
    setItems([]);
    setOverview(null);
    try {
      // Both sources must succeed so the page never mixes old and new totals.
      const [businesses, stats] = await Promise.all([api.admin.businesses(), api.admin.overview()]);
      if (!Array.isArray(businesses) ||
          !stats?.businesses || !stats?.products || !stats?.services ||
          !stats?.bookings || !stats?.reviews || !stats?.sales ||
          !Number.isFinite(stats.products.total) ||
          !Number.isFinite(stats.bookings.total)) {
        throw new Error("Unexpected platform statistics response. Restart the updated backend.");
      }
      setItems(businesses);
      setOverview(stats);
      setHasLoaded(true);
      setError("");
    } catch (e) {
      // Display unavailable values rather than inventing zeros after a failed read.
      setError(e.message);
    } finally { setIsLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function applyStatus() {
    if (!pendingStatus || busy) return;
    setBusy(true);
    try {
      const {id,accountStatus} = pendingStatus;
      await api.admin.setBusinessStatus(id, accountStatus);
      setPendingStatus(null);
      await load(); // Keep the global account counts and directory synchronized.
      setMessage("Business status updated.");
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
          <div className="business-admin-summary-card business-admin-summary-card--total">
            <span className="business-admin-summary-icon"><FiUsers aria-hidden="true" /></span>
            <strong>{overview?.businesses?.total ?? "—"}</strong><span className="business-admin-summary-label">Total</span>
          </div>
          <div className="business-admin-summary-card business-admin-summary-card--active">
            <span className="business-admin-summary-icon"><FiCheckCircle aria-hidden="true" /></span>
            <strong>{overview?.businesses?.active ?? "—"}</strong><span className="business-admin-summary-label">Active</span>
          </div>
          <div className="business-admin-summary-card business-admin-summary-card--paused">
            <span className="business-admin-summary-icon"><FiPauseCircle aria-hidden="true" /></span>
            <strong>{overview?.businesses?.paused ?? "—"}</strong><span className="business-admin-summary-label">Paused</span>
          </div>
          <div className="business-admin-summary-card business-admin-summary-card--disabled">
            <span className="business-admin-summary-icon"><FiSlash aria-hidden="true" /></span>
            <strong>{overview?.businesses?.disabled ?? "—"}</strong><span className="business-admin-summary-label">Disabled</span>
          </div>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      <section className="business-admin-directory" aria-labelledby="business-directory-title">
        <div className="business-admin-toolbar">
          <div className="business-admin-directory-heading">
            <h2 id="business-directory-title"><FiUsers aria-hidden="true" /> Business directory</h2>
            <span aria-live="polite">{hasLoaded ? `${filteredItems.length} of ${items.length} businesses` : "Business data unavailable"}</span>
          </div>
          <div className="business-admin-controls">
            <div className="business-admin-search">
              <FiSearch aria-hidden="true" />
              <Input type="search" aria-label="Search businesses" placeholder="Search name, email, user ID..."
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
          <span>User ID</span><span>Business</span><span>Status</span>
          <span>Products</span><span>Services</span><span>Bookings</span>
          <span>Reviews</span><span>Rating</span><span>Actions</span>
        </div>}
        <div className={"business-admin-list" + (viewMode === "grid" ? " business-admin-list--grid" : "")}>
          {isLoading && items.length === 0 ? <p className="business-admin-empty" role="status">Loading businesses...</p> :
            filteredItems.length === 0 ?
              <div className="business-admin-empty">
                <FiUsers aria-hidden="true" />
                <strong>{!hasLoaded ? "Business data unavailable" : items.length === 0 ? "No businesses yet" : "No matching businesses"}</strong>
                <span>{!hasLoaded ? "Refresh to retry loading from the database." : items.length === 0 ? "Registered business accounts will appear here." : "Try another search or account status."}</span>
                {items.length > 0 && <Button type="button" variant="ghost" size="sm"
                  onClick={() => { setQuery(""); setStatusFilter("all"); }}>Clear filters</Button>}
              </div> :
              filteredItems.map(item => {
                const id = String(item._id);
                const name = item.business?.name || item.name || "Unnamed business";
                const status = item.accountStatus || "active";
                const reviewCount = Number(item.reviewSummary?.count || 0);
                const averageRating = reviewCount > 0 && Number(item.reviewSummary?.averageRating) > 0
                  ? Number(item.reviewSummary.averageRating).toFixed(1) : "—";
                return <Card as="article" className="business-admin-row" key={id}>
                  <Link className="business-admin-card-hit" to={`/dashboard/businesses/${id}`}
                    aria-label={`View business statistics for ${name}`}
                    title={`View ${name} business statistics`} />
                  {viewMode === "list" && <UserIdControl id={id} />}
                  {viewMode === "grid" && <div className="business-admin-cover" aria-hidden="true">
                    {item.coverImage && <Image src={item.coverImage} alt="" loading="lazy" />}
                  </div>}
                  <div className="business-admin-identity">
                    <ProfileAvatar
                      profile={{
                        name,
                        profileImage: item.profileImage || item.business?.logo,
                        profileImagePositionX: item.profileImagePositionX,
                        profileImagePositionY: item.profileImagePositionY
                      }}
                      size={viewMode === "grid" ? "xl" : "md"}
                    />
                    <div className="business-admin-identity-text">
                      <strong>{name}</strong>
                      {viewMode === "grid" && item.username && <span className="business-admin-handle">@{item.username}</span>}
                      <small title={item.email}>{item.email}</small>
                      <div className="business-admin-metadata">
                        <span className="business-admin-category">{item.business?.category || "General"}</span>
                        {viewMode === "grid" && <UserIdControl id={id} compact />}
                      </div>
                    </div>
                  </div>
                  {viewMode === "grid" && <div className="business-admin-rating" aria-label={`Rating ${averageRating} out of 5, ${reviewCount} ${reviewCount === 1 ? "rating" : "ratings"}`}>
                    <FiStar aria-hidden="true" />
                    <strong>{averageRating}</strong>
                    <span>({reviewCount} {reviewCount === 1 ? "rating" : "ratings"})</span>
                  </div>}
                  <div className="business-admin-account-status">
                    <span className={`status business-admin-status ${status}`}>{status}</span>
                  </div>
                  <div className="business-admin-metric business-admin-metric--products" data-label="Products">
                    <FiPackage aria-hidden="true" /><strong>{item.productCount ?? "—"}</strong>
                  </div>
                  <div className="business-admin-metric business-admin-metric--services" data-label="Services">
                    <FiBriefcase aria-hidden="true" /><strong>{item.serviceCount ?? 0}</strong>
                  </div>
                  <div className="business-admin-metric business-admin-metric--bookings" data-label="Bookings">
                    <FiCalendar aria-hidden="true" /><strong>{item.bookingCount ?? 0}</strong>
                  </div>
                  <div className="business-admin-metric business-admin-metric--reviews" data-label="Reviews"
                    title="Verified customer reviews">
                    <FiStar aria-hidden="true" /><strong>{reviewCount}</strong>
                  </div>
                  <div className="business-admin-metric business-admin-metric--rating" data-label="Rating"
                    title="Average of verified customer reviews (out of 5)">
                    <FiStar aria-hidden="true" /><strong>{averageRating}</strong>
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
