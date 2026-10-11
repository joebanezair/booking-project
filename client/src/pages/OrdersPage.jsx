import { Card } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Select } from "../components/ui/select.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Label } from "../components/ui/label.jsx";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "../components/AppLayout.jsx"; import { api } from "../api.js";
const statuses=["pending","confirmed","processing","ready","out_for_delivery","completed","cancelled"];
const methods=["cash","gcash","maya","bank_transfer","other"];
export default function OrdersPage({user,onLogout}){
 const [orders,setOrders]=useState([]),[filter,setFilter]=useState("all"),[error,setError]=useState(""),[paying,setPaying]=useState(null);
 const load=()=>api.sales.orders().then(setOrders).catch(e=>setError(e.message)); useEffect(load,[]);
 const shown=useMemo(()=>filter==="all"?orders:orders.filter(o=>o.status===filter),[orders,filter]);
 async function status(id,status){try{await api.sales.setOrderStatus(id,status);load();}catch(e){setError(e.message)}}
 async function payment(e){e.preventDefault();const fd=new FormData(e.currentTarget);try{await api.sales.recordOrderPayment(paying._id,{paymentMethod:fd.get("method"),amountPaid:Number(fd.get("amount")),paymentReference:fd.get("reference"),paymentNotes:fd.get("notes")});setPaying(null);load();}catch(err){setError(err.message)}}
 return <AppLayout user={user} onLogout={onLogout}><header className="topbar"><div><p className="eyebrow">ORDERS</p><h1>Product orders</h1><p className="muted">Manage fulfillment and record manual payments without a payment API.</p></div></header>
 <div className="order-filter-row">{["all",...statuses].map(s=><Button variant="plain" className={filter===s?"active":""} onClick={()=>setFilter(s)} key={s}>{s.replaceAll("_"," ")}</Button>)}</div>{error&&<p className="error">{error}</p>}
 <section className="order-grid">{shown.map(o=><Card as="article" className="panel order-card" key={o._id}><div className="order-card-head"><div><strong>{o.orderNumber}</strong><p>{o.customerName}</p></div><span>{o.paymentStatus||"unpaid"}</span></div><p>{o.items?.map(i=>i.name+" × "+i.quantity).join(", ")}</p><strong>{new Intl.NumberFormat("en-PH",{style:"currency",currency:o.currency||"PHP"}).format(o.total||0)}</strong><div className="order-actions"><Select value={o.status} onChange={e=>status(o._id,e.target.value)}>{statuses.map(s=><option value={s} key={s}>{s.replaceAll("_"," ")}</option>)}</Select><Button variant="plain" onClick={()=>setPaying(o)}>Record payment</Button></div></Card>)}</section>
 {paying&&<div className="modal-backdrop"><form className="panel manual-payment-modal" onSubmit={payment}><h2>Record manual payment</h2><p>{paying.orderNumber} · Total {paying.total} {paying.currency}</p><Label>Method<Select name="method" defaultValue={paying.paymentMethod||"cash"}>{methods.map(m=><option value={m} key={m}>{m.replaceAll("_"," ")}</option>)}</Select></Label><Label>Amount<Input name="amount" type="number" min="0" step="0.01" defaultValue={paying.amountPaid||paying.total}/></Label><Label>Reference<Input name="reference" defaultValue={paying.paymentReference||""} placeholder="Optional reference"/></Label><Label>Notes<Textarea name="notes" defaultValue={paying.paymentNotes||""}/></Label><div className="row-actions"><Button variant="plain" type="button" onClick={()=>setPaying(null)}>Cancel</Button><Button variant="plain" type="submit">Save payment</Button></div></form></div>}</AppLayout>;
}