function money(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

export function SalesTrendChart({ data = [], currency = "PHP" }) {
  if (!data.length) return <div className="analytics-empty">No completed sales in this period.</div>;

  const width = 760;
  const height = 260;
  const padding = { top: 24, right: 20, bottom: 48, left: 58 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map(item => Number(item.revenue || 0)), 1);
  const points = data.map((item, index) => {
    const x = padding.left + (data.length === 1 ? chartW / 2 : (index / (data.length - 1)) * chartW);
    const y = padding.top + chartH - (Number(item.revenue || 0) / max) * chartH;
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return <div className="chart-shell">
    <svg className="sales-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales trend">
      {[0, .25, .5, .75, 1].map(step => {
        const y = padding.top + chartH - step * chartH;
        return <g key={step}>
          <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid-line" />
          <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">{money(max * step, currency)}</text>
        </g>;
      })}
      <path d={path} fill="none" className="chart-line" />
      {points.map((point, index) => <g key={point.key}>
        <circle cx={point.x} cy={point.y} r="4.5" className="chart-point"><title>{point.label}: {money(point.revenue, currency)}</title></circle>
        {(data.length <= 8 || index % Math.ceil(data.length / 8) === 0 || index === data.length - 1) &&
          <text x={point.x} y={height - 18} textAnchor="middle" className="chart-x-label">{point.label}</text>}
      </g>)}
    </svg>
  </div>;
}

export function ServiceSalesChart({ data = [], currency = "PHP" }) {
  if (!data.length) return <div className="analytics-empty">No service sales in this period.</div>;
  const top = data.slice(0, 8);
  const max = Math.max(...top.map(item => Number(item.revenue || 0)), 1);

  return <div className="service-chart" role="img" aria-label="Sales by service">
    {top.map(item => <div className="service-bar-row" key={item.service}>
      <div className="service-bar-meta"><strong>{item.service}</strong><span>{item.sales} sale{item.sales === 1 ? "" : "s"} · {money(item.revenue, currency)}</span></div>
      <div className="service-bar-track"><span style={{ width: `${Math.max(4, (Number(item.revenue || 0) / max) * 100)}%` }} /></div>
    </div>)}
  </div>;
}
