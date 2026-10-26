import User from "../models/User.js";
import { featureStatus } from "../lib/featureAccess.js";

// Protects new transactions, not historical records or existing-booking management.
export function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const account = await User.findOne({ _id: req.user?.id, role: "business" })
        .select("featureAccess").lean();
      if (!account) return res.status(404).json({ message: "Business account not found." });
      const access = featureStatus(account, feature);
      if (!access.active) {
        return res.status(403).json({
          code: "FEATURE_ACCESS_DENIED",
          feature,
          expiresAt: access.expiresAt,
          message: `The ${feature === "pos" ? "POS" : "booking"} feature is ${access.expired ? "expired" : "deactivated"}. Please contact your administrator.`
        });
      }
      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Unable to verify feature access." });
    }
  };
}
