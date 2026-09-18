import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    businessOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true, index: true },
    content: { type: mongoose.Schema.Types.ObjectId, ref: "Content", default: null, index: true },
    serviceName: { type: String, required: true, trim: true, maxlength: 120 },
    saleAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "PHP" },
    guestName: { type: String, trim: true, maxlength: 100, default: "" },
    guestEmail: { type: String, trim: true, lowercase: true, maxlength: 150, default: "" },
    guestPhone: { type: String, trim: true, maxlength: 30, default: "" },
    locationLabel: { type: String, trim: true, maxlength: 200, default: "" },
    bookingDate: { type: Date, required: true },
    completedAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["recorded", "voided"], default: "recorded", index: true },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, trim: true, maxlength: 300, default: "" }
  },
  { timestamps: true }
);

saleSchema.index({ businessOwner: 1, status: 1, completedAt: -1 });
saleSchema.index({ businessOwner: 1, serviceName: 1, completedAt: -1 });

export default mongoose.model("Sale", saleSchema);
