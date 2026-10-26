import test from "node:test";
import assert from "node:assert/strict";
import { featureStatus, featureSummary } from "../lib/featureAccess.js";

test("legacy accounts retain both features by default", () => {
  assert.equal(featureStatus({}, "pos").active, true);
  assert.equal(featureSummary({}).booking.active, true);
});
test("a deactivated feature is inaccessible", () => {
  assert.equal(featureStatus({ featureAccess: { pos: { enabled: false } } }, "pos").active, false);
});
test("feature expiry is enforced at exact boundary", () => {
  const account = { featureAccess: { booking: { enabled: true, expiresAt: "2026-10-30T00:00:00.000Z" } } };
  assert.equal(featureStatus(account, "booking", new Date("2026-10-29T23:59:59Z")).active, true);
  assert.equal(featureStatus(account, "booking", new Date("2026-10-30T00:00:00Z")).expired, true);
  assert.equal(featureStatus(account, "booking", new Date("2026-10-30T00:00:00Z")).active, false);
});
test("a feature does not expire if expiration is omitted", () => {
  assert.equal(featureStatus({ featureAccess: { pos: { enabled: true, expiresAt: null } } }, "pos").active, true);
});
