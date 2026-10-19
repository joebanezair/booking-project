import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import messageRoutes from "./routes/messages.js";
import publicRoutes from "./routes/public.js";
import reviewRoutes from "./routes/reviews.js";
import contentRoutes from "./routes/content.js";
import profileRoutes from "./routes/profile.js";
import ratingRoutes from "./routes/ratings.js";
import commentRoutes from "./routes/comments.js";
import reactionRoutes from "./routes/reactions.js";
import notificationRoutes from "./routes/notifications.js";
import forumRoutes from "./routes/forum.js";
import adminRoutes from "./routes/admin.js";
import emojiReactionRoutes from "./routes/emojiReactions.js";
import businessRoutes from "./routes/businesses.js";
import salesRoutes from "./routes/sales.js";
import User from "./models/User.js";
import Business from "./models/Business.js";
import Booking from "./models/Booking.js";
import { syncSaleForBooking } from "./lib/sales.js";
import { calculateBookingEndsAt, makeBookingReference } from "./lib/scheduling.js";
import { connectMediaStore, closeMediaStore, mediaEnabled } from "./lib/mediaStore.js";
import mediaRoutes from "./routes/media.js";
import { sharedRateLimit } from "./middleware/sharedRateLimit.js";
import { startRedis, stopRedis } from "./lib/distributedRedis.js";

// Always resolve credentials relative to the backend source, not process.cwd().
 // Codespaces, npm scripts and workflow runners can otherwise select different
 // .env files and point API requests at an unrelated MongoDB instance.
dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });
const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("role accountStatus").lean();
    if (!user || !["business", "admin"].includes(user.role) || (user.accountStatus || "active") === "disabled") {
      return next(new Error("Authentication required."));
    }
    socket.userId = String(payload.sub);
    next();
  } catch {
    next(new Error("Authentication required."));
  }
});

io.on("connection", socket => {
  socket.join(`user:${socket.userId}`);
  socket.on("service:join", serviceId => {
    if (mongoose.isValidObjectId(serviceId)) socket.join(`service:${serviceId}`);
  });
  socket.on("service:leave", serviceId => {
    if (mongoose.isValidObjectId(serviceId)) socket.leave(`service:${serviceId}`);
  });
});

app.set("io", io);
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "20mb" }));

// Non-sensitive version marker to distinguish a stale backend process from this inventory fix.
app.get("/api/live", (_req, res) => res.json({ ok: true, inventoryFlowVersion: "betta-vol1-auto-stock-20261019" }));
app.get("/api/ready", (_req, res) => {
  const ok = !shuttingDown && mongoose.connection.readyState === 1 && (!process.env.MEDIA_MONGO_URI || mediaEnabled());
  res.status(ok ? 200 : 503).json({ ok });
});
app.get("/api/health", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    ok: databaseConnected,
    message: databaseConnected ? "Booking API is running" : "Main database is unavailable"
  });
});
app.use("/api/auth/login", sharedRateLimit({ max: 20 }));
app.use("/api/auth/register", sharedRateLimit({ max: 10 }));
app.use("/api/public/search", sharedRateLimit({ max: 120 }));
app.use("/api/public/book", sharedRateLimit({ max: 60 }));
app.use("/api/public/orders", sharedRateLimit({ max: 50 }));
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/reactions", reactionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/emoji-reactions", emojiReactionRoutes);
app.use("/api/public/reviews", reviewRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/media", mediaRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.type === "entity.too.large") return res.status(413).json({ message: "Uploaded images are too large." });
  res.status(500).json({ message: "Something went wrong on the server." });
});

async function migrateLegacyAccounts() {
  const users = mongoose.connection.collection("users");
  const businesses = mongoose.connection.collection("businesses");

  const legacyBusinesses = await businesses.find(
    { status: { $in: ["pending", "approved", "rejected", "suspended"] } },
    { projection: { owner: 1, status: 1 } }
  ).toArray();

  const ownerIds = legacyBusinesses.map(item => item.owner).filter(Boolean);
  for (const legacy of legacyBusinesses) {
    const accountStatus = legacy.status === "suspended" ? "paused" : "active";
    await users.updateOne(
      { _id: legacy.owner, role: { $ne: "admin" } },
      { $set: { role: "business", accountStatus } }
    );
  }

  await users.updateMany(
    { role: "customer", _id: { $nin: ownerIds } },
    { $set: { role: "business", accountStatus: "disabled" } }
  );
  await users.updateMany(
    { role: { $in: ["business", "admin"] }, accountStatus: { $exists: false } },
    { $set: { accountStatus: "active" } }
  );

  const activeBusinessUsers = await User.find({
    role: "business",
    accountStatus: { $in: ["active", "paused"] }
  }).select("_id name email").lean();

  if (activeBusinessUsers.length) {
    await Business.bulkWrite(activeBusinessUsers.map(user => ({
      updateOne: {
        filter: { owner: user._id },
        update: {
          $setOnInsert: {
            owner: user._id,
            name: user.name,
            email: user.email,
            category: "General",
            description: "",
            location: "",
            phone: "",
            website: "",
            logo: ""
          }
        },
        upsert: true
      }
    })));
  }

  await businesses.updateMany(
    {},
    { $unset: { status: "", rejectionReason: "", reviewedBy: "", reviewedAt: "" } }
  );
}

async function backfillBookingScheduling() {
  const bookings = await Booking.find({
    $or: [
      { bookingReference: { $exists: false } },
      { bookingReference: "" },
      { bookingEndsAt: null },
      { history: { $exists: false } }
    ]
  }).populate("content", "durationMinutes bufferMinutes");

  for (const booking of bookings) {
    let changed = false;
    if (!booking.bookingReference) {
      let reference = makeBookingReference();
      while (await Booking.exists({ bookingReference: reference, _id: { $ne: booking._id } })) reference = makeBookingReference();
      booking.bookingReference = reference;
      changed = true;
    }
    if (!booking.serviceDurationMinutes) {
      booking.serviceDurationMinutes = Number(booking.content?.durationMinutes || 60);
      changed = true;
    }
    if (booking.bufferMinutes == null) {
      booking.bufferMinutes = Number(booking.content?.bufferMinutes || 0);
      changed = true;
    }
    if (!booking.bookingEndsAt) {
      booking.bookingEndsAt = calculateBookingEndsAt(booking.bookingDate, {
        durationMinutes: booking.serviceDurationMinutes || 60
      });
      changed = true;
    }
    if (!Array.isArray(booking.history) || booking.history.length === 0) {
      booking.history = [{ action: "imported", status: booking.status, note: "Existing booking added to scheduling history.", at: booking.createdAt || new Date() }];
      changed = true;
    }
    if (changed) await booking.save();
  }
}

async function backfillCompletedSales() {
  const completed = await Booking.find({ status: "completed" })
    .populate("content", "title price currency")
    .sort({ updatedAt: 1 });

  for (const booking of completed) {
    let changed = false;
    if (!booking.completedAt) {
      booking.completedAt = booking.updatedAt || booking.bookingDate || new Date();
      changed = true;
    }
    if (booking.content) {
      if (booking.servicePrice == null || booking.servicePrice === 0) {
        booking.servicePrice = Number(booking.content.price || 0);
        booking.currency = booking.content.currency || booking.currency || "PHP";
        changed = true;
      } else if (!booking.currency) {
        booking.currency = booking.content.currency || "PHP";
        changed = true;
      }
      if (!booking.service && booking.content.title) {
        booking.service = booking.content.title;
        changed = true;
      }
    }
    if (changed) await booking.save();
    await syncSaleForBooking(booking);
  }
}

async function start() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing. Copy .env.example to .env and configure it.");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing. Add it to server/.env.");
  if (process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters.");
  if (process.env.NODE_ENV === "production") {
    if (!process.env.CLIENT_URL || !/^https:\/\//i.test(process.env.CLIENT_URL)) throw new Error("Production CLIENT_URL must be an HTTPS origin.");
    if (process.env.MONGO_URI.includes("127.0.0.1") || process.env.MONGO_URI.includes("localhost")) throw new Error("Production MONGO_URI cannot point to localhost.");
    if (process.env.ADMIN_REGISTRATION_KEY && process.env.ADMIN_REGISTRATION_KEY.length < 32) throw new Error("ADMIN_REGISTRATION_KEY must be at least 32 characters in production.");
  }

  const requestedPool = Number(process.env.MONGO_POOL_MAX || 50);
  const maxPoolSize = Number.isInteger(requestedPool) && requestedPool >= 5 && requestedPool <= 200
    ? requestedPool : 50;
  await mongoose.connect(process.env.MONGO_URI, { maxPoolSize });
  if (process.env.MEDIA_MONGO_URI) {
    await connectMediaStore();
    console.log("Separate GridFS media database connected.");
  }

  const adminEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length) {
    await User.updateMany(
      { email: { $in: adminEmails } },
      { $set: { role: "admin", accountStatus: "active" } }
    );
  }

  if (process.env.RUN_LEGACY_MIGRATIONS === "1") {
    // Run deliberately during a maintenance window, never on every production restart.
    await migrateLegacyAccounts();
    await backfillBookingScheduling();
    await backfillCompletedSales();
  }

  await startRedis(io);
  try {
    await new Promise((resolve, reject) => {
      const onError = error => { httpServer.off("listening", onListening); reject(error); };
      const onListening = () => { httpServer.off("error", onError); resolve(); };
      httpServer.once("error", onError);
      httpServer.once("listening", onListening);
      httpServer.listen(PORT);
    });
    console.log(`API and WebSocket server listening on http://localhost:${PORT}`);
    console.log(`MongoDB database: ${mongoose.connection.name} (backend PID ${process.pid})`);
  } catch (error) {
    if (error?.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already occupied. Stop the older BookFlow API process before starting this one; otherwise the frontend will keep reaching the older server.`);
    }
    throw error;
  }
}

let shuttingDown = false;
async function stop(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down BookFlow gracefully:", signal);
  const deadline = setTimeout(() => process.exit(1), 15_000);
  deadline.unref();
  try {
    await new Promise(resolve => io.close(resolve));
    if (httpServer.listening) await new Promise(resolve => httpServer.close(resolve));
    await Promise.allSettled([stopRedis(), closeMediaStore(), mongoose.disconnect()]);
    clearTimeout(deadline);
    process.exit(0);
  } catch (error) {
    console.error("Shutdown failed", error);
    process.exit(1);
  }
}
process.once("SIGINT", () => { void stop("SIGINT"); });
process.once("SIGTERM", () => { void stop("SIGTERM"); });

start().catch(error => {
  console.error(error);
  process.exit(1);
});
