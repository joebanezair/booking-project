import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCalendar, FiCheckCircle, FiClock, FiList, FiPlay, FiPlus, FiRotateCcw, FiSearch, FiSlash, FiUserX, FiUsers, FiX } from "react-icons/fi";
import { api } from "../api.js";
import { getRealtimeSocket } from "../realtime.js";

const statuses=[["pending","Pending"],["confirmed","Confirmed"],["in_progress","In Progress"],["completed","Completed"],["cancelled","Cancelled"],["no_show","No Show"]];
const empty={contentId:"",guestName:"",guestEmail:"",guestPhone:"",locationLabel:"",locationLatitude:null,locationLongitude:null,locationAccuracy:null,service:"Consultation",servicePrice:0,currency:"PHP",serviceDurationMinutes:60,bufferMinutes:0,bookingDate:"",notes:"",internalNotes:"",status:"pending"};

function money(value,currency="PHP"){try{return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(value||0);}catch{return `${currency} ${Number(value||0).toLocaleString()}`;}}
function localInput(value){if(!value)return"";const date=new Date(value);const offset=date.getTimezoneOffset()*60000;return new Date(date.getTime()-offset).toISOString().slice(0,16);}
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
  const customerMap=useMemo(()=>new Map(customers.map(row=>[row.key,row])),[customers]);

  function selectService(contentId){
    const service=services.find(item=>item._id===contentId);
    if(!service)return setForm(v=>({...v,contentId:""}));
    setForm(v=>({...v,contentId:service._id,service:service.title,servicePrice:Number(service.price||0),currency:service.currency||"PHP",serviceDurationMinutes:Number(service.durationMinutes||60),bufferMinutes:Number(service.bufferMinutes||0)}));
  }

  async function save(event){
    event.preventDefault();
    try{
      const original=editing?items.find(item=>item._id===editing):null;
      if(form.status==="completed"&&original?.status!=="completed"&&!confirm(`Mark this service completed? This will record ${money(form.servicePrice,form.currency)} as a sale.`))return;
      if(original?.status==="completed"&&form.status!=="completed"&&!confirm("Reopening this completed booking will void its recorded sale while keeping the sales history. Continue?"))return;
      const body={...form,bookingDate:new Date(form.bookingDate).toISOString(),servicePrice:Number(form.servicePrice||0),serviceDurationMinutes:Number(form.serviceDurationMinutes||60),bufferMinutes:Number(form.bufferMinutes||0)};
      const updated=editing?await api.bookings.update(editing,body):await api.bookings.create(body);
      setItems(current=>editing?current.map(item=>item._id===editing?updated:item):(current.some(item=>item._id===updated._id)?current:[...current,updated]));
      setForm(empty);setEditing(null);setBookingModalOpen(false);setError("");refreshCustomers();
    }catch(e){setError(e.message);}
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

  async function changeStatus(booking,status){
    try{
      if(status==="completed"&&!confirm(`Mark this service completed? BookFlow will record ${money(booking.servicePrice,booking.currency)} as a sale.`))return;
      if(booking.status==="completed"&&status!=="completed"&&!confirm("Reopening this completed booking will void its recorded sale while keeping an audit trail. Continue?"))return;
      const updated=await api.bookings.setStatus(booking._id,status);setItems(current=>current.map(item=>item._id===booking._id?updated:item));setError("");refreshCustomers();
    }catch(e){setError(e.message);}
  }

  async function reschedule(booking){
    const next=prompt("Enter the new date and time:",localInput(booking.bookingDate));if(!next)return;
    const reason=prompt("Reason for rescheduling (optional):","")||"";
    try{const updated=await api.bookings.reschedule(booking._id,new Date(next).toISOString(),reason);setItems(current=>current.map(item=>item._id===booking._id?updated:item));setError("");}catch(e){setError(e.message);}
  }

  async function remove(id){
    if(!confirm("Delete this booking? Bookings that already have a sales audit record cannot be deleted."))return;
    try{await api.bookings.remove(id);setItems(current=>current.filter(item=>item._id!==id));refreshCustomers();}catch(e){setError(e.message);}
  }

  function statusActions(booking){
    if(booking.status==="pending")return <><button className="secondary" onClick={()=>changeStatus(booking,"confirmed")}><FiCheckCircle/>Confirm</button><button className="danger" onClick={()=>changeStatus(booking,"cancelled")}><FiSlash/>Cancel</button></>;
    if(booking.status==="confirmed")return <><button className="primary-button compact-button" onClick={()=>changeStatus(booking,"in_progress")}><FiPlay/>Start service</button><button className="secondary" onClick={()=>changeStatus(booking,"no_show")}><FiUserX/>No show</button><button className="danger" onClick={()=>changeStatus(booking,"cancelled")}><FiSlash/>Cancel</button></>;
    if(booking.status==="in_progress")return <button className="primary-button compact-button" onClick={()=>changeStatus(booking,"completed")}><FiCheckCircle/>Complete service</button>;
    if(booking.status==="completed")return <button className="secondary" onClick={()=>changeStatus(booking,"in_progress")}><FiRotateCcw/>Reopen</button>;
    return <button className="secondary" onClick={()=>changeStatus(booking,"pending")}><FiRotateCcw/>Reopen</button>;
  }

  function CalendarView(){
    const [year,monthNumber]=month.split("-").map(Number);const first=new Date(year,monthNumber-1,1);const days=new Date(year,monthNumber,0).getDate();const offset=first.getDay();
    const cells=Array.from({length:offset+days},(_,index)=>index<offset?null:index-offset+1);
    return <section className="panel booking-calendar-panel">
      <div className="panel-title"><div><p className="eyebrow">CALENDAR</p><h2>Booking calendar</h2></div><input className="month-picker" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div>
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
      {customers.length===0?<p className="muted">Customer history appears after bookings are created.</p>:<div className="customer-history-grid">{customers.map(row=><article className="customer-history-card" key={row.key}><div><strong>{row.guestName}</strong><small>{row.guestEmail||row.guestPhone||"Guest"}</small></div><span className={row.totalBookings>1?"returning-customer-badge":"first-customer-badge"}>{row.totalBookings>1?"Returning customer":"First booking"}</span><div className="customer-history-metrics"><span><b>{row.totalBookings}</b> bookings</span><span><b>{row.completedBookings}</b> completed</span><span><b>{row.upcomingBookings}</b> upcoming</span><span><b>{row.noShows}</b> no-shows</span></div>{row.lastBooking&&<small>Last booking: {new Date(row.lastBooking).toLocaleDateString()}</small>}{row.services?.length>0&&<p className="muted">Top service: {row.services[0].name} × {row.services[0].count}</p>}</article>)}</div>}
    </section>;
  }

  const canCreate=user.accountStatus==="active";

  return <section id="bookings">
    <div className="stats-grid booking-stats-grid"><article className="stat-card"><span>Total bookings</span><strong>{stats.total}</strong></article><article className="stat-card"><span>Pending</span><strong>{stats.pending}</strong></article><article className="stat-card"><span>Confirmed</span><strong>{stats.confirmed}</strong></article><article className="stat-card"><span>In progress</span><strong>{stats.inProgress}</strong></article><article className="stat-card"><span>Completed</span><strong>{stats.completed}</strong></article></div>
    {error&&<p className="error">{error}</p>}

    <div className="booking-view-tabs"><button className={view==="list"?"filter-chip active":"filter-chip"} onClick={()=>setView("list")}><FiList/>Bookings</button><button className={view==="calendar"?"filter-chip active":"filter-chip"} onClick={()=>setView("calendar")}><FiCalendar/>Calendar</button><button className={view==="customers"?"filter-chip active":"filter-chip"} onClick={()=>setView("customers")}><FiUsers/>Customers</button><button className={view==="availability"?"filter-chip active":"filter-chip"} onClick={()=>setView("availability")}><FiClock/>Availability</button>{canCreate&&<button className="primary-button booking-new-button" onClick={()=>{setEditing(null);setForm(empty);setBookingModalOpen(true);}}><FiPlus/>New booking</button>}</div>

    {view==="availability"&&availability?<section className="panel"><div className="panel-title"><div><p className="eyebrow">AVAILABILITY</p><h2>Booking availability</h2></div></div><div className="availability-days">{availability.workingHours?.map((row,index)=><div className="availability-row" key={row.day}><label><input type="checkbox" checked={row.enabled} onChange={e=>setAvailability({...availability,workingHours:availability.workingHours.map((x,i)=>i===index?{...x,enabled:e.target.checked}:x)})}/>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][row.day]}</label><input type="time" value={row.start} disabled={!row.enabled} onChange={e=>setAvailability({...availability,workingHours:availability.workingHours.map((x,i)=>i===index?{...x,start:e.target.value}:x)})}/><span>to</span><input type="time" value={row.end} disabled={!row.enabled} onChange={e=>setAvailability({...availability,workingHours:availability.workingHours.map((x,i)=>i===index?{...x,end:e.target.value}:x)})}/></div>)}</div><div className="two-col"><label>Minimum notice (minutes)<input type="number" min="0" value={availability.leadTimeMinutes??60} onChange={e=>setAvailability({...availability,leadTimeMinutes:Number(e.target.value)})}/></label><label>Book up to (days)<input type="number" min="1" value={availability.maxAdvanceDays??60} onChange={e=>setAvailability({...availability,maxAdvanceDays:Number(e.target.value)})}/></label></div><label>Blocked dates <span className="muted">comma-separated YYYY-MM-DD</span><input value={(availability.blackoutDates||[]).join(", ")} onChange={e=>setAvailability({...availability,blackoutDates:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label><div className="row-actions"><button className="primary-button" onClick={async()=>{try{const saved=await api.business.update(availability);setAvailability(saved);setError("");}catch(e){setError(e.message);}}}>Save availability</button></div></section>:view==="calendar"?<CalendarView/>:view==="customers"?<CustomerView/>:<>
      <section className="panel booking-filter-bar"><label><span><FiSearch/>Search</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Reference, customer, phone, service…"/></label><label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All statuses</option>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></section>
      <div className="workspace-grid booking-workspace-grid">
        {bookingModalOpen&&<div className="booking-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setBookingModalOpen(false);setEditing(null);setForm(empty);}}}>
        <section className="panel booking-editor-panel booking-modal" role="dialog" aria-modal="true" aria-label={editing?"Edit booking":"New booking"}><div className="panel-title"><h2>{editing?"Edit booking":"New booking"}</h2><button type="button" className="icon-button booking-modal-close" aria-label="Close booking form" onClick={()=>{setBookingModalOpen(false);setEditing(null);setForm(empty);}}><FiX/></button></div>
          {!editing&&!canCreate?<p className="warning-note">New bookings cannot be created while this business is paused.</p>:<form onSubmit={save}>
            <div className="two-col"><label>Guest name<input value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} required/></label><label>Guest email<input type="email" value={form.guestEmail} onChange={e=>setForm({...form,guestEmail:e.target.value})}/></label></div>
            <div className="two-col"><label>Phone number<input type="tel" value={form.guestPhone} onChange={e=>setForm({...form,guestPhone:e.target.value})}/></label><label>Location / service address<input value={form.locationLabel} onChange={e=>setForm({...form,locationLabel:e.target.value})}/></label></div>
            <label>Service<select value={form.contentId} onChange={e=>selectService(e.target.value)}><option value="">Custom / other service</option>{services.map(service=><option key={service._id} value={service._id}>{service.title}</option>)}</select></label>
            {!form.contentId&&<label>Service name<input value={form.service} onChange={e=>setForm({...form,service:e.target.value})} required/></label>}
            <div className="two-col"><label>Service price<input type="number" min="0" step="0.01" value={form.servicePrice} onChange={e=>setForm({...form,servicePrice:e.target.value})} disabled={Boolean(form.contentId)}/></label><label>Currency<input maxLength="3" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3)})} disabled={Boolean(form.contentId)}/></label></div>
            <div className="three-col"><label>Date and time<input type="datetime-local" value={form.bookingDate} onChange={e=>setForm({...form,bookingDate:e.target.value})} required/></label><label>Duration<input type="number" min="5" step="5" value={form.serviceDurationMinutes} onChange={e=>setForm({...form,serviceDurationMinutes:e.target.value})} disabled={Boolean(form.contentId)}/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
            <label>Guest notes<textarea rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
            <label>Internal business notes <span className="muted">not shown to the guest</span><textarea rows="3" maxLength="2000" value={form.internalNotes} onChange={e=>setForm({...form,internalNotes:e.target.value})}/></label>
            <div className="row-actions"><button className="primary-button">{editing?"Save changes":"Create booking"}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(null);setForm(empty);}}>Cancel</button>}</div>
          </form>}
        </section></div>}

        <section className="panel booking-list-panel"><div className="panel-title"><h2>Guest bookings</h2><span className="count">{filtered.length}</span></div><div className="booking-list">
          {filtered.length===0?<p className="muted">No matching bookings.</p>:filtered.map(booking=>{const customer=customerMap.get(customerKey(booking));return <article className="booking-card booking-lifecycle-card" key={booking._id}>
            <div className="booking-main"><div className="booking-reference-line">{booking.bookingReference&&<span>{booking.bookingReference}</span>}{customer?.totalBookings>1&&<span className="returning-customer-badge">Returning · {customer.totalBookings}</span>}</div><h3><Link className="entity-link" to={"/dashboard/bookings/"+booking._id}>{booking.service}</Link></h3><p>{booking.guestName}{booking.guestPhone?` · ${booking.guestPhone}`:""}</p><small><FiClock/> {new Date(booking.bookingDate).toLocaleString()} · {booking.serviceDurationMinutes||60} min · {money(booking.servicePrice,booking.currency)}</small>{booking.status==="completed"&&<small className="sale-recorded-note">Sale recorded when completed</small>}</div>
            <div className="booking-card-right"><span className={"status "+booking.status}>{statuses.find(([value])=>value===booking.status)?.[1]||booking.status}</span><div className="row-actions booking-status-actions">{statusActions(booking)}</div><div className="row-actions booking-secondary-actions"><Link className="secondary button-link small-link" to={"/dashboard/bookings/"+booking._id}>View</Link>{["pending","confirmed","in_progress"].includes(booking.status)&&<button className="secondary" onClick={()=>reschedule(booking)}>Reschedule</button>}<button className="secondary" onClick={()=>edit(booking)}>Edit</button><button className="danger" onClick={()=>remove(booking._id)}>Delete</button></div></div>
          </article>;})}
        </div></section>
      </div>
    </>}
  </section>;
}
