function money(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

export function SalesTrendChart({ data = [], currency = "PHP", formatValue }) {
  const format = formatValue || (value => money(value, currency));
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
          <text x={padding.left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">{format(max * step)}</text>
        </g>;
      })}
      <path d={path} fill="none" className="chart-line" />
      {points.map((point, index) => <g key={point.key}>
        <circle cx={point.x} cy={point.y} r="4.5" className="chart-point"><title>{point.label}: {format(point.revenue)}</title></circle>
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


/* Alternate line/area treatment for the Sales page trend-chart proposal. */


export function SalesStepAreaChart({ data = [], currency = "PHP", periodLabel = "Selected period" }) {
  const format = value => money(value, currency);
  if (!data.length) return <div className="analytics-empty">No completed sales in this period.</div>;

  const width = 760;
  const height = 286;
  const padding = { top: 18, right: 18, bottom: 48, left: 78 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...data.map(item => Number(item.revenue || 0)), 1);
  const points = data.map((item, index) => ({
    ...item,
    x: padding.left + (data.length === 1 ? chartWidth / 2 : index / (data.length - 1) * chartWidth),
    y: padding.top + chartHeight - Number(item.revenue || 0) / max * chartHeight
  }));
  const baseline = padding.top + chartHeight;
  const stepPath = points.map((point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    return `H ${point.x} V ${point.y}`;
  }).join(" ");
  const areaPath = `${stepPath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
  const firstValue = Number(points[0].revenue || 0);
  const lastValue = Number(points[points.length - 1].revenue || 0);
  const change = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : null;
  const trendLabel = change == null
    ? "Not enough previous data to calculate a trend"
    : `${change >= 0 ? "Trending up" : "Trending down"} by ${Math.abs(change).toFixed(1)}% across the selected period`;
  const labelIndexes = points.map((_, index) => index).filter(index =>
    data.length <= 8 || index % Math.ceil(data.length / 8) === 0 || index === data.length - 1
  );

  return <div className="sales-step-area">
    <div className="sales-step-area-chart-wrap">
      <svg className="sales-step-area-svg" viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`Step area chart showing sales revenue for ${periodLabel}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="sales-step-area-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1, var(--primary))" stopOpacity=".34"/>
            <stop offset="100%" stopColor="var(--chart-1, var(--primary))" stopOpacity=".04"/>
          </linearGradient>
        </defs>
        {[0, .25, .5, .75, 1].map(step => {
          const y = baseline - step * chartHeight;
          return <g key={step}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="sales-step-area-grid"/>
            <text x={padding.left - 10} y={y + 4} textAnchor="end" className="sales-step-area-axis">{format(max * step)}</text>
          </g>;
        })}
        <path d={areaPath} fill="url(#sales-step-area-fill)"/>
        <path d={stepPath} className="sales-step-area-line" fill="none"/>
        {points.map((point, index) => <circle key={point.key || index} cx={point.x} cy={point.y} r="3.5"
          className="sales-step-area-point">
          <title>{point.label}: {format(point.revenue)} · {point.sales || 0} sale(s)</title>
        </circle>)}
        {labelIndexes.map(index => <text key={points[index].key || index} x={points[index].x} y={height - 16}
          textAnchor="middle" className="sales-step-area-axis">{points[index].label}</text>)}
      </svg>
    </div>
    <div className="sales-step-area-footer">
      <div className="sales-step-area-trend">
        <span className={`sales-step-area-trend-icon${change != null && change < 0 ? " is-down" : ""}`} aria-hidden="true">
          {change != null && change < 0 ? "↘" : "↗"}
        </span>
        <div>
          <strong>{trendLabel}</strong>
          <small>{periodLabel}</small>
        </div>
      </div>
      <div className="sales-step-area-total">
        <small>Recorded revenue</small>
        <strong>{format(data.reduce((total, item) => total + Number(item.revenue || 0), 0))}</strong>
      </div>
    </div>
  </div>;
}
