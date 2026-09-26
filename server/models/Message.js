import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, trim: true, maxlength: 2000, default: "" },
    messageType: { type: String, enum: ["text", "file", "profile"], default: "text" },
    attachment: { name: String, mimeType: String, size: Number, dataUrl: String },
    sharedProfile: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    readAt: { type: Date, default: null },
    unsentAt: { type: Date, default: null },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
