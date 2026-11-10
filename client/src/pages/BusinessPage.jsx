import { Button } from "../components/ui/button.jsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiExternalLink, FiShare2 } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import BusinessProfileSection from "../components/BusinessProfileSection.jsx";

export default function BusinessPage({ user, onLogout, onUserUpdate }) {
  const [shareFeedback, setShareFeedback] = useState("");
  const [fallbackLink, setFallbackLink] = useState("");

  const profileUsername = String(user?.username || "").trim();
  const publicProfileUrl = profileUsername
    ? new URL("/profile/" + encodeURIComponent(profileUsername), window.location.origin).href
    : "";

  async function shareBusinessProfile() {
    if (!publicProfileUrl) {
      setShareFeedback("Your public profile link is not available. Add a username in Edit Profile first.");
      return;
    }

    setShareFeedback("");
    setFallbackLink("");
    const shareData = {
      title: user?.business?.name || user?.name || "My business on BookFlow",
      text: "View my business profile on BookFlow.",
      url: publicProfileUrl
    };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
        // Some browsers expose Web Share but do not support this share target.
      }
    }

    try {
      await navigator.clipboard.writeText(publicProfileUrl);
      setShareFeedback("Public business profile link copied.");
    } catch {
      // When clipboard permissions are blocked, give the user a selectable link.
      setFallbackLink(publicProfileUrl);
      setShareFeedback("Copy the link below to share your business profile.");
    }
  }

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar business-page-topbar">
      <div>
        <p className="eyebrow">PROFILE · EDIT BUSINESS PROFILE</p>
        <h1>Edit Business Profile</h1>
        <p className="muted">Update your business identity, contact details and branding. Changes are published after you save.</p>
      </div>
      <div className="business-page-header-actions">
        <Button type="button" variant="outline" className="business-page-share-button" onClick={shareBusinessProfile}>
          <FiShare2 aria-hidden="true" /> Share profile
        </Button>
        <Button asChild variant="outline"><Link className="secondary button-link icon-link" to="/dashboard/profile"><FiArrowLeft aria-hidden="true" />Back to Profile</Link></Button>
      </div>
    </header>
    {(shareFeedback || fallbackLink) && <div className="business-page-share-feedback" role="status">
      <span>{!fallbackLink && <FiCheck aria-hidden="true" />}{shareFeedback}</span>
      {fallbackLink && <div className="business-page-share-fallback">
        <input type="text" aria-label="Public business profile link" readOnly value={fallbackLink} onFocus={event=>event.currentTarget.select()} onClick={event=>event.currentTarget.select()}/>
        <a href={fallbackLink} target="_blank" rel="noopener noreferrer"><FiExternalLink aria-hidden="true"/>Open profile</a>
      </div>}
    </div>}
    <div className="business-page-shell">
      <BusinessProfileSection user={user} onUserUpdate={onUserUpdate} />
    </div>
  </AppLayout>;
}
