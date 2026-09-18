import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import messageRoutes from "./routes/messages.js";
import publicRoutes from "./routes/public.js";
import contentRoutes from "./routes/content.js";
import profileRoutes from "./routes/profile.js";
import ratingRoutes from "./routes/ratings.js";
import commentRoutes from "./routes/comments.js";
import reactionRoutes from "./routes/reactions.js";
import notificationRoutes from "./routes/notifications.js";
import profileRatingRoutes from "./routes/profileRatings.js";
import forumRoutes from "./routes/forum.js";
import adminRoutes from "./routes/admin.js";
import User from "./models/User.js";
import emojiReactionRoutes from "./routes/emojiReactions.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" }
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = String(payload.sub);
    next();
  } catch {
    next(new Error("Authentication required."));
  }
});

io.on("connection", socket => {
  socket.join(`user:${socket.userId}`);
  socket.on("service:join", serviceId => { if (mongoose.isValidObjectId(serviceId)) socket.join(`service:${serviceId}`); });
  socket.on("service:leave", serviceId => { if (mongoose.isValidObjectId(serviceId)) socket.leave(`service:${serviceId}`); });
});

app.set("io", io);

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "20mb" }));
app.get("/api/health", (_req,res)=>res.json({ok:true,message:"Booking API is running"}));
app.use("/api/auth",authRoutes);
app.use("/api/bookings",bookingRoutes);
app.use("/api/messages",messageRoutes);
app.use("/api/content",contentRoutes);
app.use("/api/profile",profileRoutes);
app.use("/api/ratings",ratingRoutes);
app.use("/api/comments",commentRoutes);
app.use("/api/reactions",reactionRoutes);
app.use("/api/notifications",notificationRoutes);
app.use("/api/profile-ratings",profileRatingRoutes);
app.use("/api/forum",forumRoutes);
app.use("/api/admin",adminRoutes);
app.use("/api/emoji-reactions",emojiReactionRoutes);
app.use("/api/public",publicRoutes);
app.use((err,_req,res,_next)=>{console.error(err);if(err?.type==="entity.too.large") return res.status(413).json({message:"Uploaded images are too large."});res.status(500).json({message:"Something went wrong on the server."});});

async function start(){
  if(!process.env.MONGO_URI) throw new Error("MONGO_URI is missing. Copy .env.example to .env and configure it.");
  if(!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing. Add it to server/.env.");
  await mongoose.connect(process.env.MONGO_URI);
  const adminEmails = String(process.env.ADMIN_EMAILS || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  if (adminEmails.length) await User.updateMany({ email: { $in: adminEmails } }, { $set: { role: "admin" } });
  httpServer.listen(PORT,()=>console.log(`API and WebSocket server listening on http://localhost:${PORT}`));
}
start().catch(error=>{console.error(error);process.exit(1);});
