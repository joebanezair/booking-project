import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, minlength: 3, maxlength: 40, match: /^[a-z0-9-]+$/ },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "business", "customer"], default: "customer", index: true },
    bio: { type: String, trim: true, maxlength: 1000, default: "" },
    headline: { type: String, trim: true, maxlength: 120, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    website: { type: String, trim: true, maxlength: 300, default: "" },
    profileImage: { type: String, default: "" },
    profileImagePositionX: { type: Number, min: 0, max: 100, default: 50 },
    profileImagePositionY: { type: Number, min: 0, max: 100, default: 50 },
    coverImage: { type: String, default: "" }
  },
  { timestamps: true }
);

userSchema.index({ name: "text", username: "text", headline: "text", location: "text" });

export default mongoose.model("User", userSchema);
