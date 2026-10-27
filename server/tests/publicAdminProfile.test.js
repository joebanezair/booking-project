import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("administrator public page is anonymous and returns only approved profile fields", () => {
  const publicSource = read("../routes/public.js");
  const routeStart = publicSource.indexOf('router.get("/admin/:username", async (req, res) => {');
  const nextRoute = publicSource.indexOf('router.get("/profile/:username"', routeStart);
  assert.ok(routeStart >= 0 && nextRoute > routeStart, "Admin public profile route is available without authentication");
  const route = publicSource.slice(routeStart, nextRoute);
  assert.match(route, /role: "admin"/);
  assert.match(route, /accountStatus: "active"/);

  const selected = route.match(/\.select\("([^"]+)"\)\.lean\(\)/);
  assert.ok(selected, "Query must explicitly project admin public fields");
  const expected = [
    "name", "username", "headline", "bio", "location", "website",
    "profileImage", "profileImagePositionX", "profileImagePositionY", "coverImage", "createdAt"
  ];
  assert.deepEqual(selected[1].split(/\s+/).sort(), expected.sort());
  for (const field of ["email", "passwordHash", "role", "featureAccess", "friends", "friendRequests", "blockedUsers", "restrictedUsers"]) {
    assert.doesNotMatch(selected[1], new RegExp(`\\b${field}\\b`));
  }
});

test("public discovery includes active admin profiles without account secrets", () => {
  const source = read("../routes/public.js");
  const search = source.slice(source.indexOf('router.get("/search"'), source.indexOf('router.get("/book/:userId"'));
  assert.match(search, /const adminsPipeline = \[/);
  assert.match(search, /role: "admin", accountStatus: "active"/);
  assert.match(search, /User\.aggregate\(adminsPipeline\)/);
  assert.match(search, /admins: adminRows\.slice\(0, limit\)/);
  const adminProjection = search.slice(search.indexOf("const adminsPipeline = ["), search.indexOf("const [userRows,"));
  assert.doesNotMatch(adminProjection, /email|passwordHash|featureAccess|friends|permissions/);
});

test("administrator profile editor is private while public page is shareable", () => {
  const app = read("../../client/src/App.jsx");
  const profileEditor = read("../../client/src/pages/ProfileSettingsPage.jsx");
  const adminPage = read("../../client/src/pages/PublicAdminProfilePage.jsx");
  assert.match(app, /path="\/dashboard\/profile\/edit" element=\{protectedPage\(ProfileSettingsPage\)\}/);
  assert.match(app, /path="\/admin\/:username" element=\{<PublicAdminProfilePage user=\{user\} \/>\}/);
  assert.match(profileEditor, /api\.profile\.update\(form\)/);
  assert.match(profileEditor, /View public profile/);
  assert.match(adminPage, /api\.publicAdminProfile\(username\)/);
});
