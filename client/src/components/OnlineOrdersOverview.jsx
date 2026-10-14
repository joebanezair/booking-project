import { FiCheckCircle, FiClock, FiCreditCard, FiShoppingBag } from "react-icons/fi";

const statusTypes = [
  { key: "pending", label: "Pending", color: "#ACBAFF" },
  { key: "confirmed", label: "Confirmed", color: "#7B9ACF" },
  { key: "processing", label: "Processing", color: "#8D9EEE" },
  { key: "ready", label: "Ready", color: "#6FBBAD" },
  { key: "out_for_delivery", label: "Out for delivery", color: "#E9A34B" },
  { key: "completed", label: "Completed", color: "#5267D7" },
  { key: "cancelled", label: "Cancelled", color: "#A3AAB8" }
];

const circleRadius = 54;
const circumference = 2 * Math.PI * circleRadius;

function money(amount, currency) {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return currency + " " + Number(amount || 0).toFixed(2);
  }
}

function Revenue({ orders, loading }) {
  if (loading) return <strong className="order-overview-value">—</strong>;
  const amounts = new Map();
  for (const order of orders) {
    if (order.status !== "completed") continue;
    const currency = String(order.currency || "PHP").toUpperCase();
    const amount = Number(order.total);
    if (Number.isFinite(amount) && amount >= 0) {
      amounts.set(currency, (amounts.get(currency) || 0) + amount);
    }
  }
  if (!amounts.size) return <strong className="order-overview-value">{money(0, "PHP")}</strong>;
  return <div className="order-overview-revenues">
    {[...amounts].sort(([a],[b])=>a.localeCompare(b)).map(([currency,amount])=>
      <strong className="order-overview-value" key={currency}>{money(amount,currency)}</strong>)}
  </div>;
}

/**
 * Read-only compact overview. All numbers come from the same orders
 * collection as the current storefront orders table.
 */
export default function OnlineOrdersOverview({ orders = [], loading = false }) {
  const total = orders.length;
  const counts = Object.fromEntries(statusTypes.map(({key})=>[key,0]));
  for (const order of orders) if (order.status in counts) counts[order.status] += 1;
  const segments = statusTypes.filter(({key})=>counts[key]>0);
  let offset = 0;
  const arcs = segments.map(segment=>{
    const length = total ? counts[segment.key] / total * circumference : 0;
    const arc = { ...segment, length, offset, count: counts[segment.key] };
    offset += length;
    return arc;
  });
  const statCards = [
    { label: "Total orders", value: total, note: "All orders", Icon: FiShoppingBag },
    { label: "Pending", value: counts.pending, note: "Awaiting action", Icon: FiClock },
    { label: "Completed", value: counts.completed, note: "Fulfilled orders", Icon: FiCheckCircle },
    { label: "Total sales", note: "Completed online sales", Icon: FiCreditCard, revenue: true }
  ];
  return <section className="online-order-overview" aria-label="Online order overview">
    <div className="order-overview-heading">
      <div>
        <p className="order-overview-eyebrow">ANALYTICS</p>
        <h2>Order overview</h2>
      </div>
      <span className="order-overview-period">{total >= 200 ? "Recent 200 orders" : "All time"}</span>
    </div>
    <div className="order-overview-layout">
      <div className="order-overview-chart">
        <svg className="order-overview-donut" viewBox="0 0 180 170"
          role="img" aria-label={loading ? "Loading order distribution" : `${total} orders: ${segments.map(s=>s.label+" "+s.count).join(", ") || "none"}`}>
          <circle cx="90" cy="83" r={circleRadius} fill="none" stroke="currentColor" strokeWidth="18" className="order-overview-track" />
          {!loading && arcs.map(arc=>
            <circle key={arc.key} cx="90" cy="83" r={circleRadius} fill="none"
              stroke={arc.color} strokeWidth="18"
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.offset}
              transform="rotate(-90 90 83)" />
          )}
          <text x="90" y="85" className="order-overview-donut-number" textAnchor="middle">
            {loading ? "—" : total}
          </text>
          <text x="90" y="106" className="order-overview-donut-label" textAnchor="middle">orders</text>
        </svg>
        <div className="order-overview-legend">
          {!loading && segments.length ? segments.map(arc=>
            <div className="order-overview-legend-item" key={arc.key}>
              <span className="order-overview-dot" style={{background:arc.color}} aria-hidden="true"/>
              <span>{arc.label} {Math.round(arc.count / total * 100)}%</span>
            </div>) : <span className="order-overview-empty-label">{loading ? "Loading orders…" : "No orders yet"}</span>}
        </div>
      </div>
      <div className="order-overview-stats">
        {statCards.map(({label,value,note,Icon,revenue})=>
          <div className="order-overview-stat" key={label}>
            <div className="order-overview-stat-heading">
              <Icon aria-hidden="true"/>
              <span>{label}</span>
            </div>
            {revenue?<Revenue orders={orders} loading={loading}/>:
              <strong className="order-overview-value">{loading ? "—" : value}</strong>}
            <small>{note}</small>
          </div>)}
      </div>
    </div>
  </section>;
}
