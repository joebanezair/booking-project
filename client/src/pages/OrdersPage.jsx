import { Card } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Select } from "../components/ui/select.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { Label } from "../components/ui/label.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog.jsx";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "../components/AppLayout.jsx";
import { api } from "../api.js";

const statuses = ["pending","confirmed","processing","ready","out_for_delivery","completed","cancelled"];
const methods = ["cash","gcash","maya","bank_transfer","other"];
export default function OrdersPage({user,onLogout}) {
  const [orders,setOrders] = useState([]);
  const [filter,setFilter] = useState("all");
  const [error,setError] = useState("");
  const [paying,setPaying] = useState(null);
  const [saving,setSaving] = useState(false);
  const [changing,setChanging] = useState("");
  const load = () => api.sales.orders().then(setOrders).catch(e=>setError(e.message));
  useEffect(() => { load(); }, []);
  const shown = useMemo(()=>filter==="all"?orders:orders.filter(o=>o.status===filter),[orders,filter]);

  async function status(id,nextStatus) {
    if (changing) return;
    setChanging(id);
    try {
      const updated = await api.sales.setOrderStatus(id,nextStatus);
      setOrders(current=>current.map(o=>o._id===id?updated:o));
      setError("");
    } catch(e) { setError(e.message); }
    finally { setChanging(""); }
  }

  async function payment(e) {
    e.preventDefault();
    if (!paying || saving) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError("");
    try {
      await api.sales.recordOrderPayment(paying._id, {
        paymentMethod: fd.get("method"), amountPaid: Number(fd.get("amount")),
        paymentReference: fd.get("reference"), paymentNotes: fd.get("notes")
      });
      setPaying(null);
      await load();
    } catch(err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar"><div><p className="eyebrow">ORDERS</p><h1>Product orders</h1>
      <p className="muted">Manage fulfillment and record manual payments without a payment API.</p></div></header>
    <div className="order-filter-row" role="group" aria-label="Filter orders by status">
      {["all",...statuses].map(s=><Button type="button" variant={filter===s?"secondary":"ghost"}
        className={filter===s?"active":""} aria-pressed={filter===s}
        onClick={()=>setFilter(s)} key={s}>{s.replaceAll("_"," ")}</Button>)}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="order-grid" aria-label="Product orders">
      {shown.length===0&&<p className="muted">No orders match this filter.</p>}
      {shown.map(o=><Card as="article" className="panel order-card" key={o._id}>
        <div className="order-card-head"><div><strong>{o.orderNumber}</strong><p>{o.customerName}</p></div><span>{o.paymentStatus||"unpaid"}</span></div>
        <p>{o.items?.map(i=>i.name+" × "+i.quantity).join(", ")}</p>
        <strong>{new Intl.NumberFormat("en-PH",{style:"currency",currency:o.currency||"PHP"}).format(o.total||0)}</strong>
        <div className="order-actions"><Select aria-label={`Order status for ${o.orderNumber}`}
          value={o.status} disabled={changing===o._id||o.status==="completed"}
          onChange={e=>status(o._id,e.target.value)}>
          {statuses.map(s=><option value={s} key={s}>{s.replaceAll("_"," ")}</option>)}
        </Select>
          <Button type="button" variant="outline" disabled={o.status==="completed"} title={o.status==="completed"?"Completed sales are read-only":undefined} onClick={()=>setPaying(o)}>Record payment</Button>
        </div>
      </Card>)}
    </section>

    <Dialog open={Boolean(paying)} onOpenChange={open=>{if(!open&&!saving)setPaying(null);}}
      title="Record manual payment" dismissible={!saving}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record manual payment</DialogTitle>
          <DialogDescription>{paying?.orderNumber} · Total {paying?.total} {paying?.currency}</DialogDescription>
        </DialogHeader>
        {paying && <form id="order-payment-form" onSubmit={payment} key={paying._id}>
          <Label>Method<Select name="method" defaultValue={paying.paymentMethod||"cash"}>
            {methods.map(m=><option value={m} key={m}>{m.replaceAll("_"," ")}</option>)}
          </Select></Label>
          <Label>Amount<Input name="amount" type="number" min="0" step="0.01" required
            defaultValue={paying.amountPaid||paying.total}/></Label>
          <Label>Reference<Input name="reference" defaultValue={paying.paymentReference||""}
            placeholder="Optional reference"/></Label>
          <Label>Notes<Textarea name="notes" defaultValue={paying.paymentNotes||""}/></Label>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={()=>setPaying(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving?"Saving payment...":"Save payment"}</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </AppLayout>;
}
