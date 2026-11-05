import { Router } from "express";
import mongoose from "mongoose";
import requireAuth from "../middleware/auth.js";
import Booking from "../models/Booking.js";
import Business from "../models/Business.js";
import { ProductOrder } from "../models/Sale.js";
import { decodeBookingCursor, encodeBookingCursor, readPageSize } from "../lib/pagination.js";

const router = Router();
router.use(requireAuth, (req, res, next) => {
  if (req.user?.role !== "business") return res.status(403).json({ message: "Customer history is available to regular business accounts." });
  next();
});

const purchaseStatuses = new Set(["pending", "confirmed", "processing", "ready", "out_for_delivery", "completed", "cancelled"]);
const bookingStatuses = new Set(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]);

function safeSearch(value) {
  return String(value || "").trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function encodeOrderCursor(row) {
  return Buffer.from(JSON.stringify([new Date(row.createdAt).toISOString(), String(row._id)])).toString("base64url");
}

function decodeOrderCursor(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,150}$/.test(value)) return null;
  try {
    const pair = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(pair) || pair.length !== 2 || !mongoose.isValidObjectId(pair[1])) return null;
    const createdAt = new Date(pair[0]);
    if (typeof pair[0] !== "string" || Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== pair[0]) return null;
    return { createdAt, id: new mongoose.Types.ObjectId(pair[1]) };
  } catch {
    return null;
  }
}

router.get("/purchases", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const limit = readPageSize(req.query.limit || "20", 50);
    if (!limit) return res.status(400).json({ message: "Limit must be between 1 and 50." });

    const filter = { customerUser: req.user.id };
    const status = String(req.query.status || "all");
    if (status !== "all") {
      if (!purchaseStatuses.has(status)) return res.status(400).json({ message: "Invalid purchase status." });
      filter.status = status;
    }
    const search = safeSearch(req.query.search);
    if (search) filter.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "items.name": { $regex: search, $options: "i" } }
    ];
    if (req.query.cursor) {
      const cursor = decodeOrderCursor(req.query.cursor);
      if (!cursor) return res.status(400).json({ message: "Invalid purchase history cursor." });
      filter.$and = [{ $or: [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }
      ] }];
    }

    const rows = await ProductOrder.find(filter)
      .select("orderNumber items total currency status paymentStatus paymentMethod amountPaid paidAt courierName trackingNumber trackingUrl completedAt createdAt businessOwner deliveryLocation")
      .populate("businessOwner", "name username")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const ownerIds = [...new Set(items.map(row => row.businessOwner?._id).filter(Boolean).map(String))];
    const businesses = ownerIds.length
      ? await Business.find({ owner: { $in: ownerIds } }).select("owner name").lean()
      : [];
    const businessNames = new Map(businesses.map(item => [String(item.owner), item.name]));

    return res.json({
      items: items.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        items: (order.items || []).map(item => ({
          name: item.name,
          image: item.image || item.images?.[0] || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal
        })),
        total: order.total,
        currency: order.currency || "PHP",
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        amountPaid: order.amountPaid,
        paidAt: order.paidAt,
        deliveryLocation: order.deliveryLocation,
        courierName: order.courierName,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        completedAt: order.completedAt,
        createdAt: order.createdAt,
        seller: {
          id: order.businessOwner?._id || null,
          name: businessNames.get(String(order.businessOwner?._id)) || order.businessOwner?.name || "BookFlow business",
          username: order.businessOwner?.username || ""
        }
      })),
      hasMore,
      nextCursor: hasMore ? encodeOrderCursor(items[items.length - 1]) : null
    });
  } catch (error) {
    console.error("Customer purchase history failed", error);
    return res.status(500).json({ message: "Unable to load purchase history." });
  }
});

router.get("/bookings", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const limit = readPageSize(req.query.limit || "20", 50);
    if (!limit) return res.status(400).json({ message: "Limit must be between 1 and 50." });

    const filter = { customerUser: req.user.id };
    const status = String(req.query.status || "all");
    if (status !== "all") {
      if (!bookingStatuses.has(status)) return res.status(400).json({ message: "Invalid booking status." });
      filter.status = status;
    }
    const search = safeSearch(req.query.search);
    if (search) filter.$or = [
      { bookingReference: { $regex: search, $options: "i" } },
      { service: { $regex: search, $options: "i" } }
    ];
    if (req.query.cursor) {
      const cursor = decodeBookingCursor(req.query.cursor);
      if (!cursor) return res.status(400).json({ message: "Invalid booking history cursor." });
      filter.$and = [{ $or: [
        { bookingDate: { $lt: cursor.bookingDate } },
        { bookingDate: cursor.bookingDate, _id: { $lt: cursor.id } }
      ] }];
    }

    const rows = await Booking.find(filter)
      .select("bookingReference user business content service servicePrice currency serviceDurationMinutes bookingDate bookingEndsAt completedAt status locationLabel createdAt history")
      .populate("user", "name username")
      .populate("business", "name")
      .populate("content", "title")
      .sort({ bookingDate: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(booking => ({
      id: booking._id,
      bookingReference: booking.bookingReference,
      service: booking.service || booking.content?.title || "Service booking",
      servicePrice: booking.servicePrice,
      currency: booking.currency || "PHP",
      serviceDurationMinutes: booking.serviceDurationMinutes,
      bookingDate: booking.bookingDate,
      bookingEndsAt: booking.bookingEndsAt,
      completedAt: booking.completedAt,
      status: booking.status,
      locationLabel: booking.locationLabel,
      createdAt: booking.createdAt,
      provider: {
        id: booking.user?._id || null,
        name: booking.business?.name || booking.user?.name || "BookFlow business",
        username: booking.user?.username || ""
      }
    }));

    return res.json({
      items,
      hasMore,
      nextCursor: hasMore ? encodeBookingCursor(rows[limit - 1]) : null
    });
  } catch (error) {
    console.error("Customer booking history failed", error);
    return res.status(500).json({ message: "Unable to load booking history." });
  }
});

export default router;
