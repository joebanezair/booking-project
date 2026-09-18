import mongoose from "mongoose";

export const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const emojiReactionSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["message", "comment"], required: true, index: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    emoji: { type: String, enum: ALLOWED_EMOJIS, required: true }
  },
  { timestamps: true }
);

emojiReactionSchema.index({ targetType: 1, target: 1, user: 1, emoji: 1 }, { unique: true });
emojiReactionSchema.index({ targetType: 1, target: 1, createdAt: 1 });

export default mongoose.model("EmojiReaction", emojiReactionSchema);
