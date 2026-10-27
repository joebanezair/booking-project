import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Content from "../models/Content.js";
import Booking from "../models/Booking.js";
import Sale, { Product, PosSale, ProductOrder, InventoryMovement } from "../models/Sale.js";
import BusinessAuditEvent from "../models/BusinessAuditEvent.js";

// Mounted below /admin; the parent router already requires an authenticated admin.
const router = Router();
const daysByRange = { all: 0, "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
const sections = new Set(["overview", "financials", "products", "services", "bookings", "transactions", "audit"]);
const channels = new Set(["pos", "online", "services"]);
const cents = value => Math.round((Number(value) || 0) * 100) / 100;
const dateScope = (field, after) => after ? { [field]: { $gte: after } } : {};

function currencyTotals(rows) {
  const values = new Map();
  for (const [key, entries] of Object.entries(rows)) {
    for (const item of entries) {
      const currency = item._id || "PHP";
      if (!values.has(currency)) values.set(currency, {
        currency, services: 0, pos: 0, online: 0, gross: 0, transactions: 0,
        knownPosCost: 0, missingPosCostLines: 0, posGrossProfit: null,
        knownOnlineCost: 0, missingOnlineCostLines: 0, onlineGrossProfit: null
      });
      const value = values.get(currency);
      if (key === "cost" || key === "onlineCost") {
        if (key === "cost") {
          value.knownPosCost = cents(item.knownCost);
          value.missingPosCostLines = item.missingLines || 0;
        } else {
          value.knownOnlineCost = cents(item.knownCost);
          value.missingOnlineCostLines = item.missingLines || 0;
        }
      } else {
        value[key] = cents(item.gross);
        value.gross = cents(value.gross + item.gross);
        value.transactions += item.count || 0;
      }
    }
  }
  return [...values.values()].map(row => ({
    ...row,
    posGrossProfit: row.missingPosCostLines === 0 ? cents(row.pos - row.knownPosCost) : null,
    onlineGrossProfit: row.missingOnlineCostLines === 0 ? cents(row.online - row.knownOnlineCost) : null,
    // Service delivery cost is not stored, so combined profit cannot be verified when services are sold.
    overallGrossProfit: row.services === 0 && row.missingPosCostLines === 0 && row.missingOnlineCostLines === 0
      ? cents(row.gross - row.knownPosCost - row.knownOnlineCost) : null
  })).sort((a, b) => a.currency.localeCompare(b.currency));
}

router.get("/:id/transparency", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid business ID." });
    const section = String(req.query.section || "overview");
    const range = String(req.query.range || "all");
    const channel = String(req.query.channel || "pos");
    if (!sections.has(section) || !Object.hasOwn(daysByRange, range) || !channels.has(channel)) {
      return res.status(400).json({ message: "Invalid report filter." });
    }
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || "50", 10) || 50));
    const before = req.query.before ? String(req.query.before) : null;
    if (before && !mongoose.isValidObjectId(before)) {
      return res.status(400).json({ message: "Invalid pagination cursor." });
    }
    const owner = new mongoose.Types.ObjectId(req.params.id);
    const account = await User.exists({ _id: owner, role: "business" });
    if (!account) return res.status(404).json({ message: "Business not found." });
    const after = daysByRange[range] ? new Date(Date.now() - daysByRange[range] * 86400000) : null;
    const posFilter = { businessOwner: owner, status: "recorded", ...dateScope("soldAt", after) };
    const saleFilter = { businessOwner: owner, status: "recorded", ...dateScope("completedAt", after) };
    const orderFilter = { businessOwner: owner, status: "completed",
      paymentStatus: { $nin: ["refunded", "voided"] }, ...dateScope("completedAt", after) };
    const sum = (match, field) => [
      { $match: match }, { $group: { _id: { $ifNull: ["$currency", "PHP"] },
        gross: { $sum: { $ifNull: [field, 0] } }, count: { $sum: 1 } } }
    ];
    const [saleTotals, posTotals, orderTotals, posCosts, onlineCosts, productCounts, bookingStatusRows,
      serviceCount, refundStateRows] = await Promise.all([
      Sale.aggregate(sum(saleFilter, "$saleAmount")),
      PosSale.aggregate(sum(posFilter, "$total")),
      ProductOrder.aggregate(sum(orderFilter, "$total")),
      PosSale.aggregate([
        { $match: posFilter }, { $unwind: "$items" },
        { $group: {
          _id: { $ifNull: ["$currency", "PHP"] },
          knownCost: { $sum: { $cond: [
            { $ne: [{ $ifNull: ["$items.unitCost", null] }, null] },
            { $multiply: [{ $ifNull: ["$items.unitCost", 0] }, "$items.quantity"] }, 0
          ] } },
          missingLines: { $sum: { $cond: [
            { $eq: [{ $ifNull: ["$items.unitCost", null] }, null] }, 1, 0
          ] } }
        } }
      ]),
      ProductOrder.aggregate([
        { $match: orderFilter }, { $unwind: "$items" },
        { $group: {
          _id: { $ifNull: ["$currency", "PHP"] },
          knownCost: { $sum: { $cond: [
            { $ne: [{ $ifNull: ["$items.unitCost", null] }, null] },
            { $multiply: [{ $ifNull: ["$items.unitCost", 0] }, "$items.quantity"] }, 0
          ] } },
          missingLines: { $sum: { $cond: [
            { $eq: [{ $ifNull: ["$items.unitCost", null] }, null] }, 1, 0
          ] } }
        } }
      ]),
      Product.aggregate([{ $match: { user: owner } }, { $group: { _id: null,
        total: { $sum: 1 }, posted: { $sum: { $cond: ["$published", 1, 0] } },
        stockUnits: { $sum: "$stock" }, costMissingProducts: { $sum: { $cond: [
          { $eq: [{ $ifNull: ["$unitCost", null] }, null] }, 1, 0
        ] } } } }]),
      Booking.aggregate([{ $match: { user: owner, ...dateScope("createdAt", after) } },
        { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Content.countDocuments({ user: owner }),
      ProductOrder.aggregate([{ $match: { businessOwner: owner, ...dateScope("createdAt", after),
        paymentStatus: { $in: ["partially_refunded", "refunded"] } } },
        { $group: { _id: "$paymentStatus", count: { $sum: 1 } } }])
    ]);
    const totalsByCurrency = currencyTotals({ services: saleTotals, pos: posTotals, online: orderTotals, cost: posCosts, onlineCost: onlineCosts });
    const bookingStatuses = Object.fromEntries(bookingStatusRows.map(r => [r._id, r.count]));
    const summary = {
      totalsByCurrency,
      products: productCounts[0] || { total: 0, posted: 0, stockUnits: 0, costMissingProducts: 0 },
      services: serviceCount,
      bookings: { total: bookingStatusRows.reduce((n, row) => n + row.count, 0), statuses: bookingStatuses },
      refundStatuses: Object.fromEntries(refundStateRows.map(row => [row._id, row.count])),
      limitations: [
        "Online order totals are completed order value, not verified cash collected.",
        "Partially refunded amounts and processing fees cannot be calculated without recorded amounts.",
        "Older online orders may lack unit-cost snapshots; profit is unavailable for uncosted item lines.",
        "Historical audit records are limited to events actually saved by the system."
      ]
    };
    const cursor = before ? { _id: { $lt: new mongoose.Types.ObjectId(before) } } : {};
    const base = { businessOwner: owner, ...cursor };
    let rows = [];
    if (section === "products") {
      const items = await Product.find({ user: owner, ...cursor }).select("name sku price unitCost currency stock published createdAt updatedAt")
        .sort({ _id: -1 }).limit(limit + 1).lean();
      rows = items;
      const ids = items.map(item => item._id);
      if (ids.length) {
        const posLines = await PosSale.aggregate([{ $match: posFilter }, { $unwind: "$items" },
          { $match: { "items.product": { $in: ids } } }, { $group: { _id: "$items.product",
            units: { $sum: "$items.quantity" }, gross: { $sum: "$items.lineTotal" },
            cost: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$items.unitCost", null] }, null] },
              { $multiply: ["$items.unitCost", "$items.quantity"] }, 0] } },
            missingLines: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$items.unitCost", null] }, null] }, 1, 0] } }
          } }]);
        const onlineLines = await ProductOrder.aggregate([{ $match: orderFilter }, { $unwind: "$items" },
          { $match: { "items.product": { $in: ids } } }, { $group: { _id: "$items.product",
            units: { $sum: "$items.quantity" }, gross: { $sum: "$items.lineTotal" },
            cost: { $sum: { $cond: [{ $ne: [{ $ifNull: ["$items.unitCost", null] }, null] },
              { $multiply: ["$items.unitCost", "$items.quantity"] }, 0] } },
            missingLines: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$items.unitCost", null] }, null] }, 1, 0] } }
          } }]);
        const posMap = new Map(posLines.map(row => [String(row._id), row]));
        const onlineMap = new Map(onlineLines.map(row => [String(row._id), row]));
        rows = items.map(item => {
          const pos = posMap.get(String(item._id)) || {};
          const online = onlineMap.get(String(item._id)) || {};
          const known = (pos.missingLines || 0) === 0 && (online.missingLines || 0) === 0;
          return { ...item, sold: (pos.units || 0) + (online.units || 0),
            gross: cents((pos.gross || 0) + (online.gross || 0)),
            recordedCost: cents((pos.cost || 0) + (online.cost || 0)), grossProfit: known ?
              cents((pos.gross || 0) + (online.gross || 0) - (pos.cost || 0) - (online.cost || 0)) : null,
            profitComplete: known, posUnits: pos.units || 0, onlineUnits: online.units || 0, missingCostLines: (pos.missingLines || 0) + (online.missingLines || 0) };
        });
      }
    } else if (section === "services") {
      rows = await Content.find({ user: owner, ...cursor }).select("title price currency published visibility allowBookings updatedAt createdAt")
        .sort({ _id: -1 }).limit(limit + 1).lean();
    } else if (section === "bookings") {
      rows = await Booking.find({ user: owner, ...cursor, ...dateScope("createdAt", after) })
        .select("bookingReference service servicePrice currency status source bookingDate completedAt createdAt history")
        .sort({ _id: -1 }).limit(limit + 1).lean();
    } else if (section === "transactions") {
      const match = { ...base, ...(channel === "pos" ? dateScope("soldAt", after) :
        channel === "online" ? dateScope("createdAt", after) : dateScope("completedAt", after)) };
      if (channel === "pos") {
        const sales = await PosSale.find(match).select("invoiceNumber items total currency paymentMethod soldAt status createdAt")
          .sort({ _id: -1 }).limit(limit + 1).lean();
        rows = sales.map(s => ({ ...s, reference: s.invoiceNumber, amount: s.total, date: s.soldAt }));
      } else if (channel === "online") {
        const orders = await ProductOrder.find(match).select("orderNumber items total currency paymentMethod paymentStatus amountPaid status completedAt createdAt")
          .sort({ _id: -1 }).limit(limit + 1).lean();
        rows = orders.map(s => ({ ...s, reference: s.orderNumber, amount: s.total, date: s.completedAt || s.createdAt }));
      } else {
        const sales = await Sale.find(match).select("serviceName saleAmount currency completedAt status booking createdAt")
          .sort({ _id: -1 }).limit(limit + 1).lean();
        rows = sales.map(s => ({ ...s, reference: String(s.booking || s._id), amount: s.saleAmount, date: s.completedAt }));
      }
    } else if (section === "audit") {
      // Only evidence actually recorded by the application is shown here.
      const [stock, actions] = await Promise.all([
        InventoryMovement.find({ businessOwner: owner, ...cursor, ...dateScope("createdAt", after) })
          .select("productName type quantity stockAfter reference note createdAt")
          .sort({ _id: -1 }).limit(limit + 1).lean(),
        BusinessAuditEvent.find({ businessOwner: owner, ...cursor, ...dateScope("createdAt", after) })
          .select("action actor detail createdAt").sort({ _id: -1 }).limit(limit + 1).lean()
      ]);
      rows = [...stock.map(s => ({ ...s, action: "inventory." + s.type, detail: s.productName, type: "inventory" })),
        ...actions.map(a => ({ ...a, type: "admin" }))]
        .sort((a, b) => String(b._id).localeCompare(String(a._id)));
    }
    const hasMore = rows.length > limit;
    if (hasMore) rows = rows.slice(0, limit);
    res.set("Cache-Control", "no-store, private");
    res.json({ section, range, channel, summary, rows, hasMore,
      nextCursor: hasMore ? String(rows[rows.length - 1]._id) : null, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Admin transparency:", error);
    res.status(500).json({ message: "Unable to load business transparency report." });
  }
});

export default router;
