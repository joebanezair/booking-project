import { Card } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog.jsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiBriefcase, FiCalendar, FiEye, FiKey, FiPause, FiPlay, FiSlash, FiStar } from "react-icons/fi";
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

  async function load() {
    try { setItems(await api.admin.businesses()); setError(""); }
    catch(e) { setError(e.message); }
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
    <header className="topbar"><div><p className="eyebrow">ADMIN</p><h1>Business management</h1>
      <p className="muted">Monitor registered businesses and control account availability without an approval queue.</p></div></header>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="success" role="status">{message}</p>}
    <section className="panel business-directory">
      <div className="business-table-head"><span>Business</span><span>Status</span><span>Services</span><span>Bookings</span><span>Reviews</span><span>Actions</span></div>
      {items.length===0?<p className="muted">No business accounts found.</p>:
        items.map(item=><Card as="article" className="business-table-row" key={item._id}>
          <div className="business-cell-main"><ProfileAvatar profile={{name:item.business?.name||item.name,profileImage:item.business?.logo||item.profileImage}} />
            <div><strong>{item.business?.name||item.name}</strong><small>{item.email}</small><small>{item.business?.category||"General"}</small></div></div>
          <span className={`status ${item.accountStatus}`}>{item.accountStatus}</span>
          <span className="metric-cell"><FiBriefcase/>{item.serviceCount}</span>
          <span className="metric-cell"><FiCalendar/>{item.bookingCount}</span>
          <span className="metric-cell"><FiStar/>{item.reviewSummary?.averageRating||0} ({item.reviewSummary?.count||0})</span>
          <div className="row-actions">
            <Button asChild variant="outline" size="sm"><Link to={`/dashboard/businesses/${item._id}`}><FiEye/>View</Link></Button>
            <Button variant="outline" size="sm" onClick={()=>{setPasswordTarget({id:item._id,name:item.business?.name||item.name});setNewPassword("");setConfirmPassword("");setError("");}}><FiKey/>Reset password</Button>
            {item.accountStatus!=="paused"&&item.accountStatus!=="disabled"&&
              <Button variant="outline" size="sm" onClick={()=>setPendingStatus({id:item._id,name:item.business?.name||item.name,accountStatus:"paused"})}><FiPause/>Pause</Button>}
            {item.accountStatus!=="active"&&
              <Button variant="outline" size="sm" onClick={()=>setPendingStatus({id:item._id,name:item.business?.name||item.name,accountStatus:"active"})}><FiPlay/>Reactivate</Button>}
            {item.accountStatus!=="disabled"&&
              <Button variant="destructive" size="sm" onClick={()=>setPendingStatus({id:item._id,name:item.business?.name||item.name,accountStatus:"disabled"})}><FiSlash/>Disable</Button>}
          </div>
        </Card>)}
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
  </AppLayout>;
}
