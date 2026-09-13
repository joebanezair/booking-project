import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const services = ["Consultation", "Technical Support", "Product Demo", "Project Meeting", "Discovery Call", "Other"];
const emptyBooking = { guestName: "", service: "Consultation", bookingDate: "", notes: "", status: "pending" };

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
    <p className="muted">Bookings, public scheduling and direct messaging in one place.</p>
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

function Messages({ currentUser }) {
  const [users,setUsers]=useState([]);
  const [selected,setSelected]=useState(null);
  const [conversation,setConversation]=useState([]);
  const [body,setBody]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{ api.messages.users().then(setUsers).catch(e=>setError(e.message)); },[]);

  async function open(user) {
    setSelected(user); setError("");
    try { const data=await api.messages.conversation(user._id); setConversation(data.messages); }
    catch(e){setError(e.message);}
  }

  async function send(e) {
    e.preventDefault();
    if(!selected || !body.trim()) return;
    try {
      const msg=await api.messages.send(selected._id,body);
      setConversation(items=>[...items,msg]); setBody("");
    } catch(e){setError(e.message);}
  }

  return <section id="messages" className="panel messages-panel">
    <div className="panel-title"><div><p className="eyebrow">MESSAGES</p><h2>Message another user</h2></div></div>
    {error && <p className="error">{error}</p>}
    <div className="messages-layout">
      <div className="user-list">
        {users.length===0 ? <p className="muted">No other registered users yet.</p> : users.map(user=>
          <button key={user._id} className={"user-row "+(selected?._id===user._id?"active":"")} onClick={()=>open(user)}>
            <span className="avatar">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span>
          </button>)}
      </div>
      <div className="conversation">
        {!selected ? <div className="empty-state"><p className="muted">Select a user to start a conversation.</p></div> : <>
          <div className="conversation-header"><strong>{selected.name}</strong><small>{selected.email}</small></div>
          <div className="message-list">
            {conversation.length===0 ? <p className="muted">No messages yet. Say hello.</p> : conversation.map(m=>
              <div key={m._id} className={"message-bubble "+(String(m.sender)===String(currentUser.id)?"mine":"theirs")}>
                {m.body}<small>{new Date(m.createdAt).toLocaleString()}</small>
              </div>)}
          </div>
          <form className="message-compose" onSubmit={send}>
            <input maxLength="2000" placeholder="Write a message..." value={body} onChange={e=>setBody(e.target.value)} />
            <button className="primary-button">Send</button>
          </form>
        </>}
      </div>
    </div>
  </section>;
}

function Dashboard({ user, onLogout }) {
  const [bookings,setBookings]=useState([]);
  const [form,setForm]=useState(emptyBooking);
  const [editingId,setEditingId]=useState(null);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);

  useEffect(()=>{ api.bookings.list().then(setBookings).catch(e=>setError(e.message)); },[]);

  const publicUrl = `${window.location.origin}/b/${user.id}`;
  const publicDisplayUrl = `/b/${user.id}`;
  const stats = useMemo(()=>({
    total:bookings.length,
    pending:bookings.filter(b=>b.status==="pending").length,
    confirmed:bookings.filter(b=>b.status==="confirmed").length
  }),[bookings]);

  async function submit(e){
    e.preventDefault(); setError("");
    try{
      if(editingId){
        const updated=await api.bookings.update(editingId,form);
        setBookings(items=>items.map(b=>b._id===editingId?updated:b));
      }else{
        const created=await api.bookings.create(form); setBookings(items=>[...items,created]);
      }
      setForm(emptyBooking); setEditingId(null);
    }catch(e){setError(e.message);}
  }

  function edit(b){
    setEditingId(b._id);
    setForm({guestName:b.guestName,service:b.service,bookingDate:new Date(b.bookingDate).toISOString().slice(0,16),notes:b.notes||"",status:b.status});
  }

  async function remove(id){
    if(!confirm("Delete this booking?")) return;
    await api.bookings.remove(id); setBookings(items=>items.filter(b=>b._id!==id));
  }

  async function copyLink(){
    await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(()=>setCopied(false),1500);
  }

  return <main className="page-shell">
    <aside className="sidebar">
      <div><div className="sidebar-brand"><span className="brand-mark small">B</span><strong>BookFlow</strong></div>
      <nav className="sidebar-nav"><a href="#dashboard">Dashboard</a><a href="#bookings">Bookings</a><a href="#messages">Messages</a></nav></div>
      <button className="secondary" onClick={onLogout}>Sign out</button>
    </aside>
    <section className="content-shell" id="dashboard">
      <header className="topbar"><div><p className="eyebrow">DASHBOARD</p><h1>Hi, {user.name.split(" ")[0]}.</h1><p className="muted">Manage bookings and conversations.</p></div></header>

      <section className="share-card">
        <div><p className="eyebrow">YOUR PUBLIC BOOKING PAGE</p><h2>Let anyone book with you</h2><p className="muted">{publicDisplayUrl}</p></div>
        <div className="share-actions"><a className="secondary button-link" href={publicUrl} target="_blank">Open page</a><button className="primary-button" onClick={copyLink}>{copied?"Copied!":"Copy link"}</button></div>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><span>Total</span><strong>{stats.total}</strong></article>
        <article className="stat-card"><span>Pending</span><strong>{stats.pending}</strong></article>
        <article className="stat-card"><span>Confirmed</span><strong>{stats.confirmed}</strong></article>
      </section>
      {error&&<p className="error">{error}</p>}

      <section className="workspace-grid">
        <form className="panel" onSubmit={submit}>
          <div className="panel-title"><div><p className="eyebrow">BOOKING</p><h2>{editingId?"Edit booking":"New booking"}</h2></div></div>
          <label>Guest name<input value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} required/></label>
          <label>Service<select value={form.service} onChange={e=>setForm({...form,service:e.target.value})}>{services.map(s=><option key={s}>{s}</option>)}</select></label>
          <label>Date and time<input type="datetime-local" value={form.bookingDate} onChange={e=>setForm({...form,bookingDate:e.target.value})} required/></label>
          <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></label>
          <label>Notes<textarea rows="4" maxLength="500" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
          <button className="primary-button">{editingId?"Save changes":"Create booking"}</button>
        </form>

        <section className="panel" id="bookings">
          <div className="panel-title"><div><p className="eyebrow">APPOINTMENTS</p><h2>Your bookings</h2></div></div>
          <div className="booking-list">
            {bookings.length===0?<div className="empty-state"><p className="muted">No bookings yet.</p></div>:bookings.map(b=><article className="booking-card" key={b._id}>
              <div><h3>{b.guestName}</h3><p>{b.service} · {new Date(b.bookingDate).toLocaleString()}</p>{b.guestEmail&&<small>{b.guestEmail}</small>}</div>
              <div className="booking-card-right"><span className={"status "+b.status}>{b.status}</span>{b.source==="public"&&<span className="source-badge">Public request</span>}
              <div className="row-actions"><button className="secondary" onClick={()=>edit(b)}>Edit</button><button className="danger" onClick={()=>remove(b._id)}>Delete</button></div></div>
            </article>)}
          </div>
        </section>
      </section>

      <Messages currentUser={user}/>
    </section>
  </main>;
}

export default function App(){
  const publicMatch=window.location.pathname.match(/^\/(?:book|b)\/([a-f\d]{24})\/?$/i);
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem("booking_user"));}catch{return null;}});
  if(publicMatch) return <PublicBooking userId={publicMatch[1]}/>;
  function logout(){localStorage.removeItem("booking_token");localStorage.removeItem("booking_user");setUser(null);}
  return user?<Dashboard user={user} onLogout={logout}/>:<Auth onAuthenticated={setUser}/>;
}
