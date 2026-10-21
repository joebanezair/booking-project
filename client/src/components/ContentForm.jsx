import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Select } from "./ui/select.jsx";
import { Textarea } from "./ui/textarea.jsx";
import { Image } from "./ui/image.jsx";
import { Label } from "./ui/label.jsx";
import { useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { fileToDataUrl } from "../lib.js";

const newQuestion=()=>({id:crypto.randomUUID?.()||`q-${Date.now()}`,label:"",type:"text",required:false,options:[]});

export default function ContentForm({initial,onSubmit,submitLabel}){
  const [form,setForm]=useState({durationMinutes:60,bufferMinutes:0,capacity:1,...initial,images:initial.images||[],bookingQuestions:initial.bookingQuestions||[]});
  const [error,setError]=useState("");

  async function cover(file){try{const coverImage=await fileToDataUrl(file);setForm(v=>({...v,coverImage}));setError("");}catch(e){setError(e.message);}}
  async function more(files){try{const selected=Array.from(files||[]);if(form.images.length+selected.length>8)throw new Error("You can upload up to 8 additional images.");const converted=await Promise.all(selected.map(fileToDataUrl));setForm(v=>({...v,images:[...v.images,...converted]}));setError("");}catch(e){setError(e.message);}}
  function patchQuestion(index,patch){setForm(v=>({...v,bookingQuestions:v.bookingQuestions.map((q,i)=>i===index?{...q,...patch}:q)}));}
  function addQuestion(){if(form.bookingQuestions.length>=12)return setError("You can add up to 12 booking questions.");setForm(v=>({...v,bookingQuestions:[...v.bookingQuestions,newQuestion()]}));}
  async function submit(e){e.preventDefault();try{setError("");await onSubmit({...form,price:Number(form.price||0),durationMinutes:Number(form.durationMinutes||60),bufferMinutes:Number(form.bufferMinutes||0),capacity:Number(form.capacity||1)});}catch(e){setError(e.message);}}

  return <form className="panel cms-form standalone-form" onSubmit={submit}>
    <Label>Service title<Input maxLength="120" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></Label>
    <Label>Service description<Textarea rows="7" maxLength="5000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/></Label>

    <div className="three-col">
      <Label>Price<Input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></Label>
      <Label>Currency<Input maxLength="3" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase()})}/></Label>
      <Label>Category<Input maxLength="80" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></Label>
    </div>

    <fieldset className="content-options scheduling-options">
      <legend>Booking schedule</legend>
      <div className="three-col">
        <Label>Duration (minutes)<Input type="number" min="5" max="1440" step="5" value={form.durationMinutes} onChange={e=>setForm({...form,durationMinutes:e.target.value})}/></Label>
        <Label>Buffer after service<Input type="number" min="0" max="240" step="5" value={form.bufferMinutes} onChange={e=>setForm({...form,bufferMinutes:e.target.value})}/></Label>
        <Label>Capacity per slot<Input type="number" min="1" max="100" value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})}/></Label>
      </div>
      <p className="muted">These settings power available time slots and double-booking protection.</p>
    </fieldset>

    <fieldset className="content-options custom-question-builder">
      <legend>Custom booking questions</legend>
      <div className="panel-title"><p className="muted">Collect service-specific details from guests.</p><Button variant="plain" type="button" className="secondary compact-button" onClick={addQuestion}><FiPlus/>Add question</Button></div>
      {form.bookingQuestions.length===0?<p className="muted">No custom questions yet.</p>:<div className="booking-question-list">
        {form.bookingQuestions.map((q,index)=><div className="booking-question-editor" key={q.id||index}>
          <div className="booking-question-editor-head"><strong>Question {index+1}</strong><Button variant="plain" type="button" className="danger compact-button" onClick={()=>setForm(v=>({...v,bookingQuestions:v.bookingQuestions.filter((_,i)=>i!==index)}))}><FiTrash2/>Remove</Button></div>
          <Label>Question<Input maxLength="160" value={q.label||""} onChange={e=>patchQuestion(index,{label:e.target.value})} placeholder="Example: Vehicle model" required/></Label>
          <div className="two-col">
            <Label>Answer type<Select value={q.type||"text"} onChange={e=>patchQuestion(index,{type:e.target.value,options:e.target.value==="select"?(q.options?.length?q.options:["Option 1","Option 2"]):[]})}><option value="text">Short text</option><option value="textarea">Long text</option><option value="select">Select options</option><option value="checkbox">Yes / checkbox</option></Select></Label>
            <Label className="toggle-row question-required-toggle"><Input type="checkbox" checked={Boolean(q.required)} onChange={e=>patchQuestion(index,{required:e.target.checked})}/><span>Required answer</span></Label>
          </div>
          {q.type==="select"&&<Label>Options <span className="muted">one per line</span><Textarea rows="4" value={(q.options||[]).join("\n")} onChange={e=>patchQuestion(index,{options:e.target.value.split("\n").map(v=>v.trim()).filter(Boolean)})}/></Label>}
        </div>)}
      </div>}
    </fieldset>

    <Label>Visibility<Select value={form.visibility||"public"} onChange={e=>setForm({...form,visibility:e.target.value})}><option value="public">Public — visible to everyone</option><option value="private">Private — only visible to you</option></Select></Label>
    <Label>Featured image<span className="upload-zone">{form.coverImage?<Image src={form.coverImage} alt="Cover preview"/>:<span>Choose featured image</span>}<Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>cover(e.target.files?.[0])}/></span></Label>
    {form.coverImage&&<Button variant="plain" type="button" className="danger" onClick={()=>setForm({...form,coverImage:""})}>Remove featured image</Button>}
    <Label>Additional images <span className="muted">({form.images.length}/8)</span><Input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>more(e.target.files)}/></Label>
    {form.images.length>0&&<div className="image-preview-grid">{form.images.map((img,i)=><div className="image-preview" key={i}><Image src={img} alt={"Preview "+(i+1)}/><Button variant="plain" type="button" aria-label={`Remove additional image ${i+1}`} onClick={()=>setForm({...form,images:form.images.filter((_,x)=>x!==i)})}><span aria-hidden="true">×</span></Button></div>)}</div>}

    <fieldset className="content-options"><legend>Service interactions</legend><Label className="toggle-row"><Input type="checkbox" checked={form.allowRatings!==false} onChange={e=>setForm({...form,allowRatings:e.target.checked})}/><span>Allow signed-in users to rate this service</span></Label><Label className="toggle-row"><Input type="checkbox" checked={form.allowBookings!==false} onChange={e=>setForm({...form,allowBookings:e.target.checked})}/><span>Allow visitors to book this service</span></Label></fieldset>
    <Label className="toggle-row"><Input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/><span>{form.published?"Published":"Save as draft"}</span></Label>
    {error&&<p className="error">{error}</p>}
    <Button variant="plain" className="primary-button">{submitLabel}</Button>
  </form>;
}
