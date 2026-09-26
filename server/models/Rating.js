import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    content: { type: mongoose.Schema.Types.ObjectId, ref: "Content", default: null, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 }
  },
  { timestamps: true }
);

ratingSchema.index({ content: 1, user: 1 }, { unique: true, partialFilterExpression: { content: { $type: "objectId" } } });
ratingSchema.index({ business: 1, user: 1 }, { unique: true, partialFilterExpression: { business: { $type: "objectId" } } });

export default mongoose.model("Rating", ratingSchema);
