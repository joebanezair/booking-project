import { useEffect, useState } from "react";
import { api } from "../api.js";
import { fileToDataUrl } from "../lib.js";

const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
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
    try{const logo=await fileToDataUrl(file);setForm(v=>({...v,logo}));setError("");}catch(e){setError(e.message);}
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
      localStorage.setItem("booking_user",JSON.stringify(next));onUserUpdate?.(next);setMessage("Business page and availability updated.");
    }catch(e){setError(e.message);}
  }

  if(loading)return <section className="panel business-account-panel"><p>Loading business profile…</p></section>;

  return <section className="panel business-account-panel">
    <div className="panel-title"><div><p className="eyebrow">BUSINESS DETAILS</p><h2>{form.name||"Business profile"}</h2></div><span className={`status ${user.accountStatus||"active"}`}>{user.accountStatus||"active"}</span></div>
    {user.accountStatus==="paused"&&<p className="warning-note">Your business is paused. You can edit your profile and manage existing bookings, but you cannot publish services or receive new bookings until an admin reactivates it.</p>}
    <form onSubmit={save}>
      <div className="two-col"><label>Business name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label>Category<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="General"/></label></div>
      <label>Description<textarea rows="5" maxLength="2000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <div className="two-col"><label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Contact phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></div>
      <div className="two-col"><label>Business email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Website<input type="url" placeholder="https://..." value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></label></div>

      <fieldset className="content-options availability-settings">
        <legend>Booking availability</legend>
        <div className="three-col">
          <label>Timezone<input value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})} placeholder="Asia/Manila"/></label>
          <label>Minimum notice (minutes)<input type="number" min="0" max="43200" value={form.leadTimeMinutes} onChange={e=>setForm({...form,leadTimeMinutes:e.target.value})}/></label>
          <label>Book up to (days)<input type="number" min="1" max="730" value={form.maxAdvanceDays} onChange={e=>setForm({...form,maxAdvanceDays:e.target.value})}/></label>
        </div>
        <label>Slot interval
          <select value={form.slotIntervalMinutes} onChange={e=>setForm({...form,slotIntervalMinutes:e.target.value})}>
            {[5,10,15,20,30,45,60,90,120].map(v=><option key={v} value={v}>{v} minutes</option>)}
          </select>
        </label>

        <div className="working-hours-list">
          {days.map((label,day)=>{
            const row=form.workingHours.find(item=>Number(item.day)===day)||{day,enabled:false,start:"09:00",end:"17:00"};
            return <div className="working-hours-row" key={day}>
              <label className="toggle-row"><input type="checkbox" checked={Boolean(row.enabled)} onChange={e=>patchHours(day,{enabled:e.target.checked})}/><span>{label}</span></label>
              <input type="time" value={row.start} onChange={e=>patchHours(day,{start:e.target.value})} disabled={!row.enabled}/>
              <span className="muted">to</span>
              <input type="time" value={row.end} onChange={e=>patchHours(day,{end:e.target.value})} disabled={!row.enabled}/>
            </div>;
          })}
        </div>

        <label>Blackout / unavailable dates <span className="muted">one YYYY-MM-DD date per line</span>
          <textarea rows="4" value={(form.blackoutDates||[]).join("\n")} onChange={e=>setForm({...form,blackoutDates:e.target.value.split("\n").map(v=>v.trim()).filter(Boolean)})} placeholder={"2026-12-25\n2027-01-01"}/>
        </label>
        <p className="muted">These rules are used automatically when BookFlow generates public time slots and checks rescheduling.</p>
      </fieldset>

      <div className="image-actions"><label className="upload-button">Choose business logo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>chooseLogo(e.target.files?.[0])}/></label>{form.logo&&<button type="button" className="danger" onClick={()=>setForm({...form,logo:""})}>Remove logo</button>}</div>
      {error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}
      <button className="primary-button">Save business details</button>
    </form>
  </section>;
}
