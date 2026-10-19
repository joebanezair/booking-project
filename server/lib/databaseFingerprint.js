import { createHmac } from "node:crypto";

// A stable, non-reversible label for the backend's effective database connection.
// Never include the MongoDB URI (which may contain credentials) in API responses.
export function databaseFingerprint() {
  const uri = process.env.MONGO_URI;
  const key = process.env.JWT_SECRET;
  if (!uri || !key) return null;
  return createHmac("sha256", key).update(uri).digest("hex").slice(0, 16);
}
