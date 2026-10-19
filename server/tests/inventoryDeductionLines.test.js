import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { ProductOrder } from "../models/Sale.js";
import { addInventoryDeductionLine } from "../lib/inventoryDeductionLines.js";

const owner = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();

function makeOrder(items) {
  return new ProductOrder({
    businessOwner: owner,
    orderNumber: "BFO-2026-UNITTEST",
    customerName: "Example",
    customerPhone: "0000000",
    deliveryLocation: "Test",
    total: 1450,
    items
  });
}

test("order subdocument retains product ID in the stock decrement row", () => {
  const order = makeOrder([{ product: productId, name: "Premium Care Kit", quantity: 1, unitPrice: 1450, lineTotal: 1450 }]);
  const item = order.items[0];
  // Regression for the bug: Mongoose schema fields live in _doc, so
  // {...item} does not create { product: ..., name: ..., quantity: ... }.
  assert.equal(({ ...item }).product, undefined);
  const grouped = new Map();
  addInventoryDeductionLine(grouped, item, { _id: productId, name: "Premium Care Kit" });
  const [row] = [...grouped.values()];
  assert.equal(String(row.product), String(productId));
  assert.equal(row.quantity, 1);
  assert.equal(row.name, "Premium Care Kit");
});

test("two order subdocument lines of the same product aggregate without losing ID", () => {
  const order = makeOrder([
    { product: productId, name: "Premium Care Kit", quantity: 1 },
    { product: productId, name: "Premium Care Kit", quantity: 2 }
  ]);
  const grouped = new Map();
  for (const item of order.items) {
    addInventoryDeductionLine(grouped, item, { _id: productId, name: "Premium Care Kit" });
  }
  assert.equal(grouped.size, 1);
  assert.equal([...grouped.values()][0].quantity, 3);
  assert.equal(String([...grouped.values()][0].product), String(productId));
});

test("POS plain objects also retain their product IDs", () => {
  const grouped = new Map();
  addInventoryDeductionLine(grouped, { product: productId, name: "Premium Care Kit", quantity: 1 }, { _id: productId, name: "Premium Care Kit" });
  assert.equal(String(grouped.get(String(productId)).product), String(productId));
});

test("missing inventory IDs or malformed quantities cannot result in deductions", () => {
  assert.throws(() => addInventoryDeductionLine(new Map(), { quantity: 1 }, {}), { statusCode: 409 });
  for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.throws(() => addInventoryDeductionLine(new Map(), { quantity }, { _id: productId }), { statusCode: 400 });
  }
});

test("duplicate total above safe integer limit is rejected", () => {
  const grouped = new Map();
  addInventoryDeductionLine(grouped, { quantity: Number.MAX_SAFE_INTEGER }, { _id: productId });
  assert.throws(() => addInventoryDeductionLine(grouped, { quantity: 1 }, { _id: productId }), { statusCode: 400 });
});
