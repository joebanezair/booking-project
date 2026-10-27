import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCalendar, FiCheck, FiCopy, FiEdit3, FiMapPin, FiShield } from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import { Image } from "../components/ui/image.jsx";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { api } from "../api.js";

export default function PublicAdminProfilePage({ user }) {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setProfile(null);
    setError("");
    setCopied(false);
    api.publicAdminProfile(username)
      .then(result => { if (mounted) setProfile(result.profile); })
      .catch(e => { if (mounted) setError(e.message || "Unable to load admin profile."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [username]);

  const isOwner = user?.role === "admin" && user?.username === profile?.username;
  const joined = profile?.joinedAt && !Number.isNaN(new Date(profile.joinedAt).getTime())
    ? new Date(profile.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (loading) return <main className="public-page admin-public-page admin-public-loading" role="status">Loading admin profile…</main>;
  if (!profile) return <main className="public-page admin-public-page admin-public-error">
    <div className="admin-public-error-body">
      <FiShield aria-hidden="true" />
      <h1>Admin profile unavailable</h1>
      <p>{error || "This administrator profile could not be found."}</p>
      <Button asChild variant="outline"><Link to="/search"><FiArrowLeft aria-hidden="true" /> Back to BookFlow</Link></Button>
    </div>
  </main>;

  return <main className="public-page bookflow-storefront admin-public-page" id="admin-profile-top">
    <section className={`public-profile-hero storefront-hero admin-public-hero ${profile.coverImage ? "has-cover" : ""}`}
      aria-label={`${profile.name} administrator profile`}>
      <div className={`public-cover storefront-cover admin-public-cover ${profile.coverImage ? "has-image" : "storefront-cover-empty"}`}>
        <Link to="/search" className="storefront-cover-brand" aria-label="BookFlow home" title="BookFlow home">
          <span className="brand-mark small" aria-hidden="true"><FiCalendar /></span>
        </Link>
        {profile.coverImage
          ? <Image className="ui-profile-cover-image" src={profile.coverImage} alt={`${profile.name} cover photo`} decoding="async" />
          : <div className="storefront-cover-placeholder" aria-hidden="true" />}
      </div>

      <div className="public-profile-info storefront-profile-info storefront-container admin-public-profile-info">
        <ProfileAvatar profile={profile} size="xl" />
        <div className="public-profile-copy admin-public-copy">
          <div className="profile-title-row storefront-title-row admin-public-title-row">
            <div className="storefront-name-block">
              <span className="admin-public-role"><FiShield aria-hidden="true" /> Platform administrator</span>
              <h1>{profile.name}</h1>
              <span className="storefront-handle">@{profile.username}</span>
            </div>
            <div className="admin-public-actions">
              {isOwner && <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/profile/edit"><FiEdit3 aria-hidden="true" /> Edit profile</Link>
              </Button>}
              <Button type="button" variant="outline" size="sm" onClick={copyLink} aria-label="Copy public admin profile link">
                {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
                {copied ? "Copied" : "Copy profile link"}
              </Button>
            </div>
          </div>
          {profile.headline && <p className="profile-headline admin-public-headline">{profile.headline}</p>}
          <div className="profile-meta storefront-meta admin-public-meta">
            {profile.location && <span><FiMapPin aria-hidden="true" /> {profile.location}</span>}
            {joined && <span><FiCalendar aria-hidden="true" /> Joined {joined}</span>}
          </div>
        </div>
      </div>
    </section>

    <section className="storefront-container admin-public-about" aria-labelledby="admin-public-about-heading">
      <div className="admin-public-about-heading">
        <FiShield aria-hidden="true" />
        <div>
          <h2 id="admin-public-about-heading">About this administrator</h2>
          <p>Official BookFlow administrator profile</p>
        </div>
      </div>
      <p>{profile.bio || "This administrator has not added a public introduction yet."}</p>
    </section>

    <footer className="storefront-footer">
      <div className="storefront-container storefront-footer-inner">
        <div className="storefront-footer-brand">
          <Link className="brand-row" to="/search"><span className="brand-mark small">B</span><strong>BookFlow</strong></Link>
          <p>Discover and connect with businesses on BookFlow.</p>
        </div>
        <div className="storefront-footer-links"><Link to="/search">Explore BookFlow</Link><a href="#admin-profile-top">Back to top</a></div>
      </div>
    </footer>
  </main>;
}
