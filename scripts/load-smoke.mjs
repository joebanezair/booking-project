// Local, bounded HTTP smoke/load probe. Not a substitute for distributed stress testing.
// Usage: node scripts/load-smoke.mjs [baseUrl] [concurrency] [totalRequests]
const base = process.argv[2] || "http://127.0.0.1:5000";
const concurrency = Number(process.argv[3] || 10);
const total = Number(process.argv[4] || 200);
const parsed = new URL(base);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  console.error("This lightweight probe only permits localhost. Use an approved load-test environment for remote targets.");
  process.exit(1);
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50 ||
    !Number.isInteger(total) || total < 1 || total > 5000) {
  console.error("Concurrency must be 1–50 and total requests must be 1–5000.");
  process.exit(1);
}
let cursor = 0;
const durations = [];
const statuses = new Map();
const started = performance.now();
async function worker() {
  while (cursor < total) {
    cursor++;
    const begin = performance.now();
    let status = "NETWORK_ERROR";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(new URL("/api/public/browse", parsed), { signal: controller.signal, headers: { "Accept": "application/json" } });
        status = String(response.status);
        await response.arrayBuffer();
      } finally { clearTimeout(timeout); }
    } catch {}
    durations.push(performance.now() - begin);
    statuses.set(status, (statuses.get(status) || 0) + 1);
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
durations.sort((a,b)=>a-b);
const percentile = p => Math.round(durations[Math.min(durations.length-1, Math.ceil(durations.length*p)-1)]);
console.log(JSON.stringify({
  target: new URL("/api/public/browse", parsed).href,
  concurrency, requests: total, statuses: Object.fromEntries(statuses),
  elapsedSeconds: Number(((performance.now()-started)/1000).toFixed(2)),
  latencyMs: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) }
}, null, 2));
