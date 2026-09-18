import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Business from "../models/Business.js";
import Booking from "../models/Booking.js";
import Content from "../models/Content.js";
import Review from "../models/Review.js";
import Sale from "../models/Sale.js";
import requireAuth from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireRole.js";
import { notify } from "../lib/notifications.js";

const router = Router();
router.use(requireAuth, requireAdmin);

const accountStatuses = new Set(["active", "paused", "disabled"]);


router.get("/overview", async (_req, res) => {
  try {
    const [
      totalBusinesses,
      activeBusinesses,
      pausedBusinesses,
      disabledBusinesses,
      totalServices,
      publishedServices,
      totalBookings,
      pendingBookings,
      completedBookings,
      verifiedReviews,
      recordedSales,
      salesTotals
    ] = await Promise.all([
      User.countDocuments({ role: "business" }),
      User.countDocuments({ role: "business", accountStatus: "active" }),
      User.countDocuments({ role: "business", accountStatus: "paused" }),
      User.countDocuments({ role: "business", accountStatus: "disabled" }),
      Content.countDocuments(),
      Content.countDocuments({ published: true }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: "pending" }),
      Booking.countDocuments({ status: "completed" }),
      Review.countDocuments({ verified: true }),
      Sale.countDocuments({ status: "recorded" }),
      Sale.aggregate([
        { $match: { status: "recorded" } },
        { $group: { _id: "$currency", total: { $sum: "$saleAmount" }, count: { $sum: 1 } } },
        { $sort: { count: -1, total: -1 } }
      ])
    ]);

    res.json({
      businesses: { total: totalBusinesses, active: activeBusinesses, paused: pausedBusinesses, disabled: disabledBusinesses },
      services: { total: totalServices, published: publishedServices },
      bookings: { total: totalBookings, pending: pendingBookings, completed: completedBookings },
      sales: {
        recorded: recordedSales,
        totalsByCurrency: salesTotals.map(row => ({ currency: row._id || "PHP", total: row.total, count: row.count }))
      },
      reviews: { verified: verifiedReviews }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load platform activity." });
  }
});

router.get("/businesses", async (_req, res) => {
  try {
    const users = await User.find({ role: "business" })
      .select("name username email accountStatus profileImage createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const ids = users.map(user => user._id);
    const [profiles, serviceCounts, bookingCounts, reviewRows] = await Promise.all([
      Business.find({ owner: { $in: ids } }).select("owner name category location phone website logo").lean(),
      Content.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: "$user", count: { $sum: 1 } } }]),
      Booking.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: "$user", count: { $sum: 1 } } }]),
      Review.aggregate([{ $match: { businessOwner: { $in: ids }, verified: true } }, { $group: { _id: "$businessOwner", count: { $sum: 1 }, averageRating: { $avg: "$rating" } } }])
    ]);
    const byOwner = new Map(profiles.map(item => [String(item.owner), item]));
    const services = new Map(serviceCounts.map(item => [String(item._id), item.count]));
    const bookings = new Map(bookingCounts.map(item => [String(item._id), item.count]));
    const reviews = new Map(reviewRows.map(item => [String(item._id), { count: item.count, averageRating: Number(item.averageRating.toFixed(1)) }]));

    res.json(users.filter(user => byOwner.has(String(user._id))).map(user => ({
      ...user,
      accountStatus: user.accountStatus || "active",
      business: byOwner.get(String(user._id)),
      serviceCount: services.get(String(user._id)) || 0,
      bookingCount: bookings.get(String(user._id)) || 0,
      reviewSummary: reviews.get(String(user._id)) || { count: 0, averageRating: 0 }
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load businesses." });
  }
});

router.get("/businesses/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid business ID." });
    const user = await User.findOne({ _id: req.params.id, role: "business" })
      .select("name username email accountStatus profileImage createdAt updatedAt")
      .lean();
    if (!user) return res.status(404).json({ message: "Business account not found." });

    const [business, services, recentBookings, reviewRows, saleRows] = await Promise.all([
      Business.findOne({ owner: user._id }).lean(),
      Content.find({ user: user._id }).select("title published visibility category price currency updatedAt").sort({ updatedAt: -1 }).limit(50).lean(),
      Booking.find({ user: user._id }).select("guestName guestEmail guestPhone service servicePrice currency bookingDate completedAt status source").sort({ createdAt: -1 }).limit(20).lean(),
      Review.aggregate([{ $match: { businessOwner: user._id, verified: true } }, { $group: { _id: "$businessOwner", count: { $sum: 1 }, averageRating: { $avg: "$rating" } } }]),
      Sale.aggregate([
        { $match: { businessOwner: user._id, status: "recorded" } },
        { $group: { _id: "$currency", total: { $sum: "$saleAmount" }, count: { $sum: 1 } } },
        { $sort: { count: -1, total: -1 } }
      ])
    ]);
    if (!business) return res.status(404).json({ message: "Business profile not found." });
    const review = reviewRows[0] || {};

    res.json({
      user: { ...user, accountStatus: user.accountStatus || "active" },
      business,
      services,
      recentBookings,
      salesSummary: {
        recorded: saleRows.reduce((sum, row) => sum + row.count, 0),
        totalsByCurrency: saleRows.map(row => ({ currency: row._id || "PHP", total: row.total, count: row.count }))
      },
      reviewSummary: {
        count: review.count || 0,
        averageRating: review.averageRating ? Number(review.averageRating.toFixed(1)) : 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load business details." });
  }
});

router.patch("/businesses/:id/status", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid business ID." });
    const accountStatus = String(req.body.accountStatus || "");
    if (!accountStatuses.has(accountStatus)) return res.status(400).json({ message: "Choose active, paused, or disabled." });

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "business" },
      { accountStatus },
      { new: true, runValidators: true }
    ).select("name username email accountStatus");
    if (!user) return res.status(404).json({ message: "Business account not found." });

    const title = accountStatus === "active" ? "Business account reactivated" : accountStatus === "paused" ? "Business account paused" : "Business account disabled";
    const body = accountStatus === "active"
      ? "Your business can publish services and receive new bookings again."
      : accountStatus === "paused"
        ? "Your business is temporarily unavailable for new bookings and service publishing."
        : "Your business account has been disabled by an administrator.";

    if (accountStatus !== "disabled") {
      await notify(req, user._id, { type: "business-status", title, body, link: "/dashboard" });
    } else {
      req.app.get("io").in(`user:${user._id}`).disconnectSockets(true);
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update business status." });
  }
});

export default router;
