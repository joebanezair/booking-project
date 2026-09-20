import { Router } from "express";
import Business from "../models/Business.js";
import requireAuth from "../middleware/auth.js";
import { requireBusiness } from "../middleware/requireRole.js";

const router = Router();
router.use(requireAuth, requireBusiness);

const imagePattern = /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i;
const defaultWorkingHours = () => [
  { day: 0, enabled: false, start: "09:00", end: "17:00" },
  { day: 1, enabled: true, start: "09:00", end: "17:00" },
  { day: 2, enabled: true, start: "09:00", end: "17:00" },
  { day: 3, enabled: true, start: "09:00", end: "17:00" },
  { day: 4, enabled: true, start: "09:00", end: "17:00" },
  { day: 5, enabled: true, start: "09:00", end: "17:00" },
  { day: 6, enabled: false, start: "09:00", end: "17:00" }
];

function normalizeHours(value) {
  const incoming = Array.isArray(value) ? value : [];
  return defaultWorkingHours().map(fallback => {
    const row = incoming.find(item => Number(item?.day) === fallback.day) || {};
    return {
      day: fallback.day,
      enabled: row.enabled == null ? fallback.enabled : Boolean(row.enabled),
      start: String(row.start || fallback.start),
      end: String(row.end || fallback.end)
    };
  });
}

function normalize(body) {
  return {
    name: String(body.name || "").trim(),
    category: String(body.category || "General").trim() || "General",
    description: String(body.description || "").trim(),
    location: String(body.location || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    phone: String(body.phone || "").trim(),
    website: String(body.website || "").trim(),
    logo: String(body.logo || ""),
    timezone: String(body.timezone || "Asia/Manila").trim(),
    workingHours: normalizeHours(body.workingHours),
    blackoutDates: Array.isArray(body.blackoutDates)
      ? [...new Set(body.blackoutDates.map(value => String(value || "").trim()).filter(Boolean))].slice(0, 120)
      : [],
    leadTimeMinutes: Number(body.leadTimeMinutes ?? 60),
    maxAdvanceDays: Number(body.maxAdvanceDays ?? 60),
    slotIntervalMinutes: Number(body.slotIntervalMinutes ?? 30)
  };
}

function validate(input) {
  if (!input.name || !input.email) return "Business name and email are required.";
  if (!/^\S+@\S+\.\S+$/.test(input.email)) return "Enter a valid business email.";
  if (input.name.length > 120 || input.category.length > 80 || input.description.length > 2000 || input.location.length > 160 || input.phone.length > 40) return "One or more business profile fields are too long.";
  if (input.website && !/^https?:\/\//i.test(input.website)) return "Website must start with http:// or https://.";
  if (input.logo && !imagePattern.test(input.logo)) return "Logo must be a JPEG, PNG, WebP, or GIF.";
  if (input.logo && Math.ceil((input.logo.split(",")[1] || "").length * 3 / 4) > 2 * 1024 * 1024) return "Logo must be 2 MB or smaller.";
  try { new Intl.DateTimeFormat("en-US", { timeZone: input.timezone }).format(new Date()); }
  catch { return "Enter a valid IANA timezone, such as Asia/Manila."; }
  if (!Number.isInteger(input.leadTimeMinutes) || input.leadTimeMinutes < 0 || input.leadTimeMinutes > 43200) return "Lead time must be between 0 and 43,200 minutes.";
  if (!Number.isInteger(input.maxAdvanceDays) || input.maxAdvanceDays < 1 || input.maxAdvanceDays > 730) return "Advance booking limit must be between 1 and 730 days.";
  if (!Number.isInteger(input.slotIntervalMinutes) || input.slotIntervalMinutes < 5 || input.slotIntervalMinutes > 240) return "Slot interval must be between 5 and 240 minutes.";
  for (const hours of input.workingHours) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.end)) return "Working hours must use HH:MM time.";
    if (hours.enabled && hours.start >= hours.end) return "Each open day must end after it starts.";
  }
  if (input.blackoutDates.some(value => !/^\d{4}-\d{2}-\d{2}$/.test(value))) return "Blackout dates must use YYYY-MM-DD.";
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
