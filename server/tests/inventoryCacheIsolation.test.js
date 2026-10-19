import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("sensitive sales and inventory endpoints never use public response caching", () => {
  const sales = read("../routes/sales.js");
  assert.doesNotMatch(sales, /publicJsonCache/);
  assert.match(sales, /router\.use\(\(_req, res, next\) => \{ res\.set\("Cache-Control", "no-store"\); next\(\); \}\);/);
  assert.match(sales, /findOneAndUpdate\([\s\S]*?stock: \{ \$gte: line\.quantity \}/);
  assert.match(sales, /\$inc: \{ stock: -line\.quantity \}/);
});

test("storefront stock and guest online order responses bypass HTTP caches", () => {
  const publicRoutes = read("../routes/public.js");
  assert.match(publicRoutes,
    /router\.get\("\/profile\/:username", optionalAuth, async \(req, res\) => \{\s*res\.set\("Cache-Control", "no-store"\)/);
  assert.match(publicRoutes,
    /router\.post\("\/products\/:userId\/order", async \(req, res\) => \{\s*res\.set\("Cache-Control", "no-store"\)/);
  const cacheApplications = [...publicRoutes.matchAll(/publicJsonCache\(/g)];
  assert.equal(cacheApplications.length, 1, "Public browsing must be the only public route with JSON caching");
  assert.match(publicRoutes, /router\.get\("\/browse", publicJsonCache\(\)/);
});

test("response cache only serves anonymous GET and never stores error responses", () => {
  const cache = read("../middleware/publicJsonCache.js");
  assert.match(cache, /req\.method !== "GET"/);
  assert.match(cache, /req\.headers\?\.authorization/);
  assert.match(cache, /req\.headers\?\.cookie/);
  assert.match(cache, /res\.statusCode === 200/);
});
