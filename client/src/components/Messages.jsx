import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";
import EmojiReactions from "./EmojiReactions.jsx";

function applyRealtimeReaction(reactions = [], event, currentUserId) {
  const previous = new Map(reactions.map(reaction => [reaction.emoji, reaction]));
  return event.reactions.map(reaction => ({ ...reaction, reacted: String(event.actorId) === String(currentUserId) && reaction.emoji === event.emoji ? event.selected : Boolean(previous.get(reaction.emoji)?.reacted) }));
}

export default function Messages({ currentUser, initialUserId }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const selectedRef = useRef(null);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => {
    api.messages.users().then(setUsers).catch(e => setError(e.message));
    const socket = getRealtimeSocket();
    if (!socket) return;
    const receive = message => {
      if (String(message.sender) !== String(selectedRef.current?._id)) return;
      setConversation(current => current.some(item => item._id === message._id) ? current : [...current, { ...message, emojiReactions: message.emojiReactions || [] }]);
    };
    const receiveReaction = event => setConversation(current => current.map(message => String(message._id) === String(event.targetId) ? { ...message, emojiReactions: applyRealtimeReaction(message.emojiReactions, { ...event, emoji: event.emoji }, currentUser.id) } : message));
    socket.on("message:new", receive);
    socket.on("message:reaction", receiveReaction);
    socket.on("connect_error", event => setError(`Real-time connection: ${event.message}`));
    return () => { socket.off("message:new", receive); socket.off("message:reaction", receiveReaction); socket.off("connect_error"); };
  }, [currentUser.id]);

  useEffect(() => {
    if (!initialUserId || String(initialUserId) === String(currentUser.id)) return;
    openById(initialUserId);
  }, [initialUserId, currentUser.id]);

  async function openById(userId) {
    try {
      setError("");
      const data = await api.messages.conversation(userId);
      setSelected(data.user);
      setConversation(data.messages);
      if (String(initialUserId) !== String(userId)) navigate(`/dashboard/messages/${userId}`);
    } catch (e) { setError(e.message); }
  }

  async function send(e) {
    e.preventDefault();
    if (!selected || !body.trim()) return;
    try {
      const message = await api.messages.send(selected._id, body);
      setConversation(current => [...current, message]);
      setBody("");
    } catch (e) { setError(e.message); }
  }

  async function react(messageId, emoji) {
    try {
      const result = await api.emojiReactions.toggle("message", messageId, emoji);
      setConversation(current => current.map(message => String(message._id) === String(messageId) ? { ...message, emojiReactions: result.reactions } : message));
    } catch (e) { setError(e.message); }
  }

  return <section id="messages" className="panel messages-panel"><div className="panel-title"><h2>Messages</h2></div>{error && <p className="error">{error}</p>}<div className="messages-layout"><div className="user-list">{users.map(user => <button className={`user-row ${selected?._id === user._id ? "active" : ""}`} key={user._id} onClick={() => openById(user._id)}><span className="avatar">{user.name[0]}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></button>)}</div><div className="conversation">{!selected ? <div className="empty-state"><p className="muted">Select a user to start a conversation.</p></div> : <><div className="conversation-header"><strong>{selected.username ? <Link className="entity-link" to={`/profile/${selected.username}`}>{selected.name}</Link> : selected.name}</strong>{selected.username && <small><Link className="entity-link" to={`/profile/${selected.username}`}>View public profile</Link></small>}</div><div className="message-list">{conversation.map(message => <div key={message._id} className={`message-entry ${String(message.sender) === String(currentUser.id) ? "mine" : "theirs"}`}><div className="message-bubble">{message.body}<small>{new Date(message.createdAt).toLocaleString()}</small></div><EmojiReactions reactions={message.emojiReactions} canReact onToggle={emoji => react(message._id, emoji)} label="message" /></div>)}</div><form className="message-compose" onSubmit={send}><input value={body} onChange={e => setBody(e.target.value)} placeholder="Write a message..." /><button className="primary-button">Send</button></form></>}</div></div></section>;
}
