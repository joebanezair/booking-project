import mongoose from "mongoose";

const contentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    price: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "PHP" },
    category: { type: String, trim: true, maxlength: 80, default: "General" },
    coverImage: { type: String, default: "" },
    images: { type: [String], default: [] },
    published: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

contentSchema.index({ user: 1, createdAt: -1 });
contentSchema.index({ user: 1, published: 1, updatedAt: -1 });

export default mongoose.model("Content", contentSchema);
