// Minimal, dependency-free Office Open XML workbook writer for POS reports.
// Uses valid ZIP "stored" entries (no compression) and typed Excel number cells.
// Keeping generation local avoids exposing private business cost data to a service.
const encoder = new TextEncoder();

function escapeXml(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function excelColumn(index) {
  let result = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    result = String.fromCharCode(65 + (n - 1) % 26) + result;
  }
  return result;
}
function xmlCell(cell, row, col) {
  const reference = excelColumn(col) + row;
  if (cell && typeof cell === "object" && cell.type === "number" &&
      cell.value !== null && cell.value !== undefined && Number.isFinite(Number(cell.value))) {
    return `<c r="${reference}" s="${cell.money ? 1 : 0}"><v>${Number(cell.value)}</v></c>`;
  }
  const string = cell && typeof cell === "object" && cell.type === "text" ? cell.value : cell;
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(string)}</t></is></c>`;
}
function sheetXml(rows, columns, headerRows = [], autoFilterRow = 0) {
  const formattedRows = rows.map((values, index) => {
    const row = index + 1;
    return `<row r="${row}">${values.map((cell, column) =>
      headerRows.includes(row) && (typeof cell !== "object" || cell.type !== "number")
        ? `<c r="${excelColumn(column)}${row}" s="2" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`
        : xmlCell(cell, row, column)).join("")}</row>`;
  }).join("");
  const cols = columns.map((width, i) => `<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join("");
  const filter = autoFilterRow && rows.length >= autoFilterRow
    ? `<autoFilter ref="A${autoFilterRow}:${excelColumn(columns.length - 1)}${rows.length}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="16"/>
<cols>${cols}</cols><sheetData>${formattedRows}</sheetData>${filter}</worksheet>`;
}
function number(value, money = false) {
  return Number.isFinite(Number(value)) && value !== null && value !== undefined
    ? { type: "number", value: Number(value), money } : { type: "text", value: "Not available" };
}
function crc32(bytes) {
  let result = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    result ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      result = (result >>> 1) ^ ((result & 1) ? 0xEDB88320 : 0);
    }
  }
  return (result ^ 0xFFFFFFFF) >>> 0;
}
function zipWorkbook(files) {
  const records = [], directory = [];
  let offset = 0;
  for (const [path, xml] of files) {
    const name = encoder.encode(path), data = encoder.encode(xml), crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lh = new DataView(local.buffer);
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true);
    local.set(name, 30);
    records.push(local, data);
    const central = new Uint8Array(46 + name.length);
    const ch = new DataView(central.buffer);
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    offset += local.length + data.length;
  }
  const centralLength = directory.reduce((size, data) => size + data.length, 0);
  const end = new Uint8Array(22), eocd = new DataView(end.buffer);
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, centralLength, true);
  eocd.setUint32(16, offset, true);
  return new Blob([...records, ...directory, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}
function workbookBlob(sheets, currency) {
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}
<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`;
  const currencyMark = currency === "PHP" ? "₱" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  const safeMark = escapeXml(currencyMark.replace(/"/g, ""));
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;${safeMark}&quot;#,##0.00;[Red](&quot;${safeMark}&quot;#,##0.00)"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><name val="Aptos"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs></styleSheet>`;
  return zipWorkbook([
    ["[Content_Types].xml", types],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", workbook],
    ["xl/_rels/workbook.xml.rels", relationships],
    ["xl/styles.xml", styles],
    ...sheets.map((sheet, i) => [`xl/worksheets/sheet${i+1}.xml`, sheet.xml])
  ]);
}
function downloadWorkbook(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Exports the period + currency currently selected in the POS Charts dashboard.
// Current store price is informational; actual revenue and earnings come from
// recorded POS sales, not a product's latest listed selling price.
export function exportPosEarningsXlsx({ report, current, rows, products, range, currency }) {
  if (!report || !current) throw new Error("There are no POS earnings to export.");
  const label = range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "All time";
  const rowsByProduct = new Map((products || []).map(product => [String(product._id), product]));
  const summary = [
    ["BookFlow POS Revenue & Earnings"],
    ["Period", label],
    ["Currency", currency],
    ["Export date", new Date().toISOString().slice(0,10)],
    [],
    ["Metric", "Amount"],
    ["Total POS sales", number(current.revenue, true)],
    ["Product costs", number(current.cost, true)],
    ["Gross earnings", number(current.grossEarnings, true)],
    ["Units sold", number(current.unitsSold)],
    ["Units with estimated cost", number(current.estimatedUnits || 0)],
    ["Units with unresolved cost", number(current.unresolvedCostUnits || 0)],
    [],
    ["Notes"],
    ["Unit costs recorded at checkout are used where available."],
    ["For older sales without a saved cost, current product costs are used only as estimates."],
    ["Estimates never overwrite historical sales; actual profit may differ."],
    ["Gross earnings exclude other operating expenses and online orders."]
  ];
  const headings = [
    "Product", "Units sold", "Store price / unit", "Current unit cost / unit",
    "Total sales", "Product cost (incl. estimate)", "Gross earnings", "Cost status",
    "Estimated units", "Unknown-cost units", "Currency"
  ];
  const table = [
    ["BookFlow POS Earnings by Product"],
    ["Period", label],
    ["Currency", currency],
    [],
    headings,
    ...rows.map(row => {
      const product = rowsByProduct.get(String(row.productId));
      return [
        row.name, number(row.unitsSold), number(product && (product.currency || currency) === currency ? product.price : null, true),
        number(product?.unitCost, true), number(row.revenue, true),
        number(row.cost, true), number(row.grossEarnings, true),
        row.unresolvedCostUnits > 0 ? "Cost unavailable" : row.isEstimate ? "Estimated" : "Recorded",
        number(row.estimatedUnits || 0), number(row.unresolvedCostUnits || 0), row.currency
      ];
    }),
    [],
    ["Notes"],
    ["Store price / unit is the product's current listed selling price, not historical transaction price."],
    ["Product cost and gross earnings include estimates only where checkout unit costs were missing."],
    ["Earnings exclude online orders and operating expenses."]
  ];
  const workbook = workbookBlob([
    { name: "POS Summary", xml: sheetXml(summary, [42, 28], [1, 6]) },
    { name: "Earnings by Product", xml: sheetXml(table, [30, 15, 19, 22, 19, 25, 21, 21, 19, 20, 13], [1, 5]) }
  ], currency);
  const fileDate = new Date().toISOString().slice(0, 10);
  downloadWorkbook(workbook, `BookFlow-POS-Earnings-${range}-${currency}-${fileDate}.xlsx`);
}
