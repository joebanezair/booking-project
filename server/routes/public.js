import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Content from "../models/Content.js";
import User from "../models/User.js";

const router = Router();

router.get("/profile/:userId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(404).json({ message: "Profile not found." });
    }
    const user = await User.findById(req.params.userId)
      .select("name bio headline location website profileImage createdAt");
    if (!user) return res.status(404).json({ message: "Profile not found." });

    const items = await Content.find({ user: user._id, published: true })
      .select("title description price currency category coverImage images createdAt updatedAt")
      .sort({ updatedAt: -1 });

    res.json({
      profile: {
        id: user._id,
        name: user.name,
        bio: user.bio,
        headline: user.headline,
        location: user.location,
        website: user.website,
        profileImage: user.profileImage,
        createdAt: user.createdAt
      },
      content: items
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load public profile." });
  }
});

router.get("/content/:contentId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.contentId)) {
      return res.status(404).json({ message: "Content not found." });
    }

    const item = await Content.findOne({ _id: req.params.contentId, published: true })
      .populate("user", "name bio headline location website profileImage");
    if (!item || !item.user) return res.status(404).json({ message: "Content not found." });

    res.json({
      _id: item._id,
      title: item.title,
      description: item.description,
      price: item.price,
      currency: item.currency,
      category: item.category,
      coverImage: item.coverImage,
      images: item.images,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      owner: {
        id: item.user._id,
        name: item.user.name,
        bio: item.user.bio,
        headline: item.user.headline,
        location: item.user.location,
        website: item.user.website,
        profileImage: item.user.profileImage
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load content." });
  }
});

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
