import { Router } from "express";
import Business from "../models/Business.js";
import requireAuth from "../middleware/auth.js";
import { requireBusiness } from "../middleware/requireRole.js";

const router = Router();
router.use(requireAuth, requireBusiness);

const imagePattern = /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i;

function normalize(body) {
  return {
    name: String(body.name || "").trim(),
    category: String(body.category || "General").trim() || "General",
    description: String(body.description || "").trim(),
    location: String(body.location || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    phone: String(body.phone || "").trim(),
    website: String(body.website || "").trim(),
    logo: String(body.logo || "")
  };
}

function validate(input) {
  if (!input.name || !input.email) return "Business name and email are required.";
  if (!/^\S+@\S+\.\S+$/.test(input.email)) return "Enter a valid business email.";
  if (input.name.length > 120 || input.category.length > 80 || input.description.length > 2000 || input.location.length > 160 || input.phone.length > 40) return "One or more business profile fields are too long.";
  if (input.website && !/^https?:\/\//i.test(input.website)) return "Website must start with http:// or https://.";
  if (input.logo && !imagePattern.test(input.logo)) return "Logo must be a JPEG, PNG, WebP, or GIF.";
  if (input.logo && Math.ceil((input.logo.split(",")[1] || "").length * 3 / 4) > 2 * 1024 * 1024) return "Logo must be 2 MB or smaller.";
  return null;
}

router.get("/mine", async (req, res) => {
  try {
    let business = await Business.findOne({ owner: req.user.id });
    if (!business) {
      business = await Business.create({ owner: req.user.id, name: req.user.email.split("@")[0], email: req.user.email, category: "General" });
    }
    res.json(business);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load your business profile." });
  }
});

router.put("/mine", async (req, res) => {
  try {
    const input = normalize(req.body);
    const error = validate(input);
    if (error) return res.status(400).json({ message: error });

    const business = await Business.findOneAndUpdate(
      { owner: req.user.id },
      { $set: input, $setOnInsert: { owner: req.user.id } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(business);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update your business profile." });
  }
});

export default router;
