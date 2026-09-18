import { Router } from "express";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import requireAuth from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireRole.js";
import Business from "../models/Business.js";
import { notify } from "../lib/notifications.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/customers", async (_req, res) => {
  try {
    const customers = await User.find({ role: "customer" })
      .select("name username email profileImage createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const counts = await Booking.aggregate([
      { $match: { customer: { $ne: null } } },
      { $group: { _id: "$customer", bookings: { $sum: 1 } } }
    ]);
    const bookingCounts = new Map(counts.map(item => [String(item._id), item.bookings]));
    res.json(customers.map(customer => ({ ...customer, bookingCount: bookingCounts.get(String(customer._id)) || 0 })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load customers." });
  }
});

router.get("/business-requests", async (_req, res) => {
  try {
    const businesses = await Business.find().populate("owner", "name username email profileImage").populate("reviewedBy", "name").sort({ createdAt: -1 });
    res.json(businesses);
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to load business applications." }); }
});

router.patch("/business-requests/:id", async (req, res) => {
  try {
    const status = String(req.body.status || "");
    if (!["approved", "rejected", "suspended"].includes(status)) return res.status(400).json({ message: "Choose approved, rejected, or suspended." });
    const rejectionReason = String(req.body.rejectionReason || "").trim();
    if (status === "rejected" && !rejectionReason) return res.status(400).json({ message: "Provide a reason for rejection." });
    const business = await Business.findByIdAndUpdate(req.params.id, { status, rejectionReason: status === "rejected" ? rejectionReason : "", reviewedBy: req.user.id, reviewedAt: new Date() }, { new: true, runValidators: true }).populate("owner", "name username email profileImage");
    if (!business) return res.status(404).json({ message: "Business application not found." });
    const title = status === "approved" ? "Business approved" : status === "rejected" ? "Business application needs changes" : "Business suspended";
    const body = status === "approved" ? `${business.name} can now publish services and manage bookings.` : status === "rejected" ? rejectionReason : `${business.name} can no longer use provider tools.`;
    await notify(req, business.owner._id, { type: "business-status", title, body, link: "/dashboard/profile" });
    res.json(business);
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to review this business." }); }
});

export default router;
