import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    businessOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reviewToken: { type: String, required: true, unique: true, index: true },
    rating: { type: Number, min: 1, max: 5, default: null },
    comment: { type: String, trim: true, maxlength: 1500, default: "" },
    verified: { type: Boolean, default: false, index: true },
    submittedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

reviewSchema.index({ business: 1, verified: 1, submittedAt: -1 });

export default mongoose.model("Review", reviewSchema);
