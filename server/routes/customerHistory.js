import { Router } from "express";
import mongoose from "mongoose";
import requireAuth from "../middleware/auth.js";
import Booking from "../models/Booking.js";
import Business from "../models/Business.js";
import Content from "../models/Content.js";
import { bookingMutationGuard } from "../middleware/bookingMutationGuard.js";
import { calculateBookingEndsAt, validateBookingWindow } from "../lib/scheduling.js";
import { ProductOrder } from "../models/Sale.js";
import { decodeBookingCursor, encodeBookingCursor, readPageSize } from "../lib/pagination.js";

const router = Router();
router.use(requireAuth, (req, res, next) => {
  if (req.user?.role !== "business") return res.status(403).json({ message: "Customer history is available to regular business accounts." });
  next();
});

async function resolveCustomerBookingOwner(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Booking not found." });
  }
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customerUser: req.user.id
    }).select("user").lean();
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    req.customerBookingOwner = booking.user;
    return next();
  } catch (error) {
    console.error("Customer booking ownership check failed", error);
    return res.status(500).json({ message: "Unable to update this booking." });
  }
}

const customerBookingMutationGuard = bookingMutationGuard(req => req.customerBookingOwner);


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

    const [rows, totalCount] = await Promise.all([
      ProductOrder.find(filter)
        .select("orderNumber items total currency status paymentStatus paymentMethod amountPaid paidAt courierName trackingNumber trackingUrl completedAt createdAt businessOwner deliveryLocation customerName customerEmail customerPhone notes")
        .populate("businessOwner", "name username")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean(),
      ProductOrder.countDocuments({ customerUser: req.user.id })
    ]);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const ownerIds = [...new Set(items.map(row => row.businessOwner?._id).filter(Boolean).map(String))];
    const businesses = ownerIds.length
      ? await Business.find({ owner: { $in: ownerIds } }).select("owner name").lean()
      : [];
    const businessNames = new Map(businesses.map(item => [String(item.owner), item.name]));

    return res.json({
      totalCount,
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
        customerName: order.customerName,
        customerEmail: order.customerEmail || "",
        customerPhone: order.customerPhone,
        notes: order.notes || "",
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

router.patch("/purchases/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Purchase not found." });
    }

    const ownedOrder = await ProductOrder.findOne({
      _id: req.params.id,
      customerUser: req.user.id
    }).select("_id status").lean();

    if (!ownedOrder) return res.status(404).json({ message: "Purchase not found." });
    if (!["pending", "confirmed"].includes(ownedOrder.status)) {
      return res.status(409).json({
        message: "Contact and delivery details can only be edited before the order enters processing."
      });
    }

    const customerName = String(req.body.customerName || "").trim();
    const customerPhone = String(req.body.customerPhone || "").trim();
    const customerEmail = String(req.body.customerEmail || "").trim().toLowerCase();
    const deliveryLocation = String(req.body.deliveryLocation || "").trim();
    const notes = String(req.body.notes || "").trim();

    if (!customerName || customerName.length > 120 ||
        !/^[0-9+().\-\s]{7,30}$/.test(customerPhone) ||
        customerEmail.length > 150 ||
        (customerEmail && !/^\S+@\S+\.\S+$/.test(customerEmail)) ||
        !deliveryLocation || deliveryLocation.length > 250 ||
        notes.length > 500) {
      return res.status(400).json({
        message: "Enter a valid name, phone number, email, delivery address and notes."
      });
    }

    const updated = await ProductOrder.findOneAndUpdate(
      {
        _id: req.params.id,
        customerUser: req.user.id,
        status: { $in: ["pending", "confirmed"] }
      },
      { $set: { customerName, customerPhone, customerEmail, deliveryLocation, notes } },
      { new: true, runValidators: true }
    ).select("_id status customerName customerEmail customerPhone deliveryLocation notes").lean();

    if (!updated) {
      return res.status(409).json({
        message: "This order has started processing and can no longer be edited."
      });
    }

    return res.json({
      id: updated._id,
      status: updated.status,
      customerName: updated.customerName,
      customerEmail: updated.customerEmail || "",
      customerPhone: updated.customerPhone,
      deliveryLocation: updated.deliveryLocation,
      notes: updated.notes || ""
    });
  } catch (error) {
    console.error("Customer purchase details update failed", error);
    return res.status(error.name === "ValidationError" || error.name === "CastError" ? 400 : 500)
      .json({ message: "Unable to update your order details." });
  }
});


router.patch("/bookings/:id", resolveCustomerBookingOwner, customerBookingMutationGuard, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      customerUser: req.user.id
    });
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    if (!["pending", "confirmed"].includes(booking.status)) {
      return res.status(409).json({
        message: "This booking can only be edited while it is pending or confirmed."
      });
    }

    const guestName = String(req.body.guestName || "").trim();
    const guestEmail = String(req.body.guestEmail || "").trim().toLowerCase();
    const guestPhone = String(req.body.guestPhone || "").trim();
    const locationLabel = String(req.body.locationLabel || "").trim();
    const notes = String(req.body.notes || "").trim();
    const bookingDate = new Date(req.body.bookingDate);

    if (!guestName || guestName.length > 100) {
      return res.status(400).json({ message: "Enter your name (100 characters or fewer)." });
    }
    if (!guestEmail || guestEmail.length > 150 || !/^\S+@\S+\.\S+$/.test(guestEmail)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (!/^[0-9+().\-\s]{7,30}$/.test(guestPhone)) {
      return res.status(400).json({ message: "Enter a valid phone number." });
    }
    if (locationLabel.length > 200) {
      return res.status(400).json({ message: "Location must be 200 characters or fewer." });
    }
    if (notes.length > 500) {
      return res.status(400).json({ message: "Notes must be 500 characters or fewer." });
    }
    if (Number.isNaN(bookingDate.getTime())) {
      return res.status(400).json({ message: "Choose a valid booking date and time." });
    }

    const oldDate = new Date(booking.bookingDate);
    const dateChanged = oldDate.getTime() !== bookingDate.getTime();
    if (dateChanged) {
      const business = await Business.findOne({ owner: booking.user });
      if (!business) return res.status(404).json({ message: "The service provider is no longer available." });

      const service = booking.content
        ? await Content.findOne({ _id: booking.content, user: booking.user })
            .select("durationMinutes bufferMinutes capacity")
            .lean()
        : null;
      const schedule = service || {
        durationMinutes: booking.serviceDurationMinutes || 60,
        bufferMinutes: booking.bufferMinutes || 0,
        capacity: 1
      };
      const scheduleError = await validateBookingWindow({
        business,
        service: schedule,
        ownerId: booking.user,
        start: bookingDate,
        excludeBookingId: booking._id
      });
      if (scheduleError) return res.status(409).json({ message: scheduleError });
      booking.bookingDate = bookingDate;
      booking.bookingEndsAt = calculateBookingEndsAt(bookingDate, schedule);
      booking.history.push({
        action: "rescheduled",
        status: booking.status,
        fromDate: oldDate,
        toDate: bookingDate,
        note: "Customer rescheduled their booking."
      });
    }

    const locationChanged = locationLabel !== String(booking.locationLabel || "");
    const detailsChanged =
      guestName !== booking.guestName ||
      guestEmail !== booking.guestEmail ||
      guestPhone !== booking.guestPhone ||
      locationChanged ||
      notes !== booking.notes;

    if (!dateChanged && !detailsChanged) {
      return res.json({
        id: booking._id,
        bookingReference: booking.bookingReference,
        status: booking.status,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        guestPhone: booking.guestPhone,
        bookingDate: booking.bookingDate,
        bookingEndsAt: booking.bookingEndsAt,
        locationLabel: booking.locationLabel,
        notes: booking.notes || ""
      });
    }

    booking.guestName = guestName;
    booking.guestEmail = guestEmail;
    booking.guestPhone = guestPhone;
    booking.locationLabel = locationLabel;
    booking.notes = notes;
    if (locationChanged) {
      booking.locationLatitude = null;
      booking.locationLongitude = null;
      booking.locationAccuracy = null;
    }
    if (detailsChanged) {
      booking.history.push({
        action: "customer_updated",
        status: booking.status,
        note: "Customer updated their booking details."
      });
    }

    await booking.save();
    req.app.get("io")?.to("user:" + String(booking.user)).emit("booking:updated", booking);

    return res.json({
      id: booking._id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      bookingDate: booking.bookingDate,
      bookingEndsAt: booking.bookingEndsAt,
      locationLabel: booking.locationLabel,
      notes: booking.notes || ""
    });
  } catch (error) {
    console.error("Customer booking update failed", error);
    return res.status(error.name === "ValidationError" || error.name === "CastError" ? 400 : 500)
      .json({ message: "Unable to update your booking." });
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

    const [rows, totalCount] = await Promise.all([
      Booking.find(filter)
        .select("bookingReference user business content service servicePrice currency serviceDurationMinutes bufferMinutes bookingDate bookingEndsAt completedAt status locationLabel guestName guestEmail guestPhone notes createdAt history")
        .populate("user", "name username")
        .populate("business", "name")
        .populate("content", "title")
        .sort({ bookingDate: -1, _id: -1 })
        .limit(limit + 1)
        .lean(),
      Booking.countDocuments({ customerUser: req.user.id })
    ]);

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
      guestName: booking.guestName || "",
      guestEmail: booking.guestEmail || "",
      guestPhone: booking.guestPhone || "",
      notes: booking.notes || "",
      createdAt: booking.createdAt,
      provider: {
        id: booking.user?._id || null,
        name: booking.business?.name || booking.user?.name || "BookFlow business",
        username: booking.user?.username || ""
      }
    }));

    return res.json({
      totalCount,
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
