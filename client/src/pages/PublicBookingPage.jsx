import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import { Separator } from "../components/ui/separator.jsx";
import { Input } from "../components/ui/input.jsx";
import { Select } from "../components/ui/select.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Label } from "../components/ui/label.jsx";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { FiCalendar, FiCheck, FiClock, FiMapPin, FiX } from "react-icons/fi";

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

  return <main className="public-shell public-booking-page">
    <Card as="section" className="public-card public-booking-card">
      <CardContent className="public-booking-content">
        <Link className="brand-row" to="/" aria-label="BookFlow home">
          <span className="brand-mark">B</span>
          <strong>BookFlow</strong>
        </Link>

        {error && !page ? (
          <p className="error" role="alert">{error}</p>
        ) : !page ? (
          <p className="muted">Loading booking details…</p>
        ) : (
          <>
            <header className="public-booking-header">
              <p className="eyebrow">PUBLIC BOOKING</p>
              <h1>Book time with {page.owner.name}</h1>
              {selectedService && (
                <Card className="public-booking-service-card">
                  <CardContent className="public-booking-service-content">
                    <div className="public-booking-service-copy">
                      <span className="public-booking-service-label">SELECTED SERVICE</span>
                      <strong>{selectedService.title}</strong>
                      {selectedService.bufferMinutes > 0 && (
                        <small>Includes {selectedService.bufferMinutes} min scheduling buffer</small>
                      )}
                    </div>
                    <div className="public-booking-service-meta">
                      <strong>{money(selectedService.price, selectedService.currency)}</strong>
                      <span>{durationLabel(selectedService.durationMinutes)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              <p className="muted public-booking-timezone-note">
                Times are shown for <strong>{page.scheduling?.timezone || "the business timezone"}</strong>.
                BookFlow only shows slots allowed by the business schedule.
              </p>
            </header>

            <form className="public-booking-form" onSubmit={submit}>
              <section className="public-booking-section" aria-labelledby="public-booking-contact-heading">
                <div className="public-booking-section-heading">
                  <h2 id="public-booking-contact-heading">Your details</h2>
                  <p>Enter your contact information for this booking.</p>
                </div>
                <div className="public-booking-fields">
                  <div className="public-booking-field">
                    <Label htmlFor="public-booking-name">Your name <span className="required-mark">*</span></Label>
                    <Input id="public-booking-name" value={form.guestName} onChange={e=>setForm({...form,guestName:e.target.value})} required autoComplete="name" placeholder="Your full name"/>
                  </div>
                  <div className="public-booking-field">
                    <Label htmlFor="public-booking-email">Email <span className="required-mark">*</span></Label>
                    <Input id="public-booking-email" type="email" value={form.guestEmail} onChange={e=>setForm({...form,guestEmail:e.target.value})} required autoComplete="email" placeholder="you@example.com"/>
                  </div>
                  <div className="public-booking-field">
                    <Label htmlFor="public-booking-phone">Phone number <span className="required-mark">*</span></Label>
                    <Input id="public-booking-phone" type="tel" value={form.guestPhone} onChange={e=>setForm({...form,guestPhone:e.target.value})} placeholder="+63 912 345 6789" required autoComplete="tel"/>
                  </div>
                  <div className="public-booking-field public-booking-field-wide">
                    <Label htmlFor="public-booking-location">Location / service address</Label>
                    <Input id="public-booking-location" value={form.locationLabel} onChange={e=>setForm({...form,locationLabel:e.target.value})} placeholder="Address, barangay, city, or area" autoComplete="street-address" maxLength="200"/>
                  </div>
                </div>

                <div className="public-booking-location-actions">
                  <Button variant="outline" className="public-booking-location-button" type="button" onClick={detectLocation} disabled={locating}>
                    <FiMapPin aria-hidden="true"/>{locating?"Detecting location…":"Use my current location"}
                  </Button>
                  {form.locationLatitude!==null&&form.locationLongitude!==null&&(
                    <Button variant="ghost" type="button" className="public-booking-remove-location" onClick={()=>{
                      setForm(current=>({...current,locationLatitude:null,locationLongitude:null,locationAccuracy:null}));
                      setLocationStatus("Saved coordinates removed. Your typed location is still kept.");
                    }}>
                      <FiX aria-hidden="true"/>Remove detected location
                    </Button>
                  )}
                </div>

                <Card className="public-booking-location-note">
                  <CardContent className="public-booking-note-content">
                    <FiMapPin aria-hidden="true"/>
                    <div>
                      <strong>Location sharing is optional</strong>
                      <p>Location sharing only happens after you press the button and approve your browser’s permission request. You can also enter your address manually.</p>
                    </div>
                  </CardContent>
                </Card>
                {locationStatus&&<p className="public-booking-status" role="status">{locationStatus}</p>}
              </section>

              <Separator className="public-booking-separator"/>

              {!requestedContentId&&(
                <section className="public-booking-section" aria-labelledby="public-booking-service-heading">
                  <div className="public-booking-section-heading">
                    <h2 id="public-booking-service-heading">Service</h2>
                    <p>Choose the service you would like to book.</p>
                  </div>
                  <div className="public-booking-field">
                    <Label htmlFor="public-booking-service">Select a service</Label>
                    <Select id="public-booking-service" value={selectedIndex>=0?String(selectedIndex):"0"} onChange={e=>chooseService(e.target.value)}>
                      {page.services.map((service,index)=>(
                        <option value={index} key={service.id||service.title+"-"+index}>
                          {service.title} — {money(service.price,service.currency)} · {durationLabel(service.durationMinutes)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </section>
              )}

              <section className="public-booking-section" aria-labelledby="public-booking-schedule-heading">
                <div className="public-booking-section-heading">
                  <h2 id="public-booking-schedule-heading">Choose a date and time</h2>
                  <p>Available times are based on the business schedule.</p>
                </div>
                <Card className="public-booking-schedule-card">
                  <CardContent className="public-booking-schedule-content">
                    <div className="public-booking-field">
                      <Label htmlFor="public-booking-date">Choose date <span className="required-mark">*</span></Label>
                      <Input id="public-booking-date" type="date" min={today} value={slotDate} onChange={e=>setSlotDate(e.target.value)} required/>
                    </div>
                    {slotDate&&(
                      <div className="public-booking-slots">
                        <div className="public-booking-slots-heading">
                          <strong>Available times</strong>
                          {slotsLoading&&<span>Checking availability…</span>}
                        </div>
                        {slotsLoading ? (
                          <p className="muted">Checking the business schedule…</p>
                        ) : slots.length===0 ? (
                          <p className="warning-note">No available slots on this date. Choose another day.</p>
                        ) : (
                          <div className="available-slot-grid">
                            {slots.map(slot=>(
                              <Button variant={form.bookingDate===slot.value?"default":"outline"} type="button" key={slot.value} className="slot-button" aria-pressed={form.bookingDate===slot.value} onClick={()=>setForm({...form,bookingDate:slot.value})}>
                                {form.bookingDate===slot.value?<FiCheck aria-hidden="true"/>:<FiClock aria-hidden="true"/>}{slot.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              {(selectedService?.bookingQuestions||[]).length>0&&(
                <>
                  <Separator className="public-booking-separator"/>
                  <section className="public-booking-section" aria-labelledby="public-booking-questions-heading">
                    <div className="public-booking-section-heading">
                      <h2 id="public-booking-questions-heading">Booking details</h2>
                      <p>Please answer the questions for this service.</p>
                    </div>
                    <div className="public-booking-fields">
                      {selectedService.bookingQuestions.map(question=>(
                        <div className="public-booking-field public-booking-field-wide" key={question.id}>
                          <Label>{question.label}{question.required&&" *"}</Label>
                          {question.type==="textarea" ? (
                            <Textarea rows="3" value={form.customAnswers[question.id]||""} onChange={e=>answer(question,e.target.value)} required={question.required}/>
                          ) : question.type==="select" ? (
                            <Select value={form.customAnswers[question.id]||""} onChange={e=>answer(question,e.target.value)} required={question.required}>
                              <option value="">Choose…</option>
                              {(question.options||[]).map(option=><option key={option}>{option}</option>)}
                            </Select>
                          ) : question.type==="checkbox" ? (
                            <label className="public-booking-checkbox-row">
                              <Input type="checkbox" checked={Boolean(form.customAnswers[question.id])} onChange={e=>answer(question,e.target.checked)}/>
                              <span>Yes</span>
                            </label>
                          ) : (
                            <Input value={form.customAnswers[question.id]||""} onChange={e=>answer(question,e.target.value)} required={question.required}/>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              <Separator className="public-booking-separator"/>

              <section className="public-booking-section" aria-labelledby="public-booking-notes-heading">
                <div className="public-booking-section-heading">
                  <h2 id="public-booking-notes-heading">Notes</h2>
                  <p>Add any extra information for the business (optional).</p>
                </div>
                <Textarea id="public-booking-notes" rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Share access instructions or any details the business should know."/>
              </section>

              <Card className="public-booking-history-card">
                <CardContent className="public-booking-note-content">
                  <FiCalendar aria-hidden="true"/>
                  <div>
                    <strong>Booking History</strong>
                    <p>{user?.role==="business" ? "This booking will be saved to your Booking History." : <>Sign in with your BookFlow business account to save this booking to your Booking History. <Link to="/login">Sign in</Link></>}</p>
                  </div>
                </CardContent>
              </Card>

              {error&&<p className="error" role="alert">{error}</p>}
              {message&&(
                <Card className="public-booking-success-card" role="status">
                  <CardContent className="public-booking-note-content">
                    <FiCheck aria-hidden="true"/>
                    <div>
                      <strong>{message}</strong>
                      {reference&&<p className="booking-reference-success">Reference: {reference}</p>}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button type="submit" variant="default" className="public-booking-submit" disabled={!form.bookingDate}>
                <FiCalendar aria-hidden="true"/>Request booking
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  </main>;
}
