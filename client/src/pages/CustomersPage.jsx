import { useEffect, useMemo, useState } from "react";
import { FiSearch, FiUsers } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import { api } from "../api.js";
export default function CustomersPage({user,onLogout}){
 const [rows,setRows]=useState([]),[search,setSearch]=useState(""),[error,setError]=useState("");
 useEffect(()=>{api.bookings.customers().then(setRows).catch(e=>setError(e.message));},[]);
 const shown=useMemo(()=>{const q=search.trim().toLowerCase();return q?rows.filter(x=>[x.guestName,x.guestEmail,x.guestPhone].some(v=>String(v||"").toLowerCase().includes(q))):rows;},[rows,search]);
 return <AppLayout user={user} onLogout={onLogout}><header className="topbar"><div><p className="eyebrow">CUSTOMERS</p><h1>Customer CRM</h1><p className="muted">Customer history generated from your bookings.</p></div></header>
 <section className="panel crm-panel"><div className="realtime-search"><FiSearch/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers..." /></div>{error&&<p className="error">{error}</p>}
 {!shown.length?<div className="empty-state"><FiUsers/><p>No customers found.</p></div>:<div className="crm-grid">{shown.map(c=><article className="crm-card" key={c.key}><div><strong>{c.guestName||"Guest"}</strong><p>{c.guestEmail||c.guestPhone||"No contact details"}</p></div><div className="crm-metrics"><span><b>{c.totalBookings}</b> bookings</span><span><b>{c.completedBookings}</b> completed</span><span><b>{c.upcomingBookings}</b> upcoming</span></div>{c.services?.[0]&&<small>Most booked: {c.services[0].name}</small>}</article>)}</div>}</section></AppLayout>;
}