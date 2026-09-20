import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, trim: true, maxlength: 60 },
    label: { type: String, trim: true, maxlength: 160 },
    value: { type: String, trim: true, maxlength: 1000, default: "" }
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    action: { type: String, trim: true, maxlength: 60, required: true },
    status: { type: String, trim: true, maxlength: 30, default: "" },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    fromDate: { type: Date, default: null },
    toDate: { type: Date, default: null },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    content: { type: mongoose.Schema.Types.ObjectId, ref: "Content", default: null, index: true },
    bookingReference: { type: String, trim: true, uppercase: true, index: true, sparse: true },
    guestName: { type: String, required: true, trim: true, maxlength: 100 },
    guestEmail: { type: String, trim: true, lowercase: true, maxlength: 150, default: "" },
    guestPhone: { type: String, trim: true, maxlength: 30, default: "" },
    locationLabel: { type: String, trim: true, maxlength: 200, default: "" },
    locationLatitude: { type: Number, min: -90, max: 90, default: null },
    locationLongitude: { type: Number, min: -180, max: 180, default: null },
    locationAccuracy: { type: Number, min: 0, default: null },
    service: { type: String, required: true, trim: true, maxlength: 100 },
    servicePrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "PHP" },
    serviceDurationMinutes: { type: Number, min: 5, max: 1440, default: 60 },
    bufferMinutes: { type: Number, min: 0, max: 240, default: 0 },
    bookingDate: { type: Date, required: true },
    bookingEndsAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null, index: true },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    internalNotes: { type: String, trim: true, maxlength: 2000, default: "" },
    customAnswers: { type: [answerSchema], default: [] },
    history: { type: [historySchema], default: [] },
    source: { type: String, enum: ["dashboard", "public"], default: "dashboard" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"],
      default: "pending",
      index: true
    }
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, bookingDate: 1 });
bookingSchema.index({ user: 1, status: 1, completedAt: -1 });
bookingSchema.index({ user: 1, guestEmail: 1, bookingDate: -1 });
bookingSchema.index({ user: 1, guestPhone: 1, bookingDate: -1 });

export default mongoose.model("Booking", bookingSchema);
