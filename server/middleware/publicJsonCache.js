import { createHash } from "node:crypto";
import { getRedisCacheClient } from "../lib/distributedRedis.js";
// Bounded, per-process cache for explicitly public, non-personalized JSON GET routes.
// Never use for bookings, stock, sales, authenticated responses, or writes.
export function publicJsonCache({ ttlMs = 15_000, maxEntries = 100, namespace = "public" } = {}) {
  const cache = new Map();
  const middleware = (req, res, next) => {
    const configuredTtl = process.env.CACHE_PUBLIC_TTL_MS;
    const ttl = configuredTtl === undefined ? ttlMs : Math.min(ttlMs, Number(configuredTtl));
    if (req.method !== "GET" || !Number.isFinite(ttl) || ttl <= 0 ||
        req.headers?.authorization || req.headers?.cookie) return next();

    const client = getRedisCacheClient();
    if (client) {
      res.setHeader("Cache-Control", "no-store");
      const versionKey = `bookflow:cache:${namespace}:version`;
      const urlHash = createHash("sha256").update(req.originalUrl || req.url).digest("hex");
      void (async () => {
        try {
          const version = await client.get(versionKey) || "0";
          const redisKey = `bookflow:cache:${namespace}:${version}:${urlHash}`;
          const hit = await client.get(redisKey);
          if (hit !== null) {
            res.setHeader("X-Cache", "HIT");
            return res.json(JSON.parse(hit));
          }
          res.setHeader("X-Cache", "MISS");
          const originalJson = res.json.bind(res);
          res.json = body => {
            if (res.statusCode === 200 && !res.getHeader("Set-Cookie") &&
                !res.getHeader("WWW-Authenticate")) {
              void client.set(redisKey, JSON.stringify(body), { PX: ttl }).catch(error =>
                console.error("Redis cache write failed:", error.message));
            }
            return originalJson(body);
          };
          next();
        } catch (error) {
          console.error("Redis cache read unavailable:", error.message);
          next();
        }
      })();
      return;
    }

    const key = req.originalUrl || req.url;
    const now = Date.now();
    const existing = cache.get(key);
    res.setHeader("Cache-Control", "no-store");
    if (existing && existing.expiresAt > now) {
      res.setHeader("X-Cache", "HIT");
      return res.json(existing.body);
    }
    if (existing) cache.delete(key);
    res.setHeader("X-Cache", "MISS");
    const sendJson = res.json.bind(res);
    res.json = body => {
      if (res.statusCode === 200 && !res.getHeader("Set-Cookie") &&
          !res.getHeader("WWW-Authenticate")) {
        // Evict expired/oldest records to bound memory usage.
        for (const [entryKey, entry] of cache) {
          if (entry.expiresAt <= now) cache.delete(entryKey);
        }
        while (cache.size >= maxEntries && cache.size > 0) {
          cache.delete(cache.keys().next().value);
        }
        if (maxEntries > 0) cache.set(key, { body, expiresAt: Date.now() + ttl });
      }
      return sendJson(body);
    };
    next();
  };
  middleware.clear = () => {
    cache.clear();
    const client = getRedisCacheClient();
    if (client) void client.incr(`bookflow:cache:${namespace}:version`).catch(error =>
      console.error("Redis cache invalidation failed:", error.message));
  };
  return middleware;
}
