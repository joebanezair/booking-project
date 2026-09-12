import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const allowedStatuses = new Set(["pending", "confirmed", "cancelled"]);

function normalizeBooking(body) {
  return {
    guestName: String(body.guestName || "").trim(),
    service: String(body.service || "").trim(),
    bookingDate: body.bookingDate,
    notes: String(body.notes || "").trim(),
    status: body.status || "pending"
  };
}

function validateBooking(input) {
  if (!input.guestName || !input.service || !input.bookingDate) {
    return "Guest name, service and booking date are required.";
  }
  if (input.guestName.length > 100 || input.service.length > 100) {
    return "Guest name and service must be 100 characters or fewer.";
  }
  if (input.notes.length > 500) {
    return "Notes must be 500 characters or fewer.";
  }
  if (!allowedStatuses.has(input.status)) {
    return "Invalid booking status.";
  }
  if (Number.isNaN(new Date(input.bookingDate).getTime())) {
    return "Booking date is invalid.";
  }
  return null;
}

router.get("/", async (req, res) => {
  try {
    const filter = { user: req.user.id };

    if (req.query.status && allowedStatuses.has(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      const search = String(req.query.search).trim();
      filter.$or = [
        { guestName: { $regex: search, $options: "i" } },
        { service: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } }
      ];
    }

    const bookings = await Booking.find(filter).sort({ bookingDate: 1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load bookings." });
  }
});

router.post("/", async (req, res) => {
  try {
    const input = normalizeBooking(req.body);
    const validationError = validateBooking(input);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const booking = await Booking.create({ user: req.user.id, ...input });
    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create booking." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking ID." });
    }

    const input = normalizeBooking(req.body);
    const validationError = validateBooking(input);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      input,
      { new: true, runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update booking." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking ID." });
    }

    const booking = await Booking.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete booking." });
  }
});

export default router;
