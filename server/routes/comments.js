import { Router } from "express";
import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import Content from "../models/Content.js";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";
import EmojiReaction from "../models/EmojiReaction.js";

const router = Router();
router.use(requireAuth);

router.post("/:contentId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.contentId)) return res.status(400).json({ message: "Invalid service ID." });
    const content = await Content.findOne({ _id: req.params.contentId, published: true, visibility: { $ne: "private" } });
    if (!content || !await User.exists({ _id: content.user, role: { $in: ["admin", "business"] } })) return res.status(404).json({ message: "Public service not found." });

    const text = String(req.body.comment || "").trim();
    if (!text) return res.status(400).json({ message: "Comment cannot be empty." });
    if (text.length > 2000) return res.status(400).json({ message: "Comment must be 2000 characters or fewer." });

    let parent = null, depth = 0;
    if (req.body.parentId) {
      if (!mongoose.isValidObjectId(req.body.parentId)) return res.status(400).json({ message: "Invalid parent comment." });
      parent = await Comment.findOne({ _id: req.body.parentId, content: content._id });
      if (!parent) return res.status(404).json({ message: "Parent comment not found." });
      depth = parent.depth + 1;
      if (depth > 3) return res.status(400).json({ message: "Replies can be nested up to 3 levels." });
    }
    const comment = await Comment.create({ content: content._id, user: req.user.id, comment: text, parent: parent?._id || null, depth });
    await comment.populate("user", "name username profileImage");
    req.app.get("io").emit("comment:created", comment);
    if(String(content.user)!==String(req.user.id)) await notify(req,content.user,{type:"comment",title:"New service comment",body:text.slice(0,120),link:`/services/${content._id}`});
    res.status(201).json({ ...comment.toObject(), emojiReactions: [] });
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
    req.app.get("io").emit("comment:updated", comment);
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

    const hasReplies = await Comment.exists({ parent: comment._id });
    if (hasReplies) { comment.comment = "[Comment deleted]"; comment.deletedAt = new Date(); await comment.save(); }
    else { await Promise.all([comment.deleteOne(), EmojiReaction.deleteMany({ targetType: "comment", target: comment._id })]); }
    req.app.get("io").emit("comment:deleted", { id: String(comment._id), serviceId: String(comment.content), preserved: Boolean(hasReplies) });
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete comment." });
  }
});

export default router;
