import mongoose from "mongoose";

// Cursor encodes the ordered booking tuple, not an offset that gets slower
// as the booking table grows. Parsing is deliberately strict and bounded.
export function encodeBookingCursor(row) {
  return Buffer.from(JSON.stringify([new Date(row.bookingDate).toISOString(), String(row._id)]))
    .toString("base64url");
}

export function decodeBookingCursor(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,150}$/.test(value)) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const pair = JSON.parse(decoded);
    if (!Array.isArray(pair) || pair.length !== 2 || !mongoose.isValidObjectId(pair[1])) return null;
    const date = new Date(pair[0]);
    if (typeof pair[0] !== "string" || Number.isNaN(date.getTime()) || date.toISOString() !== pair[0]) return null;
    return { bookingDate: date, id: new mongoose.Types.ObjectId(pair[1]) };
  } catch { return null; }
}

export function readPageSize(value, maximum = 100) {
  if (!/^[1-9]\d{0,2}$/.test(String(value || ""))) return null;
  const n = Number(value);
  return n >= 1 && n <= maximum ? n : null;
}
