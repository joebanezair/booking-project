import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiArrowLeft, FiCheck, FiCreditCard, FiExternalLink, FiMapPin,
  FiPackage, FiRefreshCw, FiTruck
} from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import { Image } from "../components/ui/image.jsx";
import AppLayout from "../components/AppLayout.jsx";
import { api } from "../api.js";

const phases = [
  ["pending", "Order placed"],
  ["confirmed", "Confirmed"],
  ["processing", "Processing"],
  ["ready", "Ready"],
  ["out_for_delivery", "Out for delivery"],
  ["completed", "Completed"]
];

const statusNames = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled"
};

function money(value, currency = "PHP") {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency", currency, maximumFractionDigits: 2
    }).format(Number(value || 0));
  } catch {
    return \`\${currency} \${Number(value || 0).toLocaleString()}\`;
  }
}

function dateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  }).format(date);
}

export default function CustomerOrderProgressPage({ user, onLogout }) {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOrder = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const result = await api.customerHistory.purchaseProgress(orderId);
      setOrder(result);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load order progress.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder(true);
    const interval = window.setInterval(() => loadOrder(false), 30000);
    return () => window.clearInterval(interval);
  }, [loadOrder]);

  const currentIndex = phases.findIndex(([key]) => key === order?.status);
  const cancelled = order?.status === "cancelled";

  return <AppLayout user={user} onLogout={onLogout}>
    <div className="customer-history-page customer-order-progress-page">
      <div className="customer-order-progress-topbar">
        <Link className="customer-history-back" to="/dashboard/profile/purchases">
          <FiArrowLeft aria-hidden="true"/> Back to Purchase History
        </Link>
        <Button type="button" variant="outline" onClick={() => loadOrder(false)} disabled={refreshing || loading}>
          <FiRefreshCw aria-hidden="true"/>{refreshing ? "Refreshing…" : "Refresh status"}
        </Button>
      </div>

      <header className="customer-order-progress-heading">
        <p className="eyebrow">MY PURCHASE</p>
        <h1>Order progress</h1>
        {order && <p className="customer-order-progress-reference">{order.orderNumber}</p>}
        <p className="muted">Follow your order from confirmation through delivery.</p>
      </header>

      {loading && !order && <div className="customer-history-empty"><FiRefreshCw className="customer-history-spin"/><p>Loading order progress…</p></div>}
      {error && <p className="error customer-history-error" role="alert">{error}</p>}

      {order && <>
        <section className="customer-order-progress-panel">
          <div className="customer-order-progress-panel-head">
            <div>
              <small>ORDER STATUS</small>
              <strong>{statusNames[order.status] || order.status}</strong>
            </div>
            <span className="customer-history-status">{statusNames[order.status] || order.status}</span>
          </div>
          {cancelled
            ? <p className="customer-order-cancelled">This order was cancelled. Contact the seller if you need more information.</p>
            : <ol className="customer-order-timeline" aria-label="Order fulfillment progress">
                {phases.map(([key, label], index) => {
                  const done = currentIndex >= 0 && index <= currentIndex;
                  const current = key === order.status;
                  return <li key={key} className={current ? "is-current" : done ? "is-done" : "is-upcoming"} aria-current={current ? "step" : undefined}>
                    <span className="customer-order-timeline-marker">{done ? <FiCheck aria-hidden="true"/> : index + 1}</span>
                    <span className="customer-order-timeline-label">
                      <strong>{label}</strong>
                      {current && <small>Current stage</small>}
                      {key === "pending" && <small>{dateTime(order.createdAt)}</small>}
                      {key === "completed" && order.completedAt && done && <small>{dateTime(order.completedAt)}</small>}
                    </span>
                  </li>;
                })}
              </ol>}
          <p className="customer-order-progress-updated">Last order update: {dateTime(order.updatedAt || order.createdAt)}</p>
        </section>

        <div className="customer-order-progress-grid">
          <section className="customer-order-progress-panel">
            <h2><FiTruck aria-hidden="true"/> Delivery details</h2>
            <dl className="customer-order-progress-facts">
              <div><dt>Seller</dt><dd>{order.seller?.name || "BookFlow business"}</dd></div>
              <div><dt>Delivery address</dt><dd>{order.deliveryLocation || "Not provided"}</dd></div>
              {order.courierName && <div><dt>Courier</dt><dd>{order.courierName}</dd></div>}
              {order.trackingNumber && <div><dt>Tracking number</dt><dd>{order.trackingNumber}</dd></div>}
              {order.trackingUrl && <div><dt>Courier link</dt><dd><a href={order.trackingUrl} target="_blank" rel="noreferrer">Track shipment <FiExternalLink aria-hidden="true"/></a></dd></div>}
            </dl>
            {!order.courierName && !order.trackingNumber && !order.trackingUrl &&
              <p className="muted customer-order-progress-empty">The seller has not added courier information yet.</p>}
          </section>

          <section className="customer-order-progress-panel">
            <h2><FiCreditCard aria-hidden="true"/> Payment</h2>
            <dl className="customer-order-progress-facts">
              <div><dt>Payment status</dt><dd>{String(order.paymentStatus || "unpaid").replaceAll("_", " ")}</dd></div>
              <div><dt>Payment method</dt><dd>{String(order.paymentMethod || "—").replaceAll("_", " ")}</dd></div>
              <div><dt>Amount paid</dt><dd>{money(order.amountPaid, order.currency)}</dd></div>
              {order.paidAt && <div><dt>Paid on</dt><dd>{dateTime(order.paidAt)}</dd></div>}
            </dl>
          </section>
        </div>

        <section className="customer-order-progress-panel customer-order-progress-items">
          <h2><FiPackage aria-hidden="true"/> Ordered products</h2>
          <div className="customer-order-progress-product-list">
            {(order.items || []).map((item, index) => <div className="customer-order-progress-product" key={index}>
              {item.image
                ? <Image src={item.image} alt={item.name} loading="lazy"/>
                : <span className="customer-order-progress-product-placeholder"><FiPackage aria-hidden="true"/></span>}
              <div><strong>{item.name}</strong><small>Qty {item.quantity} · {money(item.unitPrice, order.currency)} each</small></div>
              <strong>{money(item.lineTotal, order.currency)}</strong>
            </div>)}
          </div>
          <div className="customer-order-progress-total"><span>Order total</span><strong>{money(order.total, order.currency)}</strong></div>
        </section>
      </>}

      <p className="customer-history-footnote">Order progress refreshes automatically every 30 seconds. You can also use Refresh status to check for the latest update.</p>
    </div>
  </AppLayout>;
}
