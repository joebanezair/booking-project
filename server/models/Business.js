import mongoose from "mongoose";

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
    logo: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Business", businessSchema);
