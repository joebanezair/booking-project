import { Link } from "react-router-dom";
import { FiShield } from "react-icons/fi";
import { Card } from "./ui/card.jsx";
import { Image } from "./ui/image.jsx";
import ProfileAvatar from "./ProfileAvatar.jsx";

// Only administrator fields explicitly allowed by the public search endpoint
// are displayed here. No account email, permissions or management controls.
export default function AdminSearchCard({ profile }) {
  return <Card as={Link} to={`/admin/${encodeURIComponent(profile.username)}`}
    className="panel user-result admin-result"
    aria-label={`View public administrator profile for ${profile.name}`}>
    <div className={`business-card-cover${profile.coverImage ? "" : " business-card-cover-fallback"}`}>
      {profile.coverImage
        ? <Image src={profile.coverImage} alt="" loading="lazy" decoding="async" />
        : <><span className="cover-wave cover-wave-one"/><span className="cover-wave cover-wave-two"/></>}
    </div>
    <div className="business-card-avatar"><ProfileAvatar profile={profile} size="lg" /></div>
    <div className="business-card-info">
      <span className="admin-result-role"><FiShield aria-hidden="true" /> Administrator</span>
      <h2>{profile.name}</h2>
      <strong>@{profile.username}</strong>
      {profile.headline && <p>{profile.headline}</p>}
      {profile.location && <small>{profile.location}</small>}
    </div>
  </Card>;
}
