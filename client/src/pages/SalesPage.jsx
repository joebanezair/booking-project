import { Card } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Select } from "../components/ui/select.jsx";
import { Label } from "../components/ui/label.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiCalendar, FiChevronDown, FiCopy, FiCreditCard, FiDownload, FiEdit2, FiExternalLink, FiFileText, FiInbox, FiPackage, FiPrinter, FiSearch, FiShare2, FiShoppingBag, FiTruck, FiTrendingUp, FiX } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";
import { SalesTrendChart, ServiceSalesChart } from "../components/SalesCharts.jsx";
import { exportSalesSpreadsheet } from "../lib/salesExport.js";
import { api } from "../api.js";

const ranges = [
  ["today", "Today"],
  ["7d", "7 Days"],
  ["month", "This Month"],
  ["year", "This Year"],
  ["all", "All Time"],
  ["custom", "Custom"]
];

const orderStatuses = [
  ["pending", "Pending"], ["confirmed", "Confirmed"], ["processing", "Processing"],
  ["ready", "Ready"], ["out_for_delivery", "Out for delivery"],
  ["completed", "Completed"], ["cancelled", "Cancelled"]
];
const commonOrderFilters = [["all","All"],["pending","Pending"],["processing","Processing"],["completed","Completed"]];
const extraOrderFilters = orderStatuses.filter(([value])=>!commonOrderFilters.some(([common])=>common===value));
const orderStatusLabel = value => orderStatuses.find(([key])=>key===value)?.[1] || value;

const groups = [
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["annual", "Annual"]
];

function money(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

export default function SalesPage({ user, onLogout, ordersOnly = false }) {
  const [range, setRange] = useState("month");
  const [group, setGroup] = useState("daily");
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [orders,setOrders]=useState([]);
  const [ordersExpanded,setOrdersExpanded]=useState(true);
  const [orderFilter,setOrderFilter]=useState("all");
  const [orderSearch,setOrderSearch]=useState("");
  const [draftOrderStatus,setDraftOrderStatus]=useState("pending");
  const [selectedOrderId,setSelectedOrderId]=useState(null);
  const [editingOrder,setEditingOrder]=useState(false);
  const [orderSaving,setOrderSaving]=useState(false);
  const [orderModalError,setOrderModalError]=useState("");
  const [trackingLink,setTrackingLink]=useState("");
  const [shareNotice,setShareNotice]=useState("");
  const [orderStatusBusy,setOrderStatusBusy]=useState("");
  const [orderStatusNotice,setOrderStatusNotice]=useState("");
  const [receipt,setReceipt]=useState(null);
  const [historyExpanded,setHistoryExpanded]=useState(false);

  const offset = new Date().getTimezoneOffset();

  async function load(nextRange = range, nextGroup = group, nextCustom = custom) {
    if (nextRange === "custom" && (!nextCustom.start || !nextCustom.end)) return;
    setLoading(true);
    setError("");
    try {
      setData(await api.sales.analytics({
        range: nextRange,
        group: nextGroup,
        offset,
        ...(nextRange === "custom" ? nextCustom : {})
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (!ordersOnly) load(); }, [range, group, ordersOnly]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  useEffect(() => {
    if (!ordersOnly) return;
    let mounted = true;
    api.sales.orders().then(items => { if (mounted) setOrders(items); })
      .catch(e => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setOrdersLoading(false); });
    return () => { mounted = false; };
  }, [ordersOnly]);

  const rangeLabel = useMemo(() => {
    if (range === "custom" && custom.start && custom.end) return `${custom.start}_to_${custom.end}`;
    return ranges.find(item => item[0] === range)?.[1] || "Sales";
  }, [range, custom]);

  function selectRange(value) {
    setRange(value);
    if (value !== "custom") setCustom({ start: "", end: "" });
  }

  const filteredOrders = useMemo(()=>{
    const term=orderSearch.trim().toLowerCase();
    return orders.filter(order=>
      (orderFilter==="all"||order.status===orderFilter) &&
      (!term || [order.orderNumber,order.customerName,order.customerPhone,
        ...(order.items||[]).map(item=>item.name)].some(value=>String(value||"").toLowerCase().includes(term)))
    );
  },[orders,orderFilter,orderSearch]);



  const selectedOrder = orders.find(o=>o._id===selectedOrderId) || null;

  function openOrder(order) {
    setSelectedOrderId(order._id); setEditingOrder(false);
    setDraftOrderStatus(order.status);
    setOrderModalError(""); setOrderStatusNotice("");
    setTrackingLink(""); setShareNotice("");
  }
  useEffect(()=>{
    if(!selectedOrderId)return;
    let active=true;
    api.sales.orderTracking(selectedOrderId).then(result=>{
      if(active)setTrackingLink(window.location.origin+"/order-status/"+result.id+"#"+result.trackingToken);
    }).catch(e=>{if(active)setShareNotice(e.message);});
    return ()=>{active=false;};
  },[selectedOrderId]);

  async function copyOrderLink() {
    if(!trackingLink)return;
    try {
      await navigator.clipboard.writeText(trackingLink);
      setShareNotice("Tracking link copied. You can send it to the buyer.");
    } catch {
      setShareNotice("Select and copy the tracking link below.");
    }
  }
  async function shareOrderLink() {
    if(!trackingLink)return;
    if(navigator.share) {
      try { await navigator.share({title:"BookFlow order status",text:"Track your BookFlow order:",url:trackingLink});return; }
      catch(e){if(e.name==="AbortError")return;}
    }
    await copyOrderLink();
  }
  // Status changes use the dedicated route. They must not be blocked by unrelated
  // customer fields, legacy delivery addresses or stock validation for edit forms.
  async function saveOrderStatus() {
    if(!selectedOrder || orderSaving || orderStatusBusy || editingOrder ||
      ["completed","cancelled"].includes(selectedOrder.status) ||
      draftOrderStatus===selectedOrder.status) return;
    const id=selectedOrder._id;
    const next=draftOrderStatus;
    setOrderModalError(""); setOrderStatusNotice("");
    setOrderStatusBusy(id);
    try {
      const updated=await api.sales.setOrderStatus(id,next);
      setOrders(existing=>existing.map(order=>order._id===updated._id?updated:order));
      setDraftOrderStatus(updated.status);
      setOrderStatusNotice("Status updated to "+orderStatusLabel(updated.status)+". The buyer can see the change on their tracking page.");
      if(updated.status==="completed" && !ordersOnly)await load();
    }catch(err){
      setOrderModalError(err.message);
    }finally{setOrderStatusBusy("");}
  }

  async function saveOrderDetails(event) {
    event.preventDefault();
    if(!selectedOrder||orderSaving||["completed","cancelled"].includes(selectedOrder.status))return;
    const form=new FormData(event.currentTarget);
    setOrderSaving(true);setOrderModalError("");
    try{
      const updated=await api.sales.updateOrder(selectedOrder._id,{
        customerName:form.get("customerName"),customerPhone:form.get("customerPhone"),
        customerEmail:form.get("customerEmail"),deliveryLocation:form.get("deliveryLocation"),
        notes:form.get("notes"),courierName:form.get("courierName"),
        trackingNumber:form.get("trackingNumber"),trackingUrl:form.get("trackingUrl"),
        items:selectedOrder.items.map((item,i)=>({productId:item.product,quantity:Number(form.get("quantity-"+i))}))
      });
      setOrders(existing=>existing.map(o=>o._id===updated._id?updated:o));
      setEditingOrder(false);setError("");
      setOrderStatusNotice("Order details saved.");
    }catch(e){setOrderModalError(e.message);}finally{setOrderSaving(false);}
  }

  const primaryCurrency = data?.primaryCurrency || "PHP";
  const summary = data?.summary || {};
  // Analytics includes completed orders in the selected range; count online units only.
  const onlineProductsSold = (data?.productRecords || []).reduce((total, record) =>
    record.source === "online"
      ? total + (record.items || []).reduce((units, item) => units + (Number(item.quantity) || 0), 0)
      : total, 0);
  const unifiedTransactions = useMemo(() => [
    ...(data?.records || []).map(record => ({ id:`service-${record.id}`, type:"Service Sale", completedAt:record.completedAt, customer:record.guestName || "Guest", description:record.serviceName, amount:record.saleAmount, currency:record.currency || primaryCurrency, reference:`SALE-${String(record.id).slice(-8).toUpperCase()}`, status:record.status || "recorded" })),
    ...(data?.productRecords || []).map(record => ({ id:`${record.source}-${record.id}`, type:record.source === "pos" ? "POS Sale" : "Online Product Sale", completedAt:record.completedAt, customer:record.customerName || "Customer", description:record.description, items:record.items || [], amount:record.amount, currency:record.currency || primaryCurrency, reference:record.reference, status:record.status || "recorded" }))
  ].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt)), [data, primaryCurrency]);

  return <AppLayout user={user} onLogout={onLogout}>
    {ordersOnly ? <header className="topbar online-orders-page-header">
      <div><p className="eyebrow">PRODUCTS / ONLINE ORDERS</p>
        <h1>Online orders</h1>
        <p className="muted">Manage orders from your public storefront, update fulfillment, and share buyer tracking links.</p>
      </div>
    </header> : <>
    <header className="topbar analytics-topbar">
      <div>
        <p className="eyebrow">SALES & ANALYTICS</p>
        <h1>Sales & analytics</h1>
        <p className="muted">Track revenue, transactions, and sales performance.</p>
      </div>
      <Button variant="outline" className="sales-export-button icon-link" type="button" aria-label="Export spreadsheet" disabled={!unifiedTransactions.length} onClick={() => exportSalesSpreadsheet(data, rangeLabel)}>
        <FiDownload aria-hidden="true"/>Export
      </Button>
    </header>


    <section className="panel analytics-controls sales-analytics-controls">
      <div className="sales-period-row">
        <div className="filter-button-group sales-period-buttons" role="group" aria-label="Sales period">
          {ranges.map(([value, label]) => <Button variant="outline" type="button" key={value} aria-pressed={range===value} className={range === value ? "filter-chip active" : "filter-chip"} onClick={() => selectRange(value)}>{label}</Button>)}
        </div>
        <label className="sales-group-control">
          <span>Group by</span>
          <Select value={group} aria-label="Group chart by" onChange={e => setGroup(e.target.value)}>
            {groups.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </label>
      </div>
      {range === "custom" && <div className="custom-date-range">
        <Label>Start<Input type="date" value={custom.start} onChange={e => setCustom({ ...custom, start: e.target.value })} /></Label>
        <Label>End<Input type="date" value={custom.end} onChange={e => setCustom({ ...custom, end: e.target.value })} /></Label>
        <Button variant="outline" type="button" className="secondary" disabled={!custom.start || !custom.end} onClick={() => load("custom", group, custom)}>Apply</Button>
      </div>}
    </section>

    {error && <p className="error">{error}</p>}
    {loading && !data ? <section className="panel"><p>Loading sales analytics…</p></section> : <>
      <section className="stats-grid sales-stats-grid sales-kpis" aria-label="Sales performance overview">
        <Card as="article" className="stat-card analytics-stat"><span><FiCreditCard aria-hidden="true"/>Recorded sales</span><strong>{money(summary.totalSales, primaryCurrency)}</strong><small>Services {money(data?.serviceSalesTotal || 0, primaryCurrency)} · Products {money(data?.productSalesTotal || 0, primaryCurrency)}</small></Card>
        <Card as="article" className="stat-card analytics-stat"><span><FiCalendar aria-hidden="true"/>Completed services</span><strong>{summary.completedServices || 0}</strong><small>Bookings recorded as sales</small></Card>
        <Card as="article" className="stat-card analytics-stat"><span><FiTrendingUp aria-hidden="true"/>Average sale</span><strong>{money(summary.averageSale, primaryCurrency)}</strong><small>Average in primary currency</small></Card>
        <Card as="article" className="stat-card analytics-stat"><span><FiPackage aria-hidden="true"/>Products sold online</span><strong>{onlineProductsSold}</strong><small>Units from completed online orders</small></Card>
      </section>


      </>}
    </>}
    {ordersOnly && error && <p className="error" role="alert">{error}</p>}
    {ordersOnly && ordersLoading && <section className="panel sales-orders-loading" role="status">Loading online orders…</section>}
    {ordersOnly && <section className={"panel pos-history-panel sales-orders-panel"+(!orders.length?" is-empty":"")}>
      <div className="panel-title sales-orders-head">
        <div><p className="eyebrow">ONLINE ORDERS</p><h2>Public product orders</h2></div>
        <Button type="button" variant="outline" className="sales-orders-collapse" aria-expanded={ordersExpanded}
          aria-controls="sales-online-orders-content" onClick={()=>setOrdersExpanded(value=>!value)}>
          {orders.length} order{orders.length===1?"":"s"} <FiChevronDown aria-hidden="true"/>
        </Button>
      </div>
      <div id="sales-online-orders-content" className="sales-online-orders-content" hidden={!ordersExpanded}>
        {orders.length===0
          ? <div className="sales-orders-empty"><FiInbox aria-hidden="true"/><p className="muted">No public product orders yet.</p></div>
          : <>
            <div className="sales-orders-toolbar">
              <div className="sales-orders-filters" role="group" aria-label="Filter online orders">
                {commonOrderFilters.map(([value,label])=><Button type="button" key={value}
                  variant={orderFilter===value?"secondary":"outline"}
                  className={"sales-orders-filter"+(orderFilter===value?" active":"")}
                  aria-pressed={orderFilter===value} onClick={()=>setOrderFilter(value)}>
                  {label}<span className="sales-orders-filter-count">{value==="all"?orders.length:orders.filter(o=>o.status===value).length}</span>
                </Button>)}
                <Select aria-label="More order statuses" className="sales-orders-more-status"
                  value={extraOrderFilters.some(([value])=>value===orderFilter)?orderFilter:""}
                  onChange={e=>setOrderFilter(e.target.value||"all")}>
                  <option value="">More statuses</option>
                  {extraOrderFilters.map(([value,label])=><option value={value} key={value}>{label}</option>)}
                </Select>
              </div>
              <label className="sales-orders-search">
                <FiSearch aria-hidden="true"/>
                <Input type="search" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}
                  placeholder="Search orders, customers, or products..." aria-label="Search online orders"/>
              </label>
            </div>
            {filteredOrders.length===0 ? <p className="muted sales-orders-no-match" role="status">No matching orders. Adjust your search or status filter.</p> :
              <div className="sales-table-wrap sales-orders-table-wrap">
                <table className="sales-table sales-orders-table">
                  <thead><tr><th scope="col">Order</th><th scope="col">Product</th><th scope="col">Customer</th><th scope="col">Total</th><th scope="col">Status</th></tr></thead>
                  <tbody>{filteredOrders.map(order=><tr key={order._id} className="sales-order-row"
                    onClick={()=>openOrder(order)}>
                    <td data-label="Order" className="sales-orders-ident">
                      <Button type="button" variant="plain" className="sales-orders-order-link" title={order.orderNumber}
                        onClick={event=>{event.stopPropagation();openOrder(order);}}>{order.orderNumber}</Button>
                    </td>
                    <td data-label="Product" className="sales-orders-product">
                      <span className="sales-orders-item">{order.items?.map(i=>i.name+" × "+i.quantity).join(", ")}</span>
                    </td>
                    <td data-label="Customer" className="sales-orders-customer">{order.customerName}</td>
                    <td data-label="Total" className="sales-orders-amount">{money(order.total,order.currency)}</td>
                    <td data-label="Status" className="sales-orders-status-cell"><span className={"sales-orders-status is-"+order.status}>{orderStatusLabel(order.status)}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>}
          </>}
      </div>
    </section>}

    {!ordersOnly && !loading && data && <>
      {data?.totalsByCurrency?.length > 1 && <section className="panel currency-summary">
        <div className="panel-title"><h2>Sales by currency</h2></div>
        <div className="currency-total-list">{data.totalsByCurrency.map(item => <div key={item.currency}><strong>{item.currency}</strong><span>{money(item.totalSales, item.currency)}</span><small>{item.saleCount} completed sale{item.saleCount === 1 ? "" : "s"}</small></div>)}</div>
      </section>}

      <div className="analytics-grid">
        <section className="panel analytics-chart-panel">
          <div className="panel-title"><div><p className="eyebrow">TREND</p><h2>Sales over time</h2></div></div>
          <SalesTrendChart data={data?.trend || []} currency={primaryCurrency} />
        </section>
        <section className="panel analytics-chart-panel">
          <div className="panel-title"><div><p className="eyebrow">MIX</p><h2>Sales by service / product channel</h2></div></div>
          <ServiceSalesChart data={data?.byService || []} currency={primaryCurrency} />
        </section>
      </div>

      {(data?.byChannel?.length > 0 || data?.byPaymentMethod?.length > 0) && <section className="panel currency-summary sales-channel-breakdown">
        <div className="panel-title sales-channel-breakdown-heading"><div><p className="eyebrow">BREAKDOWN</p><h2>Sales channels & POS payments</h2><p className="muted sales-channel-breakdown-description">Revenue and transaction breakdown by source.</p></div></div>
        <div className="currency-total-list sales-channel-breakdown-grid">
          {(data?.byChannel || []).map(item => {
            const Icon = item.channel?.toLowerCase().includes("service") ? FiCalendar : FiShoppingBag;
            return <div className="sales-channel-breakdown-card" key={"channel-"+item.channel}>
              <div className="sales-channel-breakdown-label"><span className="sales-channel-breakdown-icon"><Icon aria-hidden="true"/></span><strong>{item.channel}</strong></div>
              <div className="sales-channel-breakdown-details">
                <span className="sales-channel-breakdown-amount">{money(item.revenue, primaryCurrency)}</span>
                <small className="sales-channel-breakdown-count"><FiFileText aria-hidden="true"/>{item.sales} transaction{item.sales===1?"":"s"}</small>
              </div>
            </div>;
          })}
          {(data?.byPaymentMethod || []).map(item => <div className="sales-channel-breakdown-card" key={"payment-"+item.method}>
            <div className="sales-channel-breakdown-label"><span className="sales-channel-breakdown-icon"><FiCreditCard aria-hidden="true"/></span><strong>POS · {item.method.toUpperCase()}</strong></div>
            <div className="sales-channel-breakdown-details">
              <span className="sales-channel-breakdown-amount">{money(item.revenue, primaryCurrency)}</span>
              <small className="sales-channel-breakdown-count"><FiFileText aria-hidden="true"/>{item.sales} sale{item.sales===1?"":"s"}</small>
            </div>
          </div>)}
        </div>
      </section>}

      <section className="panel sales-records-panel">
        <div className="panel-title sales-records-heading">
          <div><p className="eyebrow">TRANSACTION HISTORY</p><h2>All sales</h2></div>
          <Button type="button" variant="outline" className="sales-records-toggle"
            onClick={()=>setHistoryExpanded(value=>!value)}
            aria-expanded={historyExpanded}
            aria-controls="sales-transactions-content">
            <span>{historyExpanded ? "Hide transactions" : `Show ${unifiedTransactions.length} transaction${unifiedTransactions.length===1?"":"s"}`}</span>
            <FiChevronDown aria-hidden="true"/>
          </Button>
        </div>
        <div id="sales-transactions-content" className="sales-records-content" hidden={!historyExpanded}>
          {!unifiedTransactions.length ? <p className="muted">No sales transactions in this period.</p> : <div className="sales-table-wrap">
          <table className="sales-table">
            <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Customer</th><th>Item / Service</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{unifiedTransactions.map(record => <tr key={record.id} className="sales-receipt-row" tabIndex={0} role="button" aria-label={`View receipt ${record.reference || ""}`} onClick={()=>setReceipt(record)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setReceipt(record);}}}>
              <td data-label="Date">{new Date(record.completedAt).toLocaleString()}</td>
              <td data-label="Type"><strong>{record.type}</strong></td>
              <td data-label="Reference">{record.reference || "—"}</td>
              <td data-label="Customer">{record.customer}</td>
              <td data-label="Item / Service">{record.description}</td>
              <td data-label="Amount"><strong>{money(record.amount, record.currency)}</strong></td>
              <td data-label="Status"><span className="status completed">{record.status}</span></td>
            </tr>)}</tbody>
          </table>
        </div>}
        </div>
      </section>
      {receipt&&createPortal(<div className="receipt-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setReceipt(null);}}>
        <section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
          <div className="receipt-modal-actions no-print"><Button variant="plain" className="secondary icon-link" onClick={()=>window.print()}><FiPrinter/>Print</Button><Button variant="plain" className="secondary icon-action" aria-label="Close receipt" onClick={()=>setReceipt(null)}><FiX/></Button></div>
          <div className="receipt-paper">
            <p className="eyebrow">BOOKFLOW RECEIPT</p><h2 id="receipt-title">Sales receipt</h2>
            <div className="receipt-rule"/>
            <dl className="receipt-details">
              <div><dt>Reference</dt><dd>{receipt.reference||"—"}</dd></div>
              <div><dt>Date</dt><dd>{new Date(receipt.completedAt).toLocaleString()}</dd></div>
              <div><dt>Type</dt><dd>{receipt.type}</dd></div>
              <div><dt>Customer</dt><dd>{receipt.customer}</dd></div>
              {receipt.items?.length?<div className="receipt-items-block"><dt>Items</dt><dd><div className="receipt-items">{receipt.items.map((item,index)=><div className="receipt-item" key={index}><div><strong>{item.name}</strong>{item.sku&&<small>{item.sku}</small>}</div><span>{item.quantity} × {money(item.unitPrice,receipt.currency)}</span><strong>{money(item.lineTotal ?? Number(item.unitPrice||0)*Number(item.quantity||0),receipt.currency)}</strong></div>)}</div></dd></div>:<div><dt>Item / Service</dt><dd>{receipt.description}</dd></div>}
              <div><dt>Status</dt><dd>{receipt.status}</dd></div>
            </dl>
            <div className="receipt-total"><span>Total</span><strong>{money(receipt.amount,receipt.currency)}</strong></div>
            <p className="receipt-thanks">Thank you for your business.</p>
          </div>
        </section>
      </div>,document.body)}
    </>}

    <Dialog open={Boolean(selectedOrder)} title="Order details" className="vendor-order-dialog"
      dismissible={!orderSaving&&!orderStatusBusy}
      onOpenChange={open=>{if(!open&&!orderSaving&&!orderStatusBusy){setSelectedOrderId(null);setEditingOrder(false);setOrderModalError("");setOrderStatusNotice("");}}}>
      <DialogContent className="vendor-order-dialog-content">
        <DialogHeader>
          <p className="eyebrow">ORDER DETAILS</p>
          <DialogTitle>{selectedOrder?.orderNumber}</DialogTitle>
          <DialogDescription>View order details, share tracking and manage fulfillment.</DialogDescription>
        </DialogHeader>
        {selectedOrder && <>
          <div className="vendor-order-state-row">
            <span className="vendor-order-status">{orderStatusLabel(selectedOrder.status)}</span>
            {["completed","cancelled"].includes(selectedOrder.status)
              ? <span className="muted">Read-only: this sale is {selectedOrder.status}.</span>
              : <Button type="button" variant="outline" size="sm" onClick={()=>{setEditingOrder(!editingOrder);setDraftOrderStatus(selectedOrder.status);setOrderModalError("");}}
                  disabled={orderSaving||Boolean(orderStatusBusy)}><FiEdit2 aria-hidden="true"/>{editingOrder?"Cancel editing":"Edit order"}</Button>}
          </div>
          {!(["completed","cancelled"].includes(selectedOrder.status)) && <div className="vendor-order-status-editor">
            <div className="vendor-order-status-editor-heading">
              <h3>Order status</h3>
              <p className="muted">Update fulfillment without changing order details.</p>
            </div>
            <div className="vendor-order-status-editor-controls">
              <Select aria-label="Edit order status" value={draftOrderStatus}
                disabled={orderSaving||Boolean(orderStatusBusy)||editingOrder}
                onChange={e=>{setDraftOrderStatus(e.target.value);setOrderModalError("");setOrderStatusNotice("");}}>
                {orderStatuses.map(([value,label])=><option value={value} key={value}>{label}</option>)}
              </Select>
              <Button type="button" onClick={saveOrderStatus}
                disabled={orderSaving||Boolean(orderStatusBusy)||editingOrder||draftOrderStatus===selectedOrder.status}>
                {orderStatusBusy?"Updating...":draftOrderStatus==="completed"?"Complete sale":"Update status"}
              </Button>
            </div>
            {draftOrderStatus==="completed" && draftOrderStatus!==selectedOrder.status &&
              <p className="muted vendor-order-final-warning">Completing this sale records it and deducts inventory. This cannot be undone.</p>}
            {editingOrder&&<p className="muted">Save or cancel your detail changes before changing the status.</p>}
          </div>}
          {orderModalError && <p className="error vendor-order-feedback" role="alert">{orderModalError}</p>}
          {orderStatusNotice && <p className="success vendor-order-feedback" role="status">{orderStatusNotice}</p>}
          {editingOrder && !["completed","cancelled"].includes(selectedOrder.status)
            ? <form id="vendor-order-edit" key={selectedOrder._id} onSubmit={saveOrderDetails} className="vendor-order-edit-form">
                <div className="vendor-order-form-grid">
                  <Label>Customer name<Input name="customerName" defaultValue={selectedOrder.customerName} required maxLength={120}/></Label>
                  <Label>Contact number<Input name="customerPhone" defaultValue={selectedOrder.customerPhone} required maxLength={30}/></Label>
                  <Label>Email<Input name="customerEmail" type="email" defaultValue={selectedOrder.customerEmail||""} maxLength={150}/></Label>
                  <Label>Delivery location<Input name="deliveryLocation" defaultValue={selectedOrder.deliveryLocation} required maxLength={250}/></Label>
                </div>
                <h3>Items</h3>
                {selectedOrder.items.map((item,i)=><div className="vendor-order-edit-item" key={String(item.product)+"-"+i}>
                  <div><strong>{item.name}</strong><small>{money(item.unitPrice,selectedOrder.currency)} each</small></div>
                  <Label>Quantity<Input name={"quantity-"+i} type="number" min="1" max="999" step="1" required defaultValue={item.quantity}/></Label>
                </div>)}
                <h3>Courier information</h3>
                <div className="vendor-order-form-grid">
                  <Label>Courier name<Input name="courierName" defaultValue={selectedOrder.courierName||""} maxLength={120} placeholder="e.g. LBC, J&T"/></Label>
                  <Label>Tracking number<Input name="trackingNumber" defaultValue={selectedOrder.trackingNumber||""} maxLength={120} placeholder="Courier tracking reference"/></Label>
                  <Label>Tracking URL<Input name="trackingUrl" defaultValue={selectedOrder.trackingUrl||""} type="url" maxLength={512} placeholder="https://courier.example/track"/></Label>
                </div>
                <Label>Order notes<Textarea name="notes" defaultValue={selectedOrder.notes||""} maxLength={500} rows={2}/></Label>
                <p className="muted">The total is recalculated automatically from product prices and quantities. Courier details are displayed on the buyer tracking page.</p>
                <DialogFooter>
                  <Button type="button" variant="outline" disabled={orderSaving} onClick={()=>{setEditingOrder(false);setOrderModalError("");}}>Cancel</Button>
                  <Button type="submit" disabled={orderSaving}>{orderSaving?"Saving...":"Save changes"}</Button>
                </DialogFooter>
              </form>
            : <div className="vendor-order-readonly">
                <h3>Customer information</h3>
                <dl className="vendor-order-details-grid">
                  <div><dt>Customer</dt><dd>{selectedOrder.customerName}</dd></div>
                  <div><dt>Contact</dt><dd>{selectedOrder.customerPhone}</dd></div>
                  <div><dt>Email</dt><dd>{selectedOrder.customerEmail||"—"}</dd></div>
                  <div><dt>Delivery location</dt><dd>{selectedOrder.deliveryLocation}</dd></div>
                </dl>
                <h3>Ordered products</h3>
                <div className="vendor-order-lines">{selectedOrder.items.map((item,i)=><div key={String(item.product)+"-"+i}>
                  <span>{item.name} × {item.quantity}</span><strong>{money(item.lineTotal,selectedOrder.currency)}</strong>
                </div>)}</div>
                <h3><FiTruck aria-hidden="true"/> Courier information</h3>
                <dl className="vendor-order-details-grid">
                  <div><dt>Courier</dt><dd>{selectedOrder.courierName||"Not assigned yet"}</dd></div>
                  <div><dt>Tracking number</dt><dd>{selectedOrder.trackingNumber||"—"}</dd></div>
                  {selectedOrder.trackingUrl&&<div><dt>Courier tracking</dt><dd><a href={selectedOrder.trackingUrl} target="_blank" rel="noopener noreferrer">Open courier website <FiExternalLink aria-hidden="true"/></a></dd></div>}
                </dl>
                {selectedOrder.notes&&<p className="muted">Notes: {selectedOrder.notes}</p>}
                <div className="vendor-order-total"><span>Order total</span><strong>{money(selectedOrder.total,selectedOrder.currency)}</strong></div>
              </div>}
          <div className="vendor-order-share">
            <h3><FiShare2 aria-hidden="true"/> Buyer status link</h3>
            <p className="muted">Share this private link with your buyer to view status and courier updates. No account is required.</p>
            {trackingLink&&<Input aria-label="Buyer tracking link" value={trackingLink} readOnly onFocus={e=>e.target.select()}/>}
            <div className="vendor-order-share-actions">
              <Button type="button" variant="outline" disabled={!trackingLink} onClick={copyOrderLink}><FiCopy aria-hidden="true"/>Copy link</Button>
              <Button type="button" variant="secondary" disabled={!trackingLink} onClick={shareOrderLink}><FiShare2 aria-hidden="true"/>Share</Button>
              {trackingLink&&<a href={trackingLink} target="_blank" rel="noopener noreferrer" className="ui-button ui-button-outline">Preview <FiExternalLink aria-hidden="true"/></a>}
            </div>
            {shareNotice&&<p className="muted" role="status">{shareNotice}</p>}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </AppLayout>;
}
