import Business from "../models/Business.js";

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to access this resource." });
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");
export async function requireBusiness(req, res, next) {
  if (["admin", "business"].includes(req.user?.role)) return next();
  if (!req.user) return res.status(403).json({ message: "You do not have permission to access this resource." });
  if (req.user.businessId && req.user.isProviderMode) { req.business = { _id: req.user.businessId }; return next(); }
  try {
    const business = await Business.findOne({ owner: req.user.id, status: "approved" }).select("_id").lean();
    if (!business || req.user.mode !== "business") return res.status(403).json({ message: "Switch to business mode after your business is approved." });
    req.business = business;
    next();
  } catch (error) { next(error); }
}
