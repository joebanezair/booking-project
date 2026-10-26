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
