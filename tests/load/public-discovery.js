// Smoke / ramp load test: run k6 run -e BASE_URL=https://your-api.example tests/load/public-discovery.js
// Exercise public discovery without changing production data.
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errors = new Rate("bookflow_api_errors");
const latency = new Trend("bookflow_api_latency", true);
const base = (__ENV.BASE_URL || "http://localhost:5000").replace(/\/$/, "");
export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "30s", target: 0 }
  ],
  thresholds: {
    bookflow_api_errors: ["rate<0.01"],
    bookflow_api_latency: ["p(95)<800"]
  }
};
export default function () {
  const q = encodeURIComponent(__ENV.SEARCH_TERM || "");
  const path = Math.random() < 0.7
    ? `/api/public/search?q=${q}&page=1`
    : "/api/public/browse";
  const response = http.get(base + path, { tags: { endpoint: path.startsWith("/api/public/search") ? "search" : "browse" } });
  const success = check(response, { "HTTP 200": r => r.status === 200 });
  errors.add(!success);
  latency.add(response.timings.duration);
  sleep(1);
}
