// Read-only diagnosis for online orders that cannot deduct inventory.
// Run from the server directory:
//   node scripts/diagnose-order-inventory.mjs BFO-2026-1792414125425
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import mongoose from "mongoose";
import { Product, ProductOrder } from "../models/Sale.js";
import { resolveOrderedProduct, exactInventoryPattern } from "../lib/resolveOrderedProduct.js";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
const number = process.argv[2];
if (!number || !/^BFO-[0-9]{4}-[0-9]+$/.test(number)) {
  console.error("Usage: node scripts/diagnose-order-inventory.mjs BFO-YYYY-NUMBER");
  process.exit(2);
}
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is missing from server/.env.");
  process.exit(2);
}
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const order = await ProductOrder.findOne({ orderNumber: number })
    .select("orderNumber status businessOwner items").lean();
  if (!order) {
    console.log(JSON.stringify({
      orderNumber: number, database: mongoose.connection.name, found: false,
      explanation: "Order not found in this database. Check which MONGO_URI the running API actually uses."
    }, null, 2));
  } else {
    const rows = [];
    const totals = new Map();
    for (const line of order.items || []) {
      const storedId = String(line.product || "");
      const current = storedId && mongoose.isValidObjectId(storedId)
        ? await Product.findOne({ _id: storedId, user: order.businessOwner })
          .select("_id stock name sku").lean()
        : null;
      let resolved = null, problem = null;
      try {
        resolved = await resolveOrderedProduct(line, {
          byId: id => Product.findOne({ _id: id, user: order.businessOwner })
            .select("_id stock name sku").lean(),
          bySku: sku => Product.find({ user: order.businessOwner, sku: exactInventoryPattern(sku) })
            .select("_id stock name sku").limit(10).lean(),
          byName: name => Product.find({ user: order.businessOwner, name: exactInventoryPattern(name) })
            .select("_id stock name sku").limit(10).lean()
        });
      } catch (error) { problem = error.message; }
      const quantity = Number(line.quantity);
      const resolvedId = resolved ? String(resolved._id) : null;
      if (resolvedId) totals.set(resolvedId, (totals.get(resolvedId) || 0) + quantity);
      rows.push({
        item: line.name || line.sku || "Unnamed product",
        quantity, originalProductId: storedId || null,
        originalIdExistsInBusinessInventory: Boolean(current),
        resolvedProductId: resolvedId,
        recovery: !resolved ? "failed" : current ? "existing reference" : "unique legacy match",
        inventoryStock: resolved ? Number(resolved.stock) : null,
        problem
      });
    }
    for (const row of rows) {
      const needed = row.resolvedProductId ? totals.get(row.resolvedProductId) : null;
      row.totalRequiredFromProduct = needed;
      row.enoughStockNow = needed === null ? false
        : Number.isSafeInteger(needed) && needed > 0 && row.inventoryStock >= needed;
    }
    console.log(JSON.stringify({
      orderNumber: number, database: mongoose.connection.name, found: true,
      status: order.status, readyToComplete: rows.length > 0 && rows.every(row => row.enoughStockNow),
      items: rows
    }, null, 2));
  }
} catch {
  console.error("Could not connect to the configured MongoDB. Check server/.env and database availability.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
