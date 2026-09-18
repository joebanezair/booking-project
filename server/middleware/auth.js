import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Business from "../models/Business.js";

export default async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("email role").lean();
    if (!user) return res.status(401).json({ message: "Your account no longer exists." });
    const business = await Business.findOne({ owner: user._id, status: "approved" }).select("_id").lean();
    const legacyProvider = ["admin", "business"].includes(user.role);
    const requestedMode = req.headers["x-account-mode"] === "business" ? "business" : "personal";
    req.user = { id: String(user._id), email: user.email, role: user.role || "customer", businessId: business?._id || null, hasBusiness: legacyProvider || Boolean(business), mode: legacyProvider ? "business" : requestedMode, isProviderMode: legacyProvider || Boolean(business && requestedMode === "business") };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
