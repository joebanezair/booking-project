import { Router } from "express";
import mongoose from "mongoose";
import EmojiReaction, { ALLOWED_EMOJIS } from "../models/EmojiReaction.js";
import Message from "../models/Message.js";
import Comment from "../models/Comment.js";
import Content from "../models/Content.js";
import ForumPost from "../models/ForumPost.js";
import { invalidatePublicJsonCaches } from "../middleware/publicJsonCache.js";
import requireAuth from "../middleware/auth.js";
import { reactionSummary } from "../lib/emojiReactions.js";
import { isProviderOwner } from "../lib/providers.js";

const router = Router();
router.use(requireAuth);

router.put("/:targetType/:targetId", async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const emoji = String(req.body.emoji || "");
    if (!['message', 'comment', 'forum_post'].includes(targetType)) return res.status(400).json({ message: "Invalid reaction target." });
    if (!mongoose.isValidObjectId(targetId)) return res.status(400).json({ message: "Invalid target ID." });
    if (!ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ message: "Unsupported emoji reaction." });

    let event;
    if (targetType === "message") {
      const message = await Message.findOne({ _id: targetId, $or: [{ sender: req.user.id }, { recipient: req.user.id }] });
      if (!message) return res.status(404).json({ message: "Message not found." });
      event = { rooms: [`user:${message.sender}`, `user:${message.recipient}`], name: "message:reaction" };
    } else if (targetType === "comment") {
      const comment = await Comment.findById(targetId);
      if (!comment) return res.status(404).json({ message: "Comment not found." });
      const content = await Content.findOne({ _id: comment.content, published: true, visibility: { $ne: "private" } }).select("user");
      const business = content ? await isProviderOwner(content.user) : null;
      if (!content || !business) return res.status(404).json({ message: "Public service not found." });
      event = { rooms: [`service:${content._id}`], name: "comment:reaction", serviceId: String(content._id) };
    } else {
      const post = await ForumPost.findById(targetId).select("_id");
      if (!post) return res.status(404).json({ message: "Discussion not found." });
      event = { rooms: [], name: "forum:reaction", postId: String(post._id) };
    }

    const filter = { targetType, target: targetId, user: req.user.id, emoji };
    const existing = await EmojiReaction.findOne(filter);
    if (existing) await existing.deleteOne();
    else await EmojiReaction.create(filter);

    const reactions = await reactionSummary(targetType, new mongoose.Types.ObjectId(targetId), req.user.id);
    const payload = { targetType, targetId, reactions, serviceId: event.serviceId };
    const realtimePayload = { ...payload, emoji, reactions: reactions.map(({ emoji: value, count }) => ({ emoji: value, count })), actorId: req.user.id, selected: !existing };
    if (targetType === "forum_post") {
      // The public forum feed caches only non-personalized results. Purge after a reaction change.
      await invalidatePublicJsonCaches("forum");
      req.app.get("io")?.emit("forum:reaction", { postId: event.postId, reactions: realtimePayload.reactions });
    } else {
      for (const room of event.rooms) req.app.get("io")?.to(room).emit(event.name, realtimePayload);
    }
    res.json(payload);
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "Reaction already exists." });
    console.error(error);
    res.status(500).json({ message: "Unable to update reaction." });
  }
});

export default router;
