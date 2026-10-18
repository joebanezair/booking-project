// Bounded, per-process cache for explicitly public, non-personalized JSON GET routes.
// Never use for bookings, stock, sales, authenticated responses, or writes.
export function publicJsonCache({ ttlMs = 15_000, maxEntries = 100 } = {}) {
  const cache = new Map();
  return (req, res, next) => {
    const configuredTtl = process.env.CACHE_PUBLIC_TTL_MS;
    const ttl = configuredTtl === undefined ? ttlMs : Number(configuredTtl);
    if (req.method !== "GET" || !Number.isFinite(ttl) || ttl <= 0 ||
        req.headers?.authorization || req.headers?.cookie) return next();

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
}
