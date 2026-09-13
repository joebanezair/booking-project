import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    guestName: { type: String, required: true, trim: true, maxlength: 100 },
    guestEmail: { type: String, trim: true, lowercase: true, maxlength: 150, default: "" },
    service: { type: String, required: true, trim: true, maxlength: 100 },
    bookingDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    source: { type: String, enum: ["dashboard", "public"], default: "dashboard" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
