import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowRight, FiBarChart2, FiBriefcase, FiCalendar,
  FiTrendingUp
} from "react-icons/fi";
import { FaMoneyBillTrendUp } from "react-icons/fa6";
import { Button } from "./ui/button.jsx";
import { SalesTrendChart, ServiceSalesChart } from "./SalesCharts.jsx";

export const DASHBOARD_RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" }
];

function currencyFormat(value, currency) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0)); }
  catch { return `${currency} ${Number(value || 0).toLocaleString()}`; }
}

function MetricSparkline({ points, tone }) {
  const numbers = (points || []).map(point => Number(point || 0)).filter(Number.isFinite);
  if (numbers.length < 2 || !numbers.some(Boolean)) return null;
  const max = Math.max(...numbers, 1);
  const min = Math.min(...numbers, 0);
  const spread = Math.max(1, max - min);
  const path = numbers.map((value, index) => {
    const x = 3 + index / (numbers.length - 1) * 114;
    const y = 29 - (value - min) / spread * 23;
    return `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  return <svg className={`dashboard-metric-sparkline tone-${tone}`} viewBox="0 0 120 36" preserveAspectRatio="none"
    aria-hidden="true"><path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function SinglePeriodSummary({ point, value, unit }) {
  // One recorded point is not a trend: show the actual observation rather
  // than placing a misleading disconnected dot in a line graph.
  return <div className="dashboard-single-period" role="group"
    aria-label={`${value} ${unit} in ${point.label}`}>
    <strong>{value}</strong>
    <span>{point.label}</span>
    <small>One reporting period has data. A trend appears once another period records activity.</small>
  </div>;
}

function groupingKey(date, range) {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return null;
  // Dates in completed sale records already correspond to genuine transactions.
  if (range === "year" || range === "all") return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function completionTrend(records, range, currency) {
  const countByDate = new Map();
  for (const record of records || []) {
    if (currency && (record.currency || "PHP") !== currency) continue;
    const date = groupingKey(record.completedAt, range);
    if (date) countByDate.set(date, { total: (countByDate.get(date)?.total || 0) + 1, time: new Date(record.completedAt).getTime() });
  }
  return [...countByDate.entries()].sort((a, b) => a[1].time - b[1].time).map(([date, info]) => ({ key: date, label: date, revenue: info.total }));
}

function byRealService(records, currency) {
  const rows = new Map();
  for (const sale of records || []) {
    if ((sale.currency || "PHP") !== currency) continue;
    const label = sale.serviceName || "Service";
    const row = rows.get(label) || { service: label, sales: 0, revenue: 0 };
    row.sales += 1;
    row.revenue += Number(sale.saleAmount || 0);
    rows.set(label, row);
  }
  return [...rows.values()].sort((a, b) => b.sales - a.sales || b.revenue - a.revenue || a.service.localeCompare(b.service));
}

function BookingStatus({ summary, loading }) {
  const total = summary?.total || 0;
  const groups = [
    { key: "completed", label: "Completed", color: "var(--dashboard-green)", value: summary?.completed || 0 },
    { key: "upcoming", label: "Upcoming", color: "var(--dashboard-blue)", value: summary?.upcoming || 0 },
    { key: "cancelled", label: "Cancelled / no-show", color: "var(--dashboard-orange)", value: summary?.cancelled || 0 }
  ];
  let start = 0;
  const segments = groups.map(group => {
    const from = start;
    start += total ? group.value / total * 100 : 0;
    return total && group.value ? `${group.color} ${from}% ${start}%` : "";
  }).filter(Boolean);
  const empty = !loading && total === 0;
  return <section className={`dashboard-v2-status${empty ? " is-empty" : ""}`} aria-labelledby="dashboard-service-status-title">
    <h3 id="dashboard-service-status-title">Booking status</h3>
    <p className="dashboard-v2-muted">Booking activity for this period</p>
    <div className="dashboard-status-content">
      {empty
        ? <div className="dashboard-status-zero" role="status">
            <strong>0</strong>
            <span>No bookings in this period</span>
          </div>
        : <div className="dashboard-status-donut"
            style={{ background: segments.length ? `conic-gradient(${segments.join(", ")})` : "var(--dashboard-track)" }}
            role="img" aria-label={total ? `${total} bookings: ${groups.map(item => `${item.label} ${item.value}`).join(", ")}` : "No bookings in this period"}>
            <div className="dashboard-status-hole">
              <strong>{loading ? "—" : total}</strong><span>Total</span>
            </div>
          </div>}
      <div className="dashboard-status-legend">
        {groups.map(item => <div className="dashboard-status-row" key={item.key}>
          <span className="dashboard-status-dot" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span className="dashboard-status-name">{item.label}</span>
          <strong>{loading ? "—" : item.value}</strong>
          <small>{total ? Math.round(item.value / total * 100) : 0}%</small>
        </div>)}
      </div>
    </div>
  </section>;
}

export default function DashboardAnalytics({ data, statusSummary, range = "month", loading, statusLoading, visibility = {} }) {
  const [chartTab, setChartTab] = useState("sales");
  const primaryCurrency = data?.primaryCurrency || "PHP";
  const summary = data?.summary;
  const realServices = useMemo(() => byRealService(data?.records, primaryCurrency), [data, primaryCurrency]);
  const completedTrend = useMemo(() => completionTrend(data?.records, range, primaryCurrency), [data, range, primaryCurrency]);
  const salesTrend = data?.trend || [];
  const metrics = [
    { key: "sales", label: "This period", value: summary ? currencyFormat(summary.totalSales, primaryCurrency) : "—", description: "Recorded service and product sales", icon: FaMoneyBillTrendUp, tone: "blue", series: salesTrend.map(item => item.revenue) },
    { key: "completed", label: "Completed", value: summary?.completedServices ?? "—", description: "Services completed this period", icon: FiCalendar, tone: "green", series: completedTrend.map(item => item.revenue) },
    { key: "average", label: "Average sale", value: summary ? currencyFormat(summary.averageSale, primaryCurrency) : "—", description: "Primary currency", icon: FiTrendingUp, tone: "purple", series: [] },
    { key: "services", label: "Services sold", value: summary?.servicesSold ?? "—", description: "Distinct services this period", icon: FiBriefcase, tone: "orange", series: [] }
  ];
  const title = DASHBOARD_RANGES.find(item => item.value === range)?.label || "This month";
  const statKeys = { sales: "statSales", completed: "statCompleted", average: "statAverage", services: "statServices" };
  const visibleMetrics = metrics.filter(metric => visibility[statKeys[metric.key]] !== false);
  const panelKeys = ["salesOverview", "serviceStatus", "topServices"];
  const visiblePanels = panelKeys.filter(key => visibility[key] !== false);
  const chartHasData = chartTab === "services"
    ? realServices.length > 0
    : chartTab === "completed" ? completedTrend.length > 0 : salesTrend.length > 0;
  const statusEmpty = !statusLoading && !Number(statusSummary?.total || 0);
  const topServicesEmpty = !realServices.length;
  const allPanelsEmpty = visiblePanels.length > 0 && visiblePanels.every(key =>
    key === "salesOverview" ? !chartHasData && !loading
      : key === "serviceStatus" ? statusEmpty
      : topServicesEmpty && !loading
  );
  if (!visibleMetrics.length && !visiblePanels.length) return null;
  return <section className="business-dashboard-analytics dashboard-v2-analytics" aria-label="Business analytics">
    {visibleMetrics.length > 0 && <div className="dashboard-v2-stats" data-visible-count={visibleMetrics.length}>
      {visibleMetrics.map(({ icon: Icon, ...metric }) => <article key={metric.key} className={`dashboard-v2-stat tone-${metric.tone}`}>
        <div className="dashboard-v2-stat-heading">
          <span className="dashboard-v2-stat-icon"><Icon aria-hidden="true" /></span>
          <span className="dashboard-v2-stat-label">{metric.label === "This period" ? title : metric.label}</span>
        </div>
        <strong className="dashboard-v2-stat-number">{metric.value}</strong>
        <MetricSparkline points={metric.series} tone={metric.tone} />
        <small>{metric.description}</small>
      </article>)}
    </div>}
    {visiblePanels.length > 0 && <div className="dashboard-v2-analysis-grid" data-visible-count={visiblePanels.length} data-all-empty={allPanelsEmpty ? "true" : "false"}>
      {visibility.salesOverview !== false && <section className={`dashboard-v2-sales${!chartHasData && !loading ? " is-empty" : ""}`} aria-labelledby="dashboard-sales-heading">
        <div className="dashboard-v2-panel-head">
          <div><h3 id="dashboard-sales-heading">Sales Overview</h3>
            <p className="dashboard-v2-muted">Recorded sales activity · {title.toLowerCase()}</p></div>
          <div className="dashboard-v2-sales-controls" role="group" aria-label="Sales chart view">
            {[["sales","Sales"],["completed","Completed"],["services","Services"]].map(([key, label]) =>
              <Button key={key} type="button" variant="ghost" size="sm"
                className={chartTab === key ? "dashboard-chart-tab selected" : "dashboard-chart-tab"}
                aria-pressed={chartTab === key} onClick={() => setChartTab(key)}>{label}</Button>)}
          </div>
        </div>
        <div className="dashboard-v2-chart-area">
          {loading && !data ? <div className="dashboard-v2-empty">Loading analytics…</div>
            : chartTab === "services" ?
              realServices.length ? <ServiceSalesChart data={realServices} currency={primaryCurrency} /> : <div className="dashboard-v2-empty"><FiBarChart2 aria-hidden="true"/><strong>No service sales yet</strong><span>Completed service sales appear here.</span></div>
            : chartTab === "completed" ?
              completedTrend.length === 1
                ? <SinglePeriodSummary point={completedTrend[0]} value={String(completedTrend[0].revenue)} unit="completed services" />
                : completedTrend.length ? <SalesTrendChart data={completedTrend} currency="" formatValue={number => String(Math.round(number))} /> : <div className="dashboard-v2-empty"><FiBarChart2 aria-hidden="true"/><strong>No completed services yet</strong><span>Activity will appear after service completion.</span></div>
            : salesTrend.length === 1
              ? <SinglePeriodSummary point={salesTrend[0]} value={currencyFormat(salesTrend[0].revenue, primaryCurrency)} unit="recorded sales" />
              : salesTrend.length ? <SalesTrendChart data={salesTrend} currency={primaryCurrency} /> : <div className="dashboard-v2-empty"><FiBarChart2 aria-hidden="true"/><strong>No recorded sales this period</strong><span>Completed transactions will appear here.</span></div>}
        </div>
        <div className="dashboard-v2-sales-footer"><Button asChild variant="link" size="sm"><Link to="/dashboard/sales">Full analytics <FiArrowRight aria-hidden="true" /></Link></Button></div>
      </section>}
      {visibility.serviceStatus !== false && <BookingStatus summary={statusSummary} loading={statusLoading} />}
      {visibility.topServices !== false && <section className={`dashboard-v2-top-services${topServicesEmpty && !loading ? " is-empty" : ""}`} aria-labelledby="dashboard-top-services-heading">
        <h3 id="dashboard-top-services-heading">Top Services</h3>
        <p className="dashboard-v2-muted">Most sold services · {title.toLowerCase()}</p>
        {realServices.length ? <ol className="dashboard-v2-top-list">{realServices.slice(0,5).map((item, index) =>
          <li key={item.service}><span>{index+1}</span><div><strong>{item.service}</strong><small>{item.sales} completed · {currencyFormat(item.revenue,primaryCurrency)}</small></div></li>)}</ol>
        : <div className="dashboard-v2-top-empty"><FiBarChart2 aria-hidden="true"/><strong>No services sold yet</strong><p>Top-selling services will appear here.</p></div>}
      </section>}
    </div>}
  </section>;
}
