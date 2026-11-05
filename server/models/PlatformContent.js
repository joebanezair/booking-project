import mongoose from "mongoose";

const revisionSchema = new mongoose.Schema({
  revisionId: { type: String, required: true },
  version: { type: Number, required: true },
  title: { type: String, required: true },
  components: { type: [mongoose.Schema.Types.Mixed], default: [] },
  publishedAt: { type: Date, required: true },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { _id: false });

const contentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  components: { type: [mongoose.Schema.Types.Mixed], default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const platformContentSchema = new mongoose.Schema({
  slug: { type: String, required: true, enum: ["terms", "faqs"], unique: true, index: true },
  draft: { type: contentSchema, required: true },
  published: { type: contentSchema, required: true },
  publishedVersion: { type: Number, default: 1, min: 1 },
  publishedAt: { type: Date, default: Date.now },
  revisions: { type: [revisionSchema], default: [] }
}, { timestamps: true, optimisticConcurrency: true });

export default mongoose.model("PlatformContent", platformContentSchema);
