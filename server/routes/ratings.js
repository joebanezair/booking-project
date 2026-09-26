import { Router } from "express";
import mongoose from "mongoose";
import Content from "../models/Content.js";
import Business from "../models/Business.js";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

async function getPublishedContent(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Content.findOne({ _id: id, published: true, visibility: { $ne: "private" }, allowRatings: true }).select("user");
}

router.put("/:contentId", async (req, res) => {
  try {
    const content = await getPublishedContent(req.params.contentId);
    if (!content) return res.status(404).json({ message: "Published content not found." });
    if (String(content.user) === String(req.user.id)) {
      return res.status(403).json({ message: "You cannot rate your own content." });
    }

    const value = Number(req.body.rating);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return res.status(400).json({ message: "Rating must be an integer from 1 to 5." });
    }

    const rating = await Rating.findOneAndUpdate(
      { content: content._id, user: req.user.id },
      { rating: value },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.json(rating);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to save rating." });
  }
});

router.delete("/:contentId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.contentId)) {
      return res.status(400).json({ message: "Invalid content ID." });
    }
    await Rating.findOneAndDelete({ content: req.params.contentId, user: req.user.id });
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to remove rating." });
  }
});

router.put("/business/:businessId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.businessId)) return res.status(400).json({ message: "Invalid business ID." });
    const [business, currentUser] = await Promise.all([
      Business.findById(req.params.businessId).select("owner"),
      User.findById(req.user.id).select("accountStatus")
    ]);
    if (!business) return res.status(404).json({ message: "Business not found." });
    if ((currentUser?.accountStatus || "active") === "disabled") return res.status(403).json({ message: "Disabled accounts cannot rate businesses." });
    if (String(business.owner) === String(req.user.id)) return res.status(403).json({ message: "You cannot rate your own business." });
    const value = Number(req.body.rating);
    if (!Number.isInteger(value) || value < 1 || value > 5) return res.status(400).json({ message: "Rating must be an integer from 1 to 5." });
    const rating = await Rating.findOneAndUpdate({ business: business._id, user: req.user.id }, { rating: value, content: null }, { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true });
    res.json(rating);
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to save business rating." }); }
});

router.delete("/business/:businessId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.businessId)) return res.status(400).json({ message: "Invalid business ID." });
    await Rating.findOneAndDelete({ business: req.params.businessId, user: req.user.id });
    res.status(204).end();
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to remove business rating." }); }
});

export default router;
