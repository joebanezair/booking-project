// Conservative single-process protection. Use Nginx/Redis for distributed production limits.
const windows = new Map();
export function localRateLimit({ windowMs = 60_000, max = 60 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    if (windows.size > 20_000) {
      for (const [key, state] of windows) if (state.reset <= now) windows.delete(key);
    }
    const key = req.ip + ":" + req.baseUrl + ":" + req.path;
    let state = windows.get(key);
    if (!state || state.reset <= now) state = { count: 0, reset: now + windowMs };
    state.count += 1;
    windows.set(key, state);
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - state.count));
    if (state.count > max) {
      res.setHeader("Retry-After", Math.ceil((state.reset - now) / 1000));
      return res.status(429).json({ message: "Too many requests. Try again shortly." });
    }
    next();
  };
}
