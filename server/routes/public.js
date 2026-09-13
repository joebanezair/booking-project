import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

const router = Router();

router.get("/book/:userId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(404).json({ message: "Booking page not found." });
    }
    const user = await User.findById(req.params.userId).select("name");
    if (!user) return res.status(404).json({ message: "Booking page not found." });

    res.json({
      owner: { id: user._id, name: user.name },
      services: ["Consultation", "Technical Support", "Product Demo", "Project Meeting", "Discovery Call", "Other"]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load booking page." });
  }
});

router.post("/book/:userId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(404).json({ message: "Booking page not found." });
    }
    const owner = await User.findById(req.params.userId);
    if (!owner) return res.status(404).json({ message: "Booking page not found." });

    const guestName = String(req.body.guestName || "").trim();
    const guestEmail = String(req.body.guestEmail || "").trim().toLowerCase();
    const service = String(req.body.service || "").trim();
    const bookingDate = req.body.bookingDate;
    const notes = String(req.body.notes || "").trim();

    if (!guestName || !guestEmail || !service || !bookingDate) {
      return res.status(400).json({ message: "Name, email, service and booking date are required." });
    }
    if (!/^\S+@\S+\.\S+$/.test(guestEmail)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (Number.isNaN(new Date(bookingDate).getTime())) {
      return res.status(400).json({ message: "Booking date is invalid." });
    }
    if (new Date(bookingDate) < new Date()) {
      return res.status(400).json({ message: "Please choose a future date and time." });
    }

    const booking = await Booking.create({
      user: owner._id,
      guestName,
      guestEmail,
      service,
      bookingDate,
      notes,
      source: "public",
      status: "pending"
    });

    res.status(201).json({ id: booking._id, message: "Booking request sent successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create booking." });
  }
});

export default router;
