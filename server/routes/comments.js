import { Router } from "express";
import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import Content from "../models/Content.js";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/:contentId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.contentId)) return res.status(400).json({ message: "Invalid content ID." });
    const content = await Content.findOne({ _id: req.params.contentId, published: true });
    if (!content) return res.status(404).json({ message: "Published content not found." });

    const text = String(req.body.comment || "").trim();
    if (!text) return res.status(400).json({ message: "Comment cannot be empty." });
    if (text.length > 2000) return res.status(400).json({ message: "Comment must be 2000 characters or fewer." });

    const comment = await Comment.create({ content: content._id, user: req.user.id, comment: text });
    await comment.populate("user", "name username profileImage");
    res.status(201).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to post comment." });
  }
});

router.put("/:commentId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.commentId)) return res.status(400).json({ message: "Invalid comment ID." });
    const text = String(req.body.comment || "").trim();
    if (!text) return res.status(400).json({ message: "Comment cannot be empty." });
    if (text.length > 2000) return res.status(400).json({ message: "Comment must be 2000 characters or fewer." });

    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.commentId, user: req.user.id },
      { comment: text, edited: true },
      { new: true, runValidators: true }
    ).populate("user", "name username profileImage");

    if (!comment) return res.status(404).json({ message: "Comment not found." });
    res.json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to edit comment." });
  }
});

router.delete("/:commentId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.commentId)) return res.status(400).json({ message: "Invalid comment ID." });
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found." });

    const content = await Content.findById(comment.content).select("user");
    const canDelete = String(comment.user) === String(req.user.id) || String(content?.user) === String(req.user.id);
    if (!canDelete) return res.status(403).json({ message: "You do not have permission to delete this comment." });

    await comment.deleteOne();
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete comment." });
  }
});

export default router;
