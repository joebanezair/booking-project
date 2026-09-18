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

  const rangeLabel = useMemo(() => {
    if (range === "custom" && custom.start && custom.end) return `${custom.start}_to_${custom.end}`;
    return ranges.find(item => item[0] === range)?.[1] || "Sales";
  }, [range, custom]);

  function selectRange(value) {
    setRange(value);
    if (value !== "custom") setCustom({ start: "", end: "" });
  }

  const primaryCurrency = data?.primaryCurrency || "PHP";
  const summary = data?.summary || {};

  return <AppLayout user={user} onLogout={onLogout}>
    <header className="topbar analytics-topbar">
      <div>
        <p className="eyebrow">SALES & ANALYTICS</p>
        <h1>Completed-service sales</h1>
        <p className="muted">A sale is recorded when a booking is marked completed. This is completed service value, not payment settlement.</p>
      </div>
      <button className="primary-button icon-link" disabled={!data?.records?.length} onClick={() => exportSalesSpreadsheet(data, rangeLabel)}>
        <FiDownload />Export spreadsheet
      </button>
    </header>

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
