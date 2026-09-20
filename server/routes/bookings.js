import { randomBytes } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Business from "../models/Business.js";
import Content from "../models/Content.js";
import Review from "../models/Review.js";
import Sale from "../models/Sale.js";
import requireAuth from "../middleware/auth.js";
import { requireActiveBusiness, requireBusiness } from "../middleware/requireRole.js";
import { syncSaleForBooking } from "../lib/sales.js";
import { calculateBookingEndsAt, makeBookingReference, validateBookingWindow } from "../lib/scheduling.js";

const router = Router();
router.use(requireAuth, requireBusiness);

const allowedStatuses = new Set(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]);
const schedulableStatuses = new Set(["pending", "confirmed", "in_progress"]);

function normalizeBooking(body) {
  return {
    contentId: String(body.contentId || "").trim(),
    guestName: String(body.guestName || "").trim(),
    guestEmail: String(body.guestEmail || "").trim().toLowerCase(),
    guestPhone: String(body.guestPhone || "").trim(),
    locationLabel: String(body.locationLabel || "").trim(),
    locationLatitude: body.locationLatitude === "" || body.locationLatitude == null ? null : Number(body.locationLatitude),
    locationLongitude: body.locationLongitude === "" || body.locationLongitude == null ? null : Number(body.locationLongitude),
    locationAccuracy: body.locationAccuracy === "" || body.locationAccuracy == null ? null : Number(body.locationAccuracy),
    service: String(body.service || "").trim(),
    servicePrice: body.servicePrice === "" || body.servicePrice == null ? 0 : Number(body.servicePrice),
    currency: String(body.currency || "PHP").trim().toUpperCase(),
    serviceDurationMinutes: Number(body.serviceDurationMinutes ?? 60),
    bufferMinutes: Number(body.bufferMinutes ?? 0),
    bookingDate: body.bookingDate,
    notes: String(body.notes || "").trim(),
    internalNotes: String(body.internalNotes || "").trim(),
    status: body.status || "pending"
  };
}

function validateBooking(input) {
  if (!input.guestName || !input.service || !input.bookingDate) return "Guest name, service and booking date are required.";
  if (input.guestName.length > 100 || input.service.length > 100) return "Guest name and service must be 100 characters or fewer.";
  if (input.guestEmail && !/^\S+@\S+\.\S+$/.test(input.guestEmail)) return "Enter a valid guest email address.";
  if (input.guestPhone.length > 30) return "Phone number must be 30 characters or fewer.";
  if (input.locationLabel.length > 200) return "Location must be 200 characters or fewer.";
  if (!Number.isFinite(input.servicePrice) || input.servicePrice < 0) return "Service price must be a valid non-negative amount.";
  if (!/^[A-Z]{3}$/.test(input.currency)) return "Currency must be a three-letter code.";
  if (!Number.isInteger(input.serviceDurationMinutes) || input.serviceDurationMinutes < 5 || input.serviceDurationMinutes > 1440) return "Service duration must be between 5 and 1,440 minutes.";
  if (!Number.isInteger(input.bufferMinutes) || input.bufferMinutes < 0 || input.bufferMinutes > 240) return "Buffer time must be between 0 and 240 minutes.";
  const hasLatitude = input.locationLatitude !== null;
  const hasLongitude = input.locationLongitude !== null;
  if (hasLatitude !== hasLongitude) return "Location coordinates must include both latitude and longitude.";
  if (hasLatitude && (!Number.isFinite(input.locationLatitude) || input.locationLatitude < -90 || input.locationLatitude > 90)) return "Location latitude is invalid.";
  if (hasLongitude && (!Number.isFinite(input.locationLongitude) || input.locationLongitude < -180 || input.locationLongitude > 180)) return "Location longitude is invalid.";
  if (input.locationAccuracy !== null && (!Number.isFinite(input.locationAccuracy) || input.locationAccuracy < 0)) return "Location accuracy is invalid.";
  if (input.notes.length > 500) return "Notes must be 500 characters or fewer.";
  if (input.internalNotes.length > 2000) return "Internal notes must be 2,000 characters or fewer.";
  if (!allowedStatuses.has(input.status)) return "Invalid booking status.";
  if (Number.isNaN(new Date(input.bookingDate).getTime())) return "Booking date is invalid.";
  if (input.contentId && !mongoose.isValidObjectId(input.contentId)) return "Invalid service selection.";
  return null;
}

async function uniqueReference() {
  for (let index = 0; index < 5; index += 1) {
    const reference = makeBookingReference();
    if (!await Booking.exists({ bookingReference: reference })) return reference;
  }
  return "BF-" + Date.now().toString(36).toUpperCase() + "-" + randomBytes(2).toString("hex").toUpperCase();
}

async function resolveService(ownerId, contentId, fallback) {
  if (!contentId) return { content: null, schedule: fallback };
  const item = await Content.findOne({ _id: contentId, user: ownerId })
    .select("title price currency durationMinutes bufferMinutes capacity");
  if (!item) throw Object.assign(new Error("Selected service was not found."), { status: 404 });
  return {
    content: item,
    schedule: {
      title: item.title,
      price: Number(item.price || 0),
      currency: item.currency || "PHP",
      durationMinutes: Number(item.durationMinutes || 60),
      bufferMinutes: Number(item.bufferMinutes || 0),
      capacity: Number(item.capacity || 1)
    }
  };
}

async function ensureReviewInvite(booking) {
  if (booking.status !== "completed") return null;
  let businessId = booking.business;
  if (!businessId) {
    const business = await Business.findOne({ owner: booking.user }).select("_id").lean();
    businessId = business?._id || null;
  }
  if (!businessId) return null;

  return Review.findOneAndUpdate(
    { booking: booking._id },
    {
      $setOnInsert: {
        booking: booking._id,
        business: businessId,
        businessOwner: booking.user,
        reviewToken: randomBytes(24).toString("hex")
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function responsePayload(booking) {
  const [review, sale] = await Promise.all([
    Review.findOne({ booking: booking._id }).select("reviewToken verified submittedAt").lean(),
    Sale.findOne({ booking: booking._id }).select("saleAmount currency status completedAt voidedAt voidReason").lean()
  ]);
  return {
    ...booking.toObject(),
    reviewInvite: review ? { token: review.reviewToken, verified: review.verified, submittedAt: review.submittedAt } : null,
    saleRecord: sale || null
  };
}

async function applyStatus(booking, nextStatus) {
  const previousStatus = booking.status;
  booking.status = nextStatus;
  if (nextStatus === "completed") {
    booking.completedAt = booking.completedAt || new Date();
  } else if (previousStatus === "completed") {
    booking.completedAt = null;
  }
  booking.history.push({
    action: "status_changed",
    status: nextStatus,
    note: previousStatus + " → " + nextStatus
  });
  await booking.save();

  const sale = await syncSaleForBooking(
    booking,
    previousStatus === "completed" && nextStatus !== "completed"
      ? `Booking reopened from completed to ${nextStatus}.`
      : ""
  );
  const review = await ensureReviewInvite(booking);
  return { booking, sale, review };
}

router.get("/", async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.status && allowedStatuses.has(req.query.status)) filter.status = req.query.status;
    if (req.query.start || req.query.end) {
      filter.bookingDate = {};
      if (req.query.start && !Number.isNaN(new Date(req.query.start).getTime())) filter.bookingDate.$gte = new Date(req.query.start);
      if (req.query.end && !Number.isNaN(new Date(req.query.end).getTime())) filter.bookingDate.$lt = new Date(req.query.end);
      if (!Object.keys(filter.bookingDate).length) delete filter.bookingDate;
    }
    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);
      filter.$or = [
        { bookingReference: { $regex: search, $options: "i" } },
        { guestName: { $regex: search, $options: "i" } },
        { guestEmail: { $regex: search, $options: "i" } },
        { guestPhone: { $regex: search, $options: "i" } },
        { locationLabel: { $regex: search, $options: "i" } },
        { service: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } }
      ];
    }

    const bookings = await Booking.find(filter)
      .populate("content", "title visibility published price currency durationMinutes bufferMinutes capacity")
      .sort({ bookingDate: 1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load bookings." });
  }
});

router.get("/customers/summary", async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .select("guestName guestEmail guestPhone service bookingDate status")
      .sort({ bookingDate: -1 })
      .lean();
    const groups = new Map();
    const now = new Date();

    for (const booking of bookings) {
      const email = String(booking.guestEmail || "").trim().toLowerCase();
      const phone = String(booking.guestPhone || "").replace(/\D/g, "");
      const key = email || phone || String(booking.guestName || "").trim().toLowerCase();
      if (!key) continue;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail || "",
          guestPhone: booking.guestPhone || "",
          totalBookings: 0,
          completedBookings: 0,
          noShows: 0,
          upcomingBookings: 0,
          lastBooking: null,
          services: {}
        });
      }
      const row = groups.get(key);
      row.totalBookings += 1;
      if (booking.status === "completed") row.completedBookings += 1;
      if (booking.status === "no_show") row.noShows += 1;
      if (new Date(booking.bookingDate) > now && !["cancelled", "no_show"].includes(booking.status)) row.upcomingBookings += 1;
      if (!row.lastBooking || new Date(booking.bookingDate) > new Date(row.lastBooking)) row.lastBooking = booking.bookingDate;
      row.services[booking.service] = (row.services[booking.service] || 0) + 1;
    }

    res.json([...groups.values()]
      .map(row => ({
        ...row,
        services: Object.entries(row.services).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
      }))
      .sort((a, b) => b.totalBookings - a.totalBookings));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load customer history." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id })
      .populate("content", "title description category price currency coverImage visibility published durationMinutes bufferMinutes capacity");
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    res.json(await responsePayload(booking));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load booking." });
  }
});

router.post("/", requireActiveBusiness, async (req, res) => {
  try {
    const input = normalizeBooking(req.body);
    const validationError = validateBooking(input);
    if (validationError) return res.status(400).json({ message: validationError });

    const business = await Business.findOne({ owner: req.user.id });
    if (!business) return res.status(404).json({ message: "Business profile not found." });

    const resolved = await resolveService(req.user.id, input.contentId, {
      durationMinutes: input.serviceDurationMinutes,
      bufferMinutes: input.bufferMinutes,
      capacity: 1
    });

    if (schedulableStatuses.has(input.status)) {
      const scheduleError = await validateBookingWindow({
        business,
        service: resolved.schedule,
        ownerId: req.user.id,
        start: input.bookingDate
      });
      if (scheduleError) return res.status(409).json({ message: scheduleError });
    }

    const bookingDate = new Date(input.bookingDate);
    const booking = await Booking.create({
      user: req.user.id,
      business: business._id,
      content: resolved.content?._id || null,
      bookingReference: await uniqueReference(),
      ...input,
      service: resolved.content?.title || input.service,
      servicePrice: resolved.content ? Number(resolved.content.price || 0) : input.servicePrice,
      currency: resolved.content?.currency || input.currency,
      serviceDurationMinutes: resolved.schedule.durationMinutes,
      bufferMinutes: resolved.schedule.bufferMinutes,
      bookingDate,
      bookingEndsAt: calculateBookingEndsAt(bookingDate, resolved.schedule),
      completedAt: input.status === "completed" ? new Date() : null,
      history: [{ action: "created", status: input.status, note: "Booking created from dashboard." }]
    });

    await syncSaleForBooking(booking);
    await ensureReviewInvite(booking);
    req.app.get("io").to(`user:${req.user.id}`).emit("booking:created", booking);
    res.status(201).json(await responsePayload(booking));
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || "Unable to create booking." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });

    const input = normalizeBooking(req.body);
    const validationError = validateBooking(input);
    if (validationError) return res.status(400).json({ message: validationError });

    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    const previousStatus = booking.status;
    if (previousStatus === "completed" && input.status === "completed") {
      const financialFieldsChanged =
        booking.service !== input.service ||
        Number(booking.servicePrice || 0) !== Number(input.servicePrice || 0) ||
        String(booking.currency || "PHP") !== String(input.currency || "PHP") ||
        new Date(booking.bookingDate).getTime() !== new Date(input.bookingDate).getTime();
      if (financialFieldsChanged) {
        return res.status(409).json({ message: "Reopen the booking before changing its service, price, currency, or booking date. This preserves the recorded sales audit trail." });
      }
    }

    const business = await Business.findOne({ owner: req.user.id });
    const resolved = await resolveService(req.user.id, input.contentId || String(booking.content || ""), {
      durationMinutes: input.serviceDurationMinutes,
      bufferMinutes: input.bufferMinutes,
      capacity: 1
    });
    if (schedulableStatuses.has(input.status)) {
      const scheduleError = await validateBookingWindow({
        business,
        service: resolved.schedule,
        ownerId: req.user.id,
        start: input.bookingDate,
        excludeBookingId: booking._id
      });
      if (scheduleError) return res.status(409).json({ message: scheduleError });
    }

    const oldDate = booking.bookingDate;
    Object.assign(booking, input, {
      content: resolved.content?._id || booking.content || null,
      service: resolved.content?.title || input.service,
      servicePrice: resolved.content ? Number(resolved.content.price || 0) : input.servicePrice,
      currency: resolved.content?.currency || input.currency,
      serviceDurationMinutes: resolved.schedule.durationMinutes,
      bufferMinutes: resolved.schedule.bufferMinutes,
      bookingDate: new Date(input.bookingDate),
      bookingEndsAt: calculateBookingEndsAt(input.bookingDate, resolved.schedule)
    });
    if (input.status === "completed") booking.completedAt = booking.completedAt || new Date();
    else if (previousStatus === "completed") booking.completedAt = null;

    const dateChanged = new Date(oldDate).getTime() !== new Date(input.bookingDate).getTime();
    if (dateChanged) {
      booking.history.push({ action: "rescheduled", status: input.status, fromDate: oldDate, toDate: input.bookingDate, note: "Booking date changed while editing." });
    }
    if (previousStatus !== input.status) {
      booking.history.push({ action: "status_changed", status: input.status, note: previousStatus + " → " + input.status });
    }
    await booking.save();

    await syncSaleForBooking(
      booking,
      previousStatus === "completed" && input.status !== "completed"
        ? `Booking reopened from completed to ${input.status}.`
        : ""
    );
    await ensureReviewInvite(booking);

    req.app.get("io").to(`user:${req.user.id}`).emit("booking:updated", booking);
    res.json(await responsePayload(booking));
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || "Unable to update booking." });
  }
});

router.patch("/:id/reschedule", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const bookingDate = new Date(req.body.bookingDate);
    if (Number.isNaN(bookingDate.getTime())) return res.status(400).json({ message: "Choose a valid new date and time." });

    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (booking.status === "completed") return res.status(409).json({ message: "Reopen a completed booking before rescheduling it." });
    if (["cancelled", "no_show"].includes(booking.status)) return res.status(409).json({ message: "Reopen this booking before rescheduling it." });

    const business = await Business.findOne({ owner: req.user.id });
    const service = booking.content
      ? await Content.findOne({ _id: booking.content, user: req.user.id }).select("durationMinutes bufferMinutes capacity")
      : null;
    const schedule = service || {
      durationMinutes: booking.serviceDurationMinutes || 60,
      bufferMinutes: booking.bufferMinutes || 0,
      capacity: 1
    };
    const scheduleError = await validateBookingWindow({
      business,
      service: schedule,
      ownerId: req.user.id,
      start: bookingDate,
      excludeBookingId: booking._id
    });
    if (scheduleError) return res.status(409).json({ message: scheduleError });

    const oldDate = booking.bookingDate;
    booking.bookingDate = bookingDate;
    booking.bookingEndsAt = calculateBookingEndsAt(bookingDate, schedule);
    booking.history.push({
      action: "rescheduled",
      status: booking.status,
      fromDate: oldDate,
      toDate: bookingDate,
      note: String(req.body.reason || "Booking rescheduled.").trim().slice(0, 500)
    });
    await booking.save();

    req.app.get("io").to(`user:${req.user.id}`).emit("booking:updated", booking);
    res.json(await responsePayload(booking));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to reschedule booking." });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const status = String(req.body.status || "");
    if (!allowedStatuses.has(status)) return res.status(400).json({ message: "Invalid booking status." });

    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    await applyStatus(booking, status);
    req.app.get("io").to(`user:${req.user.id}`).emit("booking:updated", booking);
    res.json(await responsePayload(booking));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update booking status." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: "Booking not found." });
    if (await Sale.exists({ booking: booking._id })) {
      return res.status(409).json({ message: "This booking has a sales audit record and cannot be deleted. Reopen, cancel, or keep it for reporting history." });
    }

    await Booking.deleteOne({ _id: booking._id });
    await Review.deleteOne({ booking: booking._id });
    req.app.get("io").to(`user:${req.user.id}`).emit("booking:deleted", { id: String(booking._id) });
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete booking." });
  }
});

export default router;
