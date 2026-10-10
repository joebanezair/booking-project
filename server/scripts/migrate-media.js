// Opt-in, resumable-by-retry data-URI migration. Back up both databases before running.
// Usage: MEDIA_MONGO_URI=... MONGO_URI=... node scripts/migrate-media.js --dry-run
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Business from "../models/Business.js";
import Content from "../models/Content.js";
import Message from "../models/Message.js";
import { Product } from "../models/Sale.js";
import { connectMediaStore, closeMediaStore, saveDataUri } from "../lib/mediaStore.js";

const dryRun = process.argv.includes("--dry-run");
const specs = [
  [User, ["profileImage", "coverImage"], "public"],
  [Business, ["logo"], "public"],
  [Content, ["coverImage", "images"], "public"],
  [Product, ["image", "images"], "public"],
  [Message, ["attachment.dataUrl"], "private"]
];
let migrated = 0, examined = 0;
if (!process.env.MONGO_URI || !process.env.MEDIA_MONGO_URI) {
  throw new Error("Both MONGO_URI and MEDIA_MONGO_URI must be provided.");
}
await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 5 });
if (!dryRun) await connectMediaStore();
try {
  for (const [Model, fields, visibility] of specs) {
    for await (const doc of Model.find().cursor()) {
      const changes = {};
      for (const field of fields) {
        const original = field.includes(".") ? doc.get(field) : doc[field];
        if (Array.isArray(original)) {
          if (!original.some(v => typeof v === "string" && v.startsWith("data:"))) continue;
          examined += 1;
          if (!dryRun) changes[field] = await Promise.all(original.map(v =>
            saveDataUri(v, { visibility, ownerId: String(doc.user || doc.owner || doc.sender || doc._id), name: field })));
        } else if (typeof original === "string" && original.startsWith("data:")) {
          examined += 1;
          if (!dryRun) changes[field] = await saveDataUri(original, {
            visibility, ownerId: String(doc.user || doc.owner || doc.sender || doc._id), name: field
          });
        }
      }
      if (!dryRun && Object.keys(changes).length) {
        await Model.updateOne({ _id: doc._id }, { $set: changes });
        migrated += 1;
      }
    }
    console.log(`${Model.modelName}: scan finished`);
  }
  console.log(dryRun ? `Would migrate ${examined} media fields` : `Migrated ${migrated} documents / ${examined} media fields`);
} finally {
  await closeMediaStore();
  await mongoose.disconnect();
}
