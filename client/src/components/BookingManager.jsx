import { Card } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Select } from "./ui/select.jsx";
import { Textarea } from "./ui/textarea.jsx";
import { Label } from "./ui/label.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle, FiCalendar, FiChevronDown, FiChevronUp, FiCheckCircle, FiClock, FiFilter, FiEdit2, FiEye, FiCheckSquare, FiGlobe, FiList, FiDownload, FiPlay, FiPlus, FiRotateCcw, FiSave, FiSearch, FiSlash, FiTrash2, FiUserX, FiUsers, FiX } from "react-icons/fi";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";

const statuses=[["pending","Pending"],["confirmed","Confirmed"],["in_progress","In Progress"],["completed","Completed"],["cancelled","Cancelled"],["no_show","No Show"]];
const empty={contentId:"",guestName:"",guestEmail:"",guestPhone:"",locationLabel:"",locationLatitude:null,locationLongitude:null,locationAccuracy:null,service:"Consultation",servicePrice:0,currency:"PHP",serviceDurationMinutes:60,bufferMinutes:0,bookingDate:"",notes:"",internalNotes:"",status:"pending"};

function money(value,currency="PHP"){try{return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(value||0);}catch{return `${currency} ${Number(value||0).toLocaleString()}`;}}
function localInput(value){if(!value)return"";const date=new Date(value);const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16);}
function bookingDateLabel(value){return new Date(value).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}
function customerKey(item){return String(item.guestEmail||"").toLowerCase()||String(item.guestPhone||"").replace(/\D/g,"")||String(item.guestName||"").toLowerCase();}

export default function BookingManager({user}){
  const [items,setItems]=useState([]);
  const [services,setServices]=useState([]);
  const [customers,setCustomers]=useState([]);
  const [form,setForm]=useState(empty);
  const [editing,setEditing]=useState(null);
  const [view,setView]=useState("list");
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
  const [error,setError]=useState("");
  const [bookingModalOpen,setBookingModalOpen]=useState(false);
  const [availability,setAvailability]=useState(null);
  const [availabilitySavedAt,setAvailabilitySavedAt]=useState(null);
  const [historyOpen,setHistoryOpen]=useState(true);
  const [historyDateOpen,setHistoryDateOpen]=useState(false);
  const [historyFrom,setHistoryFrom]=useState("");
  const [historyTo,setHistoryTo]=useState("");
  const [historySearch,setHistorySearch]=useState("");
  const [rescheduleTarget,setRescheduleTarget]=useState(null);
  const [rescheduleDate,setRescheduleDate]=useState("");
  const [rescheduleReason,setRescheduleReason]=useState("");
  const [rescheduleBusy,setRescheduleBusy]=useState(false);
  const [confirmation,setConfirmation]=useState(null);
  const [confirmationBusy,setConfirmationBusy]=useState(false);
  const [confirmationError,setConfirmationError]=useState("");

  function requestConfirmation(options){
    setConfirmationError("");
    setConfirmation(options);
  }

  function dismissConfirmation(){
    if(confirmationBusy)return;
    setConfirmation(null);
    setConfirmationError("");
  }

  async function confirmPendingAction(){
    if(!confirmation||confirmationBusy)return;
    setConfirmationBusy(true);
    setConfirmationError("");
    try{
      await confirmation.onConfirm();
      setConfirmation(null);
      setError("");
    }catch(e){
      setConfirmationError(e.message||"Unable to complete this action. Please try again.");
    }finally{
      setConfirmationBusy(false);
    }
  }

  async function refreshCustomers(){try{setCustomers(await api.bookings.customers());}catch{}}

  useEffect(()=>{
    Promise.all([api.bookings.list(),api.content.list(),api.bookings.customers(),api.business.mine()]).then(([bookings,content,people,business])=>{setItems(bookings);setServices(content);setCustomers(people);setAvailability(business);}).catch(e=>setError(e.message));
    const socket=getRealtimeSocket();if(!socket)return;
    const upsert=booking=>{setItems(current=>current.some(item=>item._id===booking._id)?current.map(item=>item._id===booking._id?{...item,...booking}:item):[...current,booking]);refreshCustomers();};
    const remove=({id})=>{setItems(current=>current.filter(item=>item._id!==id));refreshCustomers();};
    socket.on("booking:created",upsert);socket.on("booking:updated",upsert);socket.on("booking:deleted",remove);
    return()=>{socket.off("booking:created",upsert);socket.off("booking:updated",upsert);socket.off("booking:deleted",remove);};
  },[]);

  const stats=useMemo(()=>({total:items.length,pending:items.filter(i=>i.status==="pending").length,confirmed:items.filter(i=>i.status==="confirmed").length,inProgress:items.filter(i=>i.status==="in_progress").length,completed:items.filter(i=>i.status==="completed").length}),[items]);
  const filtered=useMemo(()=>items.filter(item=>{
    if(statusFilter&&item.status!==statusFilter)return false;
    if(!search)return true;
    const q=search.toLowerCase();return [item.bookingReference,item.guestName,item.guestEmail,item.guestPhone,item.service,item.locationLabel].some(v=>String(v||"").toLowerCase().includes(q));
  }),[items,search,statusFilter]);
  const completedHistory=useMemo(()=>items.filter(item=>{ if(item.status!=="completed")return false; const when=new Date(item.bookingDate).getTime(); if(historyFrom&&when<new Date(historyFrom).getTime())return false; if(historyTo&&when>new Date(historyTo).getTime())return false; if(historySearch){const q=historySearch.toLowerCase().trim();if(![item.bookingReference,item.guestName,item.guestEmail,item.guestPhone,item.service,item.locationLabel].some(v=>String(v||"").toLowerCase().includes(q)))return false;} return true; }).sort((a,b)=>new Date(b.bookingDate)-new Date(a.bookingDate)),[items,historyFrom,historyTo,historySearch]);
  const customerMap=useMemo(()=>new Map(customers.map(row=>[row.key,row])),[customers]);

  function exportBookingHistory(){
    const headers=["Reference","Service","Customer","Email","Phone","Date & time","Duration (min)","Price","Currency","Location","Status"];
    const rows=completedHistory.map(item=>[item.bookingReference||"",item.service||"",item.guestName||"",item.guestEmail||"",item.guestPhone||"",new Date(item.bookingDate).toLocaleString(),item.serviceDurationMinutes||60,Number(item.servicePrice||0),item.currency||"PHP",item.locationLabel||"",item.status||""]);
    const csv=[headers,...rows].map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\\n");
    const blob=new Blob(["\\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="booking-history-"+new Date().toISOString().slice(0,10)+".csv";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  }

  function selectService(contentId){
    const service=services.find(item=>item._id===contentId);
    if(!service)return setForm(v=>({...v,contentId:""}));
    setForm(v=>({...v,contentId:service._id,service:service.title,servicePrice:Number(service.price||0),currency:service.currency||"PHP",serviceDurationMinutes:Number(service.durationMinutes||60),bufferMinutes:Number(service.bufferMinutes||0)}));
  }

  async function persistBooking(){
    const body={...form,bookingDate:new Date(form.bookingDate).toISOString(),servicePrice:Number(form.servicePrice||0),serviceDurationMinutes:Number(form.serviceDurationMinutes||60),bufferMinutes:Number(form.bufferMinutes||0)};
    const updated=editing?await api.bookings.update(editing,body):await api.bookings.create(body);
    setItems(current=>editing?current.map(item=>item._id===editing?updated:item):(current.some(item=>item._id===updated._id)?current:[...current,updated]));
    setForm(empty);setEditing(null);setBookingModalOpen(false);setError("");refreshCustomers();
  }

  async function save(event){
    event.preventDefault();
    const original=editing?items.find(item=>item._id===editing):null;
    if(form.status==="completed"&&original?.status!=="completed"){
      requestConfirmation({
        title:"Complete this service?",
        description:"The booking will be marked completed and BookFlow will record a sale.",
        service:form.service,
        saleAmount:money(form.servicePrice,form.currency),
        confirmLabel:"Complete service",
        onConfirm:persistBooking
      });
      return;
    }
    if(original?.status==="completed"&&form.status!=="completed"){
      requestConfirmation({
        title:"Reopen completed booking?",
        description:"Reopening this booking will void its recorded sale while keeping the sales history for auditing.",
        service:form.service,
        confirmLabel:"Reopen booking",
        tone:"danger",
        onConfirm:persistBooking
      });
      return;
    }
    try{await persistBooking();}catch(e){setError(e.message);}
  }

  function edit(booking){
    setEditing(booking._id);
    setForm({
      contentId:booking.content?._id||booking.content||"",guestName:booking.guestName,guestEmail:booking.guestEmail||"",guestPhone:booking.guestPhone||"",
      locationLabel:booking.locationLabel||"",locationLatitude:booking.locationLatitude??null,locationLongitude:booking.locationLongitude??null,locationAccuracy:booking.locationAccuracy??null,
      service:booking.service,servicePrice:Number(booking.servicePrice||0),currency:booking.currency||"PHP",serviceDurationMinutes:Number(booking.serviceDurationMinutes||60),bufferMinutes:Number(booking.bufferMinutes||0),
      bookingDate:localInput(booking.bookingDate),notes:booking.notes||"",internalNotes:booking.internalNotes||"",status:booking.status
    });
    setView("list");
    setBookingModalOpen(true);
  }

  async function persistStatus(booking,status){
    const updated=await api.bookings.setStatus(booking._id,status);
    setItems(current=>current.map(item=>item._id===booking._id?updated:item));
    setError("");
    refreshCustomers();
  }

  async function changeStatus(booking,status){
    if(status==="completed"){
      requestConfirmation({
        title:"Complete this service?",
        description:"The booking will be marked completed and BookFlow will record a sale.",
        service:booking.service,
        saleAmount:money(booking.servicePrice,booking.currency),
        confirmLabel:"Complete service",
        onConfirm:()=>persistStatus(booking,status)
      });
      return;
    }
    if(booking.status==="completed"&&status!=="completed"){
      requestConfirmation({
        title:"Reopen completed booking?",
        description:"Reopening this booking will void its recorded sale while keeping an audit trail.",
        service:booking.service,
        confirmLabel:"Reopen booking",
        tone:"danger",
        onConfirm:()=>persistStatus(booking,status)
      });
      return;
    }
    try{await persistStatus(booking,status);}catch(e){setError(e.message);}
  }

  function reschedule(booking) {
    setRescheduleTarget(booking);
    setRescheduleDate(localInput(booking.bookingDate));
    setRescheduleReason("");
    setError("");
  }

  async function submitReschedule(event) {
    event.preventDefault();
    if (!rescheduleTarget || !rescheduleDate || rescheduleBusy) return;
    setRescheduleBusy(true);
    try {
      const parsed = new Date(rescheduleDate);
      if (!Number.isFinite(parsed.getTime())) throw new Error("Choose a valid date and time.");
      const updated = await api.bookings.reschedule(rescheduleTarget._id,parsed.toISOString(),rescheduleReason);
      setItems(current=>current.map(item=>item._id===rescheduleTarget._id?updated:item));
      setRescheduleTarget(null);
      setError("");
    } catch(e) { setError(e.message); }
    finally { setRescheduleBusy(false); }
  }

  async function persistRemoval(id){
    await api.bookings.remove(id);
    setItems(current=>current.filter(item=>item._id!==id));
    setError("");
    refreshCustomers();
  }

  function remove(id){
    const booking=items.find(item=>item._id===id);
    requestConfirmation({
      title:"Delete booking?",
      description:"This booking will be permanently deleted. Bookings with a sales audit record cannot be deleted.",
      service:booking?.service,
      confirmLabel:"Delete booking",
      tone:"danger",
      onConfirm:()=>persistRemoval(id)
    });
  }

  function statusActions(booking){
    if(booking.status==="pending")return <><Button variant="plain" className="secondary" onClick={()=>changeStatus(booking,"confirmed")}><FiCheckCircle/>Confirm</Button><Button variant="plain" className="danger" onClick={()=>changeStatus(booking,"cancelled")}><FiSlash/>Cancel</Button></>;
    if(booking.status==="confirmed")return <><Button variant="plain" className="primary-button compact-button" onClick={()=>changeStatus(booking,"in_progress")}><FiPlay/>Start service</Button><Button variant="plain" className="secondary" onClick={()=>changeStatus(booking,"no_show")}><FiUserX/>No show</Button><Button variant="plain" className="danger" onClick={()=>changeStatus(booking,"cancelled")}><FiSlash/>Cancel</Button></>;
    if(booking.status==="in_progress")return <Button variant="plain" className="primary-button compact-button" onClick={()=>changeStatus(booking,"completed")}><FiCheckCircle/>Complete service</Button>;
    if(booking.status==="completed")return null;
    return <Button variant="plain" className="secondary" onClick={()=>changeStatus(booking,"pending")}><FiRotateCcw/>Reopen</Button>;
  }

  function CalendarView(){
    const [year,monthNumber]=month.split("-").map(Number);const first=new Date(year,monthNumber-1,1);const days=new Date(year,monthNumber,0).getDate();const offset=first.getDay();
    const cells=Array.from({length:offset+days},(_,index)=>index<offset?null:index-offset+1);
    return <section className="panel booking-calendar-panel">
      <div className="panel-title"><div><p className="eyebrow">CALENDAR</p><h2>Booking calendar</h2></div><Input className="month-picker" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div>
      <div className="booking-calendar-weekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><strong key={day}>{day}</strong>)}</div>
      <div className="booking-calendar-grid">{cells.map((day,index)=>{
        if(!day)return <div className="calendar-day empty" key={"empty-"+index}/>;
        const dateKey=`${month}-${String(day).padStart(2,"0")}`;const dayItems=items.filter(item=>{const d=new Date(item.bookingDate);const local=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;return local===dateKey;});
        return <div className="calendar-day" key={dateKey}><strong className="calendar-day-number">{day}</strong><div className="calendar-bookings">{dayItems.slice(0,4).map(item=><Link to={"/dashboard/bookings/"+item._id} className={"calendar-booking "+item.status} key={item._id}><span>{new Date(item.bookingDate).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</span>{item.service}</Link>)}{dayItems.length>4&&<small>+{dayItems.length-4} more</small>}</div></div>;
      })}</div>
    </section>;
  }

  function CustomerView(){
    return <section className="panel customer-history-panel"><div className="panel-title"><div><p className="eyebrow">CUSTOMER HISTORY</p><h2>Returning guests</h2></div><span className="count">{customers.length}</span></div>
      {customers.length===0?<p className="muted">Customer history appears after bookings are created.</p>:<div className="customer-history-grid">{customers.map(row=><Card as="article" className="customer-history-card" key={row.key}><div><strong>{row.guestName}</strong><small>{row.guestEmail||row.guestPhone||"Guest"}</small></div><span className={row.totalBookings>1?"returning-customer-badge":"first-customer-badge"}>{row.totalBookings>1?"Returning customer":"First booking"}</span><div className="customer-history-metrics"><span><b>{row.totalBookings}</b> bookings</span><span><b>{row.completedBookings}</b> completed</span><span><b>{row.upcomingBookings}</b> upcoming</span><span><b>{row.noShows}</b> no-shows</span></div>{row.lastBooking&&<small>Last booking: {new Date(row.lastBooking).toLocaleDateString()}</small>}{row.services?.length>0&&<p className="muted">Top service: {row.services[0].name} × {row.services[0].count}</p>}</Card>)}</div>}
    </section>;
  }

  const canCreate=user.accountStatus==="active";

  return <section id="bookings">
    <Dialog open={Boolean(confirmation)} title={confirmation?.title||"Confirm booking action"}
      className="booking-confirm-dialog" dismissible={!confirmationBusy}
      onOpenChange={open=>{if(!open)dismissConfirmation();}}>
      <DialogContent className="booking-confirm-content">
        <DialogHeader className="booking-confirm-header">
          <span className={"booking-confirm-icon "+(confirmation?.tone==="danger"?"booking-confirm-icon-danger":"")} aria-hidden="true">
            {confirmation?.tone==="danger"?<FiAlertTriangle/>:<FiCheckCircle/>}
          </span>
          <div className="booking-confirm-heading">
            <DialogTitle>{confirmation?.title}</DialogTitle>
            <DialogDescription>{confirmation?.description}</DialogDescription>
          </div>
        </DialogHeader>
        {(confirmation?.service||confirmation?.saleAmount)&&<div className="booking-confirm-details">
          {confirmation?.service&&<div className="booking-confirm-detail-row"><span>Service</span><strong>{confirmation.service}</strong></div>}
          {confirmation?.saleAmount&&<div className="booking-confirm-detail-row booking-confirm-amount"><span>Sale to record</span><strong>{confirmation.saleAmount}</strong></div>}
        </div>}
        {confirmationError&&<p className="booking-confirm-error" role="alert">{confirmationError}</p>}
        <DialogFooter className="booking-confirm-footer">
          <Button type="button" variant="outline" className="booking-confirm-cancel" disabled={confirmationBusy} autoFocus onClick={dismissConfirmation}>Cancel</Button>
          <Button type="button" variant={confirmation?.tone==="danger"?"destructive":"default"} className="booking-confirm-submit" disabled={confirmationBusy} onClick={confirmPendingAction}>
            {confirmationBusy?"Processing…":confirmation?.confirmLabel||"Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(rescheduleTarget)} title="Reschedule booking"
      dismissible={!rescheduleBusy}
      onOpenChange={open=>{if(!open&&!rescheduleBusy)setRescheduleTarget(null);}}>
      <DialogContent>
        <DialogHeader><DialogTitle>Reschedule booking</DialogTitle>
          <DialogDescription>Change the appointment time for {rescheduleTarget?.guestName || "this guest"}. Existing availability rules will still apply.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitReschedule}>
          <Label>New date and time<Input type="datetime-local" required value={rescheduleDate} onChange={e=>setRescheduleDate(e.target.value)} /></Label>
          <Label>Reason (optional)<Textarea rows={3} maxLength={1000} value={rescheduleReason} onChange={e=>setRescheduleReason(e.target.value)} /></Label>
          {error&&<p className="error" role="alert">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={rescheduleBusy} onClick={()=>setRescheduleTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={rescheduleBusy}>{rescheduleBusy?"Saving...":"Save new time"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <div className="stats-grid booking-stats-grid booking-overview-grid" aria-label="Booking overview">
      <Card as="article" className="stat-card booking-overview-card booking-overview-total">
        <div className="booking-overview-card-head"><span>Total bookings</span><span className="booking-overview-icon" aria-hidden="true"><FiCalendar/></span></div>
        <strong>{stats.total}</strong>
      </Card>
      <Card as="article" className="stat-card booking-overview-card booking-overview-pending">
        <div className="booking-overview-card-head"><span>Pending</span><span className="booking-overview-icon" aria-hidden="true"><FiClock/></span></div>
        <strong>{stats.pending}</strong>
      </Card>
      <Card as="article" className="stat-card booking-overview-card booking-overview-confirmed">
        <div className="booking-overview-card-head"><span>Confirmed</span><span className="booking-overview-icon" aria-hidden="true"><FiCheckCircle/></span></div>
        <strong>{stats.confirmed}</strong>
      </Card>
      <Card as="article" className="stat-card booking-overview-card booking-overview-progress">
        <div className="booking-overview-card-head"><span>In progress</span><span className="booking-overview-icon" aria-hidden="true"><FiPlay/></span></div>
        <strong>{stats.inProgress}</strong>
      </Card>
      <Card as="article" className="stat-card booking-overview-card booking-overview-completed">
        <div className="booking-overview-card-head"><span>Completed</span><span className="booking-overview-icon" aria-hidden="true"><FiCheckSquare/></span></div>
        <strong>{stats.completed}</strong>
      </Card>
    </div>
    {error&&<p className="error">{error}</p>}

    <div className="booking-view-toolbar">
      <div className="booking-view-tabs" role="group" aria-label="Booking views">
        <Button variant="plain" type="button" aria-pressed={view==="list"} className={view==="list"?"filter-chip active":"filter-chip"} onClick={()=>setView("list")}><FiList/>Bookings</Button>
        <Button variant="plain" type="button" aria-pressed={view==="calendar"} className={view==="calendar"?"filter-chip active":"filter-chip"} onClick={()=>setView("calendar")}><FiCalendar/>Calendar</Button>
        <Button variant="plain" type="button" aria-pressed={view==="customers"} className={view==="customers"?"filter-chip active":"filter-chip"} onClick={()=>setView("customers")}><FiUsers/>Customers</Button>
        <Button variant="plain" type="button" aria-pressed={view==="availability"} className={view==="availability"?"filter-chip active":"filter-chip"} onClick={()=>setView("availability")}><FiClock/>Availability</Button>
      </div>
      {canCreate&&<Button variant="outline" type="button" className="booking-new-button" onClick={()=>{setEditing(null);setForm(empty);setBookingModalOpen(true);}}><FiPlus/>New booking</Button>}
    </div>

    {view==="availability"&&availability?<section className="panel"><div className="panel-title"><div><p className="eyebrow">AVAILABILITY</p><h2>Booking availability</h2></div></div><div className="availability-days">{availability.workingHours?.map((row,index)=><div className="availability-row" key={row.day}><Label><Input type="checkbox" checked={row.enabled} onChange={e=>setAvailability({...availability,workingHours:availability.workingHours.map((x,i)=>i===index?{...x,enabled:e.target.checked}:x)})}/>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][row.day]}</Label><Input type="time" value={row.start} disabled={!row.enabled} onChange={e=>setAvailability({...availability,workingHours:availability.workingHours.map((x,i)=>i===index?{...x,start:e.target.value}:x)})}/><span>to</span><Input type="time" value={row.end} disabled={!row.enabled} onChange={e=>setAvailability({...availability,workingHours:availability.workingHours.map((x,i)=>i===index?{...x,end:e.target.value}:x)})}/></div>)}</div><div className="three-col availability-settings-grid"><Label className="availability-control"><span className="availability-input-icon" aria-label="Timezone" data-tooltip="Timezone" title="Timezone"><FiGlobe/></span><Input aria-label="Timezone" value={availability.timezone||"Asia/Manila"} onChange={e=>setAvailability({...availability,timezone:e.target.value})} placeholder="Asia/Manila"/></Label><Label className="availability-control"><span className="availability-input-icon" aria-label="Minimum notice (minutes)" data-tooltip="Minimum notice (minutes)" title="Minimum notice (minutes)"><FiClock/></span><Input aria-label="Minimum notice (minutes)" type="number" min="0" max="43200" value={availability.leadTimeMinutes??60} onChange={e=>setAvailability({...availability,leadTimeMinutes:Number(e.target.value)})}/></Label><Label className="availability-control"><span className="availability-input-icon" aria-label="Book up to (days)" data-tooltip="Book up to (days)" title="Book up to (days)"><FiCalendar/></span><Input aria-label="Book up to (days)" type="number" min="1" max="730" value={availability.maxAdvanceDays??60} onChange={e=>setAvailability({...availability,maxAdvanceDays:Number(e.target.value)})}/></Label></div><Label className="availability-control"><span className="availability-input-icon" aria-label="Slot interval" data-tooltip="Slot interval" title="Slot interval"><FiClock/></span><Select aria-label="Slot interval" value={availability.slotIntervalMinutes??30} onChange={e=>setAvailability({...availability,slotIntervalMinutes:Number(e.target.value)})}>{[5,10,15,20,30,45,60,90,120].map(v=><option key={v} value={v}>{v} minutes</option>)}</Select></Label><div className="availability-blocked-range"><Label className="availability-control"><span className="availability-input-icon" aria-label="Blocked from" data-tooltip="Blocked from" title="Blocked from"><FiCalendar/></span><Input aria-label="Blocked from" type="datetime-local" value={availability.blockedFrom||""} onChange={e=>setAvailability({...availability,blockedFrom:e.target.value})}/></Label><span className="availability-range-arrow" aria-hidden="true">→</span><Label className="availability-control"><span className="availability-input-icon" aria-label="Blocked until" data-tooltip="Blocked until" title="Blocked until"><FiCalendar/></span><Input aria-label="Blocked until" type="datetime-local" min={availability.blockedFrom||undefined} value={availability.blockedUntil||""} onChange={e=>setAvailability({...availability,blockedUntil:e.target.value})}/></Label></div><div className="row-actions availability-save-actions"><Button variant="plain" className="availability-save-button" type="button" aria-label="Save availability" onClick={async()=>{try{const saved=await api.business.update(availability);setAvailability(saved);setAvailabilitySavedAt(new Date());setError("");}catch(e){setError(e.message);}}}><FiSave/><span>Save</span></Button></div>{availabilitySavedAt&&<div className="availability-saved-toast" role="status"><FiCheckCircle/><span>Availability saved · {availabilitySavedAt.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</span><Button variant="plain" type="button" className="availability-toast-close" aria-label="Dismiss" onClick={()=>setAvailabilitySavedAt(null)}><FiX/></Button></div>}</section>:view==="calendar"?<CalendarView/>:view==="customers"?<CustomerView/>:<>
      <div className="workspace-grid booking-workspace-grid">
        {bookingModalOpen&&<div className="booking-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setBookingModalOpen(false);setEditing(null);setForm(empty);}}}>
        <section className="panel booking-editor-panel booking-modal" role="dialog" aria-modal="true" aria-label={editing?"Edit booking":"New booking"}><div className="panel-title"><h2>{editing?"Edit booking":"New booking"}</h2><Button variant="plain" type="button" className="icon-button booking-modal-close" aria-label="Close booking form" onClick={()=>{setBookingModalOpen(false);setEditing(null);setForm(empty);}}><FiX/></Button></div>
          {!editing&&!canCreate?<p className="warning-note">New bookings cannot be created while this business is paused.</p>:<form onSubmit={save}>
            <div className="two-col"><Label>Guest name<Input value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} required/></Label><Label>Guest email<Input type="email" value={form.guestEmail} onChange={e=>setForm({...form,guestEmail:e.target.value})}/></Label></div>
            <div className="two-col"><Label>Phone number<Input type="tel" value={form.guestPhone} onChange={e=>setForm({...form,guestPhone:e.target.value})}/></Label><Label>Location / service address<Input value={form.locationLabel} onChange={e=>setForm({...form,locationLabel:e.target.value})}/></Label></div>
            <Label>Service<Select value={form.contentId} onChange={e=>selectService(e.target.value)}><option value="">Custom / other service</option>{services.map(service=><option key={service._id} value={service._id}>{service.title}</option>)}</Select></Label>
            {!form.contentId&&<Label>Service name<Input value={form.service} onChange={e=>setForm({...form,service:e.target.value})} required/></Label>}
            <div className="two-col"><Label>Service price<Input type="number" min="0" step="0.01" value={form.servicePrice} onChange={e=>setForm({...form,servicePrice:e.target.value})} disabled={Boolean(form.contentId)}/></Label><Label>Currency<Input maxLength="3" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3)})} disabled={Boolean(form.contentId)}/></Label></div>
            <div className="three-col"><Label>Date and time<Input type="datetime-local" value={form.bookingDate} onChange={e=>setForm({...form,bookingDate:e.target.value})} required/></Label><Label>Duration<Input type="number" min="5" step="5" value={form.serviceDurationMinutes} onChange={e=>setForm({...form,serviceDurationMinutes:e.target.value})} disabled={Boolean(form.contentId)}/></Label><Label>Status<Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></Label></div>
            <Label>Guest notes<Textarea rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Label>
            <Label>Internal business notes <span className="muted">not shown to the guest</span><Textarea rows="3" maxLength="2000" value={form.internalNotes} onChange={e=>setForm({...form,internalNotes:e.target.value})}/></Label>
            <div className="row-actions"><Button variant="plain" className="primary-button">{editing?"Save changes":"Create booking"}</Button>{editing&&<Button variant="plain" type="button" className="secondary" onClick={()=>{setEditing(null);setForm(empty);}}>Cancel</Button>}</div>
          </form>}
        </section></div>}

        <section className="panel booking-list-panel booking-compact-panel">
          <div className="booking-section-heading">
            <div><h2>Guest bookings</h2><p>Manage your customer appointments</p></div>
            <span className="booking-total-pill">{filtered.length} {filtered.length===1?"booking":"bookings"}</span>
          </div>
          <div className="booking-controls">
            <label className="booking-inline-search"><FiSearch aria-hidden="true"/><Input aria-label="Search guest bookings" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search bookings..."/></label>
            <label className="booking-inline-select"><FiFilter aria-hidden="true"/><Select aria-label="Filter bookings by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All statuses</option>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></label>
          </div>
          <div className="booking-list booking-compact-list">
            {filtered.length===0?<p className="booking-empty-message">No matching bookings.</p>:filtered.map(booking=>{
              const customer=customerMap.get(customerKey(booking));
              return <Card as="article" className="booking-card booking-lifecycle-card booking-compact-card" key={booking._id}>
                <div className="booking-card-top">
                  <div className="booking-main">
                    <div className="booking-reference-line">{booking.bookingReference&&<span>{booking.bookingReference}</span>}{customer?.totalBookings>1&&<span className="returning-customer-badge">Returning · {customer.totalBookings}</span>}</div>
                    <h3><Link className="entity-link" to={"/dashboard/bookings/"+booking._id}>{booking.service}</Link></h3>
                    <p>{booking.guestName}{booking.guestPhone?" · "+booking.guestPhone:""}</p>
                    <div className="booking-card-meta"><FiCalendar aria-hidden="true"/><span>{bookingDateLabel(booking.bookingDate)} · {booking.serviceDurationMinutes||60} min · {money(booking.servicePrice,booking.currency)}</span></div>
                  </div>
                  <span className={"status "+booking.status}>{statuses.find(([value])=>value===booking.status)?.[1]||booking.status}</span>
                </div>
                <div className="booking-card-footer">
                  {booking.status==="completed"?<span className="booking-sale-hint"><FiCheckCircle aria-hidden="true"/>Sale recorded when completed</span>:<span className="booking-card-spacer" aria-hidden="true"/>}
                  <div className="booking-card-actions">
                    <div className="row-actions booking-status-actions">{statusActions(booking)}</div>
                    <div className="row-actions booking-secondary-actions">
                      <Button asChild variant="outline"><Link className="secondary button-link small-link icon-action" aria-label="View booking" title="View booking" data-tooltip="View booking" to={"/dashboard/bookings/"+booking._id}><FiEye/></Link></Button>
                      {["pending","confirmed","in_progress"].includes(booking.status)&&<Button variant="outline" className="secondary icon-action" aria-label="Reschedule booking" title="Reschedule" data-tooltip="Reschedule" onClick={()=>reschedule(booking)}><FiCalendar/></Button>}
                      {booking.status!=="completed"&&<><Button variant="outline" className="secondary icon-action" aria-label="Edit booking" title="Edit booking" data-tooltip="Edit booking" onClick={()=>edit(booking)}><FiEdit2/></Button><Button variant="outline" className="danger icon-action" aria-label="Delete booking" title="Delete booking" data-tooltip="Delete booking" onClick={()=>remove(booking._id)}><FiTrash2/></Button></>}
                    </div>
                  </div>
                </div>
              </Card>;
            })}
          </div>
        </section>
        <section className="panel booking-history-panel booking-compact-panel">
          <div className="booking-section-heading booking-history-heading">
            <div><h2>Booking history</h2><p>Completed and previously recorded bookings</p></div>
            <div className="booking-history-heading-actions">
              <span className="booking-record-count">{completedHistory.length} {completedHistory.length===1?"record":"records"}</span>
              <Button type="button" variant="outline" className="booking-history-collapse" aria-label={historyOpen?"Collapse booking history":"Expand booking history"} aria-expanded={historyOpen} onClick={()=>setHistoryOpen(v=>!v)}>{historyOpen?<FiChevronUp/>:<FiChevronDown/>}</Button>
            </div>
          </div>
          {historyOpen&&<div className="booking-history-content">
            <div className="booking-history-controls">
              <label className="booking-inline-search booking-history-search"><FiSearch aria-hidden="true"/><Input aria-label="Search booking history" value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Search history..."/></label>
              <div className="booking-date-filter">
                <Button variant="outline" type="button" className="booking-date-trigger" aria-expanded={historyDateOpen} aria-controls="booking-date-range-popup" onClick={()=>setHistoryDateOpen(v=>!v)}><FiCalendar aria-hidden="true"/><span>{historyFrom||historyTo?"Date range · active":"Date range"}</span><FiChevronDown aria-hidden="true"/></Button>
                {historyDateOpen&&<div id="booking-date-range-popup" className="booking-date-popup">
                  <div className="booking-date-inputs">
                    <Label>From<Input type="datetime-local" value={historyFrom} onChange={e=>setHistoryFrom(e.target.value)}/></Label>
                    <Label>To<Input type="datetime-local" min={historyFrom||undefined} value={historyTo} onChange={e=>setHistoryTo(e.target.value)}/></Label>
                  </div>
                  <div className="booking-date-actions">
                    <Button type="button" variant="ghost" onClick={()=>{setHistoryFrom("");setHistoryTo("");}}>Clear dates</Button>
                    <Button type="button" variant="outline" onClick={()=>setHistoryDateOpen(false)}>Done</Button>
                  </div>
                </div>}
              </div>
              <Button variant="outline" type="button" className="booking-history-export" onClick={exportBookingHistory} disabled={completedHistory.length===0} aria-label="Export booking history to sheet" title="Export booking history to CSV"><FiDownload/><span>Export to sheet</span></Button>
            </div>
            <div className="booking-list booking-compact-list">
              {completedHistory.length===0?<p className="booking-empty-message">No completed bookings in this date and time range.</p>:completedHistory.map(booking=><Card as="article" className="booking-card booking-lifecycle-card booking-compact-card booking-history-card" key={booking._id}>
                <div className="booking-card-top">
                  <div className="booking-main">
                    <div className="booking-reference-line">{booking.bookingReference&&<span>{booking.bookingReference}</span>}</div>
                    <h3><Link className="entity-link" to={"/dashboard/bookings/"+booking._id}>{booking.service}</Link></h3>
                    <p>{booking.guestName}{booking.guestPhone?" · "+booking.guestPhone:""}</p>
                    <div className="booking-card-meta"><FiCalendar aria-hidden="true"/><span>{bookingDateLabel(booking.bookingDate)} · {booking.serviceDurationMinutes||60} min · {money(booking.servicePrice,booking.currency)}</span></div>
                  </div>
                  <span className="status completed">Completed</span>
                </div>
                <div className="booking-card-footer">
                  <span className="booking-sale-hint"><FiCheckCircle aria-hidden="true"/>Sale recorded</span>
                  <div className="row-actions booking-secondary-actions"><Button asChild variant="outline"><Link className="secondary button-link small-link icon-action" aria-label="View completed booking" title="View booking" data-tooltip="View booking" to={"/dashboard/bookings/"+booking._id}><FiEye/></Link></Button></div>
                </div>
              </Card>)}
            </div>
          </div>}
        </section>
      </div>
    </>}
  </section>;
}
