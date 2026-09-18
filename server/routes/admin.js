import { Router } from "express";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import requireAuth from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireRole.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/customers", async (_req, res) => {
  try {
    const customers = await User.find({ role: { $ne: "admin" } })
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

export default router;
