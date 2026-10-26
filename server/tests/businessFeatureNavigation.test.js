import test from "node:test";
import assert from "node:assert/strict";
import { hasBusinessFeature } from "../../client/src/featureAccess.js";

test("legacy businesses can access services", () => {
  assert.equal(hasBusinessFeature({ role: "business" }, "booking"), true);
});
test("deactivating booking blocks Services even if POS is enabled", () => {
  const user = { role: "business", featureAccess: { booking: { enabled: false, active: false }, pos: { enabled: true, active: true } } };
  assert.equal(hasBusinessFeature(user, "booking"), false);
  assert.equal(hasBusinessFeature(user, "pos"), true);
});
test("expired plans hide Services based on current date", () => {
  const user = { role: "business", featureAccess: { booking: { enabled: true, active: true, expiresAt: "2026-10-30T00:00:00Z" } } };
  assert.equal(hasBusinessFeature(user, "booking", Date.parse("2026-10-29T23:59:59Z")), true);
  assert.equal(hasBusinessFeature(user, "booking", Date.parse("2026-10-30T00:00:00Z")), false);
});
test("admin and anonymous users are never granted business-only routes", () => {
  assert.equal(hasBusinessFeature({ role: "admin" }, "booking"), false);
  assert.equal(hasBusinessFeature(null, "booking"), false);
});

test("deactivating POS blocks Products while Services stays accessible", () => {
  const user = { role: "business", featureAccess: {
    pos: { enabled: false, active: false },
    booking: { enabled: true, active: true }
  } };
  assert.equal(hasBusinessFeature(user, "pos"), false);
  assert.equal(hasBusinessFeature(user, "booking"), true);
});

test("an expired POS plan blocks products at the expiration boundary", () => {
  const user = { role: "business", featureAccess: {
    pos: { enabled: true, active: true, expiresAt: "2026-11-01T00:00:00Z" }
  } };
  assert.equal(hasBusinessFeature(user, "pos", Date.parse("2026-10-31T23:59:59Z")), true);
  assert.equal(hasBusinessFeature(user, "pos", Date.parse("2026-11-01T00:00:00Z")), false);
});

test("legacy business accounts retain Products access", () => {
  assert.equal(hasBusinessFeature({ role: "business" }, "pos"), true);
});
