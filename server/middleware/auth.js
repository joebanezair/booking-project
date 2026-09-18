import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Business from "../models/Business.js";

export default async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: "Authentication required." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("email role accountStatus").lean();
    if (!user) return res.status(401).json({ message: "Your account no longer exists." });
    if (!["business", "admin"].includes(user.role)) {
      return res.status(403).json({ message: "This legacy account type is no longer supported. Public visitors can book services without an account." });
    }

    const accountStatus = user.accountStatus || "active";
    if (accountStatus === "disabled") {
      return res.status(403).json({ message: "This account has been disabled by an administrator." });
    }

    const business = user.role === "business"
      ? await Business.findOne({ owner: user._id }).select("_id").lean()
      : null;

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      accountStatus,
      businessId: business?._id ? String(business._id) : null
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
