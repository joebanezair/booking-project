import test from "node:test";
import assert from "node:assert/strict";
import { databaseFingerprint } from "../lib/databaseFingerprint.js";

test("MongoDB connection fingerprint is stable and never reveals credentials", () => {
  const originalUri = process.env.MONGO_URI;
  const originalSecret = process.env.JWT_SECRET;
  try {
    process.env.MONGO_URI = "mongodb://user:secret-password@host-a:27017/booking_app";
    process.env.JWT_SECRET = "some-private-server-only-signing-key";
    const a = databaseFingerprint();
    assert.match(a, /^[a-f0-9]{16}$/);
    assert.equal(a, databaseFingerprint());
    assert.doesNotMatch(a, /password|mongodb|host-a/i);
    process.env.MONGO_URI = "mongodb://user:secret-password@host-b:27017/booking_app";
    assert.notEqual(a, databaseFingerprint());
  } finally {
    if (originalUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = originalUri;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
