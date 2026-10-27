// Dependency-free Excel 2003 XML workbook; no business data is sent to third parties.
// Stream-sized pages from the admin endpoint. Never silently export a partial report.
const xmlEscape = input => String(input ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
function xmlCell(value) {
  const numeric = typeof value === "number" && Number.isFinite(value);
  // Prevent formulas from executing when someone opens an exported workbook.
  const safe = numeric ? value : /^[\s]*[=+\-@]/.test(String(value ?? "")) ? "'" + value : value;
  return `<Cell><Data ss:Type="${numeric ? "Number" : "String"}">${xmlEscape(safe)}</Data></Cell>`;
}
const xmlRow = cells => `<Row>${cells.map(xmlCell).join("")}</Row>`;
function sheet(name, columns, records) {
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${xmlRow(columns)}${records.map(xmlRow).join("")}</Table></Worksheet>`;
}
const iso = date => date ? new Date(date).toISOString() : "";
const scalar = value => value == null ? "Not recorded" : value;

export async function exportAdminBusinessWorkbook({ businessName, range, load }) {
  const first = await load({ section: "financials", range, limit: 100 });
  const s = first.summary;
  const summary = [
    ["Range", range], ["Generated at", new Date().toISOString()], ["Business", businessName],
    ["Products posted", s.products.posted], ["Products total", s.products.total],
    ["Inventory units", s.products.stockUnits], ["Products without unit costs", s.products.costMissingProducts],
    ["Services", s.services], ["Bookings in range", s.bookings.total],
    ...Object.entries(s.bookings.statuses).map(([status, count]) => ["Bookings: " + status, count]),
    ...s.limitations.map(note => ["Coverage limitation", note])
  ];
  const finance = s.totalsByCurrency.map(r => [
    r.currency, r.services, r.pos, r.online, r.gross, r.knownPosCost, r.knownOnlineCost,
    scalar(r.posGrossProfit), scalar(r.onlineGrossProfit), scalar(r.overallGrossProfit),
    r.missingPosCostLines, r.missingOnlineCostLines, r.transactions
  ]);

  const fetchAll = async (section, channel) => {
    const result = [];
    let before = "", page = 0;
    while (true) {
      const next = await load({ section, range, ...(channel ? { channel } : {}), before, limit: 100 });
      result.push(...(next.rows || []));
      if (!next.hasMore) return result;
      if (!next.nextCursor || ++page >= 100) {
        throw new Error("The report exceeds the 10,000-row export limit for a section. Use a shorter date range.");
      }
      before = next.nextCursor;
    }
  };
  const [products, services, bookings, pos, online, serviceSales, audit] = await Promise.all([
    fetchAll("products"), fetchAll("services"), fetchAll("bookings"),
    fetchAll("transactions", "pos"), fetchAll("transactions", "online"),
    fetchAll("transactions", "services"), fetchAll("audit")
  ]);
  const sheets = [
    sheet("Summary", ["Metric", "Value"], summary),
    sheet("Financials", ["Currency", "Services gross", "POS gross", "Completed online value",
      "Gross total", "Known POS costs", "Known online costs", "POS gross profit",
      "Online gross profit", "Combined gross profit (if known)",
      "Missing POS cost lines", "Missing online cost lines", "Transactions"], finance),
    sheet("Products", ["ID", "Name", "SKU", "Price", "Initial unit cost", "Currency",
      "Stock", "Published", "Units sold", "POS units", "Online units", "Sales gross",
      "Recorded POS costs", "Gross profit if known"], products.map(x => [
        String(x._id), x.name, x.sku, x.price, scalar(x.unitCost), x.currency,
        x.stock, x.published ? "yes" : "no", x.sold, x.posUnits, x.onlineUnits,
        x.gross, x.recordedCost, scalar(x.grossProfit)
      ])),
    sheet("Services", ["ID", "Service", "Price", "Currency", "Published", "Bookings enabled", "Updated"], services.map(x => [
      String(x._id), x.title, x.price, x.currency, x.published ? "yes" : "no", x.allowBookings ? "yes" : "no", iso(x.updatedAt)
    ])),
    sheet("Bookings", ["Reference", "Service", "Price", "Currency", "Status", "Scheduled", "Completed",
      "Status history"], bookings.map(x => [
        x.bookingReference || String(x._id), x.service, x.servicePrice, x.currency, x.status,
        iso(x.bookingDate), iso(x.completedAt),
        (x.history || []).map(h => [iso(h.at), h.action, h.status].join(": ")).join(" | ")
      ])),
    sheet("POS Sales", ["Invoice", "Date", "Amount", "Currency", "Payment method", "Status",
      "Items with recorded historical costs"], pos.map(x => [
        x.reference, iso(x.date), x.amount, x.currency, x.paymentMethod, x.status,
        (x.items || []).map(i => `${i.quantity} x ${i.name}; initial unit cost: ${scalar(i.unitCost)}`).join(" | ")
      ])),
    sheet("Online Orders", ["Order", "Date", "Order value", "Currency", "Amount paid",
      "Payment status", "Order status", "Items"], online.map(x => [
        x.reference, iso(x.date), x.amount, x.currency, x.amountPaid, x.paymentStatus, x.status,
        (x.items || []).map(i => `${i.quantity} x ${i.name}; historical unit cost: ${scalar(i.unitCost)}`).join(" | ")
      ])),
    sheet("Service Sales", ["Reference", "Date", "Service", "Gross sale", "Currency", "Status"],
      serviceSales.map(x => [x.reference, iso(x.date), x.serviceName, x.amount, x.currency, x.status])),
    sheet("Activity Audit", ["Date", "Action", "Detail", "Stock change", "Stock after", "Actor"],
      audit.map(x => [iso(x.createdAt), x.action, x.detail, scalar(x.quantity), scalar(x.stockAfter),
        x.actor ? String(x.actor) : "System / transaction"]))
  ];
  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets.join("")}
</Workbook>`;
  const filename = String(businessName || "Business").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 50);
  const blob = new Blob([contents], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Business_Transparency_${filename}_${range}.xls`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
