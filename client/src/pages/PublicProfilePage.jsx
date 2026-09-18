import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FiMessageSquare } from "react-icons/fi";
import { api } from "../api.js";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import ContentCard from "../components/ContentCard.jsx";
import { RatingInput, RatingSummary } from "../components/StarRating.jsx";

export default function PublicProfilePage({ user }) {
  const { username } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ratingMessage, setRatingMessage] = useState("");

  async function load() {
    try { setData(await api.publicProfile(username)); setError(""); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [username]);

  if (error) return <main className="public-shell"><section className="public-card"><p className="error">{error}</p></section></main>;
  if (!data) return <main className="public-shell"><section className="public-card">Loading...</section></main>;

  const { profile, content } = data;
  const isOwner = user && String(user.id) === String(profile.id);
  const canRate = user?.role === "customer" && !isOwner;
  const conversationPath = `/dashboard/messages/${profile.id}`;

  async function rate(value) {
    try {
      const result = await api.profileRatings.set(profile.id, value);
      setData(current => ({ ...current, profile: { ...current.profile, ratingSummary: { averageRating: result.averageRating, ratingCount: result.ratingCount }, currentUserRating: result.currentUserRating } }));
      setRatingMessage("Your business rating was saved.");
    } catch (e) { setRatingMessage(e.message); }
  }
  async function remove() {
    try {
      const result = await api.profileRatings.remove(profile.id);
      setData(current => ({ ...current, profile: { ...current.profile, ratingSummary: { averageRating: result.averageRating, ratingCount: result.ratingCount }, currentUserRating: null } }));
      setRatingMessage("Your rating was removed.");
    } catch (e) { setRatingMessage(e.message); }
  }

  return <main className="public-page"><header className="public-top"><Link className="brand-row" to="/search"><span className="brand-mark small">B</span><strong>BookFlow</strong></Link></header><section className={`public-profile-hero ${profile.coverImage ? "has-cover" : ""}`}>{profile.coverImage && <div className="public-cover" style={{ backgroundImage: `url(${profile.coverImage})` }} />}<div className="public-profile-info"><ProfileAvatar profile={profile} size="xl" /><div className="public-profile-copy"><p className="eyebrow">BUSINESS PROFILE</p><div className="profile-title-row"><h1>{profile.name}</h1>{!isOwner && (user ? <Link className="primary-button button-link icon-link" to={conversationPath}><FiMessageSquare aria-hidden="true" />Message</Link> : <Link className="primary-button button-link icon-link" to="/login" state={{ from: conversationPath }}><FiMessageSquare aria-hidden="true" />Sign in to message</Link>)}</div>{profile.headline && <p className="profile-headline">{profile.headline}</p>}<RatingSummary {...profile.ratingSummary} />{canRate && <div className="your-rating"><span>Rate this business</span><RatingInput value={profile.currentUserRating || 0} onChange={rate} />{profile.currentUserRating && <button className="link-button" onClick={remove}>Remove rating</button>}</div>}{!user && <button className="link-button" onClick={() => navigate("/login", { state: { from: `/profile/${username}` } })}>Sign in to rate this business</button>}{ratingMessage && <p className="rating-feedback" role="status">{ratingMessage}</p>}{profile.bio && <p className="public-bio">{profile.bio}</p>}<div className="profile-meta">{profile.location && <span>{profile.location}</span>}{profile.website && <a href={profile.website} target="_blank" rel="noreferrer">Website</a>}<Link to={`/b/${profile.id}`}>Book a session</Link></div></div></div></section><section className="public-content-section"><div className="section-heading"><div><p className="eyebrow">PUBLIC SERVICES</p><h2>Explore {profile.name}&apos;s services</h2></div></div>{content.length === 0 ? <div className="panel empty-state"><p className="muted">No public services yet.</p></div> : <div className="content-grid">{content.map(item => <Link key={item._id} to={`/services/${item._id}`} className="content-card-link"><ContentCard item={item} /></Link>)}</div>}</section></main>;
}
