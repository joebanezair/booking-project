import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicMediaInput, signedPrivateReference, validPrivateSignature
} from "../lib/mediaStore.js";

process.env.JWT_SECRET = "test-only-secret-that-is-more-than-thirty-two-characters";
process.env.MEDIA_PUBLIC_BASE_URL = "https://api.example.test";
const id = "507f1f77bcf86cd799439011";

test("Only expected public image references are accepted", () => {
  assert.equal(publicMediaInput(`/api/media/public/${id}`), true);
  assert.equal(publicMediaInput(`https://api.example.test/api/media/public/${id}`), true);
  assert.equal(publicMediaInput("https://untrusted.test/api/media/public/" + id), false);
  assert.equal(publicMediaInput("https://api.example.test/anything-else"), false);
});

test("Private media signatures expire and cannot be altered", () => {
  const url = signedPrivateReference(`https://api.example.test/api/media/private/${id}`);
  const parsed = new URL(url);
  const expires = parsed.searchParams.get("expires");
  const sig = parsed.searchParams.get("sig");
  assert.equal(validPrivateSignature(id, expires, sig), true);
  assert.equal(validPrivateSignature("507f1f77bcf86cd799439012", expires, sig), false);
  assert.equal(validPrivateSignature(id, 1, sig), false);
  assert.equal(validPrivateSignature(id, expires, "0".repeat(64)), false);
});
