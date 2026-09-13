import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    content: { type: mongoose.Schema.Types.ObjectId, ref: "Content", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
    edited: { type: Boolean, default: false }
  },
  { timestamps: true }
);

commentSchema.index({ content: 1, createdAt: -1 });

export default mongoose.model("Comment", commentSchema);
