import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ProfileMediaHeader from "../components/ProfileMediaHeader.jsx";
import { fileToDataUrl } from "../lib.js";
import { api } from "../api.js";

export default function ProfileSettingsPage({ user, onLogout, onUserUpdate }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const photoDrag = useRef(null);
  const location = useLocation();

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

  useEffect(() => {
    api.profile.get().then(setForm).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!form || location.hash !== "#profile-photo-position") return;
    requestAnimationFrame(() => document.getElementById("profile-photo-position")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [form, location.hash]);

  async function chooseImage(field, file) {
    if (!file) return;
    try {
      const image = await fileToDataUrl(file);
      setForm(current => ({ ...current, [field]: image }));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const updated = await api.profile.update(form);
      setForm(updated);
      const next = { ...user, name: updated.name, username: updated.username };
      localStorage.setItem("booking_user", JSON.stringify(next));
      onUserUpdate(next);
      setMessage("Profile updated.");
    } catch (e) {
      setError(e.message);
    }
  }

  function removeCover() {
    if (!window.confirm("Remove your cover photo?")) return;
    setForm(current => ({ ...current, coverImage: "" }));
  }

  function removeProfile() {
    if (!window.confirm("Delete your profile photo?")) return;
    setForm(current => ({ ...current, profileImage: "", profileImagePositionX: 50, profileImagePositionY: 50 }));
  }

  function showReposition() {
    requestAnimationFrame(() => document.getElementById("profile-photo-position")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div><p className="eyebrow">PROFILE · EDIT PROFILE</p><h1>Edit Profile</h1><p className="muted">Update your profile information and profile media.</p></div>
      <Link className="secondary button-link icon-link" to="/dashboard/profile"><FiArrowLeft aria-hidden="true" />Back to Profile</Link>
    </header>

    {!form ? <p>{error || "Loading..."}</p> : <form className="panel standalone-form profile-edit-form" onSubmit={save}>
      <ProfileMediaHeader
        profile={form}
        onCoverFile={file => chooseImage("coverImage", file)}
        onRemoveCover={removeCover}
        onProfileFile={file => chooseImage("profileImage", file)}
        onRemoveProfile={removeProfile}
        onReposition={showReposition}
      />

      {form.profileImage && <section className="profile-photo-editor linked-media-reposition" id="profile-photo-position">
        <div className="profile-editor-head">
          <div className="profile-photo-drag-wrap">
            <p className="eyebrow">PROFILE PHOTO POSITION</p>
            <div
              className="profile-photo-drag-frame"
              role="application"
              tabIndex="0"
              aria-label="Profile photo crop. Drag the photo or use the arrow keys to reposition it."
              onPointerDown={startPhotoDrag}
              onPointerMove={movePhoto}
              onPointerUp={stopPhotoDrag}
              onPointerCancel={stopPhotoDrag}
              onKeyDown={nudgePhoto}
            >
              <img
                className="profile-photo-drag-image"
                draggable="false"
                src={form.profileImage}
                alt="Profile photo crop preview"
                style={{ objectPosition: String(form.profileImagePositionX ?? 50) + "% " + String(form.profileImagePositionY ?? 50) + "%" }}
              />
              <span className="profile-photo-drag-hint" aria-hidden="true">Drag to reposition</span>
            </div>
            <p className="muted">Drag your photo until it is framed correctly. You can also use the arrow keys.</p>
          </div>
        </div>
      </section>}

      <div className="two-col">
        <label>Name<input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Username<input value={form.username || ""} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} required /></label>
      </div>
      <label>Bio<textarea rows="5" maxLength="1000" value={form.bio || ""} onChange={e => setForm({ ...form, bio: e.target.value })} /></label>
      <div className="two-col">
        <label>Headline<input value={form.headline || ""} onChange={e => setForm({ ...form, headline: e.target.value })} /></label>
        <label>Location<input value={form.location || ""} onChange={e => setForm({ ...form, location: e.target.value })} /></label>
      </div>
      <label>Website<input type="url" placeholder="https://..." value={form.website || ""} onChange={e => setForm({ ...form, website: e.target.value })} /></label>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <button className="primary-button">Save profile</button>
    </form>}
  </AppLayout>;
}
