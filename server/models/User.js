import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, minlength: 3, maxlength: 40, match: /^[a-z0-9-]+$/ },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["business", "admin"], default: "business", index: true },
    accountStatus: { type: String, enum: ["active", "paused", "disabled"], default: "active", index: true },
    bio: { type: String, trim: true, maxlength: 1000, default: "" },
    headline: { type: String, trim: true, maxlength: 120, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    website: { type: String, trim: true, maxlength: 300, default: "" },
    profileImage: { type: String, default: "" },
    profileImagePositionX: { type: Number, min: 0, max: 100, default: 50 },
    profileImagePositionY: { type: Number, min: 0, max: 100, default: 50 },
    coverImage: { type: String, default: "" },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    friendRequests: [{ from: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, createdAt: { type: Date, default: Date.now } }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    restrictedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    pinnedConversations: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

userSchema.index({ role: 1, accountStatus: 1, createdAt: -1 });
userSchema.index({ name: "text", username: "text", headline: "text", location: "text" });

export default mongoose.model("User", userSchema);
