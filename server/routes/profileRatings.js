import { Router } from "express";
import mongoose from "mongoose";
import ProfileRating from "../models/ProfileRating.js";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";

const router = Router();
router.use(requireAuth);

async function summary(profileId, userId) {
  const [rows, current] = await Promise.all([
    ProfileRating.aggregate([{ $match: { profile: new mongoose.Types.ObjectId(profileId) } }, { $group: { _id: "$profile", averageRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }]),
    ProfileRating.findOne({ profile: profileId, user: userId }).select("rating")
  ]);
  const result = rows[0] || {};
  return { averageRating: result.averageRating ? Number(result.averageRating.toFixed(1)) : 0, ratingCount: result.ratingCount || 0, currentUserRating: current?.rating || null };
}

router.put("/:userId", async (req, res) => {
  try {
    if (req.user.role !== "customer") return res.status(403).json({ message: "Only customers can rate businesses." });
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid business profile ID." });
    const business = await User.findOne({ _id: req.params.userId, role: "admin" }).select("_id username");
    if (!business) return res.status(404).json({ message: "Business profile not found." });
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be from 1 to 5." });
    await ProfileRating.findOneAndUpdate({ profile: business._id, user: req.user.id }, { rating }, { upsert: true, runValidators: true });
    await notify(req, business._id, { type: "profile-rating", title: "New business rating", body: `Your business received a ${rating}-star rating.`, link: `/profile/${business.username || ""}` });
    res.json(await summary(business._id, req.user.id));
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to rate this business." }); }
});

router.delete("/:userId", async (req, res) => {
  try {
    if (req.user.role !== "customer") return res.status(403).json({ message: "Only customers can manage business ratings." });
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ message: "Invalid business profile ID." });
    const business = await User.findOne({ _id: req.params.userId, role: "admin" }).select("_id");
    if (!business) return res.status(404).json({ message: "Business profile not found." });
    await ProfileRating.findOneAndDelete({ profile: business._id, user: req.user.id });
    res.json(await summary(business._id, req.user.id));
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to remove this rating." }); }
});

export default router;
