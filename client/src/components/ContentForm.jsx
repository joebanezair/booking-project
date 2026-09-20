import { useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { fileToDataUrl } from "../lib.js";

const newQuestion=()=>({id:crypto.randomUUID?.()||`q-${Date.now()}`,label:"",type:"text",required:false,options:[]});

export default function ContentForm({initial,onSubmit,submitLabel}){
  const [form,setForm]=useState({durationMinutes:60,bufferMinutes:0,capacity:1,bookingQuestions:[],...initial,images:initial.images||[],bookingQuestions:initial.bookingQuestions||[]});
  const [error,setError]=useState("");

  async function cover(file){try{setForm(v=>({...v,coverImage:await fileToDataUrl(file)}));setError("");}catch(e){setError(e.message);}}
  async function more(files){try{const selected=Array.from(files||[]);if(form.images.length+selected.length>8)throw new Error("You can upload up to 8 additional images.");const converted=await Promise.all(selected.map(fileToDataUrl));setForm(v=>({...v,images:[...v.images,...converted]}));setError("");}catch(e){setError(e.message);}}
  function patchQuestion(index,patch){setForm(v=>({...v,bookingQuestions:v.bookingQuestions.map((q,i)=>i===index?{...q,...patch}:q)}));}
  function addQuestion(){if(form.bookingQuestions.length>=12)return setError("You can add up to 12 booking questions.");setForm(v=>({...v,bookingQuestions:[...v.bookingQuestions,newQuestion()]}));}
  async function submit(e){e.preventDefault();try{setError("");await onSubmit({...form,price:Number(form.price||0),durationMinutes:Number(form.durationMinutes||60),bufferMinutes:Number(form.bufferMinutes||0),capacity:Number(form.capacity||1)});}catch(e){setError(e.message);}}

  return <form className="panel cms-form standalone-form" onSubmit={submit}>
    <label>Service title<input maxLength="120" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></label>
    <label>Service description<textarea rows="7" maxLength="5000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/></label>

    <div className="three-col">
      <label>Price<input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>
      <label>Currency<input maxLength="3" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase()})}/></label>
      <label>Category<input maxLength="80" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label>
    </div>

    <fieldset className="content-options scheduling-options">
      <legend>Booking schedule</legend>
      <div className="three-col">
        <label>Duration (minutes)<input type="number" min="5" max="1440" step="5" value={form.durationMinutes} onChange={e=>setForm({...form,durationMinutes:e.target.value})}/></label>
        <label>Buffer after service<input type="number" min="0" max="240" step="5" value={form.bufferMinutes} onChange={e=>setForm({...form,bufferMinutes:e.target.value})}/></label>
        <label>Capacity per slot<input type="number" min="1" max="100" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})}/></label>
      </div>
      <p className="muted">These settings power available time slots and double-booking protection.</p>
    </fieldset>

    <fieldset className="content-options custom-question-builder">
      <legend>Custom booking questions</legend>
      <div className="panel-title"><p className="muted">Collect service-specific details from guests.</p><button type="button" className="secondary compact-button" onClick={addQuestion}><FiPlus/>Add question</button></div>
      {form.bookingQuestions.length===0?<p className="muted">No custom questions yet.</p>:<div className="booking-question-list">
        {form.bookingQuestions.map((q,index)=><div className="booking-question-editor" key={q.id||index}>
          <div className="booking-question-editor-head"><strong>Question {index+1}</strong><button type="button" className="danger compact-button" onClick={()=>setForm(v=>({...v,bookingQuestions:v.bookingQuestions.filter((_,i)=>i!==index)}))}><FiTrash2/>Remove</button></div>
          <label>Question<input maxLength="160" value={q.label||""} onChange={e=>patchQuestion(index,{label:e.target.value})} placeholder="Example: Vehicle model" required/></label>
          <div className="two-col">
            <label>Answer type<select value={q.type||"text"} onChange={e=>patchQuestion(index,{type:e.target.value,options:e.target.value==="select"?(q.options?.length?q.options:["Option 1","Option 2"]):[]})}><option value="text">Short text</option><option value="textarea">Long text</option><option value="select">Select options</option><option value="checkbox">Yes / checkbox</option></select></label>
            <label className="toggle-row question-required-toggle"><input type="checkbox" checked={Boolean(q.required)} onChange={e=>patchQuestion(index,{required:e.target.checked})}/><span>Required answer</span></label>
          </div>
          {q.type==="select"&&<label>Options <span className="muted">one per line</span><textarea rows="4" value={(q.options||[]).join("\n")} onChange={e=>patchQuestion(index,{options:e.target.value.split("\n").map(v=>v.trim()).filter(Boolean)})}/></label>}
        </div>)}
      </div>}
    </fieldset>

    <label>Visibility<select value={form.visibility||"public"} onChange={e=>setForm({...form,visibility:e.target.value})}><option value="public">Public — visible to everyone</option><option value="private">Private — only visible to you</option></select></label>
    <label>Featured image<span className="upload-zone">{form.coverImage?<img src={form.coverImage} alt="Cover preview"/>:<span>Choose featured image</span>}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>cover(e.target.files?.[0])}/></span></label>
    {form.coverImage&&<button type="button" className="danger" onClick={()=>setForm({...form,coverImage:""})}>Remove featured image</button>}
    <label>Additional images <span className="muted">({form.images.length}/8)</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>more(e.target.files)}/></label>
    {form.images.length>0&&<div className="image-preview-grid">{form.images.map((img,i)=><div className="image-preview" key={i}><img src={img} alt={"Preview "+(i+1)}/><button type="button" onClick={()=>setForm({...form,images:form.images.filter((_,x)=>x!==i)})}>×</button></div>)}</div>}

    <fieldset className="content-options"><legend>Service interactions</legend><label className="toggle-row"><input type="checkbox" checked={form.allowRatings!==false} onChange={e=>setForm({...form,allowRatings:e.target.checked})}/><span>Allow signed-in users to rate this service</span></label><label className="toggle-row"><input type="checkbox" checked={form.allowBookings!==false} onChange={e=>setForm({...form,allowBookings:e.target.checked})}/><span>Allow visitors to book this service</span></label></fieldset>
    <label className="toggle-row"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/><span>{form.published?"Published":"Save as draft"}</span></label>
    {error&&<p className="error">{error}</p>}
    <button className="primary-button">{submitLabel}</button>
  </form>;
}
