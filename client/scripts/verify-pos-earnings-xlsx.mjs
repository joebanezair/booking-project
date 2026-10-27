import assert from "node:assert/strict";
import test from "node:test";
import { exportPosEarningsXlsx } from "../src/utils/exportPosEarningsXlsx.js";

// Verify a real Excel workbook is produced without a third-party library, and
// that the UI export preserves the current reporting period and numeric values.
test("POS Excel export contains two valid worksheet parts with numeric prices and earnings", async () => {
  let capturedBlob, filename;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  try {
    URL.createObjectURL = blob => { capturedBlob = blob; return "blob:test"; };
    URL.revokeObjectURL = () => {};
    globalThis.document = {
      body: { appendChild: () => {} },
      createElement: () => ({
        set href(value) { assert.equal(value, "blob:test"); },
        set download(value) { filename = value; },
        click: () => {},
        remove: () => {}
      })
    };
    globalThis.window = { setTimeout: callback => callback() };
    exportPosEarningsXlsx({
      report: { currencies: [{ currency: "PHP", revenue: 4543 }] },
      current: { currency: "PHP", revenue: 4543, cost: 1898, grossEarnings: 2645,
        unitsSold: 67, estimatedUnits: 8, unresolvedCostUnits: 0 },
      range: "all", currency: "PHP",
      products: [
        { _id: "a", price: 222, unitCost: 22, currency: "PHP" },
        { _id: "b", price: 5, unitCost: 30, currency: "PHP" }
      ],
      rows: [
        { productId: "a", name: "New", currency: "PHP", unitsSold: 14, revenue: 3108,
          cost: 308, grossEarnings: 2800, isEstimate: false, estimatedUnits: 0, unresolvedCostUnits: 0 },
        { productId: "b", name: "Sabon", currency: "PHP", unitsSold: 53, revenue: 1435,
          cost: 1590, grossEarnings: -155, isEstimate: true, estimatedUnits: 8, unresolvedCostUnits: 0 }
      ]
    });
    assert.match(filename, /^BookFlow-POS-Earnings-all-PHP-\d{4}-\d{2}-\d{2}\.xlsx$/);
    assert.equal(capturedBlob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const bytes = new Uint8Array(await capturedBlob.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new TextDecoder();
    const entries = new Map();
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
      const len = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
      const from = offset + 30 + nameLength + extraLength;
      entries.set(name, decoder.decode(bytes.subarray(from, from + len)));
      offset = from + len;
    }
    assert.equal(view.getUint32(offset, true), 0x02014b50, "central directory follows local parts");
    assert.deepEqual([...entries.keys()].sort(), [
      "[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels",
      "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml"
    ].sort());
    assert.match(entries.get("xl/workbook.xml"), /sheet name="POS Summary"/);
    assert.match(entries.get("xl/workbook.xml"), /sheet name="Earnings by Product"/);
    const summary = entries.get("xl/worksheets/sheet1.xml");
    const detail = entries.get("xl/worksheets/sheet2.xml");
    assert.match(summary, /<v>4543<\/v>/, "overall sales are numeric");
    assert.match(summary, /<v>2645<\/v>/, "overall earnings are numeric");
    assert.match(detail, /Store price \/ unit/);
    assert.match(detail, /<v>222<\/v>/, "store price is numeric");
    assert.match(detail, /<v>22<\/v>/, "initial cost is numeric");
    assert.match(detail, /<v>-155<\/v>/, "losses are exported as numeric values");
    assert.match(detail, /Estimated/);
    assert.match(entries.get("xl/styles.xml"), /₱/);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
