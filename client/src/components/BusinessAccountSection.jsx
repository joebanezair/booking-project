import { useEffect, useState } from "react";
import { api } from "../api.js";
import { fileToDataUrl } from "../lib.js";

const empty = { name:"", category:"", description:"", location:"", email:"", phone:"", website:"", logo:"" };

export default function BusinessAccountSection({ user, onUserUpdate }) {
  const [business,setBusiness]=useState(undefined);
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  useEffect(()=>{api.business.mine().then(data=>{setBusiness(data);if(data){setForm(data);const next={...user,business:{id:data._id,name:data.name,status:data.status}};localStorage.setItem("booking_user",JSON.stringify(next));onUserUpdate(next);}}).catch(e=>setError(e.message));},[]);

  async function chooseLogo(file){if(!file)return;try{const logo=await fileToDataUrl(file);setForm(current=>({...current,logo}));}catch(e){setError(e.message);}}
  async function submit(e){e.preventDefault();setError("");setMessage("");try{const saved=business?await api.business.update(form):await api.business.create(form);setBusiness(saved);setForm(saved);setEditing(false);const next={...user,business:{id:saved._id,name:saved.name,status:saved.status}};localStorage.setItem("booking_user",JSON.stringify(next));onUserUpdate(next);setMessage("Business application submitted for admin approval.");}catch(e){setError(e.message);}}

  if(business===undefined)return <section className="panel"><p>Loading business account…</p></section>;
  const canEdit=!business||["pending","rejected"].includes(business.status);
  const showForm=!business||editing;
  return <section className="panel business-account-panel">
    <div className="panel-title"><div><p className="eyebrow">BUSINESS ACCOUNT</p><h2>{business?business.name:"Create a business account"}</h2></div>{business&&<span className={`status ${business.status}`}>{business.status}</span>}</div>
    {!showForm&&<><p className="muted">{business.status==="approved"?"Your business is approved. Switch to business mode to manage services and incoming bookings.":business.status==="rejected"?"Update the application using the admin feedback below and resubmit it.":business.status==="suspended"?"This business is suspended. Contact an administrator for assistance.":"Your application is waiting for administrator review."}</p>{business.rejectionReason&&<p className="error"><strong>Admin feedback:</strong> {business.rejectionReason}</p>}{canEdit&&<button type="button" className="secondary" onClick={()=>setEditing(true)}>Edit application</button>}</>}
    {showForm&&<form onSubmit={submit}><div className="two-col"><label>Business name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label>Category<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} required/></label></div><label>Description<textarea rows="5" maxLength="2000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/></label><div className="two-col"><label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} required/></label><label>Contact phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} required/></label></div><div className="two-col"><label>Business email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Website<input type="url" placeholder="https://..." value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></label></div><label className="upload-button">Choose business logo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>chooseLogo(e.target.files?.[0])}/></label><label className="agreement-row"><input type="checkbox" required/> I confirm that I own or represent this business.</label>{error&&<p className="error">{error}</p>}<div className="row-actions"><button className="primary-button">{business?"Resubmit for approval":"Submit for approval"}</button>{business&&<button type="button" className="secondary" onClick={()=>{setEditing(false);setForm(business);}}>Cancel</button>}</div></form>}
    {message&&<p className="success">{message}</p>}
  </section>;
}
