// Destructive staging-only race test. Requires a brand-new, unbooked UTC slot,
// capacity=1, and an active public business. Never point this at production.
// k6 run -e CONFIRM_STAGING_ONLY=1 -e BASE_URL=https://staging-api.example \
//   -e BUSINESS_USER_ID=... -e CONTENT_ID=... -e BOOKING_DATE=2027-01-11T08:00:00.000Z \
//   tests/load/booking-concurrency.js
import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const base = String(__ENV.BASE_URL || "").replace(/\/$/, "");
const owner = __ENV.BUSINESS_USER_ID;
const content = __ENV.CONTENT_ID;
const date = __ENV.BOOKING_DATE;
if (__ENV.CONFIRM_STAGING_ONLY !== "1" || !base || !owner || !content || !date ||
    /(?:localhost|127\.0\.0\.1)/.test(base) || /production|prod\./i.test(base)) {
  throw new Error("Staging-only destructive test: set CONFIRM_STAGING_ONLY=1, staging BASE_URL, BUSINESS_USER_ID, CONTENT_ID and BOOKING_DATE.");
}

const accepted = new Counter("bookings_accepted");
const conflict = new Counter("bookings_conflicted");
export const options = {
  scenarios: {
    simultaneous_slot: { executor: "shared-iterations", vus: 10, iterations: 10, maxDuration: "40s" }
  },
  thresholds: {
    bookings_accepted: ["count==1"]
  }
};

export default function () {
  const payload = JSON.stringify({
    contentId: content,
    guestName: "Staging Race " + __VU + "-" + __ITER,
    guestEmail: "race-" + __VU + "-" + __ITER + "@example.test",
    guestPhone: "+639001234567",
    service: "Concurrency test",
    bookingDate: date
  });
  const response = http.post(base + "/api/public/book/" + owner, payload, {
    headers: { "Content-Type": "application/json" }
  });
  if (response.status === 201) accepted.add(1);
  if (response.status === 409) conflict.add(1);
  check(response, { "accepted or safely rejected": r => r.status === 201 || r.status === 409 });
}
