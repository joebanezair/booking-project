import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const services = ["Consultation", "Technical Support", "Product Demo", "Project Meeting", "Discovery Call", "Other"];
const emptyBooking = { guestName: "", service: "Consultation", bookingDate: "", notes: "", status: "pending" };
const emptyContent = {
  title: "", description: "", price: "", currency: "PHP", category: "General",
  coverImage: "", images: [], published: false
};

function money(value, currency = "PHP") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toFixed(2)}`;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      return reject(new Error("Images must be JPEG, PNG, WebP, or GIF."));
    }
    if (file.size > 2 * 1024 * 1024) return reject(new Error("Each image must be 2 MB or smaller."));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
}

function Avatar({ profile, large = false }) {
  if (profile?.profileImage) {
    return <img className={large ? "profile-avatar large" : "profile-avatar"} src={profile.profileImage} alt={profile.name || "Profile"} />;
  }
  return <span className={large ? "avatar profile-avatar large" : "avatar profile-avatar"}>{(profile?.name || "?").charAt(0).toUpperCase()}</span>;
}

function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = mode === "register" ? await api.register(form) : await api.login(form);
      localStorage.setItem("booking_token", data.token);
      localStorage.setItem("booking_user", JSON.stringify(data.user));
      onAuthenticated(data.user);
    } catch (err) { setError(err.message); }
  }

  return <main className="auth-shell"><section className="auth-card">
    <p className="eyebrow">BOOKFLOW</p>
    <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
    <p className="muted">Bookings, content management, public profiles and direct messaging in one place.</p>
    <form onSubmit={submit}>
      {mode === "register" && <label>Full name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></label>}
      <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required /></label>
      <label>Password<input type="password" minLength="8" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required /></label>
      {error && <p className="error">{error}</p>}
      <button className="primary-button">{mode === "login" ? "Sign in" : "Create account"}</button>
    </form>
    <button className="link-button" onClick={()=>setMode(mode==="login"?"register":"login")}>
      {mode === "login" ? "Create an account" : "Already have an account? Sign in"}
    </button>
  </section></main>;
}

function PublicBooking({ userId }) {
  const [page, setPage] = useState(null);
  const [form, setForm] = useState({ guestName:"", guestEmail:"", service:"Consultation", bookingDate:"", notes:"" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(()=>{ api.publicBooking.get(userId).then(setPage).catch(e=>setError(e.message)); },[userId]);

  async function submit(e) {
    e.preventDefault(); setError(""); setMessage("");
    try {
      const result = await api.publicBooking.create(userId, form);
      setMessage(result.message);
      setForm({...form, guestName:"", guestEmail:"", bookingDate:"", notes:""});
    } catch(err) { setError(err.message); }
  }

  return <main className="public-shell"><section className="public-card">
    <div className="brand-row"><span className="brand-mark">B</span><strong>BookFlow</strong></div>
    {error && !page ? <p className="error">{error}</p> : !page ? <p>Loading...</p> : <>
      <p className="eyebrow">PUBLIC BOOKING PAGE</p>
      <h1>Book time with {page.owner.name}</h1>
      <p className="muted">Choose a service and request a date and time. Your booking will appear in {page.owner.name}'s dashboard.</p>
      <form onSubmit={submit}>
        <div className="two-col">
          <label>Your name<input value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} required /></label>
          <label>Your email<input type="email" value={form.guestEmail} onChange={e=>setForm({...form,guestEmail:e.target.value})} required /></label>
        </div>
        <label>Service<select value={form.service} onChange={e=>setForm({...form,service:e.target.value})}>{page.services.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Date and time<input type="datetime-local" value={form.bookingDate} onChange={e=>setForm({...form,bookingDate:e.target.value})} required /></label>
        <label>Notes<textarea rows="4" maxLength="500" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></label>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <button className="primary-button">Request booking</button>
      </form>
    </>}
  </section></main>;
}

function PublicProfile({ userId }) {
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{api.publicProfile(userId).then(setData).catch(e=>setError(e.message));},[userId]);

  if(error) return <main className="public-shell"><section className="public-card"><p className="error">{error}</p></section></main>;
  if(!data) return <main className="public-shell"><section className="public-card"><p>Loading profile...</p></section></main>;

  const {profile,content}=data;
  return <main className="public-page">
    <header className="public-top"><a className="brand-row" href="/"><span className="brand-mark small">B</span><strong>BookFlow</strong></a></header>
    <section className="public-profile-hero">
      <Avatar profile={profile} large />
      <div><p className="eyebrow">PUBLIC PROFILE</p><h1>{profile.name}</h1>
        {profile.headline&&<p className="profile-headline">{profile.headline}</p>}
        {profile.bio&&<p className="public-bio">{profile.bio}</p>}
        <div className="profile-meta">{profile.location&&<span>{profile.location}</span>}{profile.website&&<a href={profile.website} target="_blank" rel="noreferrer">Website</a>}</div>
      </div>
    </section>
    <section className="public-content-section">
      <div className="section-heading"><div><p className="eyebrow">PUBLISHED CONTENT</p><h2>Explore {profile.name}'s content</h2></div><a className="secondary button-link" href={`/b/${profile.id}`}>Book a session</a></div>
      {content.length===0?<div className="panel empty-state"><div><h3>No published content yet</h3><p className="muted">Check back later.</p></div></div>:
      <div className="content-grid">{content.map(item=><a className="public-content-card" href={`/c/${item._id}`} key={item._id}>
        {item.coverImage?<img src={item.coverImage} alt={item.title}/>:<div className="content-placeholder">B</div>}
        <div className="public-content-card-body"><span className="category-pill">{item.category}</span><h3>{item.title}</h3><p>{item.description}</p><strong>{money(item.price,item.currency)}</strong></div>
      </a>)}</div>}
    </section>
  </main>;
}

function PublicContent({ contentId }) {
  const [item,setItem]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{api.publicContent(contentId).then(setItem).catch(e=>setError(e.message));},[contentId]);
  if(error) return <main className="public-shell"><section className="public-card"><p className="error">{error}</p></section></main>;
  if(!item) return <main className="public-shell"><section className="public-card"><p>Loading content...</p></section></main>;

  return <main className="public-page">
    <header className="public-top"><a className="brand-row" href={`/p/${item.owner.id}`}><span className="brand-mark small">B</span><strong>Back to profile</strong></a></header>
    <article className="content-detail">
      {item.coverImage&&<img className="content-detail-cover" src={item.coverImage} alt={item.title}/>}
      <div className="content-detail-body"><span className="category-pill">{item.category}</span><h1>{item.title}</h1><div className="content-price">{money(item.price,item.currency)}</div><p className="content-description">{item.description}</p>
        {item.images?.length>0&&<div className="gallery">{item.images.map((img,i)=><img src={img} alt={`${item.title} ${i+1}`} key={i}/>)}</div>}
        <div className="owner-strip"><Avatar profile={item.owner}/><div><strong>{item.owner.name}</strong>{item.owner.headline&&<small>{item.owner.headline}</small>}</div><a className="secondary button-link" href={`/p/${item.owner.id}`}>View profile</a></div>
      </div>
    </article>
  </main>;
}

function ProfileEditor({ user, onUpdated }) {
  const [profile,setProfile]=useState(null);
  const [form,setForm]=useState(null);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{api.profile.get().then(p=>{setProfile(p);setForm(p);}).catch(e=>setError(e.message));},[]);
  if(!form) return <section id="profile" className="panel"><p>{error || "Loading profile..."}</p></section>;

  async function imageChange(file){
    try{setForm({...form,profileImage:await fileToDataUrl(file)});setError("");}catch(e){setError(e.message);}
  }
  async function save(e){
    e.preventDefault();setError("");setMessage("");
    try{
      const updated=await api.profile.update(form);setProfile(updated);setForm(updated);setMessage("Profile updated.");
      onUpdated({...user,name:updated.name});
    }catch(e){setError(e.message);}
  }

  return <section id="profile" className="panel profile-panel">
    <div className="panel-title"><div><p className="eyebrow">PROFILE</p><h2>Edit public profile</h2></div><a className="secondary button-link" href={`/p/${user.id}`} target="_blank">View public profile</a></div>
    <form onSubmit={save}>
      <div className="profile-editor-head"><Avatar profile={form} large/><div className="image-actions"><label className="upload-button">Choose photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>imageChange(e.target.files?.[0])}/></label>{form.profileImage&&<button type="button" className="danger" onClick={()=>setForm({...form,profileImage:""})}>Remove</button>}<small>JPEG, PNG, WebP or GIF · max 2 MB</small></div></div>
      <div className="two-col"><label>Name<input maxLength="80" value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label>Headline<input maxLength="120" value={form.headline||""} onChange={e=>setForm({...form,headline:e.target.value})}/></label></div>
      <label>Bio<textarea rows="4" maxLength="1000" value={form.bio||""} onChange={e=>setForm({...form,bio:e.target.value})}/></label>
      <div className="two-col"><label>Location<input maxLength="120" value={form.location||""} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Website<input type="url" placeholder="https://..." value={form.website||""} onChange={e=>setForm({...form,website:e.target.value})}/></label></div>
      {error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}
      <button className="primary-button">Save profile</button>
    </form>
  </section>;
}

function ContentManager({ user }) {
  const [items,setItems]=useState([]);
  const [form,setForm]=useState(emptyContent);
  const [editingId,setEditingId]=useState(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{api.content.list().then(setItems).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);

  async function coverChange(file){
    try{setForm({...form,coverImage:await fileToDataUrl(file)});setError("");}catch(e){setError(e.message);}
  }
  async function addImages(files){
    try{
      const selected=Array.from(files||[]);
      if(form.images.length+selected.length>8) throw new Error("You can upload up to 8 additional images.");
      const converted=await Promise.all(selected.map(fileToDataUrl));
      setForm({...form,images:[...form.images,...converted]});setError("");
    }catch(e){setError(e.message);}
  }
  function edit(item){
    setEditingId(item._id);
    setForm({title:item.title,description:item.description,price:item.price,currency:item.currency,category:item.category,coverImage:item.coverImage||"",images:item.images||[],published:item.published});
    document.getElementById("content-editor")?.scrollIntoView({behavior:"smooth"});
  }
  function reset(){setEditingId(null);setForm(emptyContent);setMessage("");}
  async function save(e){
    e.preventDefault();setError("");setMessage("");
    try{
      const payload={...form,price:Number(form.price||0)};
      const saved=editingId?await api.content.update(editingId,payload):await api.content.create(payload);
      setItems(current=>editingId?current.map(i=>i._id===editingId?saved:i):[saved,...current]);
      setMessage(editingId?"Content updated.":"Content created.");reset();
    }catch(e){setError(e.message);}
  }
  async function toggle(item){
    try{
      const updated=await api.content.publish(item._id,!item.published);
      setItems(current=>current.map(i=>i._id===item._id?updated:i));
    }catch(e){setError(e.message);}
  }
  async function remove(id){
    if(!confirm("Delete this content permanently?")) return;
    try{await api.content.remove(id);setItems(current=>current.filter(i=>i._id!==id));if(editingId===id)reset();}catch(e){setError(e.message);}
  }

  return <section id="content" className="cms-section">
    <div className="section-heading"><div><p className="eyebrow">CONTENT MANAGEMENT</p><h2>Your content</h2><p className="muted">Create drafts, publish when ready, and share public detail pages.</p></div></div>
    <div className="cms-layout">
      <form id="content-editor" className="panel cms-form" onSubmit={save}>
        <div className="panel-title"><div><p className="eyebrow">{editingId?"EDIT":"CREATE"}</p><h2>{editingId?"Edit content":"New content"}</h2></div>{editingId&&<button type="button" className="secondary" onClick={reset}>Cancel</button>}</div>
        <label>Title<input maxLength="120" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></label>
        <label>Description<textarea rows="5" maxLength="5000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/></label>
        <div className="three-col"><label>Price<input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Currency<input maxLength="3" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase()})}/></label><label>Category<input maxLength="80" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label></div>
        <label>Cover image<span className="upload-zone">{form.coverImage?<img src={form.coverImage} alt="Cover preview"/>:<span>Choose a featured image</span>}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>coverChange(e.target.files?.[0])}/></span></label>
        {form.coverImage&&<button type="button" className="danger" onClick={()=>setForm({...form,coverImage:""})}>Remove cover image</button>}
        <label>Additional images <span className="muted">({form.images.length}/8)</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>addImages(e.target.files)}/></label>
        {form.images.length>0&&<div className="image-preview-grid">{form.images.map((img,i)=><div className="image-preview" key={i}><img src={img} alt={`Preview ${i+1}`}/><button type="button" onClick={()=>setForm({...form,images:form.images.filter((_,x)=>x!==i)})}>×</button></div>)}</div>}
        <label className="toggle-row"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/><span>Publish immediately</span></label>
        {error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}
        <button className="primary-button">{editingId?"Save changes":"Create content"}</button>
      </form>

      <div className="content-admin-list">
        {loading?<div className="panel">Loading content...</div>:items.length===0?<div className="panel empty-state"><div><h3>No content yet</h3><p className="muted">Create your first item using the form.</p></div></div>:items.map(item=><article className="panel admin-content-card" key={item._id}>
          {item.coverImage?<img className="admin-content-cover" src={item.coverImage} alt={item.title}/>:<div className="admin-content-cover content-placeholder">B</div>}
          <div className="admin-content-body"><div className="content-card-top"><span className="category-pill">{item.category}</span><span className={item.published?"status published":"status draft"}>{item.published?"Published":"Draft"}</span></div>
            <h3>{item.title}</h3><p>{item.description}</p><strong>{money(item.price,item.currency)}</strong>
            <small>Updated {new Date(item.updatedAt).toLocaleString()}</small>
            <div className="row-actions wrap"><button className="secondary" onClick={()=>edit(item)}>Edit</button><button className="secondary" onClick={()=>toggle(item)}>{item.published?"Unpublish":"Publish"}</button>{item.published&&<a className="secondary button-link small-link" href={`/c/${item._id}`} target="_blank">View</a>}<button className="danger" onClick={()=>remove(item._id)}>Delete</button></div>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}

function Messages({ currentUser }) {
  const [users,setUsers]=useState([]);
  const [selected,setSelected]=useState(null);
  const [conversation,setConversation]=useState([]);
  const [body,setBody]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{ api.messages.users().then(setUsers).catch(e=>setError(e.message)); },[]);
  async function open(user) { setSelected(user); setError(""); try { const data=await api.messages.conversation(user._id); setConversation(data.messages); } catch(e){setError(e.message);} }
  async function send(e) { e.preventDefault(); if(!selected || !body.trim()) return; try { const msg=await api.messages.send(selected._id,body); setConversation(items=>[...items,msg]); setBody(""); } catch(e){setError(e.message);} }
  return <section id="messages" className="panel messages-panel">
    <div className="panel-title"><div><p className="eyebrow">MESSAGES</p><h2>Message another user</h2></div></div>{error&&<p className="error">{error}</p>}
    <div className="messages-layout"><div className="user-list">{users.length===0?<p className="muted">No other registered users yet.</p>:users.map(u=><button key={u._id} className={"user-row "+(selected?._id===u._id?"active":"")} onClick={()=>open(u)}><span className="avatar">{u.name.charAt(0).toUpperCase()}</span><span><strong>{u.name}</strong><small>{u.email}</small></span></button>)}</div>
      <div className="conversation">{!selected?<div className="empty-state"><p className="muted">Select a user to start a conversation.</p></div>:<><div className="conversation-header"><strong>{selected.name}</strong><small>{selected.email}</small></div><div className="message-list">{conversation.length===0?<p className="muted">No messages yet. Say hello.</p>:conversation.map(m=><div key={m._id} className={"message-bubble "+(String(m.sender)===String(currentUser.id)?"mine":"theirs")}>{m.body}<small>{new Date(m.createdAt).toLocaleString()}</small></div>)}</div><form className="message-compose" onSubmit={send}><input maxLength="2000" placeholder="Write a message..." value={body} onChange={e=>setBody(e.target.value)}/><button className="primary-button">Send</button></form></>}</div>
    </div>
  </section>;
}

function BookingManager(){
  const [bookings,setBookings]=useState([]);
  const [form,setForm]=useState(emptyBooking);
  const [editingId,setEditingId]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{api.bookings.list().then(setBookings).catch(e=>setError(e.message));},[]);
  async function submit(e){e.preventDefault();setError("");try{if(editingId){const updated=await api.bookings.update(editingId,form);setBookings(items=>items.map(b=>b._id===editingId?updated:b));}else{const created=await api.bookings.create(form);setBookings(items=>[...items,created]);}setForm(emptyBooking);setEditingId(null);}catch(e){setError(e.message);}}
  function edit(b){setEditingId(b._id);setForm({guestName:b.guestName,service:b.service,bookingDate:new Date(b.bookingDate).toISOString().slice(0,16),notes:b.notes||"",status:b.status});}
  async function remove(id){if(!confirm("Delete this booking?"))return;await api.bookings.remove(id);setBookings(items=>items.filter(b=>b._id!==id));}
  const stats=useMemo(()=>({total:bookings.length,pending:bookings.filter(b=>b.status==="pending").length,confirmed:bookings.filter(b=>b.status==="confirmed").length}),[bookings]);
  return <><section className="stats-grid"><article className="stat-card"><span>Total bookings</span><strong>{stats.total}</strong></article><article className="stat-card"><span>Pending</span><strong>{stats.pending}</strong></article><article className="stat-card"><span>Confirmed</span><strong>{stats.confirmed}</strong></article></section>{error&&<p className="error dashboard-error">{error}</p>}
  <section className="workspace-grid"><form className="panel" onSubmit={submit}><div className="panel-title"><div><p className="eyebrow">BOOKING</p><h2>{editingId?"Edit booking":"New booking"}</h2></div></div><label>Guest name<input value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} required/></label><label>Service<select value={form.service} onChange={e=>setForm({...form,service:e.target.value})}>{services.map(s=><option key={s}>{s}</option>)}</select></label><label>Date and time<input type="datetime-local" value={form.bookingDate} onChange={e=>setForm({...form,bookingDate:e.target.value})} required/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></label><label>Notes<textarea rows="4" maxLength="500" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><button className="primary-button">{editingId?"Save changes":"Create booking"}</button></form>
  <section className="panel" id="bookings"><div className="panel-title"><div><p className="eyebrow">APPOINTMENTS</p><h2>Your bookings</h2></div></div><div className="booking-list">{bookings.length===0?<div className="empty-state"><p className="muted">No bookings yet.</p></div>:bookings.map(b=><article className="booking-card" key={b._id}><div><h3>{b.guestName}</h3><p>{b.service} · {new Date(b.bookingDate).toLocaleString()}</p>{b.guestEmail&&<small>{b.guestEmail}</small>}</div><div className="booking-card-right"><span className={"status "+b.status}>{b.status}</span>{b.source==="public"&&<span className="source-badge">Public request</span>}<div className="row-actions"><button className="secondary" onClick={()=>edit(b)}>Edit</button><button className="danger" onClick={()=>remove(b._id)}>Delete</button></div></div></article>)}</div></section></section></>;
}

function Dashboard({ user, onLogout, onUserUpdate }) {
  const [copied,setCopied]=useState("");
  const bookingUrl=`${window.location.origin}/b/${user.id}`;
  const profileUrl=`${window.location.origin}/p/${user.id}`;
  async function copy(value,key){await navigator.clipboard.writeText(value);setCopied(key);setTimeout(()=>setCopied(""),1500);}
  return <main className="page-shell">
    <aside className="sidebar"><div><div className="sidebar-brand"><span className="brand-mark small">B</span><strong>BookFlow</strong></div><nav className="sidebar-nav"><a href="#dashboard">Dashboard</a><a href="#profile">Profile</a><a href="#content">Content</a><a href="#bookings">Bookings</a><a href="#messages">Messages</a></nav></div><button className="secondary" onClick={onLogout}>Sign out</button></aside>
    <section className="content-shell" id="dashboard">
      <header className="topbar"><div><p className="eyebrow">DASHBOARD</p><h1>Hi, {user.name.split(" ")[0]}.</h1><p className="muted">Manage your public profile, content, bookings and conversations.</p></div></header>
      <section className="share-grid">
        <div className="share-card"><div><p className="eyebrow">PUBLIC PROFILE</p><h2>Share your profile & content</h2><p className="muted">/p/{user.id}</p></div><div className="share-actions"><a className="secondary button-link" href={profileUrl} target="_blank">Open</a><button className="primary-button" onClick={()=>copy(profileUrl,"profile")}>{copied==="profile"?"Copied!":"Copy"}</button></div></div>
        <div className="share-card"><div><p className="eyebrow">PUBLIC BOOKING</p><h2>Let anyone book with you</h2><p className="muted">/b/{user.id}</p></div><div className="share-actions"><a className="secondary button-link" href={bookingUrl} target="_blank">Open</a><button className="primary-button" onClick={()=>copy(bookingUrl,"booking")}>{copied==="booking"?"Copied!":"Copy"}</button></div></div>
      </section>
      <ProfileEditor user={user} onUpdated={onUserUpdate}/>
      <ContentManager user={user}/>
      <BookingManager/>
      <Messages currentUser={user}/>
    </section>
  </main>;
}

export default function App(){
  const path=window.location.pathname;
  const bookingMatch=path.match(/^\/(?:book|b)\/([a-f\d]{24})\/?$/i);
  const profileMatch=path.match(/^\/p\/([a-f\d]{24})\/?$/i);
  const contentMatch=path.match(/^\/c\/([a-f\d]{24})\/?$/i);
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem("booking_user"));}catch{return null;}});

  if(bookingMatch) return <PublicBooking userId={bookingMatch[1]}/>;
  if(profileMatch) return <PublicProfile userId={profileMatch[1]}/>;
  if(contentMatch) return <PublicContent contentId={contentMatch[1]}/>;

  function logout(){localStorage.removeItem("booking_token");localStorage.removeItem("booking_user");setUser(null);}
  function updateUser(next){localStorage.setItem("booking_user",JSON.stringify(next));setUser(next);}
  return user?<Dashboard user={user} onLogout={logout} onUserUpdate={updateUser}/>:<Auth onAuthenticated={setUser}/>;
}
