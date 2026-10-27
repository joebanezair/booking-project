import test from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_PREFERENCE_KEYS, normalizeDashboardPreferences } from "../lib/dashboardPreferences.js";

test("a business dashboard can persist individual hidden widgets", () => {
  const saved = normalizeDashboardPreferences("businessWidgets", { statSales: false, quickServices: true });
  assert.equal(saved.statSales, false);
  assert.equal(saved.quickServices, true);
  assert.equal(saved.setupChecklist, true);
  assert.equal(Object.keys(saved).length, DASHBOARD_PREFERENCE_KEYS.businessWidgets.length);
});

test("an admin dashboard can persist hidden statistics", () => {
  const saved = normalizeDashboardPreferences("adminMetrics", { revenue: false, bookings: true });
  assert.equal(saved.revenue, false);
  assert.equal(saved.bookings, true);
  assert.equal(Object.keys(saved).length, DASHBOARD_PREFERENCE_KEYS.adminMetrics.length);
});

test("a dashboard only accepts known boolean visibility fields", () => {
  assert.equal(normalizeDashboardPreferences("businessWidgets", { statSales: "false" }), null);
  assert.equal(normalizeDashboardPreferences("businessWidgets", { unknown: false }), null);
  assert.equal(normalizeDashboardPreferences("businessWidgets", []), null);
  assert.equal(normalizeDashboardPreferences("businessWidgets", null), null);
  assert.equal(normalizeDashboardPreferences("other", { revenue: false }), null);
  assert.equal(normalizeDashboardPreferences("__proto__", { revenue: false }), null);
  assert.equal(normalizeDashboardPreferences("constructor", { revenue: false }), null);
});
