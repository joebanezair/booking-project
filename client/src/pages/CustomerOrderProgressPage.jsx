import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiArrowLeft, FiCheck, FiChevronLeft, FiChevronRight, FiCreditCard, FiExternalLink, FiMapPin,
  FiPackage, FiRefreshCw, FiTruck, FiX
} from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from "../components/ui/dialog.jsx";
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
    return currency + " " + Number(value || 0).toLocaleString();
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
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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
  const selectedItem = selectedItemIndex === null ? null : order?.items?.[selectedItemIndex];
  const selectedImages = selectedItem?.images?.length
    ? selectedItem.images
    : selectedItem?.image ? [selectedItem.image] : [];
  const shownImageIndex = Math.min(activeImageIndex, Math.max(0, selectedImages.length - 1));

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
            {(order.items || []).map((item, index) => <div className="customer-order-progress-product" key={item.productId || item._id || index}>
              <div className="customer-order-progress-product-main">
                <span className="customer-order-progress-product-thumb">
                  {item.image
                    ? <Image src={item.image} alt={item.name || "Ordered product"} loading="lazy"/>
                    : <span className="customer-order-progress-product-placeholder"><FiPackage aria-hidden="true"/></span>}
                </span>
                <div className="customer-order-progress-product-copy">
                  <strong className="customer-order-progress-product-name">{item.name || "Product"}</strong>
                  <span className="customer-order-progress-product-meta">
                    <span>Qty {item.quantity}</span>
                    <span aria-hidden="true">·</span>
                    <span>{money(item.unitPrice, order.currency)} each</span>
                  </span>
                  <button
                    type="button"
                    className="customer-order-progress-product-details"
                    aria-label={`View product details for ${item.name || "product"}`}
                    onClick={() => { setSelectedItemIndex(index); setActiveImageIndex(0); }}
                  >
                    View product details
                  </button>
                </div>
              </div>
              <strong className="customer-order-progress-product-line-total">{money(item.lineTotal, order.currency)}</strong>
            </div>)}
          </div>
          <div className="customer-order-progress-total"><span>Order total</span><strong>{money(order.total, order.currency)}</strong></div>
        </section>
        <Dialog
          title="Product details"
          open={Boolean(selectedItem)}
          onOpenChange={open => { if (!open) setSelectedItemIndex(null); }}
          className="customer-order-product-dialog"
        >
          <DialogContent className="customer-order-product-dialog-content">
            <DialogHeader className="customer-order-product-dialog-header">
              <div>
                <p className="eyebrow">ORDERED PRODUCT</p>
                <DialogTitle>{selectedItem?.name || "Product details"}</DialogTitle>
                <DialogDescription>Product information and images for the item in this order.</DialogDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Close product details"
                onClick={() => setSelectedItemIndex(null)}><FiX aria-hidden="true"/></Button>
            </DialogHeader>
            {selectedItem && <>
              <div className="customer-order-product-gallery">
                <div className="customer-order-product-photo">
                  {selectedImages.length
                    ? <Image src={selectedImages[shownImageIndex]} alt={`${selectedItem.name} — image ${shownImageIndex + 1}`}/>
                    : <span className="customer-order-progress-product-placeholder"><FiPackage aria-hidden="true"/>No product images available</span>}
                </div>
                {selectedImages.length > 1 && <>
                  <div className="customer-order-product-photo-controls">
                    <Button type="button" variant="outline" size="icon" aria-label="Previous image"
                      onClick={() => setActiveImageIndex(index => (index + selectedImages.length - 1) % selectedImages.length)}>
                      <FiChevronLeft aria-hidden="true"/>
                    </Button>
                    <span aria-live="polite">{shownImageIndex + 1} / {selectedImages.length}</span>
                    <Button type="button" variant="outline" size="icon" aria-label="Next image"
                      onClick={() => setActiveImageIndex(index => (index + 1) % selectedImages.length)}>
                      <FiChevronRight aria-hidden="true"/>
                    </Button>
                  </div>
                  <div className="customer-order-product-thumbnails" aria-label="Product image gallery">
                    {selectedImages.map((src, index) => <button
                      key={index}
                      type="button"
                      aria-label={`View image ${index + 1} of ${selectedItem.name}`}
                      aria-pressed={index === shownImageIndex}
                      onClick={() => setActiveImageIndex(index)}
                    ><Image src={src} alt="" loading="lazy"/></button>)}
                  </div>
                </>}
              </div>
              <section className="customer-order-product-description">
                <h3>Description</h3>
                <p>{selectedItem.description || "No product description is available."}</p>
              </section>
              <dl className="customer-order-product-facts">
                {selectedItem.sku && <div><dt>SKU</dt><dd>{selectedItem.sku}</dd></div>}
                <div><dt>Ordered quantity</dt><dd>{selectedItem.quantity}</dd></div>
                <div><dt>Unit price at order</dt><dd>{money(selectedItem.unitPrice, order.currency)}</dd></div>
                <div><dt>Subtotal</dt><dd>{money(selectedItem.lineTotal, order.currency)}</dd></div>
              </dl>
            </>}
          </DialogContent>
        </Dialog>
      </>}

      <p className="customer-history-footnote">Order progress refreshes automatically every 30 seconds. You can also use Refresh status to check for the latest update.</p>
    </div>
  </AppLayout>;
}
