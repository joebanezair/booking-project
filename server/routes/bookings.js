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
    const filter = ["admin", "business"].includes(req.user.role) ? { user: req.user.id } : { customer: req.user.id };

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

    const bookings = await Booking.find(filter)
      .populate("content","title visibility published")
      .populate("user", "name username")
      .sort({ bookingDate: 1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load bookings." });
  }
});

router.get("/:id", async (req,res) => {
  try {
    if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({message:"Invalid booking ID."});
    const ownership = ["admin", "business"].includes(req.user.role) ? { user: req.user.id } : { customer: req.user.id };
    const booking=await Booking.findOne({_id:req.params.id,...ownership})
      .populate("content","title description category price currency coverImage visibility published")
      .populate("user", "name username");
    if(!booking) return res.status(404).json({message:"Booking not found."});
    res.json(booking);
  } catch(error){console.error(error);res.status(500).json({message:"Unable to load booking."});}
});

router.post("/", async (req, res) => {
  try {
    if (!["admin", "business"].includes(req.user.role)) return res.status(403).json({ message: "Only business accounts can create dashboard bookings." });
    const input = normalizeBooking(req.body);
    const validationError = validateBooking(input);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const booking = await Booking.create({ user: req.user.id, ...input });
    req.app.get("io").to(`user:${req.user.id}`).emit("booking:created", booking);
    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create booking." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!["admin", "business"].includes(req.user.role)) return res.status(403).json({ message: "Only business accounts can update booking details and status." });
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

    req.app.get("io").to(`user:${req.user.id}`).emit("booking:updated", booking);
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update booking." });
  }
});

router.patch("/:id/cancel", async (req, res) => {
  try {
    if (req.user.role !== "customer") return res.status(403).json({ message: "This action is available to customers only." });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, customer: req.user.id, status: { $ne: "cancelled" } },
      { status: "cancelled" },
      { new: true, runValidators: true }
    );
    if (!booking) return res.status(404).json({ message: "Booking not found or already cancelled." });
    req.app.get("io").to(`user:${booking.user}`).emit("booking:updated", booking);
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to cancel booking." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!["admin", "business"].includes(req.user.role)) return res.status(403).json({ message: "Only business accounts can delete bookings." });
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

    req.app.get("io").to(`user:${req.user.id}`).emit("booking:deleted", { id: String(booking._id) });
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete booking." });
  }
});

export default router;
