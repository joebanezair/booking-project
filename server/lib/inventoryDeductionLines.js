// Mongoose order.items entries are subdocuments; spreading them does NOT copy
// schema paths such as product/name/sku. Always construct stock-update rows
// explicitly so a valid product reference survives the grouping step.
export function addInventoryDeductionLine(grouped, line, inventoryProduct) {
  const productId = inventoryProduct?._id;
  if (!productId) throw Object.assign(new Error("Inventory product ID is missing."), { statusCode: 409 });
  const quantity = Number(line.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw Object.assign(new Error("Invalid product quantity."), { statusCode: 400 });
  }
  const key = String(productId);
  const previous = grouped.get(key);
  if (previous) {
    if (!Number.isSafeInteger(previous.quantity + quantity)) {
      throw Object.assign(new Error("Product quantity is too large."), { statusCode: 400 });
    }
    previous.quantity += quantity;
  } else {
    grouped.set(key, {
      product: productId,
      name: String(line.name || inventoryProduct.name || "Inventory product"),
      sku: String(line.sku || inventoryProduct.sku || ""),
      quantity
    });
  }
}
