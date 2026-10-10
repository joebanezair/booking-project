import { Router } from "express";
import express from "express";
import mongoose from "mongoose";
import requireAuth from "../middleware/auth.js";
import { mediaBucket, saveBuffer, validPrivateSignature } from "../lib/mediaStore.js";

const router = Router();

// Optional binary endpoint for future clients; legacy JSON forms remain compatible.
router.post("/upload", requireAuth, express.raw({ type: "application/octet-stream", limit: "5mb" }), async (req, res) => {
  try {
    const visibility = req.query.visibility === "private" ? "private" : "public";
    const mimeType = String(req.headers["x-file-mime"] || "");
    const url = await saveBuffer(req.body, { mimeType, visibility, name: "upload", ownerId: req.user.id });
    res.status(201).json({ url });
  } catch (error) { res.status(error.status || 503).json({ message: error.message || "Upload failed." }); }
});

async function serve(req, res, visibility) {
  const bucket = mediaBucket();
  if (!bucket) return res.status(503).json({ message: "Media storage is unavailable." });
  if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
  if (visibility === "private" && !validPrivateSignature(req.params.id, req.query.expires, req.query.sig)) {
    return res.sendStatus(403);
  }
  try {
    const file = await bucket.find({ _id: new mongoose.Types.ObjectId(req.params.id) }).next();
    if (!file || file.metadata?.visibility !== visibility) return res.sendStatus(404);
    res.setHeader("Content-Type", file.metadata.mimeType || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", file.length);
    res.setHeader("Cache-Control", visibility === "public" ? "public, max-age=86400, immutable" : "private, no-store");
    if (visibility === "private") res.setHeader("Content-Disposition", 'attachment; filename="attachment"');
    const stream = bucket.openDownloadStream(file._id);
    stream.on("error", error => {
      console.error(error);
      if (!res.headersSent) res.sendStatus(500);
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) { console.error(error); if (!res.headersSent) res.sendStatus(500); }
}
router.get("/public/:id", (req, res) => serve(req, res, "public"));
router.get("/private/:id", (req, res) => serve(req, res, "private"));

export default router;
