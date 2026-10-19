// An online order stores its inventory ObjectId at purchase time. When older
// orders reference a removed/recreated product, recover only an unambiguous
// business-owned SKU/name match. Never guess a different product by price.
export const normalizeInventoryLabel = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

export const exactInventoryPattern = value => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const escaped = words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp("^\\s*" + escaped.join("\\s+") + "\\s*$", "i");
};

function conflict(message) {
  return Object.assign(new Error(message), { statusCode: 409 });
}

function chooseUnique(candidates, name) {
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && name) {
    const named = candidates.filter(product => normalizeInventoryLabel(product.name) === normalizeInventoryLabel(name));
    if (named.length === 1) return named[0];
  }
  return null;
}

export async function resolveOrderedProduct(line, { byId, bySku, byName }) {
  const id = String(line.product || "").trim();
  const name = String(line.name || "").trim();
  const sku = String(line.sku || "").trim();
  if (id && /^[a-f\d]{24}$/i.test(id)) {
    const current = await byId(id);
    if (current) return current;
  }
  if (sku) {
    const matches = await bySku(sku);
    const found = chooseUnique(matches, name);
    if (found) return found;
    if (matches.length > 1) throw conflict("Multiple inventory products match " + (name || sku) + ". Automatic stock deduction cannot safely choose one.");
  }
  if (name) {
    const matches = await byName(name);
    const found = chooseUnique(matches, name);
    if (found) return found;
    if (matches.length > 1) throw conflict("Multiple inventory products are named " + name + ". Give them unique SKUs before completing the order.");
  }
  throw conflict("Inventory product for " + (name || sku || "this order item") + " was not found. Stock cannot be deducted from a deleted product.");
}
