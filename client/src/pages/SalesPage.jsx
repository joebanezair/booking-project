import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiDollarSign, FiDownload, FiPackage, FiTrendingUp } from "react-icons/fi";
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
  const [products,setProducts]=useState([]);
  const [posSales,setPosSales]=useState([]);
  const [cart,setCart]=useState({});
  const [paymentMethod,setPaymentMethod]=useState("cash");
  const [customerName,setCustomerName]=useState("");
  const [productForm,setProductForm]=useState({name:"",sku:"",description:"",price:"",currency:"PHP",stock:"",published:true});

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
  useEffect(() => { Promise.all([api.sales.products(),api.sales.posSales()]).then(([items,sales])=>{setProducts(items);setPosSales(sales);}).catch(e=>setError(e.message)); }, []);

  const rangeLabel = useMemo(() => {
    if (range === "custom" && custom.start && custom.end) return `${custom.start}_to_${custom.end}`;
    return ranges.find(item => item[0] === range)?.[1] || "Sales";
  }, [range, custom]);

  function selectRange(value) {
    setRange(value);
    if (value !== "custom") setCustom({ start: "", end: "" });
  }

  async function addProduct(event){event.preventDefault();try{const item=await api.sales.createProduct(productForm);setProducts(current=>[item,...current]);setProductForm({name:"",sku:"",description:"",price:"",currency:"PHP",stock:"",published:true});}catch(e){setError(e.message);}}
  async function checkout(){const items=Object.entries(cart).filter(([,quantity])=>quantity>0).map(([productId,quantity])=>({productId,quantity}));if(!items.length)return setError("Add a product to the POS cart.");try{const sale=await api.sales.checkout({items,paymentMethod,customerName});const refreshed=await api.sales.products();setProducts(refreshed);setPosSales(current=>[sale,...current]);setCart({});setCustomerName("");setError("");}catch(e){setError(e.message);}}
  const cartTotal=products.reduce((sum,item)=>sum+Number(item.price||0)*Number(cart[item._id]||0),0);

  const primaryCurrency = data?.primaryCurrency || "PHP";
  const summary = data?.summary || {};

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar analytics-topbar">
      <div>
        <p className="eyebrow">SALES & ANALYTICS</p>
        <h1>Sales, products & POS</h1>
        <p className="muted">Manage products and stock, record in-store POS sales, and review completed service sales.</p>
      </div>
      <button className="primary-button icon-link" disabled={!data?.records?.length} onClick={() => exportSalesSpreadsheet(data, rangeLabel)}>
        <FiDownload />Export spreadsheet
      </button>
    </header>

    <div className="pos-essential-grid">
      <section className="panel"><div className="panel-title"><div><p className="eyebrow">PRODUCTS</p><h2>Products & inventory</h2></div><span className="count">{products.length}</span></div>
        <form className="product-quick-form" onSubmit={addProduct}><label>Name<input required value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/></label><label>SKU<input value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})}/></label><label>Price<input required type="number" min="0" step="0.01" value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></label><label>Stock<input required type="number" min="0" step="1" value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})}/></label><label className="check-row"><input type="checkbox" checked={productForm.published} onChange={e=>setProductForm({...productForm,published:e.target.checked})}/>Publish on profile</label><button className="primary-button">Add product</button></form>
        <div className="product-essential-list">{products.map(item=><div key={item._id}><div><strong>{item.name}</strong><small>{item.sku||"No SKU"} · {money(item.price,item.currency)}</small></div><span>{item.stock} in stock</span></div>)}</div>
      </section>
      <section className="panel"><div className="panel-title"><div><p className="eyebrow">POINT OF SALE</p><h2>Cashier checkout</h2></div></div>
        <div className="pos-product-list">{products.map(item=><div key={item._id}><div><strong>{item.name}</strong><small>{money(item.price,item.currency)} · {item.stock} available</small></div><input aria-label={"Quantity for "+item.name} type="number" min="0" max={item.stock} value={cart[item._id]||0} onChange={e=>setCart({...cart,[item._id]:Math.min(item.stock,Math.max(0,Number(e.target.value)))})}/></div>)}</div>
        <label>Customer name <span className="muted">(optional)</span><input value={customerName} onChange={e=>setCustomerName(e.target.value)}/></label><label>Payment<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="gcash">GCash</option><option value="maya">Maya</option><option value="card">Card</option><option value="other">Other</option></select></label>
        <div className="pos-total"><span>Total</span><strong>{money(cartTotal,products[0]?.currency||"PHP")}</strong></div><button className="primary-button" onClick={checkout} disabled={!cartTotal}>Complete sale</button>
      </section>
    </div>
    <section className="panel pos-history-panel"><div className="panel-title"><div><p className="eyebrow">PRODUCT SALES</p><h2>POS sales</h2></div><span className="muted">{posSales.length} records</span></div>{!posSales.length?<p className="muted">No product sales yet.</p>:<div className="sales-table-wrap"><table className="sales-table"><thead><tr><th>Date</th><th>Invoice</th><th>Items</th><th>Payment</th><th>Total</th></tr></thead><tbody>{posSales.map(sale=><tr key={sale._id}><td>{new Date(sale.soldAt).toLocaleString()}</td><td>{sale.invoiceNumber}</td><td>{sale.items?.map(item=>item.name+" × "+item.quantity).join(", ")}</td><td>{sale.paymentMethod}</td><td><strong>{money(sale.total,sale.currency)}</strong></td></tr>)}</tbody></table></div>}</section>

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
        <article className="stat-card analytics-stat"><span><FiDollarSign />Recorded sales</span><strong>{money(summary.totalSales, primaryCurrency)}</strong><small>{data?.totalsByCurrency?.length > 1 ? `Primary currency · ${data.totalsByCurrency.length} currencies recorded` : "Completed booking value"}</small></article>
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
          <div className="panel-title"><div><p className="eyebrow">SERVICES</p><h2>Sales by service</h2></div></div>
          <ServiceSalesChart data={data?.byService || []} currency={primaryCurrency} />
        </section>
      </div>

      <section className="panel sales-records-panel">
        <div className="panel-title"><div><p className="eyebrow">SALES RECORDS</p><h2>Completed bookings</h2></div><span className="muted">{data?.records?.length || 0} records</span></div>
        {!data?.records?.length ? <p className="muted">No completed booking sales in this period.</p> : <div className="sales-table-wrap">
          <table className="sales-table">
            <thead><tr><th>Completed</th><th>Customer</th><th>Service</th><th>Amount</th><th>Booking date</th><th>Status</th></tr></thead>
            <tbody>{data.records.map(record => <tr key={record.id}>
              <td data-label="Completed">{new Date(record.completedAt).toLocaleString()}</td>
              <td data-label="Customer"><strong>{record.guestName || "Guest"}</strong><small>{record.guestEmail || record.guestPhone || ""}</small></td>
              <td data-label="Service">{record.serviceName}</td>
              <td data-label="Amount"><strong>{money(record.saleAmount, record.currency || primaryCurrency)}</strong></td>
              <td data-label="Booking date">{new Date(record.bookingDate).toLocaleString()}</td>
              <td data-label="Status"><span className="status completed">recorded</span></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
    </>}
  </AppLayout>;
}
