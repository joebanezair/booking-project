import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Textarea } from "./ui/textarea.jsx";
import { Image } from "./ui/image.jsx";
import { Label } from "./ui/label.jsx";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { fileToDataUrl } from "../lib.js";
import { FiImage } from "react-icons/fi";
import "../business-logo-preview.css";

const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
// A saved GridFS logo may be a relative /api/media URL even when the API is
// hosted on another origin (VITE_API_URL). Resolve it against the API host.
function businessLogoUrl(value) {
  const logo = String(value || "").trim();
  const apiBase = String(import.meta.env.VITE_API_URL || "/api");
  if (logo.startsWith("/api/media/") && /^https?:\/\//i.test(apiBase)) {
    try { return new URL(logo, apiBase).href; } catch { return logo; }
  }
  return logo;
}
const defaultHours=()=>days.map((_,day)=>({day,enabled:day>=1&&day<=5,start:"09:00",end:"17:00"}));
const empty={
  name:"",category:"General",description:"",location:"",email:"",phone:"",website:"",logo:"",
  timezone:"Asia/Manila",workingHours:defaultHours(),blackoutDates:[],leadTimeMinutes:60,maxAdvanceDays:60,slotIntervalMinutes:30
};

export default function BusinessProfileSection({user,onUserUpdate}){
  const [form,setForm]=useState(empty);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [logoLoadFailed,setLogoLoadFailed]=useState(false);
  useEffect(()=>setLogoLoadFailed(false),[form.logo]);

  useEffect(()=>{
    api.business.mine().then(data=>{
      setForm({...empty,...data,workingHours:data.workingHours?.length?data.workingHours:defaultHours(),blackoutDates:data.blackoutDates||[]});
      const next={...user,business:{id:data._id,name:data.name,category:data.category}};
      localStorage.setItem("booking_user",JSON.stringify(next));
      onUserUpdate?.(next);
    }).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[]);

  async function chooseLogo(file){
    if(!file)return;
    try{const logo=await fileToDataUrl(file);setLogoLoadFailed(false);setForm(v=>({...v,logo}));setError("");setMessage("");}catch(e){setError(e.message);}
  }

  function patchHours(day,patch){
    setForm(v=>({...v,workingHours:v.workingHours.map(row=>Number(row.day)===day?{...row,...patch}:row)}));
  }

  async function save(event){
    event.preventDefault();setError("");setMessage("");
    try{
      const saved=await api.business.update({...form,leadTimeMinutes:Number(form.leadTimeMinutes),maxAdvanceDays:Number(form.maxAdvanceDays),slotIntervalMinutes:Number(form.slotIntervalMinutes)});
      setForm({...empty,...saved,workingHours:saved.workingHours?.length?saved.workingHours:defaultHours(),blackoutDates:saved.blackoutDates||[]});
      const next={...user,business:{id:saved._id,name:saved.name,category:saved.category}};
      localStorage.setItem("booking_user",JSON.stringify(next));onUserUpdate?.(next);setMessage("Business page updated.");
    }catch(e){setError(e.message);}
  }

  if(loading)return <section className="panel business-account-panel"><p>Loading business profile…</p></section>;

  const logoSrc=businessLogoUrl(form.logo);

  return <section className="panel business-account-panel">
    <div className="panel-title">
      <div className="business-logo-heading">
        <div className="business-logo-image" aria-label={form.logo && !logoLoadFailed ? "Business logo" : "Business logo unavailable"}>
          {form.logo && !logoLoadFailed
            ? <Image src={logoSrc} alt={`${form.name || "Business"} logo`} onError={()=>setLogoLoadFailed(true)} />
            : <FiImage aria-hidden="true" />}
        </div>
        <div>
          <p className="eyebrow">BUSINESS DETAILS</p>
          <h2>{form.name||"Business profile"}</h2>
          <p className="muted business-logo-caption">{form.logo ? (logoLoadFailed ? "Logo could not be loaded" : "Business logo") : "No business logo uploaded"}</p>
        </div>
      </div>
      <span className={`status ${user.accountStatus||"active"}`}>{user.accountStatus||"active"}</span>
    </div>
    {user.accountStatus==="paused"&&<p className="warning-note">Your business is paused. You can edit your profile and manage existing bookings, but you cannot publish services or receive new bookings until an admin reactivates it.</p>}
    <form onSubmit={save}>
      <div className="two-col"><Label>Business name<Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></Label><Label>Category<Input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="General"/></Label></div>
      <Label>Description<Textarea rows="5" maxLength="2000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Label>
      <div className="two-col"><Label>Location<Input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Label><Label>Contact phone<Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Label></div>
      <div className="two-col"><Label>Business email<Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></Label><Label>Website<Input type="url" placeholder="https://..." value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></Label></div>

      <p className="muted">Booking schedule, timezone, slot interval, notice period, and blackout dates are managed from <strong>Bookings → Availability</strong>.</p>

      <div className="business-logo-controls">
        <div>
          <strong>Business logo</strong>
          <p className="muted business-logo-help">JPEG, PNG, WebP, or GIF, up to 2 MB. The preview appears beside your business name.</p>
        </div>
        <div className="image-actions">
          <Label className="upload-button">Choose business logo<Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>chooseLogo(e.target.files?.[0])}/></Label>
          {form.logo&&<Button variant="plain" type="button" className="danger" onClick={()=>setForm(v=>({...v,logo:""}))}>Remove logo</Button>}
        </div>
      </div>
      {form.logo && logoLoadFailed && <p role="alert" className="warning-note business-logo-error">Your saved logo could not be displayed. Choose a new image and save again. If it still fails, check that the media database and /api/media/public endpoint are available.</p>}
      {error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}
      <Button variant="plain" className="primary-button">Save business details</Button>
    </form>
  </section>;
}
