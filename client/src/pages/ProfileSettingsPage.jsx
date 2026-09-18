import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { fileToDataUrl } from "../lib.js";
import { api } from "../api.js";
import BusinessAccountSection from "../components/BusinessAccountSection.jsx";

export default function ProfileSettingsPage({ user, onLogout, onUserUpdate }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const photoDrag = useRef(null);

  function clampPosition(value) {
    return Math.min(100, Math.max(0, value));
  }

  function startPhotoDrag(e) {
    if (!form?.profileImage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    photoDrag.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      positionX: form.profileImagePositionX ?? 50,
      positionY: form.profileImagePositionY ?? 50
    };
  }

  function movePhoto(e) {
    const drag = photoDrag.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const frame = e.currentTarget.getBoundingClientRect();
    const nextX = clampPosition(drag.positionX - ((e.clientX - drag.clientX) / frame.width) * 100);
    const nextY = clampPosition(drag.positionY - ((e.clientY - drag.clientY) / frame.height) * 100);
    setForm(current => ({
      ...current,
      profileImagePositionX: Math.round(nextX),
      profileImagePositionY: Math.round(nextY)
    }));
  }

  function stopPhotoDrag(e) {
    if (photoDrag.current?.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    photoDrag.current = null;
  }

  function nudgePhoto(e) {
    const movement = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
    if (!movement) return;
    e.preventDefault();
    setForm(current => ({
      ...current,
      profileImagePositionX: clampPosition((current.profileImagePositionX ?? 50) + movement[0]),
      profileImagePositionY: clampPosition((current.profileImagePositionY ?? 50) + movement[1])
    }));
  }
  useEffect(() => { api.profile.get().then(setForm).catch(e => setError(e.message)); }, []);

  async function chooseImage(field, file) {
    try { const image = await fileToDataUrl(file); setForm(current => ({ ...current, [field]: image })); setError(""); }
    catch (e) { setError(e.message); }
  }

  async function save(e) {
    e.preventDefault(); setError(""); setMessage("");
    try {
      const updated = await api.profile.update(form); setForm(updated);
      const next = { ...user, name: updated.name, username: updated.username };
      localStorage.setItem("booking_user", JSON.stringify(next)); onUserUpdate(next); setMessage("Profile updated.");
    } catch (e) { setError(e.message); }
  }

  function landingPageUrl() {
    return form?.username ? `${window.location.origin}/profile/${form.username}` : "";
  }

  async function copyLandingPage() {
    await navigator.clipboard.writeText(landingPageUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function shareLandingPage() {
    const url = landingPageUrl();
    if (navigator.share) await navigator.share({ title: `${form.name} on BookFlow`, text: `View ${form.name}'s services and book a schedule.`, url });
    else await copyLandingPage();
  }

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">PROFILE SETTINGS</p><h1>Manage your public profile</h1></div>{form?.username && <Link className="secondary button-link" to={`/profile/${form.username}`}>Preview profile</Link>}</header>
    {!form ? <p>{error || "Loading..."}</p> : <><section className="share-card landing-share-card"><div><p className="eyebrow light">PUBLIC LANDING PAGE</p><h2>Share your services with one link</h2><p className="muted">{landingPageUrl()}</p></div><div className="share-actions"><Link className="secondary button-link" to={`/profile/${form.username}`} target="_blank">Open page</Link><button type="button" className="secondary" onClick={copyLandingPage}>{copied?"Copied!":"Copy link"}</button><button type="button" className="primary-button" onClick={shareLandingPage}>Share</button></div></section><form className="panel standalone-form" onSubmit={save}>
      <section className="profile-cover-editor"><div className="cover-preview" style={form.coverImage ? { backgroundImage: `url(${form.coverImage})` } : undefined}>{!form.coverImage && <span>Cover photo preview</span>}<div className="avatar-preview"><ProfileAvatar profile={form} size="xl" /></div></div><div className="image-actions"><label className="upload-button">Choose cover photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => chooseImage("coverImage", e.target.files?.[0])} /></label>{form.coverImage && <button type="button" className="danger" onClick={() => setForm({ ...form, coverImage: "" })}>Remove cover</button>}</div></section>
      <section className="profile-photo-editor"><div className="profile-editor-head">{form.profileImage ? <div className="profile-photo-drag-wrap"><div className="profile-photo-drag-frame" role="application" tabIndex="0" aria-label="Profile photo crop. Drag the photo or use the arrow keys to reposition it." onPointerDown={startPhotoDrag} onPointerMove={movePhoto} onPointerUp={stopPhotoDrag} onPointerCancel={stopPhotoDrag} onKeyDown={nudgePhoto}><img className="profile-photo-drag-image" draggable="false" src={form.profileImage} alt="Profile photo crop preview" style={{ objectPosition: `${form.profileImagePositionX ?? 50}% ${form.profileImagePositionY ?? 50}%` }} /><span className="profile-photo-drag-hint" aria-hidden="true">Drag to reposition</span></div><p className="muted">Drag your photo until it is framed exactly how you want. You can also use the arrow keys.</p></div> : <ProfileAvatar profile={form} size="xl" />}<div className="image-actions"><label className="upload-button">Choose profile photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => chooseImage("profileImage", e.target.files?.[0])} /></label>{form.profileImage && <button type="button" className="danger" onClick={() => setForm({ ...form, profileImage: "", profileImagePositionX: 50, profileImagePositionY: 50 })}>Remove photo</button>}</div></div></section>
      <div className="two-col"><label>Name<input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} required /></label><label>Username<input value={form.username || ""} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} required /></label></div>
      <label>Bio<textarea rows="5" maxLength="1000" value={form.bio || ""} onChange={e => setForm({ ...form, bio: e.target.value })} /></label><div className="two-col"><label>Headline<input value={form.headline || ""} onChange={e => setForm({ ...form, headline: e.target.value })} /></label><label>Location<input value={form.location || ""} onChange={e => setForm({ ...form, location: e.target.value })} /></label></div><label>Website<input type="url" placeholder="https://..." value={form.website || ""} onChange={e => setForm({ ...form, website: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}<button className="primary-button">Save profile</button>
    </form>{user.role==="customer"&&<BusinessAccountSection user={user} onUserUpdate={onUserUpdate}/>}</>}
  </AppLayout>;
}
