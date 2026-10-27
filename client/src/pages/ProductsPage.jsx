import { Card } from "../components/ui/card.jsx";
import { SearchField } from "../components/ui/search-field.jsx";
import { Dialog, DialogContent } from "../components/ui/dialog.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Select } from "../components/ui/select.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Label } from "../components/ui/label.jsx";
import { Image } from "../components/ui/image.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowRight, FiBarChart2, FiCheckCircle, FiChevronDown, FiChevronRight, FiEdit2, FiGrid, FiList, FiMinus, FiMoreHorizontal, FiPackage, FiPlus, FiSearch, FiShoppingBag, FiShoppingCart, FiTrash2, FiUploadCloud, FiX } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import { api } from "../api.js";

function money(value,currency="PHP"){try{return new Intl.NumberFormat(undefined,{style:"currency",currency,maximumFractionDigits:2}).format(value||0);}catch{return `${currency} ${Number(value||0).toLocaleString()}`;}}
const blank={name:"",sku:"",description:"",price:"",unitCost:"",currency:"PHP",stock:"",published:true,images:[]};
function readProductImages(files,current,done){const remaining=Math.max(0,8-(current||[]).length);const selected=Array.from(files||[]).filter(file=>file.type.startsWith("image/")).slice(0,remaining);if(!selected.length)return;Promise.all(selected.map(file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);}))).then(images=>done([...(current||[]),...images]));}


// POS revenue uses checkout records. For legacy lines without unit-cost snapshots,
// the backend estimates cost from the current product only when the owner and
// currency still match; estimates are identified rather than presented as facts.
function PosEarningsPanel({ report, loading, error, range, onRangeChange, onRetry, products }) {
  const currencies = report?.currencies || [];
  const [selectedCurrency, setSelectedCurrency] = useState("PHP");
  const current = currencies.find(row => row.currency === selectedCurrency) || currencies[0];
  const currency = current?.currency || selectedCurrency;
  const rows = (report?.products || []).filter(row => row.currency === currency);
  const revenue = Number(current?.revenue || 0);
  const cost = current?.cost;
  const earnings = current?.grossEarnings;
  const complete = typeof cost === "number" && typeof earnings === "number";
  const positivePie = complete && earnings >= 0 && revenue > 0;
  const costAngle = positivePie ? Math.min(360, Math.max(0, cost / revenue * 360)) : 0;
  const unknownUnits = Number(current?.unknownCostUnits || 0);
  const estimatedUnits = Number(current?.estimatedUnits || 0);
  const unresolvedUnits = Number(current?.unresolvedCostUnits || 0);
  const isEstimate = Boolean(current?.isEstimate);

  return <section className="panel pos-earnings-panel" id="pos-charts" aria-labelledby="pos-charts-heading">
    <div className="pos-earnings-heading">
      <div>
        <p className="eyebrow">POS ANALYTICS</p>
        <h2 id="pos-charts-heading">Revenue &amp; earnings</h2>
        <p className="muted">In-store POS sales, unit costs and gross earnings by product.</p>
      </div>
      <div className="pos-earnings-controls">
        <Select aria-label="POS reporting period" value={range} onChange={e => onRangeChange(e.target.value)}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </Select>
        {currencies.length > 1 && <Select aria-label="POS reporting currency" value={currency}
          onChange={e => setSelectedCurrency(e.target.value)}>
          {currencies.map(item => <option key={item.currency} value={item.currency}>{item.currency}</option>)}
        </Select>}
      </div>
    </div>
    {loading ? <p className="muted" role="status">Loading POS earnings…</p> :
      error ? <div className="pos-earnings-note" role="alert">{error}
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </div> : <>
        <div className="pos-earnings-summary">
          <div><span>Total POS sales</span><strong>{money(revenue,currency)}</strong><small>Recorded checkout revenue</small></div>
          <div><span>Product costs</span><strong>{complete ? money(cost,currency) : "—"}</strong><small>{!complete ? "Unit cost missing for some sales" : isEstimate ? "Includes estimated historical costs" : "Cost of units sold"}</small></div>
          <div><span>Gross earnings</span><strong>{complete ? money(earnings,currency) : "—"}</strong><small>{isEstimate ? "Estimate · sales minus unit costs" : "Sales minus product costs"}</small></div>
          <div><span>Units sold</span><strong>{Number(current?.unitsSold || 0).toLocaleString()}</strong><small>Completed POS quantities</small></div>
        </div>
        <div className="pos-earnings-bottom">
          <div className="pos-earnings-pie-card">
            <div className="pos-earnings-subheading">
              <h3>Cost vs earnings</h3>
              <p className="muted">How completed POS revenue is distributed</p>
            </div>
            {positivePie ? <>
              <div className="pos-earnings-donut" role="img"
                aria-label={"Product costs " + money(cost,currency) + "; gross earnings " + money(earnings,currency)}
                style={{"--cost-angle":String(costAngle)+"deg"}}>
                <div className="pos-earnings-donut-center"><small>{isEstimate ? "Est. earnings" : "Gross earnings"}</small><strong>{money(earnings,currency)}</strong></div>
              </div>
              <div className="pos-earnings-legend">
                <div><i className="pos-earnings-dot is-cost" aria-hidden="true"/>Product costs{isEstimate ? " (est.)" : ""} <strong>{money(cost,currency)}</strong></div>
                <div><i className="pos-earnings-dot is-profit" aria-hidden="true"/>Gross earnings{isEstimate ? " (est.)" : ""} <strong>{money(earnings,currency)}</strong></div>
              </div>
            </> : <div className="pos-earnings-chart-empty">
              <FiBarChart2 aria-hidden="true"/>
              <p>{!revenue ? "No POS sales in this period." :
                !complete ? "Set a unit cost for each product with missing historical costs to see estimated earnings." :
                "Product costs exceed revenue. Gross earnings are negative."}</p>
            </div>}
            {estimatedUnits > 0 && <p className="pos-earnings-explanation" role="note">
              <strong>Estimated:</strong> {estimatedUnits.toLocaleString()} earlier unit(s) had no saved cost. Their cost is calculated using each product's current unit cost; the original sale records are unchanged.
            </p>}
            {unresolvedUnits > 0 && <p className="pos-earnings-explanation" role="note">
              {unresolvedUnits.toLocaleString()} unit(s) still have no usable cost. Add an initial cost to those products to display estimated totals.
            </p>}
          </div>
          <div className="pos-earnings-products">
            <div className="pos-earnings-subheading">
              <h3>Earnings per product</h3>
              <p className="muted">Recorded unit costs and clearly marked estimates for earlier sales</p>
            </div>
            <div className="pos-earnings-table-wrap">
              <table className="pos-earnings-table">
                <thead><tr><th scope="col">Product</th><th scope="col">Sold</th><th scope="col">Unit cost now</th><th scope="col">Sales</th><th scope="col">Gross earnings</th></tr></thead>
                <tbody>{rows.length ? rows.map(item => {
                  const currentProduct = products.find(product => product._id === item.productId);
                  return <tr key={item.productId + ":" + item.currency}>
                    <td>{item.name}</td>
                    <td>{Number(item.unitsSold || 0).toLocaleString()}</td>
                    <td>{currentProduct?.unitCost == null ? "Not set" : money(currentProduct.unitCost,currency)}</td>
                    <td>{money(item.revenue,currency)}</td>
                    <td>{typeof item.grossEarnings === "number" ? <>{money(item.grossEarnings,currency)}{item.isEstimate && <small className="pos-earnings-estimated-label"> Estimated</small>}</> : "Not available"}</td>
                  </tr>;
                }) : <tr><td colSpan="5" className="pos-earnings-table-empty">No POS sales recorded for this period.</td></tr>}</tbody>
              </table>
            </div>
            <p className="pos-earnings-explanation">Unit cost now is the optional cost saved on each product. Newer sales use the cost captured at checkout; older sales without a saved cost are estimated using today’s cost, if available. Estimates never overwrite previous transactions. Gross earnings exclude other operating expenses and online orders.</p>
          </div>
        </div>
      </>}
  </section>;
}

export default function ProductsPage({user,onLogout}){
  const [products,setProducts]=useState([]);
  const [form,setForm]=useState(blank);
  const [creating,setCreating]=useState(false);
  const [creatingBusy,setCreatingBusy]=useState(false);
  const [editing,setEditing]=useState(null);
  const [selected,setSelected]=useState(null);
  const [quantity,setQuantity]=useState(1);
  const [cart,setCart]=useState({});
  const [paymentMethod,setPaymentMethod]=useState("cash");
  const [customerName,setCustomerName]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [checkoutSuccess,setCheckoutSuccess]=useState(null);
  const [search,setSearch]=useState("");
  const [cartSearch,setCartSearch]=useState("");
  const [cartOpen,setCartOpen]=useState(true);
  const [confirmCheckout,setConfirmCheckout]=useState(false);
  const [checkoutBusy,setCheckoutBusy]=useState(false);
  const checkoutLock=useRef(false);
  const [productView,setProductView]=useState("grid");
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [productMenu,setProductMenu]=useState(null);
  const [section,setSection]=useState(() => window.location.hash==="#pos-charts"?"charts":"inventory");
  const [compactPos,setCompactPos]=useState(() => window.matchMedia("(max-width: 1023px)").matches);
  const [posPopupOpen,setPosPopupOpen]=useState(false);
  const posCartRef=useRef(null);
  const popupTriggerRef=useRef(null);
  const [posRange,setPosRange]=useState("all");
  const [posReport,setPosReport]=useState(null);
  const [posReportLoading,setPosReportLoading]=useState(false);
  const [posReportError,setPosReportError]=useState("");
  const [posReportRevision,setPosReportRevision]=useState(0);

  useEffect(() => {
    const matcher=window.matchMedia("(max-width: 1023px)");
    const changed=event => {
      setCompactPos(event.matches);
      if(!event.matches)setPosPopupOpen(false);
    };
    matcher.addEventListener("change",changed);
    return () => matcher.removeEventListener("change",changed);
  }, []);
  useEffect(() => {
    const syncHash=() => {
      const next=window.location.hash==="#pos-charts"?"charts":"inventory";
      setSection(next);
      if(next==="charts")setPosPopupOpen(false);
    };
    window.addEventListener("hashchange",syncHash);
    window.addEventListener("popstate",syncHash);
    return () => { window.removeEventListener("hashchange",syncHash); window.removeEventListener("popstate",syncHash); };
  }, []);
  useEffect(() => {
    if(!posPopupOpen || !compactPos)return;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKeyDown=event => {
      if(event.key==="Escape"){setPosPopupOpen(false);popupTriggerRef.current?.focus();}
      if(event.key==="Tab"){
        const panel=posCartRef.current;
        const items=panel?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]');
        if(!items?.length)return;
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",onKeyDown);
    requestAnimationFrame(()=>posCartRef.current?.querySelector(".pos-cart-dismiss")?.focus());
    return () => {document.body.style.overflow=oldOverflow;document.removeEventListener("keydown",onKeyDown);};
  },[posPopupOpen,compactPos]);
  useEffect(() => {
    if(section!=="charts")return;
    let cancelled=false;
    setPosReportLoading(true);
    setPosReportError("");
    api.sales.posEarnings(posRange)
      .then(data=>{if(!cancelled)setPosReport(data);})
      .catch(err=>{if(!cancelled){setPosReport(null);setPosReportError(err.message||"Unable to load POS earnings.");}})
      .finally(()=>{if(!cancelled)setPosReportLoading(false);});
    return ()=>{cancelled=true;};
  },[section,posRange,posReportRevision]);

  function openPosPopup() {
    // The cart button stays usable on tablet/mobile while viewing POS Charts.
    // Inventory must be mounted underneath the checkout popup.
    if(section==="charts"){
      setSection("inventory");
      window.location.hash="inventory";
    }
    setPosPopupOpen(true);
  }
  function closePosPopup() {
    setPosPopupOpen(false);
    popupTriggerRef.current?.focus();
  }
  function navigateProducts(next) {
    const target=next==="pos-charts"?"charts":"inventory";
    setPosPopupOpen(false);
    setSection(target);
    if(window.location.hash!==`#${next}`)window.location.hash=next;
  }

  async function refresh(){setProducts(await api.sales.products());}
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);

  async function addProduct(e){
    e.preventDefault();
    if(creatingBusy)return;
    setCreatingBusy(true);
    setError("");
    try{
      const item=await api.sales.createProduct(form);
      setProducts(v=>[item,...v]);
      setForm(blank);
      setCreating(false);
      setMessage("Product created.");
    }catch(e){setError(e.message);}
    finally{setCreatingBusy(false);}
  }
  async function saveProduct(e){e.preventDefault();try{const item=await api.sales.updateProduct(editing._id,editing);setProducts(v=>v.map(x=>x._id===item._id?item:x));setEditing(null);setMessage("Product updated.");setError("");}catch(e){setError(e.message);}}
  async function removeProduct(item){try{await api.sales.removeProduct(item._id);setProducts(v=>v.filter(x=>x._id!==item._id));setCart(v=>{const next={...v};delete next[item._id];return next;});setDeleteTarget(null);setMessage("Product deleted.");}catch(e){setError(e.message);}}

  function openProduct(item){if(item.stock<=0)return;setSelected(item);setQuantity(Math.max(1,Number(cart[item._id]||1)));}
  function addToCart(){if(!selected)return;const qty=Math.min(Number(selected.stock||0),Math.max(1,Number(quantity||1)));setCart(v=>({...v,[selected._id]:qty}));setSelected(null);setMessage(`${selected.name} added to cart.`);}
  function changeCart(id,next,stock){const qty=Math.min(Number(stock||0),Math.max(0,Number(next||0)));setCart(v=>{const copy={...v};if(qty<=0)delete copy[id];else copy[id]=qty;return copy;});}

  const filteredProducts=useMemo(()=>{const q=search.trim().toLowerCase();return q?products.filter(item=>[item.name,item.sku,item.description,item.currency].some(value=>String(value||"").toLowerCase().includes(q))):products;},[products,search]);
  const cartLines=useMemo(()=>products.filter(p=>Number(cart[p._id]||0)>0).map(p=>({...p,quantity:Number(cart[p._id])})),[products,cart]);
  const filteredCartLines=useMemo(()=>{const q=cartSearch.trim().toLowerCase();return q?cartLines.filter(item=>[item.name,item.sku,item.description].some(value=>String(value||"").toLowerCase().includes(q))):cartLines;},[cartLines,cartSearch]);
  const currency=cartLines[0]?.currency||"PHP";
  const cartTotal=cartLines.reduce((sum,p)=>sum+Number(p.price||0)*p.quantity,0);

  async function checkout(){
    if(checkoutLock.current)return;
    if(!cartLines.length)return setError("Add a product to your cart first.");
    checkoutLock.current=true;
    setCheckoutBusy(true);
    setError("");
    try{
      const sale=await api.sales.checkout({items:cartLines.map(p=>({productId:p._id,quantity:p.quantity})),paymentMethod,customerName});
      setCart({});
      setCustomerName("");
      setCartSearch("");
      setConfirmCheckout(false);
      setMessage("");
      setCheckoutSuccess({invoiceNumber:sale.invoiceNumber});
      setPosReportRevision(v=>v+1);
      if(posPopupOpen)closePosPopup();
      // Show the success dialog immediately; refresh inventory without delaying it.
      void refresh().catch(()=>setError("Checkout succeeded, but inventory could not be refreshed. Please reload the page."));
    }catch(e){
      setError(e.message);
    }finally{
      checkoutLock.current=false;
      setCheckoutBusy(false);
    }
  }

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar products-pos-header"><div><p className="eyebrow">PRODUCTS & POS</p><h1>Products</h1><p className="muted">Manage inventory, select products, add quantities to the cart, and check out in-store sales.</p></div>
      <div className="pos-header-cart-actions">
        <div className="cart-header-badge pos-desktop-cart"><FiShoppingCart/><strong>{cartLines.reduce((sum,item)=>sum+item.quantity,0)}</strong><span>{money(cartTotal,currency)}</span></div>
        <Button ref={popupTriggerRef} variant="outline" type="button" className="pos-responsive-cart-button"
          aria-label="Open POS checkout" aria-haspopup="dialog" aria-expanded={posPopupOpen}
          onClick={openPosPopup}><FiShoppingCart aria-hidden="true"/><span>Cart ({cartLines.reduce((sum,item)=>sum+item.quantity,0)})</span><strong>{money(cartTotal,currency)}</strong></Button>
      </div></header>
    <nav className="products-pos-breadcrumb" aria-label="Products sections">
      <Button variant="ghost" type="button" className={section==="inventory"?"is-active":""}
        aria-current={section==="inventory"?"page":undefined} onClick={()=>navigateProducts("inventory")}>
        <FiPackage aria-hidden="true"/>Products
      </Button>
      <FiChevronRight aria-hidden="true"/>
      <Button variant="ghost" type="button" className={section==="charts"?"is-active":""}
        aria-current={section==="charts"?"page":undefined} onClick={()=>navigateProducts("pos-charts")}>
        <FiBarChart2 aria-hidden="true"/>POS Charts
      </Button>
    </nav>
    {error&&<p className="error">{error}</p>}{message&&<p className="success products-pos-success" role="status"><FiCheckCircle aria-hidden="true"/><span>{message}</span></p>}

    {section==="charts" ? <PosEarningsPanel report={posReport} loading={posReportLoading} error={posReportError}
      range={posRange} onRangeChange={setPosRange} onRetry={()=>setPosReportRevision(v=>v+1)} products={products}/> : <div className="products-page-grid">
      <section className="panel" id="inventory">
        <div className="panel-title"><div><p className="eyebrow product-catalog-label">CATALOG</p><h2 className="product-inventory-title">Product inventory</h2></div><div className="row-actions product-toolbar"><Button variant="plain" type="button" className="icon-action product-add-icon" aria-label="Add product" data-tooltip="Add product" onClick={()=>{setForm(blank);setError("");setCreating(true);}}><FiPlus/><span className="product-add-label"><span className="product-add-short">Add</span><span className="product-add-full"> Product</span></span></Button><div className="product-view-toggle" role="group" aria-label="Product view"><Button variant="plain" type="button" className={"icon-action "+(productView==="grid"?"active":"")} aria-label="Grid view" data-tooltip="Grid view" aria-pressed={productView==="grid"} onClick={()=>setProductView("grid")}><FiGrid/></Button><Button variant="plain" type="button" className={"icon-action "+(productView==="list"?"active":"")} aria-label="List view" data-tooltip="List view" aria-pressed={productView==="list"} onClick={()=>setProductView("list")}><FiList/></Button></div><span className="count product-count-icon" aria-label={`${products.length} products`} data-tooltip={`${products.length} products`}><FiShoppingBag/><strong>{products.length}</strong></span></div></div>
        <SearchField className="product-ui-search" value={search} onValueChange={setSearch} placeholder="Search products..." aria-label="Search products" />{filteredProducts.length===0&&search?<p className="muted search-empty">No products match “{search}”.</p>:<div className={"product-shop-grid "+(productView==="list"?"product-shop-list":"")}>{filteredProducts.map(item=><Card as="article" key={item._id} className={"product-shop-card product-inventory-tile "+(item.stock<=0?"out-of-stock":"")}><Button type="button" variant="plain" className="product-card-primary" disabled={item.stock<=0} aria-label={`Select ${item.name} for checkout`} onClick={()=>openProduct(item)}>
          <div className="product-shop-image">{(item.images?.[0]||item.image)?<Image src={item.images?.[0]||item.image} alt={item.name}/>:<FiPackage/>}</div><div className="product-shop-info"><strong>{item.name}</strong><small>{item.sku||"No SKU"}</small><span>{money(item.price,item.currency)}</span><small>{item.stock>0?`${item.stock} in stock`:"Out of stock"}</small></div>
          </Button><div className="product-card-actions product-card-menu"><Button variant="plain" className="icon-action product-more-button" type="button" aria-label={`Actions for ${item.name}`} data-tooltip="Product actions" aria-expanded={productMenu===item._id} onClick={()=>setProductMenu(v=>v===item._id?null:item._id)}><FiMoreHorizontal/></Button>{productMenu===item._id&&<div className="product-action-popover"><Button variant="plain" className="icon-action" type="button" aria-label="Edit product" data-tooltip="Edit product" onClick={()=>{setEditing({...item});setProductMenu(null);}}><FiEdit2/></Button><Button variant="plain" className="icon-action product-delete-button" type="button" aria-label="Delete product" data-tooltip="Delete product" onClick={()=>{setDeleteTarget(item);setProductMenu(null);}}><FiTrash2/></Button></div>}</div>
        </Card>)}</div>}
      </section>

      {posPopupOpen && compactPos && <div className="pos-checkout-backdrop" aria-hidden="true" onClick={closePosPopup}/>}
      <aside ref={posCartRef} className={"panel products-cart-panel"+(posPopupOpen?" pos-popup-visible":"")}
        id="pos-checkout" role={compactPos?"dialog":undefined} aria-modal={compactPos?posPopupOpen:undefined}
        aria-label={compactPos?"POS checkout":undefined}>
        <div className="panel-title"><div><p className="eyebrow">CART</p><h2>Current sale</h2></div>
          <FiShoppingCart aria-hidden="true"/>
          <Button variant="ghost" size="icon-sm" className="pos-cart-dismiss" type="button" aria-label="Close POS checkout" onClick={closePosPopup}><FiX aria-hidden="true"/></Button>
        </div>
        <div className="cart-checkout-details"><Label>Customer name <span className="muted">(optional)</span><Input value={customerName} onChange={e=>setCustomerName(e.target.value)}/></Label>
        <Label>Payment method<Select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="gcash">GCash</option><option value="maya">Maya</option><option value="card">Card</option><option value="other">Other</option></Select></Label></div>
        <Button variant="plain" type="button" className="cart-items-toggle" onClick={()=>setCartOpen(v=>!v)} aria-expanded={cartOpen}><span>Cart items <strong>({cartLines.reduce((s,x)=>s+x.quantity,0)})</strong></span>{cartOpen?<FiChevronDown/>:<FiChevronRight/>}</Button>
        {cartOpen&&<div className="cart-items-section">{cartLines.length>0&&<SearchField className="cart-ui-search" value={cartSearch} onValueChange={setCartSearch} placeholder="Search cart items..." aria-label="Search cart items" />}
        {!cartLines.length?<p className="muted cart-empty">Click a product to choose a quantity and add it to the cart.</p>:filteredCartLines.length===0?<p className="muted cart-empty">No cart items match “{cartSearch}”.</p>:<div className="cart-lines cart-lines-scroll">{filteredCartLines.map(item=><div className="cart-line" key={item._id}><div><strong>{item.name}</strong><small>{money(item.price,item.currency)} each</small></div><div className="cart-quantity"><Button variant="plain" type="button" aria-label={`Decrease quantity of ${item.name}`} onClick={()=>changeCart(item._id,item.quantity-1,item.stock)}><FiMinus/></Button><span>{item.quantity}</span><Button variant="plain" type="button" aria-label={`Increase quantity of ${item.name}`} disabled={item.quantity>=item.stock} onClick={()=>changeCart(item._id,item.quantity+1,item.stock)}><FiPlus/></Button></div><strong>{money(item.price*item.quantity,item.currency)}</strong><Button variant="plain" type="button" className="icon-button icon-action" aria-label={"Remove "+item.name} data-tooltip={"Remove "+item.name} onClick={()=>changeCart(item._id,0,item.stock)}><FiX/></Button></div>)}</div>}</div>}
        <div className="pos-total"><span>Total</span><strong>{money(cartTotal,currency)}</strong></div>
        <Button variant="plain" className="primary-button checkout-button" type="button" disabled={!cartLines.length} onClick={()=>setConfirmCheckout(true)}>Check out</Button>
      </aside>
    </div>}

    {deleteTarget&&<Dialog open={Boolean(deleteTarget)} title="Delete product" onOpenChange={open=>{if(!open)setDeleteTarget(null);}}><DialogContent className="ui-product-confirm"><div className="panel-title"><div><p className="eyebrow">DELETE PRODUCT</p><h2 id="delete-product-title">Delete {deleteTarget.name}?</h2></div><Button variant="plain" type="button" className="icon-button icon-action" aria-label="Close delete confirmation" data-tooltip="Close" onClick={()=>setDeleteTarget(null)}><FiX/></Button></div><p className="muted">This product will be permanently removed from your inventory. This action cannot be undone.</p><div className="delete-product-actions"><Button variant="plain" type="button" className="secondary" onClick={()=>setDeleteTarget(null)}>Cancel</Button><Button variant="plain" type="button" className="danger" onClick={()=>removeProduct(deleteTarget)}><FiTrash2/>Delete product</Button></div></DialogContent></Dialog>}
      {confirmCheckout&&<Dialog open={confirmCheckout} title="Confirm checkout" dismissible={!checkoutBusy} onOpenChange={open=>{if(!open&&!checkoutBusy)setConfirmCheckout(false);}}><DialogContent className="ui-product-confirm"><div className="panel-title"><div><p className="eyebrow">FINAL CHECK</p><h2>Confirm checkout</h2></div><Button variant="plain" type="button" className="icon-button icon-action" aria-label="Close checkout confirmation" onClick={()=>setConfirmCheckout(false)}><FiX/></Button></div><p className="muted">Review this sale before completing the transaction.</p><div className="checkout-confirm-summary"><div><span>Customer</span><strong>{customerName.trim()||"Walk-in"}</strong></div><div><span>Payment</span><strong>{paymentMethod.charAt(0).toUpperCase()+paymentMethod.slice(1)}</strong></div><div><span>Items</span><strong>{cartLines.reduce((s,x)=>s+x.quantity,0)}</strong></div></div><div className="checkout-confirm-items">{cartLines.map(item=><div key={item._id}><span>{item.name} × {item.quantity}</span><strong>{money(item.price*item.quantity,item.currency)}</strong></div>)}</div><div className="pos-total"><span>Total</span><strong>{money(cartTotal,currency)}</strong></div><div className="checkout-confirm-actions"><Button variant="plain" type="button" className="secondary" onClick={()=>setConfirmCheckout(false)}>Cancel</Button>{error&&<p className="error" role="alert">{error}</p>}<Button variant="plain" type="button" className="primary-button" disabled={checkoutBusy} onClick={checkout}>{checkoutBusy?"Processing checkout…":"Confirm checkout"}</Button></div></DialogContent></Dialog>}

    {checkoutSuccess&&<Dialog open={Boolean(checkoutSuccess)} title="Checkout complete" className="checkout-success-dialog" onOpenChange={open=>{if(!open)setCheckoutSuccess(null);}}>
      <DialogContent className="checkout-success-content">
        <span className="checkout-success-icon"><FiCheckCircle aria-hidden="true"/></span>
        <h2>Checkout complete</h2>
        <p>Invoice <strong>{checkoutSuccess.invoiceNumber}</strong> recorded in Sales.</p>
        <Button variant="ghost" type="button" className="checkout-success-dismiss" onClick={()=>setCheckoutSuccess(null)}>Done <FiArrowRight aria-hidden="true"/></Button>
      </DialogContent>
    </Dialog>}

    {creating && <Dialog open={creating} title="Add new product" dismissible={!creatingBusy}
      className="product-create-dialog"
      onOpenChange={open => { if (!open && !creatingBusy) setCreating(false); }}>
      <DialogContent className="product-create-dialog-content">
        <div className="product-create-header">
          <div>
            <p className="eyebrow">NEW PRODUCT</p>
            <h2>Add product</h2>
            <p className="product-create-subtitle">Add your item details, pricing, and images.</p>
          </div>
          <Button variant="ghost" size="icon-sm" type="button" aria-label="Close new product"
            disabled={creatingBusy} onClick={()=>setCreating(false)}><FiX aria-hidden="true"/></Button>
        </div>
        <form className="product-edit-form product-create-form" onSubmit={addProduct} id="product-create-form">
          <div className="product-form-body">
            <Label className="product-field-full">Product name
              <Input autoFocus required maxLength={180} placeholder="e.g. Universal AC Contactor"
                value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/>
            </Label>
            <div className="product-form-grid">
              <Label>SKU <span className="product-field-hint">(optional)</span>
                <Input placeholder="e.g. JBA-HVAC-016" value={form.sku} onChange={e=>setForm(v=>({...v,sku:e.target.value}))}/>
              </Label>
              <Label>Currency
                <Select value={form.currency} onChange={e=>setForm(v=>({...v,currency:e.target.value}))}>
                  <option value="PHP">PHP</option><option value="USD">USD</option>
                  <option value="GBP">GBP</option><option value="SGD">SGD</option><option value="CAD">CAD</option>
                </Select>
              </Label>
            </div>
            <Label className="product-field-full">Description
              <Textarea rows={3} placeholder="Add details customers should know about this product"
                value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/>
            </Label>
            <div className="product-form-upload">
              <div className="product-upload-title">
                <strong>Product images</strong>
                <span>{form.images.length} / 8 images</span>
              </div>
              <Label className={"product-upload-dropzone"+(form.images.length>=8?" is-full":"")}>
                <FiUploadCloud aria-hidden="true"/>
                <span><strong>Choose product images</strong>
                  <small>PNG, JPG, or WebP. Up to 8 images.</small></span>
                <Input type="file" accept="image/*" multiple disabled={form.images.length>=8}
                  aria-label="Choose product images"
                  onChange={e=>{
                    readProductImages(e.target.files,form.images,images=>setForm(v=>({...v,images:[...v.images,...images.slice(form.images.length)].slice(0,8)})));
                    e.target.value="";
                  }}/>
              </Label>
              {form.images.length>0 && <div className="product-image-editor product-create-previews" aria-label="Selected images">
                {form.images.map((src,index)=><div key={index} className="product-image-thumb">
                  <Image src={src} alt={`Product image ${index+1}`}/>
                  <Button variant="ghost" size="icon-sm" type="button" aria-label={`Remove image ${index+1}`}
                    onClick={()=>setForm(v=>({...v,images:v.images.filter((_,i)=>i!==index)}))}><FiX aria-hidden="true"/></Button>
                </div>)}
              </div>}
            </div>
            <div className="product-form-grid product-cost-grid">
              <Label>Price
                <Input type="number" inputMode="decimal" min="0" step="0.01" required placeholder="0.00"
                  value={form.price} onChange={e=>setForm(v=>({...v,price:e.target.value}))}/>
              </Label>
              <Label>Initial cost <span className="product-field-hint">(optional / unit)</span>
                <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="Not set"
                  value={form.unitCost} onChange={e=>setForm(v=>({...v,unitCost:e.target.value}))}/>
              </Label>
              <Label>Initial stock
                <Input type="number" inputMode="numeric" min="0" step="1" required placeholder="0"
                  value={form.stock} onChange={e=>setForm(v=>({...v,stock:e.target.value}))}/>
              </Label>
            </div>
            <p className="product-cost-hint">Cost is per item, not your entire inventory. Leave blank if unknown; earnings will be unavailable for sales without a cost.</p>
            <Label className="product-create-publish">
              <Input type="checkbox" checked={form.published}
                onChange={e=>setForm(v=>({...v,published:e.target.checked}))}/>
              <span className="product-publish-copy"><strong>Publish on public profile</strong>
                <small>Make this product visible to customers.</small></span>
            </Label>
          </div>
          {error && <p className="error product-create-error" role="alert">{error}</p>}
          <div className="product-create-actions">
            <Button variant="outline" type="button" disabled={creatingBusy} onClick={()=>setCreating(false)}>Cancel</Button>
            <Button variant="default" type="submit" disabled={creatingBusy}>
              <FiPlus aria-hidden="true"/>{creatingBusy?"Creating...":"Create product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>}

    {selected&&<div className="booking-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><section className="panel booking-modal product-quantity-modal product-details-modal" role="dialog" aria-modal="true" aria-label={"Product details for "+selected.name}><div className="panel-title product-details-header"><div><p className="eyebrow">PRODUCT DETAILS</p></div><Button variant="plain" type="button" className="icon-button icon-action" aria-label="Close product" data-tooltip="Close" onClick={()=>setSelected(null)}><FiX/></Button></div><div className="product-details-layout"><div className="product-details-image">{(selected.images?.[0]||selected.image)?<Image src={selected.images?.[0]||selected.image} alt={selected.name}/>:<FiPackage/>}</div><div className="product-details-content"><h2>{selected.name}</h2><strong className="product-details-price">{money(selected.price,selected.currency)}</strong><span className="muted">{selected.stock} available</span><Label>Quantity<Input autoFocus type="number" min="1" max={selected.stock} value={quantity} onChange={e=>setQuantity(Math.min(selected.stock,Math.max(1,Number(e.target.value||1))))}/></Label><Button variant="plain" type="button" className="primary-button product-details-cart-button" onClick={addToCart}><FiShoppingCart/>Add to cart</Button><div className="product-details-description"><strong>Product Description</strong><p>{selected.description||"No description provided."}</p></div><div className="product-details-meta"><div><span>SKU</span><strong>{selected.sku||"No SKU"}</strong></div><div><span>Stock</span><strong>{selected.stock}</strong></div></div></div></div></section></div>}

    {editing&&<div className="booking-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}><section className="panel booking-modal product-edit-modal" role="dialog" aria-modal="true"><div className="panel-title"><h2>Edit product</h2><Button variant="plain" type="button" className="icon-button icon-action" aria-label="Close editor" data-tooltip="Close" onClick={()=>setEditing(null)}><FiX/></Button></div><form className="product-edit-form" onSubmit={saveProduct}><Label>Name<Input required value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></Label><Label>SKU<Input value={editing.sku||""} onChange={e=>setEditing({...editing,sku:e.target.value})}/></Label><Label>Description<Textarea value={editing.description||""} onChange={e=>setEditing({...editing,description:e.target.value})}/></Label><Label>Product images <span className="muted">({(editing.images||[]).length}/8)</span><Input type="file" accept="image/*" multiple disabled={(editing.images||[]).length>=8} onChange={e=>{readProductImages(e.target.files,editing.images||[],images=>setEditing({...editing,images}));e.target.value="";}}/></Label>{(editing.images||[]).length>0&&<div className="product-image-editor">{editing.images.map((src,index)=><div key={index} className="product-image-thumb"><Image src={src} alt={`Product ${index+1}`}/><Button variant="plain" type="button" className="icon-button icon-action" aria-label="Remove image" data-tooltip="Remove image" onClick={()=>setEditing({...editing,images:editing.images.filter((_,i)=>i!==index)})}><FiX/></Button></div>)}</div>}<div className="two-col product-edit-cost-grid"><Label>Price<Input type="number" min="0" step="0.01" value={editing.price} onChange={e=>setEditing({...editing,price:e.target.value})}/></Label><Label>Initial cost (optional / unit)<Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="Not set" value={editing.unitCost??""} onChange={e=>setEditing({...editing,unitCost:e.target.value})}/></Label><Label>Stock<Input type="number" min="0" value={editing.stock} onChange={e=>setEditing({...editing,stock:e.target.value})}/></Label></div><Label className="check-row"><Input type="checkbox" checked={!!editing.published} onChange={e=>setEditing({...editing,published:e.target.checked})}/>Published</Label><div className="row-actions"><Button variant="plain" className="primary-button">Save changes</Button><Button variant="plain" type="button" className="secondary" onClick={()=>setEditing(null)}>Cancel</Button></div></form></section></div>}
  </AppLayout>;
}
