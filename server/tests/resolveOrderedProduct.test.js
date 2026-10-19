import test from "node:test";
import assert from "node:assert/strict";
import { exactInventoryPattern, normalizeInventoryLabel, resolveOrderedProduct } from "../lib/resolveOrderedProduct.js";

const id1 = "507f1f77bcf86cd799439011";
const id2 = "507f1f77bcf86cd799439012";
const stale = "507f1f77bcf86cd799439099";

function finder(products) {
  return {
    byId: async id => products.find(p => String(p._id) === String(id)) || null,
    bySku: async sku => products.filter(p => exactInventoryPattern(sku)?.test(p.sku)),
    byName: async name => products.filter(p => exactInventoryPattern(name)?.test(p.name))
  };
}

test("online orders use their original inventory ID without asking for a product", async () => {
  const p = { _id: id1, name: "Premium Care Kit", sku: "PC-1" };
  const resolved = await resolveOrderedProduct({ product: id1, name: "Old snapshot name" }, finder([p]));
  assert.equal(resolved._id, id1);
});

test("legacy stale IDs automatically recover from unique case-insensitive SKU", async () => {
  const p = { _id: id2, name: "Premium Care Kit", sku: "pc-1" };
  const resolved = await resolveOrderedProduct({ product: stale, name: "Premium Care Kit", sku: " PC-1 " }, finder([p]));
  assert.equal(resolved._id, id2);
});

test("SKU-less online orders auto-match a unique normalized name", async () => {
  const p = { _id: id1, name: " PREMIUM  Care Kit ", sku: "" };
  const resolved = await resolveOrderedProduct({ product: stale, name: "premium care kit" }, finder([p]));
  assert.equal(resolved._id, id1);
});

test("outdated SKU falls back to exact unique product name", async () => {
  const p = { _id: id1, name: "Premium Care Kit", sku: "NEW-SKU" };
  const resolved = await resolveOrderedProduct({ product: stale, sku: "OLD-SKU", name: "Premium Care Kit" }, finder([p]));
  assert.equal(resolved._id, id1);
});

test("duplicate names without identifiers are never guessed", async () => {
  const p = [{ _id: id1, name: "Premium Care Kit" }, { _id: id2, name: "Premium Care Kit" }];
  await assert.rejects(resolveOrderedProduct({ product: stale, name: "Premium Care Kit" }, finder(p)), err => err.statusCode === 409);
});

test("deleted products never trigger a substitute stock deduction", async () => {
  await assert.rejects(resolveOrderedProduct({ product: stale, name: "Premium Care Kit" }, finder([])), err => err.statusCode === 409 && /not found/i.test(err.message));
});

test("regex escapes product punctuation and matches whitespace consistently", () => {
  assert.equal(normalizeInventoryLabel("  Premium   Care KIT "), "premium care kit");
  assert.equal(exactInventoryPattern("Set [XL] (3)").test(" Set [XL] (3) "), true);
  assert.equal(exactInventoryPattern("Set [XL] (3)").test("Set XL 3"), false);
});
