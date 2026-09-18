import { Router } from "express";
import Business from "../models/Business.js";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";
import { notify } from "../lib/notifications.js";

const router = Router();
router.use(requireAuth);

const imagePattern = /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i;

function normalize(body) {
  return {
    name: String(body.name || "").trim(),
    category: String(body.category || "").trim(),
    description: String(body.description || "").trim(),
    location: String(body.location || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    phone: String(body.phone || "").trim(),
    website: String(body.website || "").trim(),
    logo: String(body.logo || "")
  };
}

function validate(input) {
  if (!input.name || !input.category || !input.description || !input.location || !input.email || !input.phone) return "Complete all required business fields.";
  if (!/^\S+@\S+\.\S+$/.test(input.email)) return "Enter a valid business email.";
  if (input.website && !/^https?:\/\//i.test(input.website)) return "Website must start with http:// or https://.";
  if (input.logo && !imagePattern.test(input.logo)) return "Logo must be a JPEG, PNG, WebP, or GIF.";
  if (input.logo && Math.ceil((input.logo.split(",")[1] || "").length * 3 / 4) > 2 * 1024 * 1024) return "Logo must be 2 MB or smaller.";
  return null;
}

router.get("/mine", async (req, res) => {
  try { res.json(await Business.findOne({ owner: req.user.id })); }
  catch (error) { console.error(error); res.status(500).json({ message: "Unable to load your business application." }); }
});

router.post("/mine", async (req, res) => {
  try {
    if (req.user.role !== "customer") return res.status(403).json({ message: "This application is only needed for customer accounts." });
    if (await Business.exists({ owner: req.user.id })) return res.status(409).json({ message: "You already have a business application." });
    const input = normalize(req.body), error = validate(input);
    if (error) return res.status(400).json({ message: error });
    const business = await Business.create({ owner: req.user.id, ...input });
    const admins = await User.find({ role: "admin" }).distinct("_id");
    await Promise.all(admins.map(admin => notify(req, admin, { type: "business-request", title: "New business application", body: `${business.name} is awaiting review.`, link: "/dashboard/business-requests" })));
    res.status(201).json(business);
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to submit your business application." }); }
});

router.put("/mine", async (req, res) => {
  try {
    const current = await Business.findOne({ owner: req.user.id });
    if (!current) return res.status(404).json({ message: "Business application not found." });
    if (!["pending", "rejected"].includes(current.status)) return res.status(409).json({ message: "Approved or suspended businesses cannot be resubmitted here." });
    const input = normalize(req.body), error = validate(input);
    if (error) return res.status(400).json({ message: error });
    Object.assign(current, input, { status: "pending", rejectionReason: "", reviewedBy: null, reviewedAt: null });
    await current.save();
    const admins = await User.find({ role: "admin" }).distinct("_id");
    await Promise.all(admins.map(admin => notify(req, admin, { type: "business-request", title: "Business application resubmitted", body: `${current.name} is awaiting review.`, link: "/dashboard/business-requests" })));
    res.json(current);
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to update your business application." }); }
});

export default router;
