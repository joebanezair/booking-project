import { Image } from "./ui/image.jsx";
export default function ProfileAvatar({profile,size="md"}){
  if(profile?.profileImage){
    return <Image className={`profile-avatar ${size}`} style={{objectPosition:`${profile.profileImagePositionX??50}% ${profile.profileImagePositionY??50}%`}} src={profile.profileImage} alt={profile.name||"Profile"}/>;
  }
  const initial = String(profile?.name || "?").trim().charAt(0).toUpperCase() || "?";
  return <span className={`avatar profile-avatar profile-avatar-fallback ${size}`} role="img" aria-label={profile?.name ? `${profile.name} profile avatar` : "Profile avatar"}>
    <span className="profile-avatar-initial" aria-hidden="true">{initial}</span>
  </span>;
}
