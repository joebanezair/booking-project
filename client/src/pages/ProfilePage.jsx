import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiBriefcase, FiEdit3, FiExternalLink, FiMapPin } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import ProfileMediaHeader from "../components/ProfileMediaHeader.jsx";
import { fileToDataUrl } from "../lib.js";
import { api } from "../api.js";

export default function ProfilePage({ user, onLogout, onUserUpdate }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.profile.get().then(setProfile).catch(e => setError(e.message));
  }, []);

  async function persist(next, successMessage) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await api.profile.update(next);
      setProfile(saved);
      const nextUser = { ...user, name: saved.name, username: saved.username };
      localStorage.setItem("booking_user", JSON.stringify(nextUser));
      onUserUpdate?.(nextUser);
      setMessage(successMessage);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeImage(field, file) {
    try {
      const image = await fileToDataUrl(file);
      await persist({ ...profile, [field]: image }, field === "coverImage" ? "Cover photo updated." : "Profile photo updated.");
    } catch (e) {
      setError(e.message);
    }
  }

  function removeCover() {
    if (!window.confirm("Remove your cover photo?")) return;
    persist({ ...profile, coverImage: "" }, "Cover photo removed.");
  }

  function removeProfile() {
    if (!window.confirm("Delete your profile photo?")) return;
    persist({ ...profile, profileImage: "", profileImagePositionX: 50, profileImagePositionY: 50 }, "Profile photo deleted.");
  }

  const publicPath = profile?.username ? "/profile/" + profile.username : "";

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar">
      <div><p className="eyebrow">PROFILE</p><h1>Your profile</h1><p className="muted">Manage how your account appears across BookFlow.</p></div>
      <Link className="primary-button button-link icon-link" to="/dashboard/profile/edit"><FiEdit3 aria-hidden="true" />Edit profile</Link>
    </header>

    {!profile ? <p>{error || "Loading..."}</p> : <>
      <section className="panel profile-overview-card">
        <ProfileMediaHeader
          profile={profile}
          disabled={saving}
          onCoverFile={file => changeImage("coverImage", file)}
          onRemoveCover={removeCover}
          onProfileFile={file => changeImage("profileImage", file)}
          onRemoveProfile={removeProfile}
          onReposition={() => navigate("/dashboard/profile/edit#profile-photo-position")}
        />

        <div className="profile-overview-body">
          <div className="profile-overview-heading">
            <div>
              <h2>{profile.name}</h2>
              {profile.headline && <p className="profile-headline">{profile.headline}</p>}
              <div className="profile-overview-meta">
                {profile.username && <span>@{profile.username}</span>}
                {profile.location && <span><FiMapPin aria-hidden="true" />{profile.location}</span>}
              </div>
            </div>
            {publicPath && <Link className="secondary button-link icon-link" to={publicPath} target="_blank"><FiExternalLink aria-hidden="true" />View public profile</Link>}
          </div>
          {profile.bio && <p className="profile-overview-bio">{profile.bio}</p>}
          {profile.website && <a className="profile-website-link" href={profile.website} target="_blank" rel="noreferrer">{profile.website}</a>}
        </div>
      </section>

      <section className="profile-hub-grid">
        <Link className="panel profile-hub-card" to="/dashboard/profile/edit">
          <FiEdit3 aria-hidden="true" />
          <div><h3>Edit Profile</h3><p>Update your name, username, bio, headline, location, website, and profile media.</p></div>
        </Link>
        <Link className="panel profile-hub-card" to="/dashboard/profile/business">
          <FiBriefcase aria-hidden="true" />
          <div><h3>Business Page</h3><p>Manage your business name, category, description, contact information, website, and logo.</p></div>
        </Link>
      </section>

      {error && <p className="error profile-feedback">{error}</p>}
      {message && <p className="success profile-feedback">{message}</p>}
    </>}
  </AppLayout>;
}
