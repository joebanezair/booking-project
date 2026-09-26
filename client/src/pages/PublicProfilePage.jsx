import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiMessageSquare, FiUserPlus, FiUserCheck } from "react-icons/fi";
import { api } from "../api.js";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import ContentCard from "../components/ContentCard.jsx";
import { RatingInput, RatingSummary } from "../components/StarRating.jsx";

export default function PublicProfilePage({ user }) {
  const { username } = useParams();
  const resolvedUsername = username || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);

  useEffect(() => {
    api.publicProfile(resolvedUsername).then(result => {
      setData(result);
      setError("");
    }).catch(e => setError(e.message));
  }, [resolvedUsername]);

  async function rateBusiness(value) {
    try {
      await api.ratings.setBusiness(data.profile.businessId, value);
      const refreshed = await api.publicProfile(resolvedUsername);
      setData(refreshed); setRatingMessage("Business rating saved."); setError("");
    } catch (e) { setError(e.message); }
  }
  async function removeBusinessRating() {
    try {
      await api.ratings.removeBusiness(data.profile.businessId);
      const refreshed = await api.publicProfile(resolvedUsername);
      setData(refreshed); setRatingMessage("Business rating removed."); setError("");
    } catch (e) { setError(e.message); }
  }

  async function friendAction(action) {
    if (!data?.profile?.id || friendBusy) return;
    setFriendBusy(true); setError("");
    try {
      if (action === "add") await api.messages.addFriend(data.profile.id);
      if (action === "accept") await api.messages.acceptFriend(data.profile.id);
      if (action === "unfriend") await api.messages.unfriend(data.profile.id);
      const refreshed = await api.publicProfile(resolvedUsername);
      setData(refreshed);
    } catch (e) { setError(e.message); }
    finally { setFriendBusy(false); }
  }

  if (error) return <main className="public-shell"><section className="public-card"><p className="error">{error}</p></section></main>;
  if (!data) return <main className="public-shell"><section className="public-card">Loading...</section></main>;

  const { profile, content, reviews = [] } = data;
  const isOwner = user && String(user.id) === String(profile.id);
  const friendship = profile.friendship || {};
  const canMessage = user && !isOwner && ["business", "admin"].includes(user.role) && (user.role === "admin" || friendship.isFriend);
  const conversationPath = `/dashboard/messages/${profile.id}`;
  const paused = profile.accountStatus === "paused";

  return <main className="public-page">
    <header className="public-top"><Link className="brand-row" to="/search"><span className="brand-mark small">B</span><strong>BookFlow</strong></Link></header>

    <section className={`public-profile-hero ${profile.coverImage ? "has-cover" : ""}`}>
      {profile.coverImage && <div className="public-cover" style={{ backgroundImage: `url(${profile.coverImage})` }} />}
      <div className="public-profile-info">
        <ProfileAvatar profile={profile} size="xl" />
        <div className="public-profile-copy">
          <p className="eyebrow">BUSINESS PROFILE</p>
          <div className="profile-title-row">
            <h1>{profile.name}</h1>
            {user && !isOwner && <div className="public-profile-actions">
              {friendship.incomingRequest ? <button className="primary-button icon-link" disabled={friendBusy} onClick={() => friendAction("accept")}><FiUserPlus aria-hidden="true" />Accept Friend</button> :
               friendship.isFriend ? <button className="secondary icon-link" disabled={friendBusy} onClick={() => friendAction("unfriend")}><FiUserCheck aria-hidden="true" />Friends</button> :
               <button className="primary-button icon-link" disabled={friendBusy || friendship.requestSent || friendship.blocked} onClick={() => friendAction("add")}><FiUserPlus aria-hidden="true" />{friendship.requestSent ? "Request Sent" : "Add Friend"}</button>}
              {canMessage && <Link className="secondary button-link icon-link" to={conversationPath}><FiMessageSquare aria-hidden="true" />Message</Link>}
            </div>}
          </div>
          {paused && <div className="paused-public-banner">Temporarily unavailable — this business is not accepting new bookings right now.</div>}
          {profile.headline && <p className="profile-headline">{profile.headline}</p>}
          <div className="business-rating-block">
            <div className="verified-rating-row"><RatingSummary {...profile.businessRatingSummary} /><span className="verified-badge">Business rating</span></div>
            {user && !isOwner && <div className="profile-rating-control"><span>Your rating</span><RatingInput value={profile.currentUserBusinessRating || 0} onChange={rateBusiness} />{profile.currentUserBusinessRating && <button type="button" className="link-button" onClick={removeBusinessRating}>Remove rating</button>}</div>}
            {!user && <small className="muted">Sign in to rate this business.</small>}
            {ratingMessage && <small className="success">{ratingMessage}</small>}
          </div>
          <div className="verified-rating-row"><RatingSummary {...profile.ratingSummary} /><span className="verified-badge">Verified booking reviews</span></div>
          {profile.bio && <p className="public-bio">{profile.bio}</p>}
          <div className="profile-meta">
            {profile.location && <span>{profile.location}</span>}
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer">Website</a>}
            {!paused && <Link to={`/b/${profile.id}`}>Book a session</Link>}
          </div>
        </div>
      </div>
    </section>

    <section className="public-content-section">
      <div className="section-heading"><div><p className="eyebrow">PUBLIC SERVICES</p><h2>Explore {profile.name}&apos;s services</h2></div></div>
      {content.length === 0 ? <div className="panel empty-state"><p className="muted">No public services yet.</p></div> :
        <div className="content-grid">{content.map(item => <Link key={item._id} to={`/services/${item._id}`} className="content-card-link"><ContentCard item={item} /></Link>)}</div>}
    </section>

    <section className="public-content-section verified-reviews-section">
      <div className="section-heading"><div><p className="eyebrow">VERIFIED REVIEWS</p><h2>Reviews from completed BookFlow bookings</h2></div></div>
      {reviews.length === 0 ? <div className="panel empty-state"><p className="muted">No verified reviews yet.</p></div> :
        <div className="verified-review-list">{reviews.map(review => <article className="panel verified-review-card" key={review._id}><RatingSummary averageRating={review.rating} ratingCount={1} />{review.comment && <p>{review.comment}</p>}<small>Verified booking · {new Date(review.submittedAt).toLocaleDateString()}</small></article>)}</div>}
    </section>
  </main>;
}
