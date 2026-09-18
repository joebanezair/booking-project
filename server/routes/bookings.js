import { randomBytes } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Business from "../models/Business.js";
import Review from "../models/Review.js";
import requireAuth from "../middleware/auth.js";
import { requireActiveBusiness, requireBusiness } from "../middleware/requireRole.js";

const router = Router();
router.use(requireAuth, requireBusiness);

const allowedStatuses = new Set(["pending", "confirmed", "completed", "cancelled"]);

function normalizeBooking(body) {
  return {
    guestName: String(body.guestName || "").trim(),
    guestPhone: String(body.guestPhone || "").trim(),
    locationLabel: String(body.locationLabel || "").trim(),
    locationLatitude: body.locationLatitude === "" || body.locationLatitude == null ? null : Number(body.locationLatitude),
    locationLongitude: body.locationLongitude === "" || body.locationLongitude == null ? null : Number(body.locationLongitude),
    locationAccuracy: body.locationAccuracy === "" || body.locationAccuracy == null ? null : Number(body.locationAccuracy),
    service: String(body.service || "").trim(),
    bookingDate: body.bookingDate,
    notes: String(body.notes || "").trim(),
    status: body.status || "pending"
  };
}

function validateBooking(input) {
  if (!input.guestName || !input.service || !input.bookingDate) return "Guest name, service and booking date are required.";
  if (input.guestName.length > 100 || input.service.length > 100) return "Guest name and service must be 100 characters or fewer.";
  if (input.guestPhone.length > 30) return "Phone number must be 30 characters or fewer.";
  if (input.locationLabel.length > 200) return "Location must be 200 characters or fewer.";
  const hasLatitude = input.locationLatitude !== null;
  const hasLongitude = input.locationLongitude !== null;
  if (hasLatitude !== hasLongitude) return "Location coordinates must include both latitude and longitude.";
  if (hasLatitude && (!Number.isFinite(input.locationLatitude) || input.locationLatitude < -90 || input.locationLatitude > 90)) return "Location latitude is invalid.";
  if (hasLongitude && (!Number.isFinite(input.locationLongitude) || input.locationLongitude < -180 || input.locationLongitude > 180)) return "Location longitude is invalid.";
  if (input.locationAccuracy !== null && (!Number.isFinite(input.locationAccuracy) || input.locationAccuracy < 0)) return "Location accuracy is invalid.";
  if (input.notes.length > 500) return "Notes must be 500 characters or fewer.";
  if (!allowedStatuses.has(input.status)) return "Invalid booking status.";
  if (Number.isNaN(new Date(input.bookingDate).getTime())) return "Booking date is invalid.";
  return null;
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

router.get("/", async (req, res) => {
  try {
    const filter = { user: req.user.id };
    if (req.query.status && allowedStatuses.has(req.query.status)) filter.status = req.query.status;
    if (req.query.search) {
      const search = String(req.query.search).trim();
      filter.$or = [
        { guestName: { $regex: search, $options: "i" } },
        { guestEmail: { $regex: search, $options: "i" } },
        { guestPhone: { $regex: search, $options: "i" } },
        { locationLabel: { $regex: search, $options: "i" } },
        { service: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } }
      ];
    }

    const bookings = await Booking.find(filter)
      .populate("content", "title visibility published")
      .sort({ bookingDate: 1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load bookings." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id })
      .populate("content", "title description category price currency coverImage visibility published");
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    const review = await Review.findOne({ booking: booking._id }).select("reviewToken verified submittedAt").lean();
    res.json({
      ...booking.toObject(),
      reviewInvite: review ? { token: review.reviewToken, verified: review.verified, submittedAt: review.submittedAt } : null
    });
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

    const business = req.user.businessId || (await Business.findOne({ owner: req.user.id }).select("_id").lean())?._id || null;
    const booking = await Booking.create({ user: req.user.id, business, ...input });
    const review = await ensureReviewInvite(booking);
    req.app.get("io").to(`user:${req.user.id}`).emit("booking:created", booking);
    res.status(201).json({ ...booking.toObject(), reviewInvite: review ? { token: review.reviewToken, verified: review.verified } : null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create booking." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });

    const input = normalizeBooking(req.body);
    const validationError = validateBooking(input);
    if (validationError) return res.status(400).json({ message: validationError });

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      input,
      { new: true, runValidators: true }
    );
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    const review = await ensureReviewInvite(booking);
    req.app.get("io").to(`user:${req.user.id}`).emit("booking:updated", booking);
    res.json({ ...booking.toObject(), reviewInvite: review ? { token: review.reviewToken, verified: review.verified, submittedAt: review.submittedAt } : null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update booking." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const booking = await Booking.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    await Review.deleteOne({ booking: booking._id });
    req.app.get("io").to(`user:${req.user.id}`).emit("booking:deleted", { id: String(booking._id) });
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete booking." });
  }
});

export default router;
