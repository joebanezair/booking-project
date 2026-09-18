import { Router } from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";
import { reactionMap } from "../lib/emojiReactions.js";

const router = Router();
router.use(requireAuth);

router.get("/users", async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user.id },
      role: { $in: ["business", "admin"] },
      accountStatus: { $ne: "disabled" }
    }).select("name email username profileImage role accountStatus")
      .sort({ name: 1 });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load users." });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }
    if (String(req.params.userId) === String(req.user.id)) return res.status(400).json({ message: "You cannot message yourself." });

    const otherUser = await User.findOne({
      _id: req.params.userId,
      role: { $in: ["business", "admin"] },
      accountStatus: { $ne: "disabled" }
    }).select("name email username profileImage role accountStatus");
    if (!otherUser) return res.status(404).json({ message: "User not found." });

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, recipient: req.params.userId },
        { sender: req.params.userId, recipient: req.user.id }
      ]
    }).sort({ createdAt: 1 });

    await Message.updateMany(
      { sender: req.params.userId, recipient: req.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    );

    const reactions = await reactionMap("message", messages.map(message => message._id), req.user.id);
    res.json({ user: otherUser, messages: messages.map(message => ({ ...message.toObject(), emojiReactions: reactions.get(String(message._id)) || [] })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load conversation." });
  }
});

router.post("/:userId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ message: "You cannot message yourself." });
    }

    const body = String(req.body.body || "").trim();
    if (!body) return res.status(400).json({ message: "Message cannot be empty." });
    if (body.length > 2000) return res.status(400).json({ message: "Message is too long." });

    const recipient = await User.findOne({
      _id: req.params.userId,
      role: { $in: ["business", "admin"] },
      accountStatus: { $ne: "disabled" }
    });
    if (!recipient) return res.status(404).json({ message: "User not found." });

    const message = await Message.create({
      sender: req.user.id,
      recipient: req.params.userId,
      body
    });

    const io = req.app.get("io");
    io.to(`user:${req.params.userId}`).emit("message:new", message);
    await notify(req,req.params.userId,{type:"message",title:"New message",body:body.slice(0,120),link:`/dashboard/messages/${req.user.id}`});

    res.status(201).json({ ...message.toObject(), emojiReactions: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to send message." });
  }
});

export default router;
