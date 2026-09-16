import { Router } from "express";
import mongoose from "mongoose";
import Content from "../models/Content.js";
import Rating from "../models/Rating.js";
import Comment from "../models/Comment.js";
import Reaction from "../models/Reaction.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const imagePattern = /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i;

function validateImage(value, label) {
  if (!value) return null;
  if (!imagePattern.test(value)) return `${label} must be a JPEG, PNG, WebP, or GIF.`;
  const base64 = value.split(",")[1] || "";
  const bytes = Math.ceil(base64.length * 3 / 4);
  if (bytes > 2 * 1024 * 1024) return `${label} must be 2 MB or smaller.`;
  return null;
}

function normalize(body) {
  return {
    title: String(body.title || "").trim(),
    description: String(body.description || "").trim(),
    price: Number(body.price || 0),
    currency: String(body.currency || "PHP").trim().toUpperCase(),
    category: String(body.category || "General").trim(),
    coverImage: String(body.coverImage || ""),
    images: Array.isArray(body.images) ? body.images.map(String).filter(Boolean) : [],
    allowRatings: body.allowRatings !== false,
    allowBookings: body.allowBookings !== false,
    visibility: body.visibility === "private" ? "private" : "public",
    published: Boolean(body.published)
  };
}

function validate(input) {
  if (!input.title || !input.description) return "Title and description are required.";
  if (input.title.length > 120) return "Title must be 120 characters or fewer.";
  if (input.description.length > 5000) return "Description must be 5000 characters or fewer.";
  if (!Number.isFinite(input.price) || input.price < 0) return "Price must be a valid non-negative number.";
  if (!/^[A-Z]{3}$/.test(input.currency)) return "Currency must be a 3-letter code.";
  if (!input.category || input.category.length > 80) return "Category must be 80 characters or fewer.";
  if (input.images.length > 8) return "You can upload up to 8 additional images.";
  const coverError = validateImage(input.coverImage, "Cover image");
  if (coverError) return coverError;
  for (let i = 0; i < input.images.length; i += 1) {
    const error = validateImage(input.images[i], `Image ${i + 1}`);
    if (error) return error;
  }
  return null;
}

router.get("/", async (req, res) => {
  try {
    const items = await Content.find({ user: req.user.id }).sort({ updatedAt: -1 });
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load content." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid content ID." });
    const item = await Content.findOne({ _id: req.params.id, user: req.user.id });
    if (!item) return res.status(404).json({ message: "Content not found." });
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load content." });
  }
});

router.post("/", async (req, res) => {
  try {
    const input = normalize(req.body);
    const error = validate(input);
    if (error) return res.status(400).json({ message: error });

    const item = await Content.create({ user: req.user.id, ...input });
    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create content." });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid content ID." });
    }
    const input = normalize(req.body);
    const error = validate(input);
    if (error) return res.status(400).json({ message: error });

    const item = await Content.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      input,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: "Content not found." });
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update content." });
  }
});

router.patch("/:id/publish", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid content ID." });
    }
    const item = await Content.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { published: Boolean(req.body.published) },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: "Content not found." });
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update publish status." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid content ID." });
    }
    const item = await Content.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!item) return res.status(404).json({ message: "Content not found." });
    await Promise.all([
      Rating.deleteMany({ content: req.params.id }),
      Comment.deleteMany({ content: req.params.id })
      ,Reaction.deleteMany({ content: req.params.id })
    ]);
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete content." });
  }
});

export default router;
