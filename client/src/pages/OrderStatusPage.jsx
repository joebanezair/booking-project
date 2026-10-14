import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiChevronLeft, FiChevronRight, FiExternalLink, FiPackage, FiRefreshCw, FiTruck, FiX } from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import { Image } from "../components/ui/image.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog.jsx";
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
  const [selectedItemIndex,setSelectedItemIndex]=useState(null);
  const [activeImageIndex,setActiveImageIndex]=useState(0);

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
  const selectedItem=selectedItemIndex===null?null:order?.items?.[selectedItemIndex];
  const selectedImages=selectedItem?.images||[];
  const shownImageIndex=Math.min(activeImageIndex,Math.max(0,selectedImages.length-1));
  return <main className="public-shell buyer-order-status-page">
    <section className="public-card buyer-status-card">
      <header className="buyer-status-header">
        <Link className="brand-row" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link>
        <Button type="button" variant="outline" onClick={refresh} disabled={refreshing}><FiRefreshCw aria-hidden="true"/>{refreshing?"Refreshing...":"Refresh status"}</Button>
      </header>
      <div className="buyer-status-intro">
        <p className="eyebrow">MY ORDER</p>
        <h1>Order status</h1>
        <p className="muted">Track your order, delivery, and courier updates in one place.</p>
      </div>
      {loading&&!order&&<p role="status">Loading your order...</p>}
      {error&&<p role="alert" className="error">{error}</p>}
      {order&&<>
        <div className="buyer-order-summary">
          <div><small>Order reference</small><strong>{order.orderNumber}</strong></div>
          <span className={"buyer-status-pill"+(cancelled?" cancelled":"")}>{names[order.status]||order.status}</span>
        </div>
        <section className="buyer-order-section buyer-order-progress">
          <div className="buyer-order-progress-head">
            <h2>Order progress</h2>
            {!cancelled && <span className="buyer-order-progress-count">{Math.max(0,current+1)} of {phases.length} steps</span>}
          </div>
          {cancelled?<p className="buyer-order-cancelled">This order was cancelled. Contact the seller for more information.</p>:
          <ol className="buyer-order-timeline" aria-label="Order fulfillment progress">{phases.map((phase,index)=>{
            const done=index<=current;
            const isCurrent=phase===order.status;
            return <li key={phase} className={isCurrent?"is-done is-current":done?"is-done":"is-upcoming"} aria-current={isCurrent?"step":undefined}>
              <span className="buyer-order-phase-icon" aria-hidden="true">{done?<FiCheck/>:index+1}</span>
              <div className="buyer-order-phase-text">
                <strong>{names[phase]}</strong>
                {isCurrent&&<small>Current status</small>}
              </div>
            </li>;
          })}</ol>}
          <p className="muted buyer-order-updated">Last updated {new Date(order.updatedAt||order.createdAt).toLocaleString()}</p>
        </section>
        <div className="buyer-order-details-grid">
        <section className="buyer-order-section buyer-order-details-panel">
          <h2><FiTruck aria-hidden="true"/> Courier details</h2>
          {order.courierName||order.trackingNumber||order.trackingUrl?
            <dl className="buyer-order-courier">
              {order.courierName&&<div><dt>Courier</dt><dd>{order.courierName}</dd></div>}
              {order.trackingNumber&&<div><dt>Tracking number</dt><dd>{order.trackingNumber}</dd></div>}
              {order.trackingUrl&&<div><dt>Courier website</dt><dd><a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">Track shipment <FiExternalLink aria-hidden="true"/></a></dd></div>}
            </dl>
          :<p className="muted">The seller has not added courier details yet.</p>}
        </section>
        <section className="buyer-order-section buyer-order-details-panel">
          <h2><FiPackage aria-hidden="true"/> Order items</h2>
          <div className="buyer-order-items">{(order.items||[]).map((item,index)=>
            <button key={index} type="button" className="buyer-order-item" aria-label={`View product details for ${item.name}`}
              onClick={()=>{setSelectedItemIndex(index);setActiveImageIndex(0);}}>
              <span className="buyer-order-item-thumb">
                {item.images?.length?<Image src={item.images[0]} alt="" loading="lazy"/>:<FiPackage aria-hidden="true"/>}
              </span>
              <span className="buyer-order-item-info">
                <span className="buyer-order-item-name">{item.name}</span>
                <small>Quantity: {item.quantity}</small>
                <span className="buyer-order-item-link">View product details</span>
              </span>
              <strong className="buyer-order-item-price">{money(item.lineTotal,order.currency)}</strong>
              <FiChevronRight className="buyer-order-item-chevron" aria-hidden="true"/>
            </button>)}</div>
          <div className="buyer-order-grand-total"><span>Total</span><strong>{money(order.total,order.currency)}</strong></div>
        </section>
        </div>
        <Dialog title="Product details" className="buyer-product-dialog" open={Boolean(selectedItem)}
          onOpenChange={open=>{if(!open)setSelectedItemIndex(null);}}>
          <DialogContent className="buyer-product-dialog-content">
            <DialogHeader className="buyer-product-dialog-heading">
              <div>
                <p className="eyebrow">ORDERED PRODUCT</p>
                <DialogTitle>{selectedItem?.name}</DialogTitle>
                <DialogDescription>Product information and images from the seller.</DialogDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close product details"
                onClick={()=>setSelectedItemIndex(null)}><FiX aria-hidden="true"/></Button>
            </DialogHeader>
            {selectedItem&&<>
              <div className="buyer-product-gallery">
                <div className="buyer-product-photo">
                  {selectedImages.length?<Image src={selectedImages[shownImageIndex]} alt={`${selectedItem.name} — image ${shownImageIndex+1}`}/>:
                    <span className="buyer-product-photo-empty"><FiPackage aria-hidden="true"/>No product images available</span>}
                  {selectedImages.length>1&&<div className="buyer-product-photo-controls">
                    <Button type="button" variant="outline" size="icon" aria-label="Previous product image"
                      onClick={()=>setActiveImageIndex(i=>(i+selectedImages.length-1)%selectedImages.length)}><FiChevronLeft aria-hidden="true"/></Button>
                    <span aria-live="polite">{shownImageIndex+1} / {selectedImages.length}</span>
                    <Button type="button" variant="outline" size="icon" aria-label="Next product image"
                      onClick={()=>setActiveImageIndex(i=>(i+1)%selectedImages.length)}><FiChevronRight aria-hidden="true"/></Button>
                  </div>}
                </div>
                {selectedImages.length>1&&<div className="buyer-product-thumbnails" aria-label="Product image gallery">
                  {selectedImages.map((src,index)=><button type="button" key={index}
                    aria-label={`View image ${index+1} of ${selectedItem.name}`} aria-pressed={index===shownImageIndex}
                    onClick={()=>setActiveImageIndex(index)}><Image src={src} alt="" loading="lazy"/></button>)}
                </div>}
              </div>
              <section className="buyer-product-description">
                <h3>Description</h3>
                <p>{selectedItem.description||"No product description is available."}</p>
              </section>
              <dl className="buyer-product-facts">
                {selectedItem.sku&&<div><dt>SKU</dt><dd>{selectedItem.sku}</dd></div>}
                <div><dt>Ordered quantity</dt><dd>{selectedItem.quantity}</dd></div>
                <div><dt>Unit price at order</dt><dd>{money(selectedItem.unitPrice,order.currency)}</dd></div>
                <div><dt>Subtotal</dt><dd>{money(selectedItem.lineTotal,order.currency)}</dd></div>
              </dl>
              <DialogFooter><Button type="button" variant="outline" onClick={()=>setSelectedItemIndex(null)}>Back to order</Button></DialogFooter>
            </>}
          </DialogContent>
        </Dialog>
        <p className="muted buyer-order-note">Keep this link private. Status refreshes every 30 seconds, or you can refresh it manually.</p>
      </>}
      <Link to="/search" className="buyer-order-back"><FiArrowLeft aria-hidden="true"/> Browse BookFlow</Link>
    </section>
  </main>;
}
