import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";
import Business from "../models/Business.js";

const router = Router();

function createToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
}
async function publicUser(user) {
  const business = await Business.findOne({ owner: user._id }).select("_id name status").lean();
  return { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role || "customer", business: business ? { id: business._id, name: business.name, status: business.status } : null };
}
function slug(value) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "user";
}
async function uniqueUsername(name) {
  const base = slug(name);
  let candidate = base, i = 1;
  while (await User.exists({ username: candidate })) candidate = `${base}-${i++}`;
  return candidate;
}

function validInviteKey(actual, expected) {
  if (!expected || expected.length < 32 || expected.startsWith("replace_with_")) return false;
  const actualBuffer = Buffer.from(String(actual || ""));
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function createAccount(req, res, role) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ message: "An account with that email already exists." });
  const user = await User.create({ name: name.trim(), username: await uniqueUsername(name), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role });
  return res.status(201).json({ token: createToken(user), user: await publicUser(user) });
}

router.post("/register", async (req, res) => {
  try {
    await createAccount(req, res, "customer");
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to create account." }); }
});

router.post("/register/:role/:inviteKey", async (req, res) => {
  try {
    const role = req.params.role;
    if (role !== "admin") return res.status(404).json({ message: "Registration page not found." });
    const expected = process.env.ADMIN_REGISTRATION_KEY;
    if (!validInviteKey(req.params.inviteKey, expected)) return res.status(403).json({ message: "This registration invitation is invalid or unavailable." });
    await createAccount(req, res, role);
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to create invited account." }); }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Invalid email or password." });
    if (!user.username) { user.username = await uniqueUsername(user.name); await user.save(); }

    res.json({ token: createToken(user), user: await publicUser(user) });
  } catch (error) { console.error(error); res.status(500).json({ message: "Unable to log in." }); }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: "Your account no longer exists." });
  res.json(await publicUser(user));
});

export default router;
