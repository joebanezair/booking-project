import { useEffect, useRef, useState } from "react";

export const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function EmojiReactions({ reactions = [], canReact = false, onToggle, label = "item" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const closeEscape = event => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);

  async function choose(emoji) {
    await onToggle?.(emoji);
    setOpen(false);
  }

  return <div className="emoji-reactions" ref={rootRef}>
    <div className="emoji-reaction-summary">
      {reactions.filter(reaction => reaction.count > 0).map(reaction => <button type="button" key={reaction.emoji} className={`emoji-reaction ${reaction.reacted ? "active" : ""}`} disabled={!canReact} aria-pressed={reaction.reacted} aria-label={`${reaction.emoji}: ${reaction.count} reaction${reaction.count === 1 ? "" : "s"}`} onClick={() => choose(reaction.emoji)}><span>{reaction.emoji}</span><strong>{reaction.count}</strong></button>)}
      {canReact && <button type="button" className="emoji-picker-trigger" aria-expanded={open} aria-label={`React to this ${label}`} onClick={() => setOpen(value => !value)}>☺<span>+</span></button>}
    </div>
    {open && <div className="emoji-picker" role="menu" aria-label={`Choose a reaction for this ${label}`}>{EMOJIS.map(emoji => <button type="button" role="menuitem" key={emoji} aria-label={`React with ${emoji}`} onClick={() => choose(emoji)}>{emoji}</button>)}</div>}
  </div>;
}
