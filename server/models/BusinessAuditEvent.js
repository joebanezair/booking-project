import mongoose from "mongoose";

// Only records events that the application actually emits; not a retroactive audit trail.
const schema = new mongoose.Schema({
  businessOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, required: true, maxlength: 100 },
  detail: { type: String, maxlength: 500, default: "" }
}, { timestamps: true, versionKey: false });

schema.index({ businessOwner: 1, createdAt: -1 });
export default mongoose.models.BusinessAuditEvent || mongoose.model("BusinessAuditEvent", schema);
