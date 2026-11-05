import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, minlength: 3, maxlength: 40, match: /^[a-z0-9-]+$/ },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["business", "admin"], default: "business", index: true },
    accountStatus: { type: String, enum: ["active", "paused", "disabled"], default: "active", index: true },
    termsAcceptance: {
      versionId: { type: String, trim: true, maxlength: 80, default: "" },
      version: { type: Number, min: 1, default: null },
      acceptedAt: { type: Date, default: null }
    },
    // Admin-managed, time-limited feature access. Older accounts remain enabled unless explicitly changed.
    featureAccess: {
      pos: {
        enabled: { type: Boolean, default: true },
        expiresAt: { type: Date, default: null }
      },
      booking: {
        enabled: { type: Boolean, default: true },
        expiresAt: { type: Date, default: null }
      }
    },
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
    pinnedConversations: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Persist dashboard checkboxes per account so they survive sign-out and other devices.
    dashboardPreferences: {
      businessWidgets: { type: mongoose.Schema.Types.Mixed, default: null },
      adminMetrics: { type: mongoose.Schema.Types.Mixed, default: null }
    }
  },
  { timestamps: true }
);

userSchema.index({ role: 1, accountStatus: 1, createdAt: -1 });
userSchema.index({ name: "text", username: "text", headline: "text", location: "text" });

export default mongoose.model("User", userSchema);
