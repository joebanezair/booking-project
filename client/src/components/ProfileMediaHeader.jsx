import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Image } from "./ui/image.jsx";
import { Dialog, DialogContent } from "./ui/dialog.jsx";
import { useEffect, useRef, useState } from "react";
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
  useEffect(() => { if (!menu) return; const close = event => { if (event.key === "Escape") setMenu(""); }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [menu]);

  function pick(inputRef) {
    setMenu("");
    inputRef.current?.click();
  }

  function selected(handler, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handler?.(file);
  }

  return <section className="linkedin-profile-media">
    <div className={"linkedin-cover" + (profile?.coverImage ? " has-image" : "")}>
      {profile?.coverImage && <Image className="ui-profile-cover-image" src={profile.coverImage} alt="" decoding="async" />}
      {!profile?.coverImage && <span className="linkedin-cover-placeholder">Add a cover photo</span>}
      <Button variant="plain"
        type="button"
        className="media-hit-area cover-hit-area"
        aria-label="Edit cover photo"
        aria-expanded={menu === "cover"}
        onClick={() => !disabled && setMenu(menu === "cover" ? "" : "cover")}
        disabled={disabled}
      />
      <Button variant="plain"
        type="button"
        className="media-edit-button cover-edit-button"
        aria-label="Cover photo options"
        aria-expanded={menu === "cover"}
        onClick={() => setMenu(menu === "cover" ? "" : "cover")}
        disabled={disabled}
      >
        <FiCamera aria-hidden="true" />
      </Button>

      {menu === "cover" && <div className="profile-media-menu cover-media-menu" role="group" aria-label="Cover photo actions">
        <Button variant="plain" type="button" onClick={() => pick(coverInput)}><FiUpload aria-hidden="true" />Change cover photo</Button>
        {profile?.coverImage && <Button variant="plain" type="button" className="menu-danger" onClick={() => { setMenu(""); onRemoveCover?.(); }}><FiTrash2 aria-hidden="true" />Remove cover photo</Button>}
        <Button variant="plain" type="button" onClick={() => setMenu("")}><FiX aria-hidden="true" />Cancel</Button>
      </div>}

      <div className="linkedin-avatar-wrap">
        <Button variant="plain"
          type="button"
          className="linkedin-avatar-button"
          aria-label="Profile photo options"
          aria-expanded={menu === "profile"}
          onClick={() => !disabled && setMenu(menu === "profile" ? "" : "profile")}
          disabled={disabled}
        >
          <ProfileAvatar profile={profile} size="xl" />
          <span className="avatar-camera-badge"><FiCamera aria-hidden="true" /></span>
        </Button>

        {menu === "profile" && <div className="profile-media-menu profile-photo-menu" role="group" aria-label="Profile photo actions">
          {profile?.profileImage && <Button variant="plain" type="button" onClick={() => { setMenu(""); setPreviewOpen(true); }}><FiEye aria-hidden="true" />View photo</Button>}
          <Button variant="plain" type="button" onClick={() => pick(profileInput)}><FiUpload aria-hidden="true" />Change profile photo</Button>
          {profile?.profileImage && onReposition && <Button variant="plain" type="button" onClick={() => { setMenu(""); onReposition(); }}><FiMove aria-hidden="true" />Reposition profile photo</Button>}
          {profile?.profileImage && <Button variant="plain" type="button" className="menu-danger" onClick={() => { setMenu(""); onRemoveProfile?.(); }}><FiTrash2 aria-hidden="true" />Delete profile photo</Button>}
          <Button variant="plain" type="button" onClick={() => setMenu("")}><FiX aria-hidden="true" />Cancel</Button>
        </div>}
      </div>
    </div>

    <Input ref={coverInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => selected(onCoverFile, event)} />
    <Input ref={profileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => selected(onProfileFile, event)} />

    <Dialog open={previewOpen && Boolean(profile?.profileImage)} onOpenChange={setPreviewOpen}
      title="Profile photo preview" className="ui-photo-preview-dialog">
      <DialogContent className="ui-photo-preview-content">
        <Button variant="outline" type="button" size="icon-sm" className="ui-photo-preview-close"
          aria-label="Close photo preview" onClick={() => setPreviewOpen(false)}><FiX /></Button>
        {profile?.profileImage && <Image
          src={profile.profileImage}
          alt={profile.name || "Profile"}
          style={{ objectPosition: String(profile.profileImagePositionX ?? 50) + "% " + String(profile.profileImagePositionY ?? 50) + "%" }}
        />}
      </DialogContent>
    </Dialog>
  </section>;
}
