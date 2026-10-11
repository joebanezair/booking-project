import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { encodeBookingCursor, decodeBookingCursor, readPageSize } from "../lib/pagination.js";

test("Booking cursors round-trip ordered booking date and ObjectId", () => {
  const row = { bookingDate: new Date("2027-02-10T08:30:00.000Z"), _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011") };
  const cursor = decodeBookingCursor(encodeBookingCursor(row));
  assert.equal(cursor?.bookingDate.toISOString(), row.bookingDate.toISOString());
  assert.equal(String(cursor?.id), String(row._id));
});

test("Invalid page limits and malformed cursor values are rejected", () => {
  for (const bad of ["-5", "0", "101", "1.2", "1e3", "Infinity", "abc"]) assert.equal(readPageSize(bad), null);
  assert.equal(readPageSize("100"), 100);
  assert.equal(readPageSize("50"), 50);
  for (const bad of ["<script>", "Zg", "a".repeat(151), Buffer.from('["notadate","507f1f77bcf86cd799439011"]').toString("base64url")]) {
    assert.equal(decodeBookingCursor(bad), null);
  }
});
