import { Router } from "express";
import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import Business from "../models/Business.js";
import { notify } from "../lib/notifications.js";

const router = Router();
const tokenPattern = /^[a-f0-9]{48}$/;

async function loadInvite(token) {
  if (!tokenPattern.test(String(token || ""))) return null;
  const review = await Review.findOne({ reviewToken: token }).lean();
  if (!review) return null;
  const [booking, business] = await Promise.all([
    Booking.findById(review.booking).select("guestName service bookingDate status").lean(),
    Business.findById(review.business).select("name category logo owner").lean()
  ]);
  if (!booking || !business) return null;
  return { review, booking, business };
}

router.get("/:token", async (req, res) => {
  try {
    const data = await loadInvite(req.params.token);
    if (!data) return res.status(404).json({ message: "Review link not found." });
    if (data.booking.status !== "completed") return res.status(409).json({ message: "This booking is not currently eligible for a review." });

    res.json({
      business: { name: data.business.name, category: data.business.category, logo: data.business.logo },
      booking: { service: data.booking.service, bookingDate: data.booking.bookingDate },
      submitted: Boolean(data.review.verified),
      rating: data.review.verified ? data.review.rating : null,
      comment: data.review.verified ? data.review.comment : ""
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load review link." });
  }
});

router.put("/:token", async (req, res) => {
  try {
    const data = await loadInvite(req.params.token);
    if (!data) return res.status(404).json({ message: "Review link not found." });
    if (data.booking.status !== "completed") return res.status(409).json({ message: "This booking is not currently eligible for a review." });
    if (data.review.verified) return res.status(409).json({ message: "A verified review has already been submitted for this booking." });

    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be from 1 to 5." });
    if (comment.length > 1500) return res.status(400).json({ message: "Review comment must be 1500 characters or fewer." });

    const review = await Review.findByIdAndUpdate(
      data.review._id,
      { rating, comment, verified: true, submittedAt: new Date() },
      { new: true, runValidators: true }
    );
    await notify(req, data.business.owner, {
      type: "verified-review",
      title: "New verified review",
      body: `Your business received a ${rating}-star verified review.`,
      link: "/dashboard/profile"
    });

    res.json({ submitted: true, rating: review.rating, comment: review.comment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to submit review." });
  }
});

export default router;
