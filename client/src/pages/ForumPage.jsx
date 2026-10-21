import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiCheckCircle,
  FiCompass,
  FiEdit3,
  FiGrid,
  FiMessageCircle,
  FiMessageSquare,
  FiSearch,
  FiSend,
  FiTag,
  FiUsers,
  FiX
} from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { api } from "../api.js";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import { getRealtimeSocket } from "../realtime.js";

const DEFAULT_FORM = { title: "", body: "", category: "General" };
const TOPIC_SUGGESTIONS = ["General", "Questions", "Tips & Advice", "Feedback", "Announcements"];

function Author({ profile }) {
  const avatar = <ProfileAvatar profile={profile} />;
  const name = profile?.name || "Community member";

  return (
    <div className="forum-person">
      {profile?.username ? <Link to={"/profile/" + profile.username} aria-label={"View " + name + "'s profile"}>{avatar}</Link> : avatar}
      <div className="forum-person-details">
        <strong>{profile?.username ? <Link className="entity-link" to={"/profile/" + profile.username}>{name}</Link> : name}</strong>
      </div>
    </div>
  );
}

export default function ForumPage({ user }) {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [replies, setReplies] = useState({});
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All topics");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [sendingReplyId, setSendingReplyId] = useState(null);

  async function load() {
    try {
      const data = await api.forum.list();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load discussions.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    const socket = getRealtimeSocket();
    if (!socket) return;
    const refresh = () => load();
    socket.on("forum:post", refresh);
    socket.on("forum:reply", refresh);
    return () => {
      socket.off("forum:post", refresh);
      socket.off("forum:reply", refresh);
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(posts.map(post => post.category || "General"))).sort((a, b) => a.localeCompare(b)),
    [posts]
  );
  const visiblePosts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return posts.filter(post => {
      if (categoryFilter !== "All topics" && (post.category || "General") !== categoryFilter) return false;
      if (!term) return true;
      return [post.title, post.body, post.category, post.user?.name]
        .some(value => String(value || "").toLocaleLowerCase().includes(term));
    });
  }, [posts, categoryFilter, query]);
  const hasFilters = Boolean(query.trim()) || categoryFilter !== "All topics";

  async function create(event) {
    event.preventDefault();
    if (isPublishing || !form.title.trim() || !form.body.trim()) return;
    setIsPublishing(true);
    setError("");
    setNotice("");
    try {
      await api.forum.create({
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category.trim() || "General"
      });
      setForm(DEFAULT_FORM);
      setQuery("");
      setCategoryFilter("All topics");
      setNotice("Your discussion was published.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to publish your discussion.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function sendReply(postId) {
    const body = (replies[postId] || "").trim();
    if (!body || sendingReplyId) return;
    setSendingReplyId(postId);
    setError("");
    setNotice("");
    try {
      await api.forum.reply(postId, body);
      setReplies(current => ({ ...current, [postId]: "" }));
      await load();
    } catch (err) {
      setError(err.message || "Unable to send your reply.");
    } finally {
      setSendingReplyId(null);
    }
  }

  return (
    <main className="public-page forum-page">
      <header className="public-top browse-top forum-topbar">
        <Link className="brand-row forum-brand" to="/">
          <span className="brand-mark small"><FiMessageCircle aria-hidden="true" /></span>
          <strong>BookFlow <span>Forum</span></strong>
        </Link>
        <nav className="forum-nav" aria-label="Forum navigation">
          <Link className="forum-back-link" to="/" aria-label="Explore BookFlow"><FiCompass aria-hidden="true" /><span>Explore</span></Link>
          <Button asChild variant="default" className="forum-dashboard-link">
            <Link to={user ? "/dashboard" : "/login"}><FiGrid aria-hidden="true" /> {user ? "Dashboard" : "Sign in"} <FiArrowRight className="forum-dashboard-arrow" aria-hidden="true" /></Link>
          </Button>
        </nav>
      </header>

      <section className="forum-shell">
        <div className="forum-hero">
          <div className="forum-hero-heading">
            <FiUsers aria-hidden="true" />
            <h1>Community discussions</h1>
          </div>
          <p>Ask questions, share ideas, and connect with the community.</p>
        </div>

        <div className="forum-main">
          {user ? (
            <section className="panel forum-composer" id="new-discussion" aria-labelledby="forum-composer-title">
              <div className="forum-composer-heading">
                <span className="forum-icon-tile"><FiEdit3 aria-hidden="true" /></span>
                <div>
                  <h2 id="forum-composer-title">Start a discussion</h2>
                </div>
              </div>
              <form className="forum-form" onSubmit={create}>
                <div className="forum-form-row">
                  <label className="forum-field">
                    <span>Discussion title</span>
                    <Input
                      value={form.title}
                      onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
                      placeholder="What would you like to talk about?"
                      maxLength={160}
                      required
                    />
                  </label>
                  <label className="forum-field">
                    <span className="forum-field-label"><FiTag aria-hidden="true" /> Category</span>
                    <Input
                      value={form.category}
                      onChange={event => setForm(current => ({ ...current, category: event.target.value }))}
                      placeholder="Choose a topic"
                      list="forum-topic-suggestions"
                      maxLength={60}
                    />
                    <datalist id="forum-topic-suggestions">
                      {TOPIC_SUGGESTIONS.map(topic => <option value={topic} key={topic} />)}
                    </datalist>
                  </label>
                </div>
                <label className="forum-field">
                  <span>Your message</span>
                  <Textarea
                    rows={4}
                    placeholder="Write your question or idea..."
                    value={form.body}
                    onChange={event => setForm(current => ({ ...current, body: event.target.value }))}
                    maxLength={5000}
                    required
                  />
                </label>
                <div className="forum-form-footer">
                  <Button type="submit" className="forum-primary-action" disabled={isPublishing || !form.title.trim() || !form.body.trim()}>
                    <FiSend aria-hidden="true" /> {isPublishing ? "Publishing..." : "Publish discussion"}
                  </Button>
                </div>
              </form>
            </section>
          ) : (
            <div className="forum-signin">
              <div className="forum-icon-tile"><FiEdit3 aria-hidden="true" /></div>
              <div>
                <strong>Have something to share?</strong>
                <p>Join the conversation by signing in to publish a post or reply.</p>
              </div>
              <Button asChild className="forum-primary-action"><Link to="/login">Sign in to post <FiArrowRight aria-hidden="true" /></Link></Button>
            </div>
          )}

          {error && <p className="error forum-message" role="alert">{error}</p>}
          {notice && <p className="forum-success forum-message" role="status"><FiCheckCircle aria-hidden="true" /> {notice}</p>}

          <section className="forum-feed" id="discussions" aria-labelledby="forum-feed-title">
            <div className="forum-feed-heading">
              <h2 id="forum-feed-title"><FiMessageCircle aria-hidden="true" /> Recent discussions <span className="forum-post-count">{posts.length}</span></h2>
            </div>
            <div className="forum-toolbar">
              <div className="forum-search">
                <FiSearch aria-hidden="true" />
                <Input
                  type="search"
                  aria-label="Search recent discussions"
                  placeholder="Search discussions..."
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                />
              </div>
              <label className="forum-filter">
                <span className="sr-only">Filter by category</span>
                <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                  <option value="All topics">All topics</option>
                  {categories.map(category => <option value={category} key={category}>{category}</option>)}
                </select>
              </label>
            </div>

            {isLoading ? (
              <div className="forum-empty" role="status">
                <span className="forum-empty-icon"><FiMessageSquare aria-hidden="true" /></span>
                <h3>Loading discussions...</h3>
              </div>
            ) : visiblePosts.length === 0 ? (
              <div className="forum-empty">
                <span className="forum-empty-icon">{hasFilters ? <FiSearch aria-hidden="true" /> : <FiMessageSquare aria-hidden="true" />}</span>
                <h3>{hasFilters ? "No matching discussions" : "No discussions yet"}</h3>
                <p>{hasFilters ? "Try another keyword or category to find a conversation." : "Be the first to start a conversation and share something useful."}</p>
                {hasFilters ? (
                  <Button variant="outline" type="button" className="forum-clear-button" onClick={() => { setQuery(""); setCategoryFilter("All topics"); }}>
                    <FiX aria-hidden="true" /> Clear filters
                  </Button>
                ) : (
                  <a className="forum-empty-link" href={user ? "#new-discussion" : "/login"}>
                    {user ? "Write the first post" : "Sign in to start"} <FiArrowRight aria-hidden="true" />
                  </a>
                )}
              </div>
            ) : (
              <div className="forum-list">
                {visiblePosts.map(post => (
                  <Card as="article" className="panel forum-post" key={post._id}>
                    <div className="forum-post-top">
                      <div className="forum-author">
                        <Author profile={post.user} />
                        <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>
                      </div>
                      <span className="category-pill">{post.category || "General"}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p className="forum-post-body">{post.body}</p>
                    <div className="forum-post-reply-heading">
                      <FiMessageSquare aria-hidden="true" />
                      {(post.replies || []).length} {(post.replies || []).length === 1 ? "reply" : "replies"}
                    </div>
                    {(post.replies || []).length > 0 && (
                      <div className="forum-replies">
                        {post.replies.map(reply => (
                          <div className="forum-reply" key={reply._id}>
                            <Author profile={reply.user} />
                            <p>{reply.body}</p>
                            <time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString()}</time>
                          </div>
                        ))}
                      </div>
                    )}
                    {user && (
                      <form className="forum-reply-form" onSubmit={event => { event.preventDefault(); sendReply(post._id); }}>
                        <Input
                          aria-label={"Reply to " + post.title}
                          placeholder="Write a reply..."
                          value={replies[post._id] || ""}
                          maxLength={2000}
                          onChange={event => setReplies(current => ({ ...current, [post._id]: event.target.value }))}
                        />
                        <Button type="submit" variant="secondary" disabled={!replies[post._id]?.trim() || sendingReplyId !== null}>
                          <FiSend aria-hidden="true" /> {sendingReplyId === post._id ? "Sending..." : "Reply"}
                        </Button>
                      </form>
                    )}
                  </Card>
                ))}
              </div>
            )}
            
          </section>
        </div>
      </section>
    </main>
  );
}
