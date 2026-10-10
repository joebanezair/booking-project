import { createHmac, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";

let bucket = null;
let mediaConnection = null;
const imageMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const attachmentMime = new Set([...imageMime, "application/pdf", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);

const base = () => String(process.env.MEDIA_PUBLIC_BASE_URL || "").replace(/\/$/, "");
export function mediaEnabled() { return Boolean(bucket); }
export function publicMediaReference(id) { return `${base()}/api/media/public/${id}`; }
export function privateMediaReference(id) { return `${base()}/api/media/private/${id}`; }
export function publicMediaInput(v) { return typeof v === "string" && (
  /^\/api\/media\/public\/[a-f0-9]{24}$/i.test(v) ||
  (Boolean(base()) && new RegExp("^" + base().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/api/media/public/[a-f0-9]{24}$", "i").test(v))
); }

export async function connectMediaStore() {
  if (!process.env.MEDIA_MONGO_URI) return false;
  mediaConnection = mongoose.createConnection(process.env.MEDIA_MONGO_URI, { maxPoolSize: 20 });
  await mediaConnection.asPromise();
  bucket = new mongoose.mongo.GridFSBucket(mediaConnection.db, { bucketName: "bookflowMedia" });
  return true;
}

export function mediaBucket() { return bucket; }
export async function closeMediaStore() {
  bucket = null;
  if (mediaConnection) await mediaConnection.close();
}

export async function saveBuffer(buffer, { mimeType, visibility = "public", name = "upload", ownerId } = {}) {
  if (!bucket) throw new Error("Media database is not configured.");
  const allowed = visibility === "private" ? attachmentMime : imageMime;
  if (!allowed.has(mimeType)) throw Object.assign(new Error("Unsupported media type."), { status: 400 });
  const maxBytes = visibility === "private" ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > maxBytes) {
    throw Object.assign(new Error("Media file exceeds size limits or is empty."), { status: 413 });
  }
  const filename = String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const upload = bucket.openUploadStream(filename, {
    contentType: mimeType,
    metadata: { visibility, ownerId: ownerId || null, mimeType, createdAt: new Date() }
  });
  await new Promise((resolve, reject) => {
    upload.on("finish", resolve);
    upload.on("error", reject);
    upload.end(buffer);
  });
  return visibility === "private" ? privateMediaReference(upload.id) : publicMediaReference(upload.id);
}

export async function saveDataUri(dataUri, options = {}) {
  if (!mediaEnabled() || typeof dataUri !== "string" || !dataUri.startsWith("data:")) return dataUri;
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([a-zA-Z0-9+/=]+)$/.exec(dataUri);
  if (!match) throw Object.assign(new Error("Invalid Base64 media upload."), { status: 400 });
  return saveBuffer(Buffer.from(match[2], "base64"), { ...options, mimeType: match[1].toLowerCase() });
}

export function storeImageFields(fieldNames) {
  return async (req, res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method) || !mediaEnabled()) return next();
    try {
      for (const field of fieldNames) {
        const value = req.body?.[field];
        if (Array.isArray(value)) {
          req.body[field] = await Promise.all(value.map(v => saveDataUri(v, { ownerId: req.user?.id, name: field })));
        } else if (typeof value === "string") {
          req.body[field] = await saveDataUri(value, { ownerId: req.user?.id, name: field });
        }
      }
      next();
    } catch (error) { res.status(error.status || 503).json({ message: error.message || "Media upload failed." }); }
  };
}

function signature(id, expiry) {
  return createHmac("sha256", process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET)
    .update(`${id}:${expiry}`).digest("hex");
}
export function signedPrivateReference(value, ttlSeconds = 900) {
  const id = String(value || "").match(/\/api\/media\/private\/([a-f0-9]{24})$/i)?.[1];
  if (!id) return value;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${value}?expires=${expires}&sig=${signature(id, expires)}`;
}
export function validPrivateSignature(id, expires, sig) {
  const expiry = Number(expires);
  if (!Number.isSafeInteger(expiry) || expiry < Date.now() / 1000 || expiry > Date.now() / 1000 + 3600) return false;
  const expected = Buffer.from(signature(id, expiry), "hex");
  const candidate = Buffer.from(String(sig || ""), "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}
export function attachmentForClient(attachment) {
  if (!attachment) return attachment;
  const value = attachment.toObject ? attachment.toObject() : attachment;
  return { ...value, dataUrl: signedPrivateReference(value.dataUrl) };
}
