import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiExternalLink, FiPackage, FiRefreshCw, FiTruck } from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import { api } from "../api.js";

const phases=["pending","confirmed","processing","ready","out_for_delivery","completed"];
const names={pending:"Order placed",confirmed:"Confirmed",processing:"Processing",
  ready:"Ready",out_for_delivery:"Out for delivery",completed:"Completed",cancelled:"Cancelled"};
function money(value,currency){
  try{return new Intl.NumberFormat("en-PH",{style:"currency",currency:currency||"PHP"}).format(Number(value||0));}
  catch{return String(Number(value||0).toFixed(2))+" "+(currency||"PHP");}
}

export default function OrderStatusPage(){
  const {orderId}=useParams();
  const [token]=useState(()=>window.location.hash.slice(1));
  const [order,setOrder]=useState(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    if(!/^[0-9a-f]{64}$/.test(token)){setError("This tracking link is missing its secure key. Ask the vendor for a new link.");setLoading(false);return;}
    setRefreshing(true);
    try{
      const result=await api.publicOrderStatus(orderId,token);
      setOrder(result);setError("");
    }catch(e){setError(e.message);}
    finally{setRefreshing(false);setLoading(false);}
  },[orderId,token]);

  useEffect(()=>{
    refresh();
    const interval=window.setInterval(refresh,30000);
    return ()=>window.clearInterval(interval);
  },[refresh]);

  const current=phases.indexOf(order?.status);
  const cancelled=order?.status==="cancelled";
  return <main className="public-shell buyer-order-status-page">
    <section className="public-card buyer-status-card">
      <header className="buyer-status-header">
        <Link className="brand-row" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link>
        <Button type="button" variant="outline" onClick={refresh} disabled={refreshing}><FiRefreshCw aria-hidden="true"/>{refreshing?"Refreshing...":"Refresh status"}</Button>
      </header>
      <p className="eyebrow">MY ORDER</p>
      <h1>Order status</h1>
      <p className="muted">Check your order's progress, details, and courier updates.</p>
      {loading&&!order&&<p role="status">Loading your order...</p>}
      {error&&<p role="alert" className="error">{error}</p>}
      {order&&<>
        <div className="buyer-order-summary">
          <div><small>Order reference</small><strong>{order.orderNumber}</strong></div>
          <span className={"buyer-status-pill"+(cancelled?" cancelled":"")}>{names[order.status]||order.status}</span>
        </div>
        <section className="buyer-order-section">
          <h2>Order progress</h2>
          {cancelled?<p className="buyer-order-cancelled">This order was cancelled. Contact the seller for more information.</p>:
          <ol className="buyer-order-timeline">{phases.map((phase,index)=>{
            const done=index<=current;
            return <li key={phase} className={done?"is-done":""}>
              <span className="buyer-order-phase-icon">{done?<FiCheck aria-hidden="true"/>:index+1}</span>
              <div><strong>{names[phase]}</strong>{phase===order.status&&<small>Current status</small>}</div>
            </li>;
          })}</ol>}
          <p className="muted buyer-order-updated">Last updated {new Date(order.updatedAt||order.createdAt).toLocaleString()}</p>
        </section>
        <section className="buyer-order-section">
          <h2><FiTruck aria-hidden="true"/> Courier details</h2>
          {order.courierName||order.trackingNumber||order.trackingUrl?
            <dl className="buyer-order-courier">
              {order.courierName&&<div><dt>Courier</dt><dd>{order.courierName}</dd></div>}
              {order.trackingNumber&&<div><dt>Tracking number</dt><dd>{order.trackingNumber}</dd></div>}
              {order.trackingUrl&&<div><dt>Courier website</dt><dd><a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">Track shipment <FiExternalLink aria-hidden="true"/></a></dd></div>}
            </dl>
          :<p className="muted">The seller has not added courier details yet.</p>}
        </section>
        <section className="buyer-order-section">
          <h2><FiPackage aria-hidden="true"/> Order items</h2>
          <div className="buyer-order-items">{(order.items||[]).map((item,index)=>
            <div key={index}><span>{item.name} × {item.quantity}</span><strong>{money(item.lineTotal,order.currency)}</strong></div>)}</div>
          <div className="buyer-order-grand-total"><span>Total</span><strong>{money(order.total,order.currency)}</strong></div>
        </section>
        <p className="muted buyer-order-note">Keep this link private. Status refreshes every 30 seconds, or you can refresh it manually.</p>
      </>}
      <Link to="/search" className="buyer-order-back"><FiArrowLeft aria-hidden="true"/> Browse BookFlow</Link>
    </section>
  </main>;
}
