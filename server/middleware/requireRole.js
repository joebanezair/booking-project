export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to access this resource." });
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireBusiness = requireRole("admin", "business");
