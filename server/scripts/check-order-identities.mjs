// Compare order IDs observed by the browser with the canonical orderNumber
// in the SAME MongoDB used by the server terminal. No writes or customer PII.
// Usage: node scripts/check-order-identities.mjs BFO-2026-1792414125425 6ad611a0b1c06efa38100266 6ad611adb1c06efa38100287
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import mongoose from "mongoose";
import { ProductOrder, Product } from "../models/Sale.js";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const [number, ...ids] = process.argv.slice(2);
if (!/^BFO-\d{4}-\d+$/.test(number || "") ||
    !ids.length || ids.some(id => !mongoose.isValidObjectId(id))) {
  console.error("Usage: node scripts/check-order-identities.mjs <order-number> <order-id> [another-order-id]");
  process.exit(2);
}
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is missing from server/.env");
  process.exit(2);
}
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const byNumber = await ProductOrder.find({ orderNumber: number }).select("_id orderNumber status businessOwner items").lean();
  const byIds = await ProductOrder.find({ _id: { $in: ids } }).select("_id orderNumber status businessOwner items").lean();
  const records = [...new Map([...byNumber, ...byIds].map(order => [String(order._id), order])).values()];
  const details = [];
  for (const order of records) {
    const items = [];
    for (const item of order.items || []) {
      const inventory = item.product ? await Product.findOne({
        _id: item.product, user: order.businessOwner
      }).select("_id stock").lean() : null;
      items.push({ name: item.name || "Unknown", quantity: Number(item.quantity),
        productId: item.product ? String(item.product) : null,
        productFound: Boolean(inventory), currentStock: inventory?.stock ?? null });
    }
    details.push({ id: String(order._id), orderNumber: order.orderNumber,
      status: order.status, items });
  }
  console.log(JSON.stringify({
    database: mongoose.connection.name,
    queriedOrderNumber: number,
    idsFromBrowser: ids,
    matchingOrderIds: byNumber.map(order => String(order._id)),
    browserIdsFoundInThisDatabase: ids.map(id => ({ id, found: byIds.some(order => String(order._id) === id) })),
    records: details
  }, null, 2));
} catch (error) {
  console.error("Unable to inspect the local MongoDB order IDs:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
