import mongoose from "mongoose";

const workingHoursSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    enabled: { type: Boolean, default: false },
    start: { type: String, default: "09:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    end: { type: String, default: "17:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ }
  },
  { _id: false }
);

const defaultWorkingHours = () => [
  { day: 0, enabled: false, start: "09:00", end: "17:00" },
  { day: 1, enabled: true, start: "09:00", end: "17:00" },
  { day: 2, enabled: true, start: "09:00", end: "17:00" },
  { day: 3, enabled: true, start: "09:00", end: "17:00" },
  { day: 4, enabled: true, start: "09:00", end: "17:00" },
  { day: 5, enabled: true, start: "09:00", end: "17:00" },
  { day: 6, enabled: false, start: "09:00", end: "17:00" }
];

const businessSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, trim: true, maxlength: 80, default: "General" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    location: { type: String, trim: true, maxlength: 160, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 150 },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    website: { type: String, trim: true, maxlength: 300, default: "" },
    logo: { type: String, default: "" },
    timezone: { type: String, trim: true, maxlength: 80, default: "Asia/Manila" },
    workingHours: { type: [workingHoursSchema], default: defaultWorkingHours },
    blackoutDates: { type: [String], default: [] },
    leadTimeMinutes: { type: Number, min: 0, max: 43200, default: 60 },
    maxAdvanceDays: { type: Number, min: 1, max: 730, default: 60 },
    slotIntervalMinutes: { type: Number, min: 5, max: 240, default: 30 }
  },
  { timestamps: true }
);

export default mongoose.model("Business", businessSchema);
