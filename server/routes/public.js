import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Business from "../models/Business.js";
import Content from "../models/Content.js";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Comment from "../models/Comment.js";
import Reaction from "../models/Reaction.js";
import Review from "../models/Review.js";
import { notify } from "../lib/notifications.js";
import optionalAuth from "../middleware/optionalAuth.js";
import { reactionMap } from "../lib/emojiReactions.js";
import { isActiveProvider, isProviderOwner, providerOwnerIds } from "../lib/providers.js";
import { calculateBookingEndsAt, getAvailableSlots, makeBookingReference, validateBookingWindow } from "../lib/scheduling.js";

const router = Router();

async function ratingSummary(contentIds) {
  if (!contentIds.length) return new Map();
  const ids = contentIds.map(id => new mongoose.Types.ObjectId(id));
  const rows = await Rating.aggregate([
    { $match: { content: { $in: ids } } },
    { $group: { _id: "$content", averageRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }
  ]);
  return new Map(rows.map(row => [
    String(row._id),
    { averageRating: Number(row.averageRating.toFixed(1)), ratingCount: row.ratingCount }
  ]));
}

async function verifiedReviewSummary(businessId) {
  if (!businessId) return { averageRating: 0, ratingCount: 0 };
  const rows = await Review.aggregate([
    { $match: { business: new mongoose.Types.ObjectId(businessId), verified: true } },
    { $group: { _id: "$business", averageRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }
  ]);
  const row = rows[0] || {};
  return {
    averageRating: row.averageRating ? Number(row.averageRating.toFixed(1)) : 0,
    ratingCount: row.ratingCount || 0
  };
}

router.get("/profile/:username", optionalAuth, async (req, res) => {
  try {
    const user = await User.findOne({
      username: String(req.params.username).toLowerCase(),
      role: "business",
      accountStatus: { $in: ["active", "paused"] }
    }).select("name username bio headline location website profileImage profileImagePositionX profileImagePositionY coverImage accountStatus createdAt friendRequests");

    if (!user) return res.status(404).json({ message: "Business profile not found." });

    const business = await Business.findOne({ owner: user._id }).select("name category description location website logo").lean();
    if (!business) return res.status(404).json({ message: "Business profile not found." });

    const items = await Content.find({
      user: user._id,
      published: true,
      visibility: { $ne: "private" }
    }).select("title description price currency category coverImage createdAt updatedAt").sort({ updatedAt: -1 });

    const [summary, reviewSummary, reviews, businessRatingRows, currentBusinessRating] = await Promise.all([
      ratingSummary(items.map(item => item._id)),
      verifiedReviewSummary(business._id),
      Review.find({ business: business._id, verified: true })
        .select("rating comment submittedAt")
        .sort({ submittedAt: -1 })
        .limit(8)
        .lean(),
      Rating.aggregate([{ $match: { business: business._id } }, { $group: { _id: "$business", averageRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }]),
      req.user ? Rating.findOne({ business: business._id, user: req.user.id }).select("rating") : null
    ]);

    res.json({
      profile: {
        id: user._id,
        name: business.name || user.name,
        username: user.username,
        bio: business.description || user.bio,
        headline: business.category || user.headline,
        location: business.location || user.location,
        website: business.website || user.website,
        profileImage: business.logo || user.profileImage,
        profileImagePositionX: user.profileImagePositionX,
        profileImagePositionY: user.profileImagePositionY,
        coverImage: user.coverImage,
        accountStatus: user.accountStatus || "active",
        createdAt: user.createdAt,
        ratingSummary: reviewSummary,
        businessId: business._id,
        businessRatingSummary: { averageRating: businessRatingRows[0]?.averageRating ? Number(businessRatingRows[0].averageRating.toFixed(1)) : 0, ratingCount: businessRatingRows[0]?.ratingCount || 0 },
        currentUserBusinessRating: currentBusinessRating?.rating || null,
        friendship: req.user ? (() => { const viewer = req.user; return { available: String(viewer.id) !== String(user._id), isFriend: (viewer.friends || []).some(id => String(id) === String(user._id)), requestSent: (user.friendRequests || []).some(r => String(r.from) === String(viewer.id)), incomingRequest: (viewer.friendRequests || []).some(r => String(r.from) === String(user._id)), blocked: (viewer.blockedUsers || []).some(id => String(id) === String(user._id)) }; })() : null
      },
      reviews,
      content: items.map(item => ({
        ...item.toObject(),
        ...(summary.get(String(item._id)) || { averageRating: 0, ratingCount: 0 })
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load public profile." });
  }
});

router.get("/content/:contentId", optionalAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.contentId)) return res.status(404).json({ message: "Service not found." });

    const item = await Content.findOne({
      _id: req.params.contentId,
      published: true,
      visibility: { $ne: "private" }
    }).populate("user", "name username role accountStatus bio headline location website profileImage profileImagePositionX profileImagePositionY coverImage");

    if (!item || !item.user || !await isProviderOwner(item.user._id)) {
      return res.status(404).json({ message: "Service not found." });
    }

    const [business, summaryRows, comments, current, reactionRows, currentReaction] = await Promise.all([
      Business.findOne({ owner: item.user._id }).select("name category location website logo").lean(),
      Rating.aggregate([{ $match: { content: item._id } }, { $group: { _id: "$content", averageRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }]),
      Comment.find({ content: item._id }).populate("user", "name username profileImage profileImagePositionX profileImagePositionY").sort({ createdAt: 1 }).limit(200),
      req.user ? Rating.findOne({ content: item._id, user: req.user.id }).select("rating") : null,
      Reaction.aggregate([{ $match: { content: item._id } }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
      req.user ? Reaction.findOne({ content: item._id, user: req.user.id }).select("type") : null
    ]);

    const commentReactions = await reactionMap("comment", comments.map(comment => comment._id), req.user?.id);
    const summary = summaryRows[0] || {};
    const reactions = Object.fromEntries(reactionRows.map(row => [row._id, row.count]));

    res.json({
      _id: item._id,
      title: item.title,
      description: item.description,
      price: item.price,
      currency: item.currency,
      category: item.category,
      coverImage: item.coverImage,
      images: item.images,
      allowRatings: item.allowRatings,
      allowBookings: item.allowBookings,
      durationMinutes: item.durationMinutes || 60,
      bufferMinutes: item.bufferMinutes || 0,
      capacity: item.capacity || 1,
      bookingQuestions: item.bookingQuestions || [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      owner: {
        id: item.user._id,
        name: business?.name || item.user.name,
        username: item.user.username,
        bio: item.user.bio,
        headline: business?.category || item.user.headline,
        location: business?.location || item.user.location,
        website: business?.website || item.user.website,
        profileImage: business?.logo || item.user.profileImage,
        profileImagePositionX: item.user.profileImagePositionX,
        profileImagePositionY: item.user.profileImagePositionY,
        coverImage: item.user.coverImage,
        accountStatus: item.user.accountStatus || "active"
      },
      ratingSummary: {
        averageRating: summary.averageRating ? Number(summary.averageRating.toFixed(1)) : 0,
        ratingCount: summary.ratingCount || 0
      },
      currentUserRating: current?.rating || null,
      reactionSummary: {
        likes: reactions.like || 0,
        dislikes: reactions.dislike || 0,
        currentReaction: currentReaction?.type || null
      },
      comments: comments.map(comment => ({
        ...comment.toObject(),
        emojiReactions: commentReactions.get(String(comment._id)) || []
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load service." });
  }
});

router.get("/browse", async (_req, res) => {
  try {
    const ownerIds = await providerOwnerIds();
    const items = await Content.find({
      user: { $in: ownerIds },
      published: true,
      visibility: { $ne: "private" }
    }).populate("user", "name username profileImage accountStatus").sort({ updatedAt: -1 }).limit(60);

    const summary = await ratingSummary(items.map(item => item._id));
    res.json(items.map(item => ({
      ...item.toObject(),
      owner: item.user,
      ...(summary.get(String(item._id)) || { averageRating: 0, ratingCount: 0 })
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to browse services." });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    const category = String(req.query.category || "").trim();
    const minRating = Math.max(0, Math.min(5, Number(req.query.minRating || 0)));
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = 12;
    const skip = (page - 1) * limit;
    const regex = q ? new RegExp(q.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&"), "i") : null;

    const ownerIds = await providerOwnerIds();
    const businessProfiles = await Business.find({ owner: { $in: ownerIds } }).select("owner name category location logo").lean();
    const businessByOwner = new Map(businessProfiles.map(profile => [String(profile.owner), profile]));

    const userMatches = regex
      ? await User.find({
          _id: { $in: ownerIds },
          $or: [{ name: regex }, { username: regex }, { headline: regex }, { location: regex }]
        }).distinct("_id")
      : ownerIds;

    const businessMatches = regex
      ? businessProfiles.filter(profile => [profile.name, profile.category, profile.location].some(value => regex.test(String(value || "")))).map(profile => profile.owner)
      : ownerIds;

    const matchingIds = [...new Map([...userMatches, ...businessMatches].map(id => [String(id), id])).values()];
    const matchingUsers = await User.find({ _id: { $in: matchingIds } })
      .select("name username headline location profileImage profileImagePositionX profileImagePositionY accountStatus")
      .sort({ name: 1 });

    const users = matchingUsers.slice(skip, skip + limit).map(user => {
      const profile = businessByOwner.get(String(user._id));
      return {
        ...user.toObject(),
        name: profile?.name || user.name,
        headline: profile?.category || user.headline,
        location: profile?.location || user.location,
        profileImage: profile?.logo || user.profileImage
      };
    });

    const serviceFilter = {
      user: { $in: ownerIds },
      published: true,
      visibility: { $ne: "private" },
      ...(category ? { category } : {}),
      ...(regex ? { $or: [{ title: regex }, { description: regex }, { category: regex }, { user: { $in: matchingIds } }] } : {})
    };

    const services = await Content.find(serviceFilter)
      .populate("user", "name username profileImage accountStatus")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const ratings = await ratingSummary(services.map(service => service._id));
    const mapped = services.map(service => ({
      ...service.toObject(),
      owner: service.user,
      ...(ratings.get(String(service._id)) || { averageRating: 0, ratingCount: 0 })
    })).filter(service => service.averageRating >= minRating);

    res.json({ users, services: mapped, page, hasMore: users.length === limit || services.length === limit });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to search businesses and services." });
  }
});

router.get("/book/:userId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: "Booking page not found." });

    const user = await User.findOne({ _id: req.params.userId, role: "business" }).select("name accountStatus");
    if (!user || user.accountStatus === "disabled") return res.status(404).json({ message: "Booking page not found." });
    if (user.accountStatus === "paused") return res.status(409).json({ message: "This business is temporarily unavailable for new bookings." });

    const [business, bookableServices] = await Promise.all([
      Business.findOne({ owner: user._id }).select("name timezone workingHours blackoutDates leadTimeMinutes maxAdvanceDays slotIntervalMinutes").lean(),
      Content.find({
        user: user._id,
        published: true,
        visibility: { $ne: "private" },
        allowBookings: true
      }).select("title price currency durationMinutes bufferMinutes capacity bookingQuestions").sort({ updatedAt: -1 }).lean()
    ]);
    if (!business) return res.status(404).json({ message: "Business profile not found." });

    res.json({
      owner: { id: user._id, name: business.name || user.name },
      scheduling: {
        timezone: business.timezone || "Asia/Manila",
        workingHours: business.workingHours || [],
        blackoutDates: business.blackoutDates || [],
        leadTimeMinutes: business.leadTimeMinutes ?? 60,
        maxAdvanceDays: business.maxAdvanceDays ?? 60,
        slotIntervalMinutes: business.slotIntervalMinutes ?? 30
      },
      services: bookableServices.length
        ? bookableServices.map(service => ({
            id: service._id,
            title: service.title,
            price: service.price,
            currency: service.currency,
            durationMinutes: service.durationMinutes || 60,
            bufferMinutes: service.bufferMinutes || 0,
            capacity: service.capacity || 1,
            bookingQuestions: service.bookingQuestions || []
          }))
        : [{
            id: "",
            title: "Consultation",
            price: 0,
            currency: "PHP",
            durationMinutes: 60,
            bufferMinutes: 0,
            capacity: 1,
            bookingQuestions: []
          }]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load booking page." });
  }
});

router.get("/book/:userId/slots", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: "Booking page not found." });
    const owner = await User.findOne({ _id: req.params.userId, role: "business", accountStatus: "active" }).select("_id");
    if (!owner || !await isActiveProvider(owner._id)) return res.status(409).json({ message: "This business is unavailable for new bookings." });

    const business = await Business.findOne({ owner: owner._id });
    if (!business) return res.status(404).json({ message: "Business profile not found." });

    let service = { durationMinutes: 60, bufferMinutes: 0, capacity: 1 };
    if (req.query.contentId) {
      if (!mongoose.isValidObjectId(req.query.contentId)) return res.status(400).json({ message: "Invalid service selection." });
      service = await Content.findOne({
        _id: req.query.contentId,
        user: owner._id,
        published: true,
        visibility: { $ne: "private" },
        allowBookings: true
      }).select("durationMinutes bufferMinutes capacity");
      if (!service) return res.status(404).json({ message: "This service is not available for booking." });
    }

    const slots = await getAvailableSlots({
      business,
      service,
      ownerId: owner._id,
      dateKey: String(req.query.date || "")
    });
    res.json({ date: String(req.query.date || ""), timezone: business.timezone || "Asia/Manila", slots });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load available times." });
  }
});

router.post("/book/:userId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ message: "Booking page not found." });

    const owner = await User.findOne({ _id: req.params.userId, role: "business" }).select("_id accountStatus");
    if (!owner || owner.accountStatus === "disabled") return res.status(404).json({ message: "Booking page not found." });
    if (!await isActiveProvider(owner._id)) return res.status(409).json({ message: "This business is temporarily unavailable for new bookings." });

    const business = await Business.findOne({ owner: owner._id });
    if (!business) return res.status(404).json({ message: "Business profile not found." });

    const guestName = String(req.body.guestName || "").trim();
    const guestEmail = String(req.body.guestEmail || "").trim().toLowerCase();
    const guestPhone = String(req.body.guestPhone || "").trim();
    const service = String(req.body.service || "").trim();
    const bookingDate = req.body.bookingDate;
    const notes = String(req.body.notes || "").trim();
    const locationLabel = String(req.body.locationLabel || "").trim();
    const locationLatitude = req.body.locationLatitude === "" || req.body.locationLatitude == null ? null : Number(req.body.locationLatitude);
    const locationLongitude = req.body.locationLongitude === "" || req.body.locationLongitude == null ? null : Number(req.body.locationLongitude);
    const locationAccuracy = req.body.locationAccuracy === "" || req.body.locationAccuracy == null ? null : Number(req.body.locationAccuracy);

    if (!guestName || !guestEmail || !guestPhone || !service || !bookingDate) {
      return res.status(400).json({ message: "Name, email, phone number, service and booking time are required." });
    }
    if (!/^\S+@\S+\.\S+$/.test(guestEmail)) return res.status(400).json({ message: "Enter a valid email address." });
    if (!/^[0-9+().\-\s]{7,30}$/.test(guestPhone)) return res.status(400).json({ message: "Enter a valid phone number." });
    if (locationLabel.length > 200) return res.status(400).json({ message: "Location must be 200 characters or fewer." });

    const hasLatitude = locationLatitude !== null;
    const hasLongitude = locationLongitude !== null;
    if (hasLatitude !== hasLongitude) return res.status(400).json({ message: "Location coordinates must include both latitude and longitude." });
    if (hasLatitude && (!Number.isFinite(locationLatitude) || locationLatitude < -90 || locationLatitude > 90)) return res.status(400).json({ message: "Location latitude is invalid." });
    if (hasLongitude && (!Number.isFinite(locationLongitude) || locationLongitude < -180 || locationLongitude > 180)) return res.status(400).json({ message: "Location longitude is invalid." });
    if (locationAccuracy !== null && (!Number.isFinite(locationAccuracy) || locationAccuracy < 0)) return res.status(400).json({ message: "Location accuracy is invalid." });
    if (notes.length > 500) return res.status(400).json({ message: "Notes must be 500 characters or fewer." });

    let selectedContent = null;
    if (req.body.contentId) {
      if (!mongoose.isValidObjectId(req.body.contentId)) return res.status(400).json({ message: "Invalid service selection." });
      selectedContent = await Content.findOne({
        _id: req.body.contentId,
        user: owner._id,
        published: true,
        visibility: { $ne: "private" },
        allowBookings: true
      }).select("title price currency durationMinutes bufferMinutes capacity bookingQuestions");
      if (!selectedContent) return res.status(404).json({ message: "This service is not available for booking." });
    }

    const scheduleService = selectedContent || { durationMinutes: 60, bufferMinutes: 0, capacity: 1 };
    const scheduleError = await validateBookingWindow({
      business,
      service: scheduleService,
      ownerId: owner._id,
      start: bookingDate
    });
    if (scheduleError) return res.status(409).json({ message: scheduleError });

    const submittedAnswers = req.body.customAnswers && typeof req.body.customAnswers === "object" ? req.body.customAnswers : {};
    const customAnswers = [];
    for (const question of selectedContent?.bookingQuestions || []) {
      const raw = submittedAnswers[question.id];
      const value = question.type === "checkbox" ? (raw ? "Yes" : "") : String(raw ?? "").trim();
      if (question.required && !value) return res.status(400).json({ message: "Please answer: " + question.label });
      if (question.type === "select" && value && !question.options.includes(value)) return res.status(400).json({ message: "Choose a valid option for: " + question.label });
      if (value.length > 1000) return res.status(400).json({ message: "A booking answer is too long." });
      if (value) customAnswers.push({ questionId: question.id, label: question.label, value });
    }

    let bookingReference = makeBookingReference();
    while (await Booking.exists({ bookingReference })) bookingReference = makeBookingReference();

    const bookingStart = new Date(bookingDate);
    const booking = await Booking.create({
      user: owner._id,
      business: business._id,
      content: selectedContent?._id || null,
      bookingReference,
      guestName,
      guestEmail,
      guestPhone,
      locationLabel,
      locationLatitude,
      locationLongitude,
      locationAccuracy,
      service: selectedContent?.title || service,
      servicePrice: Number(selectedContent?.price || 0),
      currency: selectedContent?.currency || "PHP",
      serviceDurationMinutes: Number(selectedContent?.durationMinutes || 60),
      bufferMinutes: Number(selectedContent?.bufferMinutes || 0),
      bookingDate: bookingStart,
      bookingEndsAt: calculateBookingEndsAt(bookingStart, scheduleService),
      notes,
      customAnswers,
      history: [{ action: "created", status: "pending", note: "Guest requested this booking." }],
      source: "public",
      status: "pending"
    });

    req.app.get("io").to(`user:${owner._id}`).emit("booking:created", booking);
    await notify(req, owner._id, {
      type: "booking",
      title: "New booking request",
      body: `${guestName} requested ${selectedContent?.title || service} (${bookingReference}).`,
      link: "/dashboard/bookings"
    });

    res.status(201).json({
      id: booking._id,
      bookingReference,
      message: "Booking request sent successfully."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create booking." });
  }
});

export default router;
