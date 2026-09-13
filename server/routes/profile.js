import { Router } from "express";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const imagePattern = /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i;

function validateImage(value) {
  if (!value) return null;
  if (!imagePattern.test(value)) return "Profile image must be a JPEG, PNG, WebP, or GIF.";
  const base64 = value.split(",")[1] || "";
  const bytes = Math.ceil(base64.length * 3 / 4);
  if (bytes > 2 * 1024 * 1024) return "Profile image must be 2 MB or smaller.";
  return null;
}

router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email bio headline location website profileImage createdAt updatedAt");
    if (!user) return res.status(401).json({ message: "Your session no longer matches an account. Please sign in again." });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load profile." });
  }
});

router.put("/", async (req, res) => {
  try {
    const input = {
      name: String(req.body.name || "").trim(),
      bio: String(req.body.bio || "").trim(),
      headline: String(req.body.headline || "").trim(),
      location: String(req.body.location || "").trim(),
      website: String(req.body.website || "").trim(),
      profileImage: String(req.body.profileImage || "")
    };

    if (!input.name) return res.status(400).json({ message: "Name is required." });
    if (input.name.length > 80) return res.status(400).json({ message: "Name must be 80 characters or fewer." });
    if (input.bio.length > 1000) return res.status(400).json({ message: "Bio must be 1000 characters or fewer." });
    if (input.headline.length > 120) return res.status(400).json({ message: "Headline must be 120 characters or fewer." });
    if (input.location.length > 120) return res.status(400).json({ message: "Location must be 120 characters or fewer." });
    if (input.website.length > 300) return res.status(400).json({ message: "Website must be 300 characters or fewer." });
    if (input.website && !/^https?:\/\//i.test(input.website)) {
      return res.status(400).json({ message: "Website must start with http:// or https://." });
    }

    const imageError = validateImage(input.profileImage);
    if (imageError) return res.status(400).json({ message: imageError });

    const user = await User.findByIdAndUpdate(req.user.id, input, {
      new: true,
      runValidators: true
    }).select("name email bio headline location website profileImage createdAt updatedAt");

    if (!user) return res.status(401).json({ message: "Your session no longer matches an account. Please sign in again." });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update profile." });
  }
});

export default router;
