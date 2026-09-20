import { useRef, useState } from "react";
import { FiCamera, FiEye, FiMove, FiTrash2, FiUpload, FiX } from "react-icons/fi";
import ProfileAvatar from "./ProfileAvatar.jsx";

export default function ProfileMediaHeader({
  profile,
  onCoverFile,
  onRemoveCover,
  onProfileFile,
  onRemoveProfile,
  onReposition,
  disabled = false
}) {
  const coverInput = useRef(null);
  const profileInput = useRef(null);
  const [menu, setMenu] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  function pick(inputRef) {
    setMenu("");
    inputRef.current?.click();
  }

  function selected(handler, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handler?.(file);
  }

  const coverStyle = profile?.coverImage ? { backgroundImage: "url(" + profile.coverImage + ")" } : undefined;

  return <section className="linkedin-profile-media">
    <div className={"linkedin-cover" + (profile?.coverImage ? " has-image" : "")} style={coverStyle}>
      {!profile?.coverImage && <span className="linkedin-cover-placeholder">Add a cover photo</span>}
      <button
        type="button"
        className="media-hit-area cover-hit-area"
        aria-label="Edit cover photo"
        onClick={() => !disabled && setMenu(menu === "cover" ? "" : "cover")}
        disabled={disabled}
      />
      <button
        type="button"
        className="media-edit-button cover-edit-button"
        aria-label="Cover photo options"
        onClick={() => setMenu(menu === "cover" ? "" : "cover")}
        disabled={disabled}
      >
        <FiCamera aria-hidden="true" />
      </button>

      {menu === "cover" && <div className="profile-media-menu cover-media-menu" role="menu">
        <button type="button" onClick={() => pick(coverInput)}><FiUpload aria-hidden="true" />Change cover photo</button>
        {profile?.coverImage && <button type="button" className="menu-danger" onClick={() => { setMenu(""); onRemoveCover?.(); }}><FiTrash2 aria-hidden="true" />Remove cover photo</button>}
        <button type="button" onClick={() => setMenu("")}><FiX aria-hidden="true" />Cancel</button>
      </div>}

      <div className="linkedin-avatar-wrap">
        <button
          type="button"
          className="linkedin-avatar-button"
          aria-label="Profile photo options"
          onClick={() => !disabled && setMenu(menu === "profile" ? "" : "profile")}
          disabled={disabled}
        >
          <ProfileAvatar profile={profile} size="xl" />
          <span className="avatar-camera-badge"><FiCamera aria-hidden="true" /></span>
        </button>

        {menu === "profile" && <div className="profile-media-menu profile-photo-menu" role="menu">
          {profile?.profileImage && <button type="button" onClick={() => { setMenu(""); setPreviewOpen(true); }}><FiEye aria-hidden="true" />View photo</button>}
          <button type="button" onClick={() => pick(profileInput)}><FiUpload aria-hidden="true" />Change profile photo</button>
          {profile?.profileImage && onReposition && <button type="button" onClick={() => { setMenu(""); onReposition(); }}><FiMove aria-hidden="true" />Reposition profile photo</button>}
          {profile?.profileImage && <button type="button" className="menu-danger" onClick={() => { setMenu(""); onRemoveProfile?.(); }}><FiTrash2 aria-hidden="true" />Delete profile photo</button>}
          <button type="button" onClick={() => setMenu("")}><FiX aria-hidden="true" />Cancel</button>
        </div>}
      </div>
    </div>

    <input ref={coverInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => selected(onCoverFile, event)} />
    <input ref={profileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => selected(onProfileFile, event)} />

    {previewOpen && profile?.profileImage && <div className="photo-preview-modal" role="dialog" aria-modal="true" aria-label="Profile photo preview" onClick={() => setPreviewOpen(false)}>
      <div className="photo-preview-dialog" onClick={event => event.stopPropagation()}>
        <button type="button" className="photo-preview-close" aria-label="Close photo preview" onClick={() => setPreviewOpen(false)}><FiX /></button>
        <img
          src={profile.profileImage}
          alt={profile.name || "Profile"}
          style={{ objectPosition: String(profile.profileImagePositionX ?? 50) + "% " + String(profile.profileImagePositionY ?? 50) + "%" }}
        />
      </div>
    </div>}
  </section>;
}
