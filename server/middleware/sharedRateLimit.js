import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { localRateLimit } from "./localRateLimit.js";

// Shared MongoDB counters are an optional dependency-free step for multi-replica
// deployments. Prefer Redis or proxy-level counters for very high public traffic.
const schema = new mongoose.Schema({
  _id: String,
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { versionKey: false, collection: "api_rate_limit_windows" });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Window = mongoose.models.SharedRateLimitWindow || mongoose.model("SharedRateLimitWindow", schema);

export function sharedRateLimit({ windowMs = 60_000, max = 60 } = {}) {
  const local = localRateLimit({ windowMs, max });
  if (process.env.DISTRIBUTED_RATE_LIMIT !== "1") return local;
  return async (req, res, next) => {
    const now = Date.now();
    const end = (Math.floor(now / windowMs) + 1) * windowMs;
    const scope = [req.ip, req.baseUrl, Math.floor(now / windowMs)].join(":");
    // Avoid collecting raw IP addresses in the MongoDB limiter.
    const _id = createHash("sha256").update(scope).digest("hex");
    try {
      const result = await Window.findOneAndUpdate(
        { _id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(end) } },
        { upsert: true, new: true }
      ).lean();
      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", Math.max(0, max - result.count));
      if (result.count > max) {
        res.setHeader("Retry-After", Math.ceil((end - now) / 1000));
        return res.status(429).json({ message: "Too many requests. Try again shortly." });
      }
      next();
    } catch (error) {
      console.error("Shared API rate limiter unavailable", error);
      // Avoid an unsafe fail-open when using a distributed limiter for auth.
      res.status(503).json({ message: "Rate limit protection is temporarily unavailable." });
    }
  };
}
