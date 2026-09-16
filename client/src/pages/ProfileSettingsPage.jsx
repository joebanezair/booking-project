import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { fileToDataUrl } from "../lib.js";
import { api } from "../api.js";

export default function ProfileSettingsPage({ user, onLogout, onUserUpdate }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
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
      <section className="profile-photo-editor"><div className="profile-editor-head"><ProfileAvatar profile={form} size="xl" /><div className="image-actions"><label className="upload-button">Choose profile photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => chooseImage("profileImage", e.target.files?.[0])} /></label>{form.profileImage && <button type="button" className="danger" onClick={() => setForm({ ...form, profileImage: "" })}>Remove photo</button>}</div></div>{form.profileImage && <div className="position-controls"><label>Horizontal position <span>{form.profileImagePositionX ?? 50}%</span><input type="range" min="0" max="100" value={form.profileImagePositionX ?? 50} onChange={e => setForm({ ...form, profileImagePositionX: Number(e.target.value) })} /></label><label>Vertical position <span>{form.profileImagePositionY ?? 50}%</span><input type="range" min="0" max="100" value={form.profileImagePositionY ?? 50} onChange={e => setForm({ ...form, profileImagePositionY: Number(e.target.value) })} /></label><p className="muted">Move the sliders until your photo is framed correctly.</p></div>}</section>
      <div className="two-col"><label>Name<input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} required /></label><label>Username<input value={form.username || ""} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} required /></label></div>
      <label>Bio<textarea rows="5" maxLength="1000" value={form.bio || ""} onChange={e => setForm({ ...form, bio: e.target.value })} /></label><div className="two-col"><label>Headline<input value={form.headline || ""} onChange={e => setForm({ ...form, headline: e.target.value })} /></label><label>Location<input value={form.location || ""} onChange={e => setForm({ ...form, location: e.target.value })} /></label></div><label>Website<input type="url" placeholder="https://..." value={form.website || ""} onChange={e => setForm({ ...form, website: e.target.value })} /></label>
      {error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}<button className="primary-button">Save profile</button>
    </form></>}
  </AppLayout>;
}
