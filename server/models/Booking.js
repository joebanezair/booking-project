import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    content: { type: mongoose.Schema.Types.ObjectId, ref: "Content", default: null, index: true },
    guestName: { type: String, required: true, trim: true, maxlength: 100 },
    guestEmail: { type: String, trim: true, lowercase: true, maxlength: 150, default: "" },
    guestPhone: { type: String, trim: true, maxlength: 30, default: "" },
    locationLabel: { type: String, trim: true, maxlength: 200, default: "" },
    locationLatitude: { type: Number, min: -90, max: 90, default: null },
    locationLongitude: { type: Number, min: -180, max: 180, default: null },
    locationAccuracy: { type: Number, min: 0, default: null },
    service: { type: String, required: true, trim: true, maxlength: 100 },
    bookingDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    source: { type: String, enum: ["dashboard", "public"], default: "dashboard" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
      index: true
    }
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, bookingDate: 1 });

export default mongoose.model("Booking", bookingSchema);
