export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to access this resource." });
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireBusiness = requireRole("business");

export function requireActiveBusiness(req, res, next) {
  if (!req.user || req.user.role !== "business") {
    return res.status(403).json({ message: "A business account is required." });
  }
  if (req.user.accountStatus !== "active") {
    return res.status(403).json({
      message: req.user.accountStatus === "paused"
        ? "This business account is paused. Reactivate it before publishing services or accepting new bookings."
        : "This business account is disabled."
    });
  }
  next();
}
