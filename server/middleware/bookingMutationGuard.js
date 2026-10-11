import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

// All booking writers (public and dashboard) use this same MongoDB lease.
// This serializes read/validate/write on the same business across API replicas.
// Requires the primary MongoDB to be shared by every API instance.
const schema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false, collection: "booking_mutation_leases" });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const BookingLease = mongoose.models.BookingMutationLease || mongoose.model("BookingMutationLease", schema);

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const leaseMs = 120_000;

async function acquire(ownerId) {
  const _id = new mongoose.Types.ObjectId(ownerId);
  const token = randomUUID();
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const now = new Date();
    try {
      const lock = await BookingLease.findOneAndUpdate(
        { _id, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
        { $set: { token, expiresAt: new Date(now.getTime() + leaseMs) } },
        { upsert: true, new: true }
      ).lean();
      if (lock?.token === token) {
        return async () => {
          await BookingLease.deleteOne({ _id, token });
        };
      }
    } catch (error) {
      // A live lease causes a duplicate _id on the conditional upsert.
      if (error.code !== 11000) throw error;
    }
    await pause(75 + attempt * 15);
  }
  return null;
}

export function bookingMutationGuard(ownerFromRequest) {
  return async (req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    const ownerId = ownerFromRequest(req);
    if (!mongoose.isValidObjectId(ownerId)) return res.status(400).json({ message: "Invalid business account." });
    try {
      const release = await acquire(ownerId);
      if (!release) {
        res.setHeader("Retry-After", "2");
        return res.status(409).json({ message: "The booking schedule is busy. Please retry shortly." });
      }
      // Release after the response: validators and writes in the handler remain serialized.
      // If the process dies mid-request the lease eventually expires; monitor long requests.
      res.once("finish", () => release().catch(error => console.error("Failed to release booking lease", error)));
      next();
    } catch (error) {
      console.error("Booking lock unavailable", error);
      res.status(503).json({ message: "Booking schedule protection is temporarily unavailable." });
    }
  };
}
