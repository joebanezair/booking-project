import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Business from "../models/Business.js";
import Booking from "../models/Booking.js";
import Content from "../models/Content.js";
import Review from "../models/Review.js";
import Sale, { Product, PosSale, ProductOrder } from "../models/Sale.js";
import requireAuth from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireRole.js";
import { notify } from "../lib/notifications.js";
import { readPageSize } from "../lib/pagination.js";

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
      totalProducts,
      publishedProducts,
      totalServices,
      publishedServices,
      totalBookings,
      bookingStatusRows,
      verifiedReviews,
      verifiedRatingRows,
      recordedSales,
      recordedPosSales,
      totalOnlineOrders,
      completedOnlineOrders,
      salesTotals,
      posRevenueRows,
      onlineRevenueRows
    ] = await Promise.all([
      User.countDocuments({ role: "business" }),
      User.countDocuments({ role: "business", accountStatus: { $nin: ["paused", "disabled"] } }),
      User.countDocuments({ role: "business", accountStatus: "paused" }),
      User.countDocuments({ role: "business", accountStatus: "disabled" }),
      Product.countDocuments(),
      Product.countDocuments({ published: true }),
      Content.countDocuments(),
      Content.countDocuments({ published: true }),
      Booking.countDocuments(),
      Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Review.countDocuments({ verified: true }),
      Review.aggregate([
        { $match: { verified: true, rating: { $gte: 1, $lte: 5 } } },
        { $group: { _id: null, count: { $sum: 1 }, averageRating: { $avg: "$rating" } } }
      ]),
      Sale.countDocuments({ status: "recorded" }),
      PosSale.countDocuments({ status: "recorded" }),
      ProductOrder.countDocuments(),
      ProductOrder.countDocuments({ status: "completed" }),
      Sale.aggregate([
        { $match: { status: "recorded" } },
        { $group: { _id: { $ifNull: ["$currency", "PHP"] }, total: { $sum: "$saleAmount" }, count: { $sum: 1 } } },
        { $sort: { count: -1, total: -1 } }
      ]),
      PosSale.aggregate([
        { $match: { status: "recorded" } },
        { $group: { _id: { $ifNull: ["$currency", "PHP"] }, total: { $sum: "$total" }, count: { $sum: 1 } } }
      ]),
      // Completed order value isn't proof of payment received.
      // Exclude fully refunded and voided orders, matching the business detail view.
      ProductOrder.aggregate([
        { $match: { status: "completed", paymentStatus: { $nin: ["refunded", "voided"] } } },
        { $group: { _id: { $ifNull: ["$currency", "PHP"] }, total: { $sum: "$total" }, count: { $sum: 1 } } }
      ])
    ]);

    const bookingStatuses = Object.fromEntries(bookingStatusRows.map(row => [row._id, row.count]));
    const verifiedRating = verifiedRatingRows[0];
    // Aggregate gross recorded sales, not platform commissions or verified cash receipts.
    // Group by currency rather than combining incompatible monetary units.
    // Each transaction comes from exactly one of the three source collections.
    const revenueByCurrency = new Map();
    for (const [channel, rows] of [
      ["services", salesTotals], ["pos", posRevenueRows], ["online", onlineRevenueRows]
    ]) {
      for (const row of rows) {
        const currency = row._id || "PHP";
        if (!revenueByCurrency.has(currency)) {
          revenueByCurrency.set(currency, {
            currency, gross: 0, services: 0, pos: 0, online: 0, transactions: 0
          });
        }
        const entry = revenueByCurrency.get(currency);
        const total = Number(row.total || 0);
        entry[channel] += total;
        entry.gross += total;
        entry.transactions += row.count || 0;
      }
    }
    // Platform-wide average must weight individual verified reviews, not business averages.
    // A missing rating is null; zero is never presented as a one-star review.
    res.set("Cache-Control", "no-store");
    res.json({
      generatedAt: new Date().toISOString(),
      businesses: { total: totalBusinesses, active: activeBusinesses, paused: pausedBusinesses, disabled: disabledBusinesses },
      products: { total: totalProducts, published: publishedProducts },
      services: { total: totalServices, published: publishedServices },
      bookings: {
        total: totalBookings,
        pending: bookingStatuses.pending || 0,
        confirmed: bookingStatuses.confirmed || 0,
        inProgress: bookingStatuses.in_progress || 0,
        completed: bookingStatuses.completed || 0,
        cancelled: bookingStatuses.cancelled || 0,
        noShow: bookingStatuses.no_show || 0
      },
      sales: {
        recorded: recordedSales,
        posRecorded: recordedPosSales,
        onlineOrders: totalOnlineOrders,
        completedOnlineOrders,
        // Legacy: service sales only. The consolidated totals are in revenue below.
        totalsByCurrency: salesTotals.map(row => ({ currency: row._id || "PHP", total: row.total, count: row.count }))
      },
      revenue: {
        definition: "gross_recorded_sales",
        // No refund-amount field exists for partially refunded orders; these are gross amounts.
        totalsByCurrency: [...revenueByCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency))
      },
      reviews: {
        verified: verifiedReviews,
        ratingsCount: verifiedRating?.count || 0,
        averageRating: verifiedRating && Number.isFinite(verifiedRating.averageRating)
          ? Number(verifiedRating.averageRating.toFixed(1)) : null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load platform activity." });
  }
});

router.get("/businesses", async (req, res) => {
  try {
    // Retain the existing array response for current dashboards. For a large
    // directory, callers opt into ?limit=50&before=<ObjectId>.
    const paged = req.query.limit !== undefined || req.query.before !== undefined;
    const limit = paged ? readPageSize(req.query.limit || "50") : null;
    if (paged && !limit) return res.status(400).json({ message: "Limit must be between 1 and 100." });
    if (req.query.before && !mongoose.isValidObjectId(req.query.before))
      return res.status(400).json({ message: "Invalid directory cursor." });
    const filter = { role: "business" };
    if (paged && req.query.before) filter._id = { $lt: new mongoose.Types.ObjectId(req.query.before) };
    const query = User.find(filter).select("name username email accountStatus profileImage profileImagePositionX profileImagePositionY coverImage createdAt");
    const users = await (paged
      ? query.sort({ _id: -1 }).limit(limit + 1).lean()
      : query.sort({ createdAt: -1 }).lean());
    const hasMore = paged && users.length > limit;
    if (hasMore) users.pop();
    const ids = users.map(user => user._id);
    // Set-based revenue queries avoid per-business requests, including for paginated directories.
    // These use the exact business detail definition, grouped separately by owner AND currency.
    const revenuePipeline = (filter, amountField) => [
      { $match: { businessOwner: { $in: ids }, ...filter } },
      { $group: {
        _id: { owner: "$businessOwner", currency: { $ifNull: ["$currency", "PHP"] } },
        gross: { $sum: { $ifNull: [amountField, 0] } }
      } }
    ];
    const [profiles, productCounts, serviceCounts, bookingCounts, reviewRows,
      serviceRevenueRows, posRevenueRows, onlineRevenueRows] = await Promise.all([
      Business.find({ owner: { $in: ids } }).select("owner name category location phone website logo").lean(),
      Product.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: "$user", count: { $sum: 1 } } }]),
      Content.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: "$user", count: { $sum: 1 } } }]),
      Booking.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: "$user", count: { $sum: 1 } } }]),
      Review.aggregate([{ $match: { businessOwner: { $in: ids }, verified: true } }, { $group: { _id: "$businessOwner", count: { $sum: 1 }, averageRating: { $avg: "$rating" } } }]),
      Sale.aggregate(revenuePipeline({ status: "recorded" }, "$saleAmount")),
      PosSale.aggregate(revenuePipeline({ status: "recorded" }, "$total")),
      // Completed order VALUE, not verified collected payments. Exclude fully refunded and voided.
      ProductOrder.aggregate(revenuePipeline(
        { status: "completed", paymentStatus: { $nin: ["refunded", "voided"] } }, "$total"
      ))
    ]);
    const byOwner = new Map(profiles.map(item => [String(item.owner), item]));
    const products = new Map(productCounts.map(item => [String(item._id), item.count]));
    const services = new Map(serviceCounts.map(item => [String(item._id), item.count]));
    const bookings = new Map(bookingCounts.map(item => [String(item._id), item.count]));
    const reviews = new Map(reviewRows.map(item => [String(item._id), {
      count: item.count,
      averageRating: Number.isFinite(item.averageRating) ? Number(item.averageRating.toFixed(1)) : 0
    }]));

    const revenueByOwner = new Map();
    for (const rows of [serviceRevenueRows, posRevenueRows, onlineRevenueRows]) {
      for (const row of rows) {
        const owner = String(row._id.owner);
        const currency = row._id.currency || "PHP";
        if (!revenueByOwner.has(owner)) revenueByOwner.set(owner, new Map());
        const amounts = revenueByOwner.get(owner);
        amounts.set(currency, (amounts.get(currency) || 0) + Number(row.gross || 0));
      }
    }
    const items = users.filter(user => byOwner.has(String(user._id))).map(user => ({
      ...user,
      accountStatus: user.accountStatus || "active",
      business: byOwner.get(String(user._id)),
      productCount: products.get(String(user._id)) || 0,
      serviceCount: services.get(String(user._id)) || 0,
      bookingCount: bookings.get(String(user._id)) || 0,
      reviewSummary: reviews.get(String(user._id)) || { count: 0, averageRating: 0 },
      financialSummary: {
        definition: "gross_recorded_sales",
        totalsByCurrency: [...(revenueByOwner.get(String(user._id)) || new Map())]
          .map(([currency, gross]) => ({ currency, gross }))
          .sort((first, second) => first.currency.localeCompare(second.currency))
      }
    }));
    res.set("Cache-Control", "no-store");
    res.json(paged ? { items, hasMore, nextCursor: hasMore ? String(users[users.length - 1]._id) : null } : items);
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

    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // Each source is aggregated in MongoDB, not loaded as a full collection.
    // Keep currencies separate: adding USD and PHP without conversion is invalid.
    const sourceTotals = (match, amountField, dateField) => [
      { $match: match },
      { $group: {
        _id: { $ifNull: ["$currency", "PHP"] },
        gross: { $sum: { $ifNull: [amountField, 0] } },
        count: { $sum: 1 },
        last30Days: { $sum: { $cond: [
          { $gte: [dateField, since30Days] },
          { $ifNull: [amountField, 0] }, 0
        ] } }
      } },
      { $sort: { gross: -1 } }
    ];

    const [business, services, recentBookings, reviewRows, saleRows,
      productCount, serviceCounts, bookingStatuses, serviceRevenue, posRevenue, onlineRevenue] = await Promise.all([
      Business.findOne({ owner: user._id }).lean(),
      Content.find({ user: user._id }).select("title published visibility category price currency updatedAt").sort({ updatedAt: -1 }).limit(50).lean(),
      Booking.find({ user: user._id }).select("guestName guestEmail guestPhone service servicePrice currency bookingDate completedAt status source").sort({ createdAt: -1 }).limit(20).lean(),
      Review.aggregate([{ $match: { businessOwner: user._id, verified: true } }, { $group: { _id: "$businessOwner", count: { $sum: 1 }, averageRating: { $avg: "$rating" } } }]),
      Sale.aggregate([
        { $match: { businessOwner: user._id, status: "recorded" } },
        { $group: { _id: "$currency", total: { $sum: "$saleAmount" }, count: { $sum: 1 } } },
        { $sort: { count: -1, total: -1 } }
      ]),
      Product.countDocuments({ user: user._id }),
      Content.countDocuments({ user: user._id }),
      Booking.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Sale.aggregate(sourceTotals(
        { businessOwner: user._id, status: "recorded" }, "$saleAmount", "$completedAt"
      )),
      PosSale.aggregate(sourceTotals(
        { businessOwner: user._id, status: "recorded" }, "$total", "$soldAt"
      )),
      // This is completed order *value*, not a verified amount paid to the business.
      // Exclude explicitly fully-refunded or voided orders from the operational gross.
      ProductOrder.aggregate(sourceTotals(
        { businessOwner: user._id, status: "completed", paymentStatus: { $nin: ["refunded", "voided"] } },
        "$total", "$completedAt"
      ))
    ]);
    if (!business) return res.status(404).json({ message: "Business profile not found." });
    const review = reviewRows[0] || {};
    const bookingStatusCounts = Object.fromEntries(bookingStatuses.map(row => [row._id, row.count]));
    const bookingsTotal = bookingStatuses.reduce((sum, row) => sum + row.count, 0);
    const byCurrency = new Map();
    for (const [channel, rows] of [
      ["services", serviceRevenue], ["pos", posRevenue], ["online", onlineRevenue]
    ]) {
      for (const row of rows) {
        const currency = row._id || "PHP";
        if (!byCurrency.has(currency)) {
          byCurrency.set(currency, {
            currency, gross: 0, last30Days: 0, transactions: 0,
            services: 0, pos: 0, online: 0
          });
        }
        const entry = byCurrency.get(currency);
        entry[channel] += Number(row.gross || 0);
        entry.gross += Number(row.gross || 0);
        entry.last30Days += Number(row.last30Days || 0);
        entry.transactions += row.count || 0;
      }
    }

    res.set("Cache-Control", "no-store");
    res.json({
      user: { ...user, accountStatus: user.accountStatus || "active" },
      business,
      services,
      recentBookings,
      productCount,
      serviceCount: serviceCounts,
      bookingSummary: { total: bookingsTotal, statuses: bookingStatusCounts },
      financialSummary: {
        since: since30Days.toISOString(),
        totalsByCurrency: [...byCurrency.values()].sort((a, b) => b.gross - a.gross)
      },
      // Legacy field kept for existing clients that only show service sales.
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

router.patch("/businesses/:id/password", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid business ID." });
    const password = String(req.body.password || "");
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    if (password.length > 128) return res.status(400).json({ message: "Password is too long." });

    const user = await User.findOne({ _id: req.params.id, role: "business" });
    if (!user) return res.status(404).json({ message: "Business account not found." });
    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();

    req.app.get("io").in(`user:${user._id}`).disconnectSockets(true);
    res.json({ ok: true, message: "Password reset successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to reset the password." });
  }
});

export default router;
