import "../admin-transparency.css";
import { useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiDownload, FiRefreshCw, FiInfo } from "react-icons/fi";
import { Button } from "./ui/button.jsx";
import { api } from "../api.js";
import { exportAdminBusinessWorkbook } from "../utils/exportAdminBusinessWorkbook.js";

const ranges = [{ value: "all", label: "All time" }, { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" }, { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last year" }];
const channelOptions = [{ value: "pos", label: "POS" }, { value: "online", label: "Online orders" },
  { value: "services", label: "Service sales" }];
const formatAmount = (value, currency = "PHP") =>
  value == null ? "Not available" : new Intl.NumberFormat("en-PH", {
    style: "currency", currency: currency || "PHP", maximumFractionDigits: 2, minimumFractionDigits: 2
  }).format(Number(value) || 0);
const formatDate = value => value ? new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—";
const status = value => String(value || "—").replaceAll("_", " ");

function DataTable({ columns, rows }) {
  return <div className="admin-transparency-table-wrap">
    <table className="admin-transparency-table">
      <thead><tr>{columns.map(item => <th key={item.key} scope="col">{item.label}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map(item => <tr key={item._id}>
        {columns.map(column => <td key={column.key}>{column.render ? column.render(item) : String(item[column.key] ?? "—")}</td>)}
      </tr>) : <tr><td colSpan={columns.length} className="admin-transparency-no-data">No records for this selection.</td></tr>}</tbody>
    </table>
  </div>;
}

export default function BusinessTransparency({ businessId, section, businessName = "Business" }) {
  const [range, setRange] = useState("all");
  const [channel, setChannel] = useState("pos");
  const [cursor, setCursor] = useState("");
  const [previous, setPrevious] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { setCursor(""); setPrevious([]); }, [businessId, section, range, channel]);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    api.admin.businessTransparency(businessId, { section, range, channel, before: cursor, limit: 50 })
      .then(value => { if (active) setReport(value); })
      .catch(err => { if (active) { setReport(null); setError(err.message); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [businessId, section, range, channel, cursor, refresh]);

  async function exportExcel() {
    setExporting(true);
    setError("");
    try { await exportAdminBusinessWorkbook({
      businessName, range,
      load: params => api.admin.businessTransparency(businessId, params)
    }); } catch (err) { setError(err.message || "Could not export report."); }
    finally { setExporting(false); }
  }

  const summary = report?.summary;
  const currencies = summary?.totalsByCurrency || [];
  const rows = report?.rows || [];
  const currencyFor = row => row.currency || "PHP";
  const columns = section === "products" ? [
    { key: "name", label: "Product" },
    { key: "price", label: "Selling price", render: r => formatAmount(r.price, currencyFor(r)) },
    { key: "unitCost", label: "Initial cost", render: r => r.unitCost == null ? "Not provided" : formatAmount(r.unitCost, currencyFor(r)) },
    { key: "stock", label: "Stock" }, { key: "sold", label: "Units sold" },
    { key: "gross", label: "Gross sales", render: r => formatAmount(r.gross, currencyFor(r)) },
    { key: "grossProfit", label: "Gross profit", render: r => r.profitComplete ? formatAmount(r.grossProfit, currencyFor(r)) : "Not available" },
    { key: "published", label: "Status", render: r => r.published ? "Published" : "Draft" }
  ] : section === "services" ? [
    { key: "title", label: "Service" },
    { key: "price", label: "Listed price", render: r => formatAmount(r.price, currencyFor(r)) },
    { key: "published", label: "Status", render: r => r.published ? "Published" : "Draft" },
    { key: "allowBookings", label: "Bookings", render: r => r.allowBookings ? "Enabled" : "Disabled" },
    { key: "updatedAt", label: "Last updated", render: r => formatDate(r.updatedAt) }
  ] : section === "bookings" ? [
    { key: "bookingReference", label: "Booking", render: r => r.bookingReference || String(r._id).slice(-8) },
    { key: "service", label: "Service" },
    { key: "servicePrice", label: "Price", render: r => formatAmount(r.servicePrice, currencyFor(r)) },
    { key: "status", label: "Status", render: r => status(r.status) },
    { key: "bookingDate", label: "Scheduled", render: r => formatDate(r.bookingDate) },
    { key: "history", label: "Recorded history", render: r => r.history?.length
      ? <details><summary>{r.history.length} events</summary><div className="admin-transparency-history">{r.history.map((h, i) =>
          <p key={i}>{formatDate(h.at)} · {status(h.action)} {h.status ? `(${status(h.status)})` : ""}</p>)}</div></details> : "—" }
  ] : section === "transactions" ? [
    { key: "reference", label: "Reference" },
    { key: "date", label: "Date", render: r => formatDate(r.date) },
    { key: "items", label: "Items / Service", render: r => r.items?.length
      ? <details><summary>{r.items.length} item(s)</summary><div className="admin-transparency-history">{r.items.map((item, i) =>
          <p key={i}>{item.quantity} × {item.name} · {formatAmount(item.lineTotal, currencyFor(r))}
            {channel === "pos" ? ` · Cost: ${item.unitCost == null ? "Not recorded" : formatAmount(item.unitCost, currencyFor(r))}` : ""}</p>)}</div></details>
      : r.serviceName || "—" },
    { key: "amount", label: "Gross amount", render: r => formatAmount(r.amount, currencyFor(r)) },
    { key: "paymentMethod", label: "Payment", render: r => r.paymentMethod || "—" },
    { key: "paymentStatus", label: "Payment status", render: r => status(r.paymentStatus) },
    { key: "status", label: "Status", render: r => status(r.status) }
  ] : section === "audit" ? [
    { key: "createdAt", label: "Date", render: r => formatDate(r.createdAt) },
    { key: "action", label: "Action" }, { key: "detail", label: "Details" },
    { key: "quantity", label: "Stock change", render: r => r.quantity == null ? "—" : `${r.quantity > 0 ? "+" : ""}${r.quantity}` },
    { key: "stockAfter", label: "Stock after", render: r => r.stockAfter ?? "—" },
    { key: "actor", label: "Actor", render: r => r.actor ? String(r.actor) : "System / transaction" }
  ] : [];

  return <section className="admin-transparency" aria-label="Business transparency">
    <div className="admin-transparency-toolbar">
      <div>
        <h2>{section === "audit" ? "Recorded activity & audit logs" : section === "financials" ? "Financial transparency" :
          section === "transactions" ? "Transaction ledger" : section === "products" ? "Products & inventory" :
          section === "bookings" ? "Bookings & history" : "Services"}</h2>
        <p className="muted">Admin-only business records. All currencies remain separate.</p>
      </div>
      <div className="admin-transparency-actions">
        <label className="admin-transparency-filter">Period
          <select value={range} onChange={event => setRange(event.target.value)}>
            {ranges.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        {section === "transactions" && <label className="admin-transparency-filter">Channel
          <select value={channel} onChange={event => setChannel(event.target.value)}>
            {channelOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setRefresh(n => n + 1)}>
          <FiRefreshCw /> Refresh</Button>
        <Button type="button" variant="outline" size="sm" disabled={exporting || busy} onClick={exportExcel}>
          <FiDownload /> {exporting ? "Preparing…" : "Export Excel"}
        </Button>
      </div>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {busy && <p className="muted" role="status">Loading {section}…</p>}
    {!busy && summary && <>
      {section === "financials" ? <>
        <div className="admin-transparency-cards">
          {currencies.length ? currencies.map(row => <article key={row.currency} className="admin-transparency-currency">
            <strong>{row.currency} financial breakdown</strong>
            <dl>
              <div><dt>Service sales (gross)</dt><dd>{formatAmount(row.services, row.currency)}</dd></div>
              <div><dt>POS sales (gross)</dt><dd>{formatAmount(row.pos, row.currency)}</dd></div>
              <div><dt>Completed online orders (value)</dt><dd>{formatAmount(row.online, row.currency)}</dd></div>
              <div className="admin-transparency-total"><dt>Total gross operational sales</dt><dd>{formatAmount(row.gross, row.currency)}</dd></div>
              <div><dt>Known POS cost of goods sold</dt><dd>{formatAmount(row.knownPosCost, row.currency)}</dd></div>
              <div><dt>POS gross profit</dt><dd>{formatAmount(row.posGrossProfit, row.currency)}</dd></div>
              <div><dt>Combined gross profit</dt><dd>{formatAmount(row.overallGrossProfit, row.currency)}</dd></div>
              <div><dt>Uncosted POS item lines</dt><dd>{row.missingPosCostLines}</dd></div>
              <div><dt>Recorded sales transactions</dt><dd>{row.transactions}</dd></div>
            </dl>
          </article>) : <p className="muted">No recorded sales in this period.</p>}
        </div>
        <p className="admin-transparency-note"><FiInfo /> Gross sale totals do not deduct processing fees, overhead, or unrecorded refunds. Revenue is not the same as profit or payout.</p>
      </> : <>
        <div className="admin-transparency-keyfigures">
          <div><span>Total posted products</span><strong>{summary.products.posted ?? 0}</strong></div>
          <div><span>Total products</span><strong>{summary.products.total ?? 0}</strong></div>
          <div><span>Available stock units</span><strong>{summary.products.stockUnits ?? 0}</strong></div>
          <div><span>Services</span><strong>{summary.services ?? 0}</strong></div>
          <div><span>Bookings in period</span><strong>{summary.bookings.total ?? 0}</strong></div>
        </div>
        <DataTable columns={columns} rows={rows} />
        <div className="admin-transparency-pagination">
          <span>{rows.length ? `Showing ${rows.length} records` : "No records"}{previous.length ? ` · Page ${previous.length + 1}` : ""}</span>
          <div>
            <Button variant="outline" size="sm" disabled={busy || !previous.length} onClick={() => {
              setCursor(previous[previous.length - 1] || "");
              setPrevious(list => list.slice(0, -1));
            }}><FiChevronLeft /> Previous</Button>
            <Button variant="outline" size="sm" disabled={busy || !report.hasMore || !report.nextCursor} onClick={() => {
              setPrevious(list => [...list, cursor]); setCursor(report.nextCursor);
            }}>Next <FiChevronRight /></Button>
          </div>
        </div>
      </>}
      <div className="admin-transparency-caveats">
        <strong>Data coverage</strong>
        <ul>{summary.limitations.map(note => <li key={note}>{note}</li>)}</ul>
      </div>
    </>}
  </section>;
}
