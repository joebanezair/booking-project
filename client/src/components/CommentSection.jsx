import { Button } from "./ui/button.jsx";
import { Textarea } from "./ui/textarea.jsx";
import { useMemo, useState } from "react";
import ProfileAvatar from "./ProfileAvatar.jsx";
import { Link } from "react-router-dom";
import EmojiReactions from "./EmojiReactions.jsx";
import { FiChevronDown, FiEdit2, FiMessageCircle, FiTrash2 } from "react-icons/fi";

export default function CommentSection({
  comments,
  currentUser,
  ownerId,
  onAdd,
  onEdit,
  onDelete,
  onReact,
  onSignIn
}) {
  const [text, setText] = useState("");
  const [replying, setReplying] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [collapsed, setCollapsed] = useState(new Set());
  const [discussionOpen, setDiscussionOpen] = useState(false);

  const tree = useMemo(() => {
    const map = new Map(comments.map(c => [c._id, { ...c, replies: [] }]));
    const roots = [];
    for (const c of map.values()) {
      const parent = c.parent ? map.get(String(c.parent)) : null;
      (parent ? parent.replies : roots).push(c);
    }
    return roots;
  }, [comments]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await onAdd(text, null);
    setText("");
  }

  async function reply(id) {
    if (!replyText.trim()) return;
    await onAdd(replyText, id);
    setReplying(null);
    setReplyText("");
  }

  async function saveEdit(id) {
    if (!editText.trim()) return;
    await onEdit(id, editText);
    setEditing(null);
  }

  function toggle(id) {
    setCollapsed(current => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function node(c) {
    const mine = String(c.user?._id) === String(currentUser?.id);
    const moderator = String(ownerId) === String(currentUser?.id);

    return (
      <article className="comment-thread" key={c._id}>
        <div className="comment-item">
          {c.user?.username ? (
            <Link to={`/profile/${c.user.username}`} className="comment-avatar-link">
              <ProfileAvatar profile={c.user} />
            </Link>
          ) : (
            <ProfileAvatar profile={c.user} />
          )}

          <div className="comment-body">
            <div className="comment-head">
              <div className="comment-author-meta">
                <strong>
                  {c.user?.username
                    ? <Link className="entity-link" to={`/profile/${c.user.username}`}>{c.user.name}</Link>
                    : (c.user?.name || "User")}
                </strong>
                <small>{new Date(c.createdAt).toLocaleString()}{c.edited ? " · edited" : ""}</small>
              </div>

              {currentUser && (
                <div className="row-actions">
                  {!c.deletedAt && c.depth < 3 && (
                    <Button variant="plain" className="secondary icon-action" aria-label="Reply" data-tooltip="Reply" onClick={() => setReplying(c._id)}>
                      <FiMessageCircle />
                    </Button>
                  )}
                  {mine && !c.deletedAt && (
                    <Button variant="plain" className="secondary icon-action" aria-label="Edit comment" data-tooltip="Edit comment" onClick={() => { setEditing(c._id); setEditText(c.comment); }}>
                      <FiEdit2 />
                    </Button>
                  )}
                  {(mine || moderator) && !c.deletedAt && (
                    <Button variant="plain" className="danger icon-action" aria-label="Delete comment" data-tooltip="Delete comment" onClick={() => onDelete(c._id)}>
                      <FiTrash2 />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {editing === c._id ? (
              <div className="comment-edit">
                <Textarea rows="3" value={editText} onChange={e => setEditText(e.target.value)} />
                <div className="row-actions">
                  <Button variant="plain" className="primary-button" onClick={() => saveEdit(c._id)}>Save</Button>
                  <Button variant="plain" className="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className={c.deletedAt ? "muted" : ""}>{c.comment}</p>
            )}

            {!c.deletedAt && (
              <EmojiReactions
                reactions={c.emojiReactions}
                canReact={Boolean(currentUser)}
                onToggle={emoji => onReact(c._id, emoji)}
                label="comment"
              />
            )}

            {replying === c._id && (
              <div className="comment-edit">
                <Textarea rows="2" placeholder="Write a reply..." value={replyText} onChange={e => setReplyText(e.target.value)} />
                <div className="row-actions">
                  <Button variant="plain" className="primary-button" onClick={() => reply(c._id)}>Reply</Button>
                  <Button variant="plain" className="secondary" onClick={() => setReplying(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {c.replies.length > 0 && (
          <>
            <Button variant="plain" className="thread-toggle" onClick={() => toggle(c._id)}>
              {collapsed.has(c._id) ? `Show ${c.replies.length} replies` : `Hide ${c.replies.length} replies`}
            </Button>
            {!collapsed.has(c._id) && (
              <div className="comment-replies">
                {c.replies.map(node)}
              </div>
            )}
          </>
        )}
      </article>
    );
  }

  const commentCount = comments.length;

  return (
    <section className="comments-section">
      <Button
        type="button"
        variant="plain"
        className={`discussion-toggle ${discussionOpen ? "is-open" : ""}`}
        aria-expanded={discussionOpen}
        aria-controls="public-service-discussion-content"
        onClick={() => setDiscussionOpen(open => !open)}
      >
        <span className="discussion-title-group">
          <span className="eyebrow">DISCUSSION</span>
          <span className="discussion-title">Threaded comments</span>
        </span>
        <span className="discussion-toggle-meta">
          <span className="discussion-count">
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </span>
          <FiChevronDown aria-hidden="true" />
        </span>
      </Button>

      {discussionOpen && (
        <div className="discussion-content" id="public-service-discussion-content">
          {currentUser ? (
            <form className="comment-form" onSubmit={submit}>
              <Textarea
                rows="3"
                maxLength="2000"
                placeholder="Share your thoughts..."
                value={text}
                onChange={e => setText(e.target.value)}
                required
              />
              <Button type="submit" variant="ghost" className="comment-submit-button">
                <FiMessageCircle aria-hidden="true" />
                Post comment
              </Button>
            </form>
          ) : (
            <div className="signin-callout">
              Want to join the discussion?
              <Button variant="plain" className="link-button" onClick={onSignIn}>Sign in to continue</Button>
            </div>
          )}

          <div className="comment-list">
            {tree.length === 0 ? <p className="muted">No comments yet.</p> : tree.map(node)}
          </div>
        </div>
      )}
    </section>
  );
}
