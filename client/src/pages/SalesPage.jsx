import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiDollarSign, FiDownload, FiPackage, FiPrinter, FiTrendingUp, FiX } from "react-icons/fi";
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

export default function SalesPage({ user, onLogout }) {
  const [range, setRange] = useState("month");
  const [group, setGroup] = useState("daily");
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [orders,setOrders]=useState([]);
  const [receipt,setReceipt]=useState(null);

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

  useEffect(() => { load(); }, [range, group]);
  useEffect(() => { api.sales.orders().then(setOrders).catch(e=>setError(e.message)); }, []);

  const rangeLabel = useMemo(() => {
    if (range === "custom" && custom.start && custom.end) return `${custom.start}_to_${custom.end}`;
    return ranges.find(item => item[0] === range)?.[1] || "Sales";
  }, [range, custom]);

  function selectRange(value) {
    setRange(value);
    if (value !== "custom") setCustom({ start: "", end: "" });
  }

  async function changeOrderStatus(order,status){try{const updated=await api.sales.setOrderStatus(order._id,status);setOrders(current=>current.map(x=>x._id===updated._id?updated:x));if(status==="completed")await load();setError("");}catch(e){setError(e.message);}}


  const primaryCurrency = data?.primaryCurrency || "PHP";
  const summary = data?.summary || {};
  const unifiedTransactions = useMemo(() => [
    ...(data?.records || []).map(record => ({ id:`service-${record.id}`, type:"Service Sale", completedAt:record.completedAt, customer:record.guestName || "Guest", description:record.serviceName, amount:record.saleAmount, currency:record.currency || primaryCurrency, reference:`SALE-${String(record.id).slice(-8).toUpperCase()}`, status:record.status || "recorded" })),
    ...(data?.productRecords || []).map(record => ({ id:`${record.source}-${record.id}`, type:record.source === "pos" ? "POS Sale" : "Online Product Sale", completedAt:record.completedAt, customer:record.customerName || "Customer", description:record.description, items:record.items || [], amount:record.amount, currency:record.currency || primaryCurrency, reference:record.reference, status:record.status || "recorded" }))
  ].sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt)), [data, primaryCurrency]);

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar analytics-topbar">
      <div>
        <p className="eyebrow">SALES & ANALYTICS</p>
        <h1>Sales & analytics</h1>
        <p className="muted">Review service, POS, and completed online-product sales. Product inventory and cashier checkout are managed from Products.</p>
      </div>
      <button className="primary-button icon-link" disabled={!unifiedTransactions.length} onClick={() => exportSalesSpreadsheet(data, rangeLabel)}>
        <FiDownload />Export spreadsheet
      </button>
    </header>


    <section className="panel pos-history-panel"><div className="panel-title"><div><p className="eyebrow">ONLINE ORDERS</p><h2>Public product orders</h2></div><span className="muted">{orders.length} records</span></div>{!orders.length?<p className="muted">No public product orders yet.</p>:<div className="sales-table-wrap"><table className="sales-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>{orders.map(order=><tr key={order._id}><td>{order.orderNumber}</td><td><strong>{order.customerName}</strong><small>{order.customerPhone}</small></td><td>{order.items?.map(i=>i.name+" × "+i.quantity).join(", ")}</td><td>{money(order.total,order.currency)}</td><td><select value={order.status} disabled={order.status==="completed"} onChange={e=>changeOrderStatus(order,e.target.value)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td></tr>)}</tbody></table></div>}</section>

    <section className="panel analytics-controls">
      <div className="filter-button-group" aria-label="Sales period">
        {ranges.map(([value, label]) => <button key={value} className={range === value ? "filter-chip active" : "filter-chip"} onClick={() => selectRange(value)}>{label}</button>)}
      </div>
      {range === "custom" && <div className="custom-date-range">
        <label>Start<input type="date" value={custom.start} onChange={e => setCustom({ ...custom, start: e.target.value })} /></label>
        <label>End<input type="date" value={custom.end} onChange={e => setCustom({ ...custom, end: e.target.value })} /></label>
        <button className="secondary" disabled={!custom.start || !custom.end} onClick={() => load("custom", group, custom)}>Apply</button>
      </div>}
      <div className="analytics-grouping">
        <span>Group chart by</span>
        <div className="filter-button-group">
          {groups.map(([value, label]) => <button key={value} className={group === value ? "filter-chip active" : "filter-chip"} onClick={() => setGroup(value)}>{label}</button>)}
        </div>
      </div>
    </section>

    {error && <p className="error">{error}</p>}
    {loading && !data ? <section className="panel"><p>Loading sales analytics…</p></section> : <>
      <section className="stats-grid sales-stats-grid">
        <article className="stat-card analytics-stat"><span><FiDollarSign />Recorded sales</span><strong>{money(summary.totalSales, primaryCurrency)}</strong><small>Services {money(data?.serviceSalesTotal || 0, primaryCurrency)} · Products {money(data?.productSalesTotal || 0, primaryCurrency)}</small></article>
        <article className="stat-card analytics-stat"><span><FiCalendar />Completed services</span><strong>{summary.completedServices || 0}</strong><small>Bookings recorded as sales</small></article>
        <article className="stat-card analytics-stat"><span><FiTrendingUp />Average sale</span><strong>{money(summary.averageSale, primaryCurrency)}</strong><small>Average in primary currency</small></article>
        <article className="stat-card analytics-stat"><span><FiPackage />Services sold</span><strong>{summary.servicesSold || 0}</strong><small>Distinct completed services</small></article>
      </section>

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

      {(data?.byChannel?.length > 0 || data?.byPaymentMethod?.length > 0) && <section className="panel currency-summary">
        <div className="panel-title"><div><p className="eyebrow">BREAKDOWN</p><h2>Sales channels & POS payments</h2></div></div>
        <div className="currency-total-list">
          {(data?.byChannel || []).map(item => <div key={"channel-"+item.channel}><strong>{item.channel}</strong><span>{money(item.revenue, primaryCurrency)}</span><small>{item.sales} transaction{item.sales===1?"":"s"}</small></div>)}
          {(data?.byPaymentMethod || []).map(item => <div key={"payment-"+item.method}><strong>POS · {item.method.toUpperCase()}</strong><span>{money(item.revenue, primaryCurrency)}</span><small>{item.sales} sale{item.sales===1?"":"s"}</small></div>)}
        </div>
      </section>}

      <section className="panel sales-records-panel">
        <div className="panel-title"><div><p className="eyebrow">TRANSACTION HISTORY</p><h2>All sales</h2></div><span className="muted">{unifiedTransactions.length} transactions</span></div>
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
      </section>
      {receipt&&<div className="receipt-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setReceipt(null);}}>
        <section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
          <div className="receipt-modal-actions no-print"><button className="secondary icon-link" onClick={()=>window.print()}><FiPrinter/>Print</button><button className="secondary icon-action" aria-label="Close receipt" onClick={()=>setReceipt(null)}><FiX/></button></div>
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
      </div>}
    </>}
  </AppLayout>;
}
