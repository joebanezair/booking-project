import { Button } from "../components/ui/button.jsx";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowUpRight, FiBriefcase, FiEdit3, FiExternalLink, FiFileText, FiHelpCircle, FiMapPin } from "react-icons/fi";
import { Card } from "../components/ui/card.jsx";
import AppLayout from "../components/AppLayout.jsx";
import ProfileMediaHeader from "../components/ProfileMediaHeader.jsx";
import BookingQrCard from "../components/BookingQrCard.jsx";
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

  const isAdmin = user.role === "admin";
  const publicPath = profile?.username ? (isAdmin ? "/admin/" : "/profile/") + encodeURIComponent(profile.username) : "";

  return <AppLayout user={user} onLogout={onLogout}>
    <div className="profile-page-redesign profile-overview-clean">
    <header className="topbar profile-page-topbar">
      <div><p className="eyebrow">{isAdmin ? "ADMIN PROFILE" : "PROFILE"}</p><h1>Your profile</h1><p className="muted">{isAdmin ? "Manage the public profile that everyone can view." : "Manage how your account appears across BookFlow."}</p></div>
      <Button asChild variant="default"><Link  className="primary-button button-link icon-link" to="/dashboard/profile/edit"><FiEdit3 aria-hidden="true" />Edit profile</Link></Button>
    </header>

    {!profile ? <p>{error || "Loading..."}</p> : <>
      <Card as="section" className="panel profile-overview-card profile-home-panel">
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
            {publicPath && <Button asChild variant="outline"><Link  className="secondary button-link icon-link" to={publicPath} target="_blank"><FiExternalLink aria-hidden="true" />View public profile</Link></Button>}
          </div>
          {profile.bio && <p className="profile-overview-bio">{profile.bio}</p>}
          {profile.website && <a className="profile-website-link" href={profile.website} target="_blank" rel="noreferrer">{profile.website}</a>}
        </div>
        {!isAdmin && <nav className="profile-home-actions" aria-label="Manage your profile and business">
          <Link className="profile-business-link" to="/dashboard/profile/business">
            <span className="profile-business-icon" aria-hidden="true"><FiBriefcase /></span>
            <span className="profile-business-copy">
              <strong>Business Page</strong>
              <small>Manage your business name, description, contact information and logo.</small>
            </span>
            <FiArrowUpRight className="profile-business-arrow" aria-hidden="true" />
          </Link>
        </nav>}

        {!isAdmin && <BookingQrCard bookingUrl={window.location.origin + "/b/" + (user.id || user._id)} businessName={profile.name} />}
      </Card>

      {isAdmin && <Card as="section" className="platform-content-profile-panel">
        <div className="platform-content-profile-heading">
          <div>
            <p className="eyebrow">ADMIN TOOLS</p>
            <h2>Platform content</h2>
            <p className="muted">Manage the public information shown to visitors and new accounts.</p>
          </div>
          <span className="platform-content-profile-badge">Administrator only</span>
        </div>
        <Link to="/dashboard/profile/content" className="platform-content-profile-link">
          <span className="platform-content-profile-icon"><FiFileText/></span>
          <span><strong>Terms & Conditions</strong><small>Edit content blocks, preview and publish versioned terms.</small></span>
          <FiArrowUpRight/>
        </Link>
        <Link to="/dashboard/profile/content?tab=faqs" className="platform-content-profile-link">
          <span className="platform-content-profile-icon"><FiHelpCircle/></span>
          <span><strong>Frequently Asked Questions</strong><small>Create unlimited FAQ groups and question-and-answer entries.</small></span>
          <FiArrowUpRight/>
        </Link>
      </Card>}
      {error && <p className="error profile-feedback">{error}</p>}
      {message && <p className="success profile-feedback">{message}</p>}
    </>}
    </div>
  </AppLayout>;
}
