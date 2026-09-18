import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("email role").lean();
    req.user = user ? { id: String(user._id), email: user.email, role: user.role || "customer" } : null;
  } catch {
    req.user = null;
  }
  next();
}
