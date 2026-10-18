# Concurrency audit — betta-vol1 (October 2026)

This is a **source review**, not a passed stress/concurrency test or production certification.

## Booking writes
- **Existing protection:** `bookingMutationGuard` acquires a MongoDB-backed per-business lease for dashboard/public writers, serializing normal read/validate/create sequences across API replicas connected to the same MongoDB.
- **Risks:** The 120-second lease expires without renewal. A long operation, process pause, or transient database failure could permit overlapping holders; response-based release can happen before all detached operations finish. Lease-based scheduling is not equivalent to a database-enforced capacity reservation. Verify reschedule, cancellations, guest submission retries, and service capacity greater than one under parallel load.
- **Required before 100K concurrency:** atomic slot/capacity reservations (or transactional capacity ledger), stable idempotency keys for duplicate submissions, lease fencing/renewal if retained, and parallel load tests.

## POS and stock
- **Existing protection:** `deductInventory` uses `findOneAndUpdate` with `stock: {$gte: quantity}` and `$inc` for each SKU. This prevents negative quantities from simultaneous atomic decrements.
- **Applied improvement:** repeated product lines are aggregated by product ID before deduction, so the total demand is checked in one conditional decrement per SKU.
- **Risks:** sequential decrements followed by compensation are **not atomic across multiple products**; a process crash between stock writes and sale creation can leave inconsistencies. Inventory movement logging can also be inconsistent if a later write fails. The order completion status path uses read-modify-save without a compare-and-swap guard, so two concurrent completion requests may double-deduct stock. A product edit can overwrite stock while checkout proceeds. Online orders currently reserve no stock at order submission and deduct on completion.
- **Required before 100K concurrency:** MongoDB replica-set-backed multi-document transactions for stock/sales/movements; conditional one-time order state transitions; unique idempotency keys and request replay handling; validate all quantity inputs; test duplicate item lines, parallel POS/checkouts, cancellations, payment retries and backend termination between writes.

## Redis/realtime
- **Implemented opt-in integration:** `REDIS_URL` enables Redis-backed anonymous public response caching and Socket.IO Redis adapter. Redis version-based forum invalidation propagates across API replicas. Without `REDIS_URL`, short-lived local cache and local Socket.IO behavior remain.
- **Dependencies:** optional `redis` and `@socket.io/redis-adapter` packages must be installed and the lockfile committed by the deployment operator. These packages are **not** currently included in committed server lockfile. Do not enable REDIS_URL before installing packages.
- **Operational risks:** Socket.IO polling still requires sticky load-balancer routing or websocket-only transport; Redis outages must be tested. Cached public service browse may remain stale for up to 15 seconds after publishing changes; changing forum posts emits an update and increments a Redis version, but existing local caching does not coordinate if Redis is disabled across multiple replicas.

## Verification checklist
1. Start MongoDB with replica-set transactions configured in staging and seed realistic products/bookings.
2. Verify duplicate simultaneous completion cannot decrement inventory twice (currently **not guaranteed**).
3. Kill a worker between inventory decrement and sale persistence and verify rollback/repair (currently **not guaranteed**).
4. Run collision tests for two guests booking the final slot, including slow handlers that exceed lease duration.
5. Verify Redis cache read/write and forum invalidation between two API processes after installing optional packages.
6. Verify Socket.IO room broadcast across both processes, sticky routing/polling, reconnects and Redis interruption.
7. Run repeatable load tests with p95/p99, failure rate, DB utilization and queue lag; do not declare the 100K target met based on unit tests.

**Production release blocker:** Do not scale transactional booking/POS paths to multi-replica high throughput until the above correctness gaps are fixed and verified.
