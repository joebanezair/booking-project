import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
  content: { type: mongoose.Schema.Types.ObjectId, ref: "Content", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["like", "dislike"], required: true }
}, { timestamps: true });

reactionSchema.index({ content: 1, user: 1 }, { unique: true });
reactionSchema.index({ content: 1, type: 1 });
export default mongoose.model("Reaction", reactionSchema);
