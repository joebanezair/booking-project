import mongoose from "mongoose";

const bookingQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 60 },
    label: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: ["text", "textarea", "select", "checkbox"], default: "text" },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] }
  },
  { _id: false }
);

const contentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    price: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: "PHP" },
    category: { type: String, trim: true, maxlength: 80, default: "General" },
    coverImage: { type: String, default: "" },
    images: { type: [String], default: [] },
    allowRatings: { type: Boolean, default: true },
    allowBookings: { type: Boolean, default: true },
    durationMinutes: { type: Number, min: 5, max: 1440, default: 60 },
    bufferMinutes: { type: Number, min: 0, max: 240, default: 0 },
    capacity: { type: Number, min: 1, max: 100, default: 1 },
    bookingQuestions: { type: [bookingQuestionSchema], default: [] },
    visibility: { type: String, enum: ["public", "private"], default: "public", index: true },
    published: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

contentSchema.index({ user: 1, createdAt: -1 });
contentSchema.index({ user: 1, published: 1, updatedAt: -1 });
contentSchema.index({ published: 1, visibility: 1, category: 1, updatedAt: -1 });
contentSchema.index({ title: "text", description: "text", category: "text" });

export default mongoose.model("Content", contentSchema);
