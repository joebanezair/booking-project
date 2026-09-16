import { Router } from "express";
import mongoose from "mongoose";
import Content from "../models/Content.js";
import Reaction from "../models/Reaction.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

async function summary(contentId, userId) {
  const [rows, current] = await Promise.all([
    Reaction.aggregate([{ $match: { content: new mongoose.Types.ObjectId(contentId) } }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
    Reaction.findOne({ content: contentId, user: userId }).select("type")
  ]);
  const counts = Object.fromEntries(rows.map(row => [row._id, row.count]));
  return { likes: counts.like || 0, dislikes: counts.dislike || 0, currentReaction: current?.type || null };
}

router.put("/:contentId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.contentId)) return res.status(400).json({ message: "Invalid service ID." });
  const service = await Content.findOne({ _id: req.params.contentId, published: true, visibility: { $ne: "private" } }).select("user");
  if (!service) return res.status(404).json({ message: "Public service not found." });
  if (String(service.user) === String(req.user.id)) return res.status(403).json({ message: "You cannot react to your own service." });
  const type = req.body.type;
  if (!["like", "dislike"].includes(type)) return res.status(400).json({ message: "Reaction must be like or dislike." });
  const existing = await Reaction.findOne({ content: service._id, user: req.user.id });
  if (existing?.type === type) await existing.deleteOne();
  else await Reaction.findOneAndUpdate({ content: service._id, user: req.user.id }, { type }, { upsert: true, runValidators: true });
  const result = await summary(service._id, req.user.id);
  req.app.get("io").emit("service:reactions", { serviceId: String(service._id), ...result });
  res.json(result);
});

export default router;
