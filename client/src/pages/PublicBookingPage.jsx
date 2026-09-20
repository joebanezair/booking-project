import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api.js";

function money(value,currency="PHP"){try{return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(value||0);}catch{return `${currency} ${Number(value||0).toLocaleString()}`;}}
function durationLabel(minutes){const value=Number(minutes||60);if(value<60)return value+" min";const hours=Math.floor(value/60);const rest=value%60;return rest?`${hours}h ${rest}m`:`${hours}h`;}

export default function PublicBookingPage({user}){
  const {userId}=useParams();
  const [params]=useSearchParams();
  const requestedContentId=params.get("content")||"";
  const requestedService=params.get("service")||"Consultation";
  const [page,setPage]=useState(null);
  const [slotDate,setSlotDate]=useState("");
  const [slots,setSlots]=useState([]);
  const [slotsLoading,setSlotsLoading]=useState(false);
  const [form,setForm]=useState({
    guestName:user?.name||"",guestEmail:user?.email||"",guestPhone:"",
    locationLabel:"",locationLatitude:null,locationLongitude:null,locationAccuracy:null,
    service:requestedService,contentId:requestedContentId,bookingDate:"",notes:"",customAnswers:{}
  });
  const [message,setMessage]=useState("");
  const [reference,setReference]=useState("");
  const [error,setError]=useState("");
  const [locationStatus,setLocationStatus]=useState("");
  const [locating,setLocating]=useState(false);

  useEffect(()=>{
    api.publicBooking.get(userId).then(result=>{
      setPage(result);
      setForm(current=>{
        if(requestedContentId){
          const selected=result.services.find(service=>String(service.id)===String(requestedContentId));
          return selected?{...current,service:selected.title,contentId:selected.id,customAnswers:{}}:current;
        }
        const first=result.services[0];
        return first?{...current,service:first.title,contentId:first.id||"",customAnswers:{}}:current;
      });
    }).catch(e=>setError(e.message));
  },[userId,requestedContentId]);

  const selectedService=page?.services?.find(service=>(form.contentId&&String(service.id)===String(form.contentId))||(!form.contentId&&service.title===form.service));

  useEffect(()=>{
    if(!slotDate||!page)return;
    setSlotsLoading(true);setError("");setForm(v=>({...v,bookingDate:""}));
    api.publicBooking.slots(userId,slotDate,form.contentId).then(result=>setSlots(result.slots||[])).catch(e=>{setSlots([]);setError(e.message);}).finally(()=>setSlotsLoading(false));
  },[slotDate,form.contentId,userId,page]);

  function detectLocation(){
    setLocationStatus("");
    if(!navigator.geolocation){setLocationStatus("Location detection is not supported by this browser. You can enter your location manually.");return;}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position=>{
      const {latitude,longitude,accuracy}=position.coords;
      setForm(current=>({...current,locationLabel:current.locationLabel||"Current location",locationLatitude:latitude,locationLongitude:longitude,locationAccuracy:accuracy}));
      setLocationStatus(`Location captured (accuracy about ${Math.round(accuracy)} m). You can still edit the location name below.`);setLocating(false);
    },err=>{setLocationStatus(err.code===err.PERMISSION_DENIED?"Location permission was not granted. You can enter your address or area manually.":"We could not detect your location. You can enter your address or area manually.");setLocating(false);},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  }

  function chooseService(index){
    const selected=page.services[Number(index)];
    if(!selected)return;
    setForm(current=>({...current,service:selected.title,contentId:selected.id||"",bookingDate:"",customAnswers:{}}));
    setSlots([]);setSlotDate("");
  }

  function answer(question,value){setForm(current=>({...current,customAnswers:{...current.customAnswers,[question.id]:value}}));}

  async function submit(e){
    e.preventDefault();
    try{
      setError("");setMessage("");setReference("");
      const result=await api.publicBooking.create(userId,form);
      setMessage(result.message);setReference(result.bookingReference||"");
    }catch(e){setError(e.message);}
  }

  const selectedIndex=page?.services?.findIndex(service=>(form.contentId&&String(service.id)===String(form.contentId))||(!form.contentId&&service.title===form.service));
  const today=new Date().toISOString().slice(0,10);

  return <main className="public-shell"><section className="public-card">
    <Link className="brand-row" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link>
    {error&&!page?<p className="error">{error}</p>:!page?<p>Loading...</p>:<>
      <p className="eyebrow">PUBLIC BOOKING</p>
      <h1>Book time with {page.owner.name}</h1>
      {selectedService&&<div className="selected-content"><strong>{selectedService.title}</strong><span>{money(selectedService.price,selectedService.currency)} · {durationLabel(selectedService.durationMinutes)}</span>{selectedService.bufferMinutes>0&&<small>Includes {selectedService.bufferMinutes} min scheduling buffer</small>}</div>}
      <p className="muted">Times are shown for {page.scheduling?.timezone||"the business timezone"}. BookFlow only shows slots allowed by the business schedule.</p>

      <form onSubmit={submit}>
        <div className="two-col">
          <label>Your name<input value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} required autoComplete="name"/></label>
          <label>Email<input type="email" value={form.guestEmail} onChange={e=>setForm({...form,guestEmail:e.target.value})} required autoComplete="email"/></label>
        </div>
        <label>Phone number<input type="tel" value={form.guestPhone} onChange={e=>setForm({...form,guestPhone:e.target.value})} placeholder="+63 912 345 6789" required autoComplete="tel"/></label>
        <label>Location / service address<input value={form.locationLabel} onChange={e=>setForm({...form,locationLabel:e.target.value})} placeholder="Address, barangay, city, or area" autoComplete="street-address" maxLength="200"/></label>
        <div className="row-actions"><button className="secondary" type="button" onClick={detectLocation} disabled={locating}>{locating?"Detecting location...":"Use my current location"}</button>{form.locationLatitude!==null&&form.locationLongitude!==null&&<button className="secondary" type="button" onClick={()=>{setForm(current=>({...current,locationLatitude:null,locationLongitude:null,locationAccuracy:null}));setLocationStatus("Saved coordinates removed. Your typed location is still kept.");}}>Remove detected location</button>}</div>
        <p className="muted">Location sharing is optional and only happens after you press the button and approve your browser's permission request.</p>
        {locationStatus&&<p className="muted">{locationStatus}</p>}

        {!requestedContentId&&<label>Service<select value={selectedIndex>=0?String(selectedIndex):"0"} onChange={e=>chooseService(e.target.value)}>{page.services.map((service,index)=><option value={index} key={service.id||service.title+"-"+index}>{service.title} — {money(service.price,service.currency)} · {durationLabel(service.durationMinutes)}</option>)}</select></label>}

        <div className="booking-slot-picker">
          <label>Choose date<input type="date" min={today} value={slotDate} onChange={e=>setSlotDate(e.target.value)} required/></label>
          {slotDate&&<div><strong>Available times</strong>{slotsLoading?<p className="muted">Checking availability…</p>:slots.length===0?<p className="warning-note">No available slots on this date. Choose another day.</p>:<div className="available-slot-grid">{slots.map(slot=><button type="button" key={slot.value} className={form.bookingDate===slot.value?"slot-button active":"slot-button"} onClick={()=>setForm({...form,bookingDate:slot.value})}>{slot.label}</button>)}</div>}</div>}
        </div>

        {(selectedService?.bookingQuestions||[]).length>0&&<fieldset className="public-booking-questions"><legend>Booking details</legend>{selectedService.bookingQuestions.map(question=><label key={question.id}>{question.label}{question.required&&" *"}
          {question.type==="textarea"?<textarea rows="3" value={form.customAnswers[question.id]||""} onChange={e=>answer(question,e.target.value)} required={question.required}/>:
           question.type==="select"?<select value={form.customAnswers[question.id]||""} onChange={e=>answer(question,e.target.value)} required={question.required}><option value="">Choose…</option>{(question.options||[]).map(option=><option key={option}>{option}</option>)}</select>:
           question.type==="checkbox"?<span className="toggle-row"><input type="checkbox" checked={Boolean(form.customAnswers[question.id])} onChange={e=>answer(question,e.target.checked)}/><span>Yes</span></span>:
           <input value={form.customAnswers[question.id]||""} onChange={e=>answer(question,e.target.value)} required={question.required}/>}
        </label>)}</fieldset>}

        <label>Notes<textarea rows="4" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        {error&&<p className="error">{error}</p>}
        {message&&<div className="success"><strong>{message}</strong>{reference&&<span className="booking-reference-success">Reference: {reference}</span>}</div>}
        <button className="primary-button" disabled={!form.bookingDate}>Request booking</button>
      </form>
    </>}
  </section></main>;
}
