## Online orders automatically use inventory and deduct stock on completion — October 19, 2026

When customers order online, the storefront records the actual business-owned inventory product ObjectId and purchased quantity. Businesses **do not select or link products again** in the Online Orders editor. Upon **Complete sale**, the backend resolves the saved reference, checks total quantity across duplicate lines, conditionally decrements the current stock, writes an inventory movement, then marks the order completed. The selected product and original sale price are not changed by the operator.

For older orders with a stale or missing product ObjectId, completion safely resolves only a **unique** matching SKU or normalized (case/whitespace-insensitive) product name in that same business inventory. If a matching product does not exist or multiple possible products are ambiguous, the server returns a 409 conflict and **does not guess or create stock**. Active-order products cannot be deleted through the ordinary product delete endpoint.

Stock is deducted on successful sale completion, **not at initial online order submission**. MongoDB's per-product conditional decrement protects against negative stock. Multi-product deduction, inventory history and order persistence are **not yet one crash-safe transaction**; replica-set-backed transactions, idempotent request keys, and real integration/load tests remain production blockers. Unit tests cover the automatic resolver; real database checkout was not tested in this change.

## betta-vol1 incremental sales concurrency hardening — October 19, 2026

- POS rejects non-integer, non-positive and greater-than-999 item quantities instead of silently clamping malformed input. Repeated SKU quantities are checked for safe-integer overflow.
- POS checkout, order status/payment/details updates, and product edit/deletion now share the existing MongoDB per-business booking mutation lease. This reduces overlapping writes among participating routes across API replicas that share a MongoDB primary. The lease is temporary (120 seconds), has no renewal/fencing, and is **not** a transaction or crash-safe inventory reservation.
- CI now runs for direct pushes to `betta-vol1` in addition to the pre-existing branches.
- Remaining release blockers: move stock updates, movement history, and POS/order persistence into MongoDB multi-document transactions on a replica set; add durable idempotency/unique request keys and atomic order state transitions; add coverage for crashes, retries and multiple API replicas. Redis dependencies/lockfile and real load testing still need completion. Do not claim 100K concurrent-user readiness.

# BookFlow — Business Booking and Service Platform

BookFlow is a full-stack MERN application for service businesses. The account model is intentionally simple:

- **Business** — the normal registered account. Businesses register immediately, maintain a public profile, publish services, receive guest bookings, manage appointments, message other registered accounts, receive notifications, participate in the forum, and manage settings.
- **Admin** — a privileged platform operator. Admins manage business accounts and can pause, reactivate, or disable them. Admins do not approve normal business registration.
- **Guest** — not an account type. Public visitors can search businesses and services, view public profiles, and create booking requests without registering.

There is no customer account role and no customer-to-business approval workflow.

## Dashboard header and adaptive sidebar — October 11, 2026

On the **`betta-vone`** branch, the signed-in workspace header and sidebar were refined to match the latest approved behavior:

- The dashboard header **does not display the date-range picker**. Sales and booking-status analytics use the **current month** by default. Other analytics controls on their dedicated pages remain unchanged.
- The shared search field has a true **10px radius**; submitting still opens the existing public Search page with the typed query.
- The top-right account menu now shows the **saved profile photograph** in a real circle (or a circular initial if no photo is uploaded). A **green Online chip and avatar dot** reflect the browser's `navigator.onLine` state, changing to gray Offline on browser offline events. This is a local network-connection indicator, **not server-side presence for other users**. Profile, Settings, and Sign out remain available in the dropdown.
- The desktop sidebar starts as a **76px icon-only rail**, automatically expands to **235px** while hovered or when navigation receives keyboard focus, and collapses when neither is true. No glowing left-edge active marker. The More disclosure, notification count, route permissions, and account footer remain intact.
- Mobile screens retain the existing labeled drawer and bottom shortcuts; reduced-motion preferences disable width transitions.
- Implementation: `client/src/workspace-header-rail.css` (loaded last), `client/src/components/AppLayout.jsx`, and `client/src/pages/DashboardPage.jsx`. The source audit verifies these controls and prevents reintroducing the header date picker.
- Review the drawer on desktop with a mouse and keyboard (Tab/Shift+Tab), verify the avatar in both themes, and test the mobile drawer after reloading.

## Full-page dashboard redesign — October 11, 2026

The approved BookFlow business dashboard design is implemented on **`betta-vone`**, while keeping the existing booking, sales, profile, search and account workflows.

- **Persistent desktop drawer (235px):** Workspace and Activity groups, accessible More dropdown (expanded by default), same role-filtered URLs, notification badge, and signed-in account identity at the footer. Active page now has a soft blue background with **no glowing left border**. The existing mobile slide-out drawer and bottom navigation still function.
- **Workspace header:** Search businesses, services and products from any signed-in workspace page; submitting opens the existing `/search?q=...` page with the query filled in. On the dashboard, the calendar range selector switches between Today, Last 7 days, This Month, This Year, and All Time. The account dropdown exposes Profile (business users), Settings, and Sign out with keyboard and outside-click dismissal.
- **Live KPI row:** Four equal desktop cards (recorded sales, completed services, average sale and services sold), using the existing sales analytics endpoint. A sparkline renders only when actual trend data supports it; no fake upward trends or imaginary comparisons.
- **Sales Overview:** Switch between Sales (real recorded sales), Completed (real completed-service records), and Services (actual service-sales breakdown), with a link to Full analytics. A quiet empty state replaces misleading zero-growth projections.
- **Visual alignment correction:** Dashboard analytics remain side by side as Sales Overview, Service Status, and Top Services on normal desktop widths; Top Services no longer drops into an oversized second row at the old 1280px breakpoint. Booking donut and empty-state icon backgrounds are true circles. Single-point sales/completion data displays a labeled factual summary instead of a disconnected chart dot. Mobile/tablet fallbacks still stack panels when needed.
- **Service status:** Donut and numeric breakdown for completed, upcoming (pending/confirmed/in-progress), and cancelled/no-show bookings. A new indexed-filter-friendly MongoDB aggregation route `GET /api/bookings/status-summary?range=month&offset=...` produces counts for the signed-in business and selected date window without fetching all bookings into the browser.
- **Top Services:** Up to five actual completed service categories from recorded sales. Shows a genuine empty state when there is no data.
- **Quick access:** All seven original destination cards (including Search) remain in a consistent responsive grid.
- **Responsive:** Four/two/one KPI columns; compact analytics grid; appropriately stacked mobile panels; theme-aware surfaces. No third-party UI framework or illustration asset was added.
- **Files:** `client/src/components/DashboardAnalytics.jsx`, `client/src/components/AppLayout.jsx`, `client/src/pages/DashboardPage.jsx`, `client/src/components/SalesCharts.jsx`, `client/src/pages/SearchPage.jsx`, `client/src/dashboard-fullpage.css`, `server/routes/bookings.js`, `client/src/api.js` and `client/src/main.jsx`. Source-level UI guards are in `client/scripts/audit-ui.mjs`.
- **Validation:** GitHub CI checks the client build, UI audit, and server tests/syntax. Perform additional visual and interaction testing on your Codespace at desktop, tablet, and phone breakpoints in light and dark mode.

Update your workspace:

```bash
cd /workspaces/codespaces-blank/booking-project
git checkout betta-vone && git pull origin betta-vone
```

## Sidebar navigation redesign — October 11, 2026

The `betta-vone` dashboard sidebar is reorganized to avoid the tall, permanently visible scrollbar shown on smaller desktop windows, while retaining every page.

- **Workspace:** Dashboard, Services, Bookings, Sales, Products; administrators additionally see Businesses, using existing role rules.
- **Activity:** Messages and Notifications, including the unread notification badge.
- **More dropdown:** Profile (business accounts), Forum, Settings, and Search. Click or press Enter/Space to expand; use Escape to close the existing mobile drawer. The dropdown opens automatically for deep-linked routes within More, and can be manually collapsed.
- **Reduced vertical space:** Compact 36px desktop link rows, 40px mobile drawer links, smaller icons and 10px corners. Existing blue active-page indicator remains.
- **Clean scrolling:** The navigation remains scrollable via wheel, keyboard, and touch when a screen is short, but the heavy browser scrollbar is visually hidden. The account footer stays separate.
- **Existing behavior retained:** Desktop icon rail expands on hover/focus; mobile drawer and bottom shortcuts still work; all original URLs and permissions are unchanged.
- **Files:** `client/src/components/AppLayout.jsx`, `client/src/sidebar-redesign.css`, and the final CSS import in `client/src/main.jsx`.
- **Check:** `node client/scripts/audit-ui.mjs` guards all 12 registered routes, the More disclosure and retained scrolling.

For final visual QA, test 375px and 768px mobile drawers, 1024px desktop sidebar, short browser-height scrolling, badge display, active links, keyboard navigation, and both light and dark themes.

## Compact product modal and sidebar refinement — October 11, 2026

On `betta-vone`, the product inventory **Add product** form and desktop/mobile sidebar have been refreshed without deleting any fields, product actions, or routes.

- **Add product dialog:** Uses the existing local shadcn-style `Dialog`, `Button`, `Input`, `Select`, `Textarea`, `Label`, and `Image` primitives; compact heading, aligned two-column SKU/currency and price/stock fields, independent form-body scrolling, and a persistent action footer.
- **Images and publishing:** The 8-image limit and remove-preview controls remain; the image uploader is a styled, keyboard-focusable file input instead of the default oversized picker. The Publish toggle is a genuine 17px checkbox with a visible label and description, replacing oversized checkbox styling.
- **Submission:** A busy state prevents accidental duplicate Create product requests. The existing product create, edit, delete, stock, image and checkout API workflows are preserved.
- **Navigation:** Every dashboard route, role filter, unread notification badge, mobile drawer/bottom navigation, and desktop hover expansion remains. The sidebar now has a subtle Workspace label, 40px aligned link rows, 10px rounded active item, clearer icon colors, quieter hover treatment and compact typography.
- **Business checklist:** Collapsed by default as requested; padding, header, progress and expanded step cards were reduced approximately 20% without changing any completion conditions or links.
- **Files:** `client/src/pages/ProductsPage.jsx`, `client/src/components/AppLayout.jsx`, `client/src/pages/DashboardPage.jsx`, `client/src/workspace-polish.css`, and `client/src/main.jsx`.
- **Verification:** CI runs `node client/scripts/audit-ui.mjs` and `npm run build`. Visual browser testing at 375/768/1440px with both light and dark themes is still required.

## Business setup checklist redesign — October 11, 2026

On `betta-vone`, the business dashboard setup checklist now follows the approved **Get Ready to Launch** design. Only the **business dashboard** changes; administrator stats, existing analytics and booking flows are unaffected.

- **Header:** Left-aligned onboarding title and supporting description, live completion percentage/count, and an illustrated rocket. The header remains an accessible, keyboard-operated expand/collapse control. Unfinished checklists begin expanded so the next tasks are easy to find.
- **Progress:** Semantic progress bar with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`, based on the same seven existing business setup conditions.
- **Checklist:** Seven unchanged destinations and completion checks, now shown as descriptive icon cards: three columns on wide desktops, two on tablets, and one on phones. Completed steps use a subtle green tint; remaining tasks use a neutral card style.
- **Compatibility:** Local shadcn-style `Card` and `Button asChild` components, theme-aware colors, 10px card corners, focus outlines, reduced-motion support, dark theme and no new image/CDN dependency. The rocket is a lightweight inline SVG, not an uploaded file.
- **Files:** `client/src/components/BusinessSetupChecklist.jsx`, `client/src/business-onboarding-refresh.css`, dashboard integration in `client/src/pages/DashboardPage.jsx`, and `client/src/main.jsx`.
- **Checks:** `node client/scripts/audit-ui.mjs` is part of CI and verifies all seven steps, disclosure/progress semantics, responsive grid CSS, and stylesheet load order. Run a browser visual review at 375px, 768px and 1440px for final spacing.

Refresh the Codespaces frontend after updating the branch:

```bash
git checkout betta-vone && git pull origin betta-vone
cd client && npm run dev -- --host 0.0.0.0
```

## Shadcn-style component modernization — October 11, 2026

**Branch:** `betta-vone` only. BookFlow's original theme variables, dark/light colors, existing features, routes, media data, and service/product/booking actions are preserved. The UI uses **local shadcn-style React primitives**, not an installed upstream shadcn/Radix/Tailwind component registry; migrating to Radix-based primitives remains a separate task.

### UI consistency sweep — October 11, 2026

- **All authored native buttons:** Repository UI audit confirms there are no raw `<button>` elements outside `client/src/components/ui/button.jsx`. The button primitive supports `variant`, `size`, `asChild`, `fullWidth`, `data-variant`, and `data-size`. Previously hardcoded button-styled navigation links (booking, dashboard, profiles, discovery, forum, service creation/edit and public booking CTA) now use `<Button asChild><Link ... /></Button>`.
- **Button fit:** Normal actions take only the room needed by their label/icon. Square icon buttons stay square (28px/32px), while deliberate full-width interactions (login, checkout, sidebar user rows, product-card selection, full-bleed image editing) remain full width. Long button labels wrap rather than extending past cards.
- **Exactly 10px radius:** Shared button, input/select/textarea, search-field, card, modal and image corners use 10px geometry through `--ui-control-radius`, `--ui-card-radius`, `--ui-image-radius` and scoped rules in `component-polish.css`. **Circular avatars remain circular**. Cover images retain their approved placement and top-corner rounding; full-bleed controls and modal backdrop are not treated as normal cards.
- **Profile/media consistency:** `ProfileMediaHeader` and `PublicProfilePage` cover photos now use the existing `components/ui/image.jsx` primitive rather than CSS `background-image`. Its error fallback also supports products, content thumbnails and profile avatars. There is **no official Image component in the upstream shadcn/ui registry**; the project intentionally implements a compatible local image primitive.
- **Spacing and alignment:** Buttons, search filters, profile catalog controls, action rows, product toolbars, rating controls, cards and dialogs use shared 8/10/12px gaps, min-width guards and mobile wrapping to reduce overlaps without losing actions, the grid/list toggle, ratings or media cropping.
- **Future-proofing:** New `client/scripts/audit-ui.mjs` runs in GitHub Actions for every push/PR; it fails if JSX reintroduces raw buttons/images or bypasses `Button asChild` for button-looking links, or if the geometry tokens and shared profile cover images go missing.

From the repository root, run:

```bash
node client/scripts/audit-ui.mjs
```

This is a **source and CI check**, not a promise of pixel-perfect rendering. Before release, inspect 320px, 375px, 768px, 1024px and 1440px viewports in both themes and interact with modal focus, profile image actions, buttons, POS checkout, search, chat and public bookings. The large historical stylesheet still has conflicting legacy `!important` rules that should be retired page by page after visual QA.

### Upgraded components

| Scope | Update |
| --- | --- |
| Shared search | Added `client/src/components/ui/search-field.jsx` (compact search icon/input/clear action, focus return and accessible labels); applied to public discovery, services, product inventory, POS cart, customers, public business profile and chat user search. |
| Layout CSS | Added `client/src/component-polish.css` **after** `shadcn-refresh.css` to scope responsive search/filter columns, unified control heights, product cards, dialogs, focus states and media layout without altering palette tokens. |
| Shared dialogs | Added `client/src/components/ui/dialog.jsx` with native modal `<dialog>`, keyboard Escape, focus containment, background inertness and backdrop click handling. Added `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` and `DialogFooter`. |
| Management actions | Business password reset/status confirmation, service deletion, product delete/checkout confirmation, manual payment and booking reschedule now use compact in-app modal confirmations instead of browser prompts or unsafe custom overlays. |
| Product inventory | Inventory cards now expose one native selectable product button and separate edit/delete buttons rather than nesting interactive controls inside a `role="button"` card. Grid and list modes remain. |
| Gallery and media | `ContentGallery` now has selectable image thumbnails without dropping any photos. Shared `Image` displays a themed fallback on image-load errors. Existing cover position and profile-photo editing logic remain. |
| Search correctness | Rating criteria are applied before service pagination (no hidden matches due to post-page filtering). The discovery endpoint now returns `hasMoreByType` so Load more corresponds to the active category, with an accessible loaded-results status. |
| Messaging | Search requests ignore stale asynchronous results; sending messages uses an in-flight lock and pending state to prevent accidental duplicate sends. |
| Notifications | Mark-as-read failures show errors and missing links no longer navigate to `#`. |

**Developer run (Codespaces):**

```bash
git fetch origin && git checkout betta-vone && git pull origin betta-vone
# Keep the existing MongoDB containers and backend from the setup instructions running.
cd client && npm ci && npm run dev -- --host 0.0.0.0
```

**Validation:** GitHub Actions `CI` runs `npm ci` and `npm run build` for React, syntax checks for backend JS, and existing backend unit tests. **This does not replace a browser-based visual and interaction regression**. Before production, test search at 375/768/1440px, grid/list layouts, images and upload previews, modal keyboard focus/Escape, checkouts, chat sending, both themes and account roles.

**Follow-up work:** Many older route-specific CSS rules remain in the large `styles.css`; those should be consolidated incrementally after screenshot/breakpoint review. Additional existing custom popovers, booking editor/product create-edit dialogs, and more complex rich text/menus are not yet migrated to Radix/shadcn registry components. Search rating aggregation also needs large-dataset benchmarking and optimized indexes/materialized summaries for 100K-scale deployments.

## Compact shadcn-style UI refresh — October 11, 2026

**Implemented on `betta-vone` without changing BookFlow's existing light/dark colors or its business functionality.**

- **Reusable shadcn-style primitives:** `client/src/components/ui/button.jsx`, `card.jsx`, `input.jsx`, `select.jsx`, `textarea.jsx`, `label.jsx`, `image.jsx`, `separator.jsx`, plus existing `badge.jsx`. These are **local shadcn-style React components**, not a claim that the upstream shadcn CLI, Tailwind or Radix registry has been installed.
- **Compact buttons:** Default **32px**, small **28px**, large **36px**, and 32px icon variants. Native-backed form and action buttons share compact spacing and readable font sizes, intentionally smaller than standard shadcn buttons. Existing primary, secondary, danger, and outline theme colors are preserved.
- **Cards and images:** Service, business, product, POS, booking, customer, forum, order, sales and dashboard card surfaces have matching neutral borders, restrained shadows, and rounded corners. Existing uploaded images, gallery actions, proportions, profile/photo cropping and cover opacity remain unchanged. Cards use the shared `Card` primitive where safe.
- **Forms:** Text inputs, dropdowns, text areas, labels, checkboxes and file inputs now share form primitives or compatible styling, while retaining required attributes, validation, state changes and submissions.
- **Dialog/menu appearance:** Existing booking/product/order/profile modal structures are preserved; shared styling unifies their borders, corners, spacing and focus treatments without replacing working behavior.
- **Same colors:** `client/src/shadcn-refresh.css` introduces only dimensions/spacing and references the **existing `--background`, `--card`, `--foreground`, `--primary`, `--secondary`, `--border`, `--ring`** and shadow variables defined in `client/src/styles.css`. It is imported last by `client/src/main.jsx`. No new color palette is applied.
- **Responsive and keyboard support:** Existing mobile layouts and navigation remain intact; focus-visible and reduced-motion styles are included.

**Run the redesigned frontend:**

```bash
git fetch origin && git checkout betta-vone && git pull origin betta-vone
cd client
npm ci
npm run dev -- --host 0.0.0.0
```

You must still run MongoDB and the backend in a separate terminal following [Run the project — Betta V1](#run-the-project--betta-v1). **A passing frontend build or CI check is not equivalent to a full visual/interaction audit**: verify images, modal focus, dark mode, mobile breakpoints, checkouts and permissions in a live browser before a production release.

## Button and interaction audit (Betta V1)

The React source has been scanned for button/link composition, click and form-submit handlers, accessible control names, failure feedback and accidental repeated submissions. The audit covers **49 JSX source files** and approximately **191 authored button component sites** (many render repeatedly at runtime). Targeted fixes were committed to `betta-vone` for service navigation links, shadcn-style `Button asChild`, cart and image control labels, forum replies, messages, public-profile errors, and duplicate POS/public-order submission.

Read [the detailed button audit and manual QA checklist](docs/button-audit.md).

**Scope:** This is a **static code audit**, not proof that every rendered button works. Login, data persistence, modal focus/keyboard access, server validation, permission states and interactions under network errors still require a browser-based end-to-end test run.

## Redis / multi-server Socket.IO setup — betta-vol1

**Status: opt-in integration committed; external packages and transactional concurrency fixes still required.**

The code connects to Redis when `REDIS_URL` is configured. It uses a shared cache for anonymous public GETs that explicitly have caching middleware, and the Socket.IO Redis adapter for cross-process broadcasts/rooms. With `REDIS_URL` unset the single-server development setup continues working as before.

### October 18, 2026 implementation summary

| Workstream | Current state | Relevant code |
| --- | --- | --- |
| Shared public cache | Opt-in Redis-backed JSON cache, with a local-memory fallback when `REDIS_URL` is unset | `server/middleware/publicJsonCache.js`, `server/lib/distributedRedis.js` |
| Forum invalidation | Redis namespace version changes on successful post/reply; local cache cleared in the current process | `server/routes/forum.js` |
| Socket.IO multi-server fanout | Redis adapter initialized on backend startup when configured; shutdown closes Redis clients | `server/server.js`, `server/lib/distributedRedis.js` |
| POS repeated-SKU handling | Quantities are grouped per product before conditional stock deduction | `server/routes/sales.js` |
| Booking concurrency | Existing MongoDB per-business mutation lease audited; lease expiry/fencing remain risks | `server/middleware/bookingMutationGuard.js` |
| Inventory atomicity | Audit documented; multi-product transactions and one-time order completion are **not yet implemented** | `docs/concurrency-audit-betta-vol1.md` |
| Validation | Code committed; Redis integration, cross-replica messaging, and high-concurrency transaction tests **not yet verified** | `server/tests/publicJsonCache.test.js`, `scripts/load-smoke.mjs` |

**Before running with Redis:** install `redis` and `@socket.io/redis-adapter` into `server/`, commit both npm dependency manifests/lockfile, provision Redis privately, and configure `REDIS_URL` in the untracked `server/.env`. Existing Redis Compose configuration is optional infrastructure and does not automatically activate these integrations.

**Local checks** after the backend is configured:

```bash
node --test server/tests/publicJsonCache.test.js
node scripts/load-smoke.mjs http://127.0.0.1:5000 10 200
```

These checks do **not** prove suitability for 100,000 simultaneous users. Before scaling, resolve order-completion double-deduction, inventory multi-document consistency, booking lease expiry/overlap, and idempotent retries; then perform representative integration, stress, and failure testing.

### Enable Redis in a development environment

1. Install the required npm packages and **commit the updated `server/package.json` and `server/package-lock.json`** to your deployment branch. They are not yet included in the committed lockfile:

```bash
cd server
npm install redis @socket.io/redis-adapter
```

2. Start a password-protected Redis instance, for example using the existing optional Docker Compose configuration in `infrastructure/compose.services.yml` with credentials supplied in an untracked environment file. Do not publish Redis port 6379 to the internet.
3. Set a valid `REDIS_URL` in the backend environment (for example `redis://:<password>@127.0.0.1:6379`, replacing the password with the real secret). Never commit credentials or paste them into source control.
4. Restart the API and inspect its startup logs. An unavailable Redis connection with `REDIS_URL` configured prevents API startup rather than silently running multiple incompatible Socket.IO instances.

Public browse uses a 15-second TTL, forum 5 seconds. Redis cache entries are keyed by URL, namespace and version; forum posts/replies increment a shared version so other replicas stop using prior forum results. A failed Redis read bypasses the cache. Writes to MongoDB do **not** flow through Redis; Redis is strictly optional short-lived response storage. **Do not cache payment, booking availability, or stock authority.**

The Socket.IO Redis adapter broadcasts between server processes, but you still need a load balancer and either sticky routing for HTTP long polling or a websocket-only client/server transport configuration. This integration does not itself provision servers, a load balancer, or a CDN.

### Booking and inventory audit

See [Concurrency audit: booking leases, stock deductions, and release blockers](docs/concurrency-audit-betta-vol1.md). The audit identified that cross-product inventory decrement/restore is not transactional, order completion may double-deduct under concurrent requests, and booking leases have fixed expiry without fencing. The duplicate-SKU deduction path is improved, but the remaining issues must be fixed and tested before treating the system as 100K-concurrent-ready.

## 100K+ user scaling readiness — betta-vol1

**Target is not yet validated.** 100,000 registered users, daily active users, and simultaneous connections imply radically different workloads. No 100K-user capacity claim should be made before representative benchmarks.

### Implemented groundwork

- Existing bounded public browse (15-second) and forum (5-second) in-memory caches. Global `CACHE_PUBLIC_TTL_MS` may shorten either TTL or disable it with `0`, but may not extend a route past its configured ceiling.
- The forum feed cache is invalidated after successful posts/replies in that *same* Node process. This is **not distributed invalidation**; do not run forum caching across replicas without a shared cache/invalidation layer.
- `/api/ready` now returns not-ready while the process is shutting down, suitable for load balancer draining decisions.
- A bounded **localhost-only** request probe at `scripts/load-smoke.mjs`. For development only; **not** a 100K-user stress test.

```bash
# From repo root, after starting API and MongoDB:
node scripts/load-smoke.mjs http://127.0.0.1:5000 10 200
node --test server/tests/publicJsonCache.test.js
```

The probe prints HTTP status totals and observed p50/p95/p99 latencies. It is restricted to 50 concurrency and 5,000 requests and only exercises public browse. Test authentication, booking writes, POS, media and Socket.IO separately in an authorized staging environment, with test data.

### Before a multi-replica production rollout

1. **Booking/stock correctness:** verify database-enforced booking conflict prevention, atomic inventory decrement, idempotency for checkout/payment retries, and transaction rollback under parallel requests. These are release blockers.
2. **Shared Redis:** replace process-local cache and rate-limit state with shared Redis adapters; use explicit invalidation on service/profile/publication changes. Do not cache booking slot authority, payment decisions, or stock quantities.
3. **Socket.IO scale-out:** configure a compatible inter-node adapter, authentication, load-balancer WebSocket support, and any required session affinity for polling. Current socket rooms are per-process.
4. **MongoDB capacity:** profile actual query plans with `explain`, verify compound indexes, constrain pagination and connection pools per API replica, and provision high availability and backups. A MongoDB replica set provides resilience, not automatic unlimited write scaling.
5. **Media and asynchronous work:** CDN/object storage for high-read assets where practical; durable queues, bounded consumers and idempotent notification workers.
6. **Production operations:** front-end CDN, TLS/load balancing, health probes, traces, error budgets, centralized logging, backup/restore drills, rolling deployments, load and soak tests.

Do not scale by simply starting many Node.js instances yet: this branch currently has single-process cache invalidation and Socket.IO room state, and has not passed the required transactional concurrency audits.

## Feature caching policy — betta-vol1

This inventory identifies user-facing features and how their API data should be handled. **Caching is selective, not universal**: transactional endpoints must always validate against MongoDB, and writing to a cache is not writing to MongoDB.

| Feature | Current caching policy |
| --- | --- |
| Public service browse | **Enabled:** 15-second in-process TTL, max 100 URLs |
| Public forum feed | **Enabled:** 5-second in-process TTL, max 50 URLs; immediately cleared on successful new posts or replies within this server process |
| Business/service/product search | **Live:** search can expose inventory and rapidly changing publication/account status |
| Public business profiles and service detail | **Live:** personalized ratings/reactions and potentially changing product stock |
| Business profile/settings and scheduling | **Live:** owner-specific and availability-affecting |
| Authentication, registration and permissions | **Never cache:** security-critical |
| Service management and publishing | **Live:** changes to public listings |
| Guest bookings, slots and appointment management | **Never cache availability or writes:** prevent double booking or stale status |
| Product management, stock and inventory history | **Live:** protect available quantities |
| POS, checkout, product orders and payment status | **Never cache:** transactional amounts, payments, and inventory |
| Sales dashboards and analytics | **Live for now:** financial correctness and timely updates |
| Messages, friends and chat | **Live:** private and real-time |
| Notifications | **Live:** private, time-sensitive |
| Reviews, ratings, comments and reactions | **Live:** user-specific and moderation-sensitive |
| Admin overview, business controls and password operations | **Never shared-cache:** private/security-sensitive |
| Images and media uploads | Browser/network caching should be addressed separately; no new shared cache added to the media API |

The middleware `server/middleware/publicJsonCache.js` caches only anonymous GET requests, sets `X-Cache: HIT/MISS`, does not cache non-200 responses, and uses `Cache-Control: no-store` to avoid browser/proxy copies. It is bounded and lost at process restart; it is **not Redis** and does not persist to either MongoDB container. Writes remain database-backed. For multiple Node.js workers or servers, use shared invalidation (e.g., Redis) before expecting immediate consistency across instances. A service-browse listing can still remain stale for up to 15 seconds.

**Run caching tests** from repository root:

```bash
node --test server/tests/publicJsonCache.test.js
```

## Public browse cache — betta-vol1

The `betta-vol1` branch implements a **bounded, in-memory TTL response cache** for `GET /api/public/browse` (public service discovery only). It is not a database and does not persist records to MongoDB.

- Default TTL: **15 seconds**; override using `CACHE_PUBLIC_TTL_MS` in `server/.env` (milliseconds, `0` disables caching). No Redis or extra Docker container is required.
- Maximum **100** cached URL responses per Node.js process; expired/oldest entries are removed as requests arrive.
- `X-Cache: MISS` on a normal first request and `X-Cache: HIT` on repeated requests within the TTL. `Cache-Control: no-store` prevents separate browser/proxy persistence.
- Requests containing authorization or cookies bypass the cache. Failed responses, writes and other endpoints do not get cached.
- **Not cached:** bookings, appointment availability, checkout, stock/inventory, sales, user/admin dashboards and all other personalized or transactional data. MongoDB remains the source of truth and writes still go to MongoDB.
- Public browse updates can appear up to 15 seconds later; cache entries also disappear on backend restart and are not shared between multiple server processes. For immediate invalidation or distributed caching, implement explicit write invalidation or Redis before increasing the TTL.

To verify after the backend is running:

```bash
curl -i http://localhost:5000/api/public/browse
curl -i http://localhost:5000/api/public/browse
node --test server/tests/publicJsonCache.test.js
```

Read `X-Cache` in the response headers; the second anonymous request should normally be a HIT within 15 seconds. Do not treat cached content as proof that a record has been committed to MongoDB.

## Run the project — Betta V1

**Use this guide for the latest [`betta-vone` branch](https://github.com/joebanezair/booking-project/tree/betta-vone).** You can run the application with only Node.js and the **main MongoDB** database. RabbitMQ, Redis, a second GridFS MongoDB, and Nginx are **optional** and are **not needed** for basic signup, browsing, booking, messaging, or development. Running these containers does not automatically turn on the related application features.

### MongoDB Docker containers — Codespaces quick reference

The `betta-vone` setup uses two persistent MongoDB containers for distinct purposes:

| MongoDB container | Local port | Purpose |
| --- | --- | --- |
| `booking-mongodb` | `127.0.0.1:27017` | Main application database: users, bookings, products, sales, and services |
| `booking-media-mongodb` | `127.0.0.1:27018` | Media database: images, photos, and file attachments (GridFS) |

Both databases use Docker volumes, so data normally survives container restarts. They run as separate containers on the same Codespaces host—not separate physical servers.

**1. Start or reuse the containers and configure the backend environment.** From the project root in Codespaces:

```bash
cd /workspaces/codespaces-blank/booking-project
node scripts/setup-codespaces.mjs
```

The script is designed to reuse existing MongoDB containers, configure `server/.env`, and avoid destroying existing database volumes. If your Codespace uses a different checkout path, `cd` to that repository root instead.

**2. Inspect all containers**, including stopped ones:

```bash
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

**3. Inspect database volumes:**

```bash
docker volume ls
```

**4. Check the database connections and API readiness:**

```bash
node scripts/setup-codespaces.mjs --check
```

**Troubleshooting and data safety:** If Docker reports a `RWLayer` error or another container-startup failure, first inspect the container status and Docker logs. The setup script cannot necessarily repair a damaged Docker storage layer. Do **not** delete either MongoDB container or its volumes while diagnosing the problem; they may hold irreplaceable application data. You do **not** need another `docker run` if the named containers already exist. If `docker ps -a` lists three or more MongoDB containers, compare their names, ports, and mounts before deciding which belong to this project.

### Codespaces automatic environment fix (recommended)

When `server/.env` is missing, contains sample secrets, or your second MongoDB has not been configured, run this **from your existing checkout's root**:

```bash
git fetch origin && git checkout betta-vone && git pull origin betta-vone
node scripts/setup-codespaces.mjs
```

The script uses Node.js and Docker, reuses/starts **`booking-mongodb`** on `127.0.0.1:27017`, creates or starts the optional **`booking-media-mongodb`** on `127.0.0.1:27018`, generates separate secure JWT/admin/media signing secrets when placeholders are present, and writes only to the local Git-ignored `server/.env` (file mode `0600`). It will **not delete database containers or volumes**, overwrite existing real credentials, enable RabbitMQ automatically, or configure a Redis/Socket.IO adapter.

To use only the primary MongoDB: `node scripts/setup-codespaces.mjs --without-media`. You can safely rerun the script after a restart; it reuses existing containers/passwords and does not reset volumes. For more detail, see [two-MongoDB Codespaces setup](#5a-two-mongodb-containers-in-github-codespaces-primary--media-gridfs).

**Start the backend and frontend in separate terminals** after setup:

```bash
# Terminal 2 (from repository root)
cd server && npm ci && npm run dev

# Terminal 3 (open a NEW terminal at repository root)
cd client && npm ci && npm run dev -- --host 0.0.0.0
```

Verify the actual services (without displaying secrets):

```bash
node scripts/setup-codespaces.mjs --check
```

You should see `/api/ready` respond with `{"ok":true}` and `/api/media/capabilities` with `{"binaryUploads":true}` when the media database and backend are running. Port `5173` is the frontend you open in Codespaces. Keep MongoDB ports private.

### 0. Requirements

- Git; Node.js **22** (with npm); Docker Engine/Desktop (with Docker Compose) **or** an accessible MongoDB instance.
- A terminal such as Bash, Git Bash, WSL or a GitHub Codespace. Code blocks below use **Bash**. For PowerShell, use `Copy-Item server\.env.example server\.env` instead of `cp`.
- Ports **27017** (MongoDB), **5000** (Express API and Socket.IO backend), and **5173** (Vite React frontend) available. The Docker examples bind database/broker ports to loopback.

Check prerequisites:

```bash
git --version
node --version
npm --version
docker --version
docker compose version
```

### 1. Download / update the correct branch

**New checkout:**

```bash
git clone --branch betta-vone https://github.com/joebanezair/booking-project.git
cd booking-project
```

**Existing checkout** (run from anywhere inside that repository, including Codespaces):

```bash
cd "$(git rev-parse --show-toplevel)"
git fetch origin && git checkout betta-vone && git pull origin betta-vone
```

**Do not use `shadcn-ui` for this run guide.** All the scalability work here is on `betta-vone`.

### 2. Start main MongoDB (Terminal 1)

For a **new** local/Codespaces Docker setup, from any directory:

```bash
docker run -d \
  --name booking-mongodb \
  -p 127.0.0.1:27017:27017 \
  -v booking-mongodb-data:/data/db \
  mongo:7
```

If the container already exists, **start it instead of trying to create it again**:

```bash
docker start booking-mongodb
docker ps
docker logs --tail 30 booking-mongodb
```

The `booking-mongodb-data` named Docker volume keeps your data between container restarts. **Do not delete the volume to troubleshoot a connection error**. If you already have MongoDB on `127.0.0.1:27017`, skip Docker and point `MONGO_URI` to that server.

### 3. Configure the API (Terminal 2)

From the repository root:

```bash
cp -n server/.env.example server/.env  # Keep any existing credentials intact
cd server
npm ci
```

Edit `server/.env`. At minimum it should contain values corresponding to these local defaults:

```dotenv
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/booking_app
CLIENT_URL=http://localhost:5173
JWT_SECRET=REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
ADMIN_REGISTRATION_KEY=REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET_32_CHARS_OR_LONGER
ADMIN_EMAILS=
```

Generate secrets (run twice; copy **different** outputs into `JWT_SECRET` and `ADMIN_REGISTRATION_KEY`):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Do not commit `.env` or expose your secrets. `ADMIN_EMAILS` is optional: set it only to the email address you deliberately want to be an admin, because matching accounts are promoted on server startup. Keep `MEDIA_MONGO_URI`, `RABBITMQ_URL`, `DISTRIBUTED_RATE_LIMIT`, and `RUN_LEGACY_MIGRATIONS` **unset** for the simplest local run.

Start the backend:

```bash
npm run dev
```

Expected output includes `API and WebSocket server listening on http://localhost:5000`. Verify it in a second terminal:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/ready
```

Both should report `ok: true` when the configured databases are connected. `/api/live` is only a process-liveness check, not a database-readiness check. Leave the backend terminal running.

### 4. Start the React frontend (Terminal 3)

Open another terminal at the repository root:

```bash
cd client
npm ci
npm run dev
```

Open **http://localhost:5173**. Create an account on `/register`, then test your dashboard, business profile, services, bookings and messages. No seed script is necessary for ordinary registration.

The Vite dev server already proxies **`/api` and `/socket.io`** to `http://127.0.0.1:5000`. No client `.env` is required. If you create one, keep `VITE_API_URL=/api` and **leave `VITE_SOCKET_URL` unset** so browser requests and chat pass through the proxy. Never point browser requests at `localhost:5000` from an external Codespaces browser.

**Everyday restart** after setup: `docker start booking-mongodb` (if needed), then `cd server && npm run dev` in one terminal and `cd client && npm run dev` in another.

### 5. GitHub Codespaces

Open the existing Codespace for the project, then use the **existing checkout** commands from step 1. From the repository root:

```bash
# Terminal 1 (only if MongoDB container is not present yet, use step 2 above)
docker start booking-mongodb

# Terminal 2
cd server
npm ci
npm run dev

# Terminal 3 (start from the repository root in a new terminal)
cd client
npm ci
npm run dev -- --host 0.0.0.0
```

If `docker start booking-mongodb` says the container does not exist, use the `docker run` command in step 2 instead. Copy and configure `server/.env` in step 3 before starting the backend.

Open the **Ports** tab and open the forwarded **5173** port to use the website. Keep backend port **5000** private where possible. `--host 0.0.0.0` allows Vite's frontend port to be forwarded; the dev proxy sends API/Socket.IO traffic to the backend within the Codespace. You do **not** need an external `VITE_API_URL` or `VITE_SOCKET_URL` for this setup.

**One-line frontend restart** (after database/backend are running, from anywhere inside the repository):

```bash
cd "$(git rev-parse --show-toplevel)" && git fetch origin && git checkout betta-vone && git pull origin betta-vone && cd client && npm run dev -- --host 0.0.0.0
```

### 5A. Two MongoDB containers in GitHub Codespaces (primary + media GridFS)

This optional Codespaces setup matches the existing **`booking-mongodb` container on `127.0.0.1:27017`** and adds a **second MongoDB container for GridFS images/files on `127.0.0.1:27018`**. It is a separate database process and Docker volume, **not a separate physical server**: both run on the same Codespaces host. Do not expose the MongoDB ports publicly.

| Database | Docker container | Local port | Stores |
| --- | --- | --- | --- |
| Main MongoDB | `booking-mongodb` | `127.0.0.1:27017` | Users, bookings, businesses, products, messages, sales and application records |
| Media MongoDB | `booking-media-mongodb` | `127.0.0.1:27018` | GridFS files (profile/cover photos, images and attachments) |

**Recommended:** use the [automatic Codespaces environment fix](#codespaces-automatic-environment-fix-recommended) instead of pasting database passwords into `.env` yourself. The manual steps below are available for troubleshooting or custom setups.

**A. Check your existing primary database first:**

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
docker start booking-mongodb  # Only if your existing primary container is stopped
```

If `booking-mongodb` already appears as running, the `docker start` command is unnecessary. **Never remove or recreate this container/its named volume just to add GridFS.** Keep the primary `MONGO_URI=mongodb://127.0.0.1:27017/booking_app` unchanged.

**B. First-time media MongoDB setup — execute this block together in ONE Bash terminal** from the repository root. Run this block **only if `booking-media-mongodb` does not already exist**:

```bash
cd "$(git rev-parse --show-toplevel)"
test -f server/.env || cp server/.env.example server/.env
umask 077

# Generate a safe, URL-compatible password without printing it.
MEDIA_PASS="$(node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('hex'))")"

docker run -d \
  --name booking-media-mongodb \
  -p 127.0.0.1:27018:27017 \
  -v booking-media-mongodb-data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=bookflowmedia \
  -e MONGO_INITDB_ROOT_PASSWORD="$MEDIA_PASS" \
  mongo:8

# Add the URI once, without overwriting the existing main MONGO_URI.
if grep -q '^MEDIA_MONGO_URI=' server/.env; then
  echo "MEDIA_MONGO_URI already exists: edit server/.env to confirm the credentials."
else
  printf '\nMEDIA_MONGO_URI=mongodb://bookflowmedia:%s@127.0.0.1:27018/bookflow_media?authSource=admin\n' "$MEDIA_PASS" >> server/.env
fi

# Private attachment-link signing can use a dedicated secret.
if ! grep -q '^MEDIA_SIGNING_SECRET=' server/.env; then
  printf 'MEDIA_SIGNING_SECRET=%s\n' "$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")" >> server/.env
fi

chmod 600 server/.env
unset MEDIA_PASS
```

The root user is initialized **only on an empty media database volume**. Save the connection URI securely in `server/.env`; do not regenerate the password and expect it to change an existing container's credentials. `server/.env` is Git-ignored and must not be committed.

**C. Every subsequent Codespaces restart** (do **not** rerun `docker run` or reset either volume):

```bash
docker start booking-mongodb booking-media-mongodb
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

Expected bindings: `booking-mongodb` → `127.0.0.1:27017`, `booking-media-mongodb` → `127.0.0.1:27018`. You might see port `27017` in Codespaces **Ports** even if the database is bound to the container's loopback; port forwarding alone does **not** establish how many databases are running. Use `docker ps` for that.

**D. Restart the API and confirm GridFS is really connected:**

```bash
# Terminal 2: from repo root
cd server
npm run dev
```

From another terminal:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/ready
curl http://localhost:5000/api/media/capabilities
```

`/api/health` checks the main MongoDB connection; `/api/ready` should return `{"ok":true}` when all *configured* database connections are ready; `/api/media/capabilities` should return `{"binaryUploads":true}` with the separate GridFS store enabled. If media capabilities are `false`, verify `server/.env`, `docker logs --tail 40 booking-media-mongodb`, credentials, container availability, and restart the API. An unreachable configured media database can prevent normal API startup.

**E. Start the frontend** in a third terminal:

```bash
cd "$(git rev-parse --show-toplevel)/client"
npm run dev -- --host 0.0.0.0
```

Open the forwarded frontend port **5173** in Codespaces; leave database ports **27017** and **27018** private. The browser uses the Vite `/api` proxy and does not connect directly to either MongoDB server.

**F. Previously uploaded Base64 images are not transferred automatically.** Once both MongoDB databases have **verified backups**, use `cd server && node scripts/migrate-media.js --dry-run` to estimate the work. Only then consider the actual `node scripts/migrate-media.js` migration during a controlled maintenance period. See [Migrate existing Base64 media](#migrate-existing-base64-media) and verify uploaded files and application references afterwards.

**Alternative: Docker Compose.** Section 6 below provides `infrastructure/compose.services.yml`, with the optional service named `media-mongo` and its own **different volume/container naming**. **Choose either the manual `booking-media-mongodb` method above OR the Compose `media-mongo` service, not both on port 27018.** RabbitMQ and Redis are independent optional services; neither is required to enable GridFS.

**Troubleshooting / data safety:**

- `Conflict. The container name ... is already in use`: use `docker start booking-media-mongodb` (and the already-saved URI), **not** a second `docker run`.
- `bind: address already in use` on `27018`: run `docker ps` and check for an existing media service; don't create duplicates.
- `Authentication failed`: use the original credentials saved when the media volume was first initialized. Changing `MONGO_INITDB_ROOT_PASSWORD` does **not** reset an existing MongoDB user.
- Never use `docker compose down -v`, `docker volume rm`, `docker rm -v`, or database-drop commands for routine restart/troubleshooting. Both databases contain potentially important data.
- Docker volumes are persistent across ordinary container restarts but **not a substitute for backups**, especially if the Codespace is deleted.

### 6. Optional: run separate media MongoDB, RabbitMQ and Redis locally

This section is **optional**. For a separate MongoDB-only Codespaces setup, use [Two MongoDB containers in GitHub Codespaces](#5a-two-mongodb-containers-in-github-codespaces-primary--media-gridfs). It uses `infrastructure/compose.services.yml` and creates self-hosted services without Cloudflare R2. Do **not** enable `MEDIA_MONGO_URI` or `RABBITMQ_URL` in the backend until the corresponding service is reachable.

Create `infrastructure/.env` with **strong, distinct passwords**:

```dotenv
MEDIA_MONGO_USER=bookflowmedia
MEDIA_MONGO_PASSWORD=REPLACE_MEDIA_PASSWORD
RABBITMQ_USER=bookflow
RABBITMQ_PASSWORD=REPLACE_RABBITMQ_PASSWORD
REDIS_PASSWORD=REPLACE_REDIS_PASSWORD
# The last two also satisfy Compose's optional chat-broker environment template.
# These localhost URLs are for host-based commands; they do NOT work inside
# the chat-broker container without proper container network configuration.
MONGO_URI=mongodb://127.0.0.1:27017/booking_app
RABBITMQ_URL=amqp://bookflow:REPLACE_RABBITMQ_PASSWORD@127.0.0.1:5672
```

From the repository root:

```bash
docker compose --env-file infrastructure/.env -f infrastructure/compose.services.yml up -d media-mongo rabbitmq redis
docker compose --env-file infrastructure/.env -f infrastructure/compose.services.yml ps
```

The optional services expose **127.0.0.1:27018** for media MongoDB, **127.0.0.1:5672** for RabbitMQ, **127.0.0.1:15672** for RabbitMQ's management UI, and **127.0.0.1:6379** for Redis. Use <http://localhost:15672> locally for RabbitMQ management, signing in with your configured broker username/password. These are **self-hosted service examples**, not automatically provisioned cloud infrastructure or a production HA topology.

To enable the separate media store, add to **`server/.env`** (substitute and URL-encode any special password characters):

```dotenv
MEDIA_MONGO_URI=mongodb://bookflowmedia:REPLACE_MEDIA_PASSWORD@127.0.0.1:27018/bookflow_media?authSource=admin
MEDIA_SIGNING_SECRET=ANOTHER_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
# Optional only when serving the API at another origin:
# MEDIA_PUBLIC_BASE_URL=https://api.example.com
```

Restart `npm run dev` in `server`. The frontend will then automatically use binary GridFS uploads when `/api/media/capabilities` reports availability. Existing files are **not** migrated automatically. Back up both databases and see [Migrate existing Base64 media](#migrate-existing-base64-media) for the migration procedure.

To turn on RabbitMQ **chat events** in local development:

1. Install worker dependencies: `cd server/workers/chat-broker && npm install`.
2. From that worker folder, set `MONGO_URI` to the main database and `RABBITMQ_URL` to your localhost broker, then run `npm start`. On Bash, you can do this in one command:
   ```bash
   MONGO_URI=mongodb://127.0.0.1:27017/booking_app \
   RABBITMQ_URL=amqp://bookflow:REPLACE_RABBITMQ_PASSWORD@127.0.0.1:5672 \
   npm start
   ```
3. Add the same `RABBITMQ_URL` to `server/.env` and restart the API. **Only enable this after the worker is running.**

This host-based worker approach is intentional: when using `docker compose --profile chat`, a worker running **inside a container** cannot reach the host database at `127.0.0.1` or the broker at host loopback. Configure container-reachable DNS/network URLs (for example, Compose service `rabbitmq:5672` and a reachable main MongoDB hostname) before using the profile. RabbitMQ processes background events; **Socket.IO remains the live chat transport**. Redis is presently an infrastructure option, not a configured Socket.IO adapter or general application cache.

Stop the optional services (without deleting named data volumes):

```bash
docker compose --env-file infrastructure/.env -f infrastructure/compose.services.yml down
```

### 7. Run checks and build

From the project root, with dependencies installed:

```bash
cd server
node --test tests/*.test.js
cd ../client
npm run build
```

For a local smoke test with the server running, open the app and try registration, login, business/service creation, booking creation, and messaging. The k6 discovery and booking-concurrency scripts are intended for a **controlled staging environment**; the booking race test **creates real booking records** and must not run against production.

### 8. Common startup problems

| Symptom | Check / fix |
| --- | --- |
| `ERR_CONNECTION_REFUSED` for `localhost:5000` or `/api` | Start `cd server && npm run dev` and check `http://localhost:5000/api/ready`. For Codespaces, use same-origin `/api` through Vite rather than a browser-facing localhost URL. |
| `MongooseServerSelectionError`, MongoDB connection refused | Run `docker ps`, `docker start booking-mongodb`, and `docker logs booking-mongodb`; confirm `MONGO_URI` uses port 27017 and the intended database. |
| `JWT_SECRET must be at least 32 characters` | Set a fresh secret in `server/.env` and restart the backend. |
| `MONGO_URI is missing` or sample passwords in `server/.env` | Run `node scripts/setup-codespaces.mjs` from the repository root, then restart the backend. Do not commit `.env`. |
| `MongoServerError: Authentication failed` on the second media database | Do not recreate the media volume. Restore the original media credentials or run `node scripts/setup-codespaces.mjs` to check the local container's saved init credentials. |
| `EADDRINUSE` on 5000/5173/27017 | Another process/container already owns the port. Stop the duplicate service; keep `client/vite.config.js` and `server/.env` ports aligned. |
| Chat is disconnected / Socket.IO errors | Confirm backend 5000 is running and Vite proxies `/socket.io`. Leave `VITE_SOCKET_URL` unset for development. |
| Media endpoint returns 503 | You opted into `MEDIA_MONGO_URI` but the media server is unavailable/misconfigured. Check media MongoDB and credentials; otherwise leave it unset for legacy local uploads. |
| RabbitMQ worker cannot connect | Check broker `docker compose ps`, credentials, and the **network location of the worker**. `127.0.0.1` inside a container refers to the container itself. |
| Existing Docker container reports `RWLayer ... unexpectedlynil` | See [Docker container recovery below](#fix-a-corrupted-mongodb-docker-container). Preserve the named MongoDB volume and make a backup before container recovery. |

**Avoid using `docker compose down -v`, `docker volume rm`, or database drop/reset commands unless you deliberately intend to erase data and have a verified backup.** A Docker container restart does not normally require deleting application data.

## Engineering implementation round 2 — October 11, 2026

**Applied to code on `betta-vone`:** This increment adds practical backend/frontend hardening. It is **not** a completed deployment of every recommendation or a claim of 100K concurrent-user capacity.

| Area | Changes committed | Limitations and operations still required |
| --- | --- | --- |
| Booking concurrency | `server/middleware/bookingMutationGuard.js` serializes public and dashboard booking writes through a shared MongoDB lease keyed by business account. Reopening a cancelled/completed booking into a schedulable status rechecks capacity. Overlap checks include post-service buffer time. | A lease is **not** a fully transactional reservation system; stalled writes extending beyond the 120-second lease, crashes and parallel third-party writers need staging race tests and stronger atomic capacity claims. |
| Binary media | React API now uploads Base64-origin images/files as **binary `application/octet-stream`** when `GET /api/media/capabilities` reports a configured media DB. Profiles, business logos, services, products and chat attachments use this flow; supported browsers can downscale public raster images to a maximum 1600-pixel edge and upload WebP when smaller. Main MongoDB stores URLs. | Without GridFS, Base64/JSON behavior remains. UI previews may still be Base64 in browser memory. Multiple responsive variants, server-side resizing and orphan cleanup are not yet implemented. |
| Private attachment authorization | Chat verifies the uploaded GridFS attachment belongs to the sending user before accepting a URL. Existing Base64 attachments stay compatible. | Secure GridFS infrastructure and staging security review remain necessary. |
| Cursor pagination | Added opt-in `GET /api/bookings?limit=50&cursor=...`, `GET /api/admin/businesses?limit=50&before=...`, and `GET /api/messages/users?limit=50&before=...`, with bounded page sizes (1–100). Contact list aggregation is scoped to the returned page. | Existing UI requests continue returning legacy arrays for backward compatibility. Convert high-volume screens to explicit paginated fetching; other sales/customer views remain unbounded. |
| Search and scheduling | Search review summaries now use a single page-scoped MongoDB aggregation; a compound booking overlap index was added. | Benchmark with real query plans and representative data. |
| Multi-instance rate limits | `DISTRIBUTED_RATE_LIMIT=1` opts into MongoDB-backed atomic shared counters. Default behavior remains local in-process limits. | Shared counters make a database write per limited request: Redis/proxy-native limits are preferable for very high traffic. |
| Runtime operations | Added `/api/live`, `/api/ready`, `MONGO_POOL_MAX` configuration, graceful shutdown handlers, and removal of Express `X-Powered-By`. | Production health/metrics collection, alerts, orchestration, rollback and HA still require deployment setup. |
| RabbitMQ resilience | The self-hosted chat event worker now uses bounded re-publish attempts and a durable `bookflow.chat.events.v1.dead` queue. | The worker must be deployed; retry/dead-letter delivery requires broker fault-injection testing. Browser realtime remains Socket.IO; Redis adapter is **not installed**. |
| Automated tests | Added cursor validation tests and private media URL tests alongside existing tests. | Unit tests alone do not establish successful multi-user load, image quality, race freedom or production readiness. |

**Staging verification commands:**

```bash
git fetch origin && git checkout betta-vone && git pull origin betta-vone
cd server && npm ci && node --test tests/*.test.js
cd ../client && npm ci && npm run build
```

**Optional server environment (enable only after its infrastructure is configured):**

```dotenv
# MEDIA_MONGO_URI=mongodb://media-user:REPLACE@media-db:27017/bookflow_media?authSource=admin
# MEDIA_PUBLIC_BASE_URL=https://api.your-domain.example
# RABBITMQ_URL=amqp://bookflow:REPLACE@rabbitmq:5672
# DISTRIBUTED_RATE_LIMIT=1
# MONGO_POOL_MAX=50
```

**What still needs implementation or deployment:** multi-instance Socket.IO Redis adapter, responsive image variants, retention/orphan cleanup, further sales/customer pagination and matching UI navigation, rigorously transactional booking capacity claims, production-ready Redis caching and Nginx routing, durable monitoring/alerts, automated encrypted backups and restore drills, security reviews, and 100K-account/10K+-concurrent load testing. **No VPS services have been deployed automatically. No Cloudflare R2 is used.**

---

### Additional staging and VPS templates

- `tests/load/booking-concurrency.js`: **mutating**, opt-in k6 test that sends ten simultaneous booking attempts into a deliberately empty, capacity-one staging slot and expects exactly one accepted booking. Requires `CONFIRM_STAGING_ONLY=1` and explicit staging parameters. Do not run this against production.
- `infrastructure/nginx-app.conf.example`: HTTPS reverse-proxy/websocket/load-balancing location examples; certificates, rate-limit zones, upstreams, headers, Redis adapter and private networking still need real deployment configuration.
- `GET /api/messages/users?limit=50&before=...`: optional bounded, page-scoped contact API. The current dashboard retains its legacy array response until a full frontend pagination UI is built.
- Browser-side public image upload optimization keeps the original bytes when WebP conversion is unsupported, bigger than the original, or not applicable; the browser still shows the existing image preview.

```bash
# From repository root; run only against a controlled empty staging slot:
k6 run -e CONFIRM_STAGING_ONLY=1 \
  -e BASE_URL=https://staging-api.example.com \
  -e BUSINESS_USER_ID=REPLACE -e CONTENT_ID=REPLACE \
  -e BOOKING_DATE=2027-01-11T08:00:00.000Z \
  tests/load/booking-concurrency.js
```

A passing ten-request race test is **not** sufficient proof of strict booking atomicity or 100K-user readiness.

---

## Betta V1 update status — October 11, 2026

**Branch:** [`betta-vone`](https://github.com/joebanezair/booking-project/tree/betta-vone) (based on `shadcn-ui`; that source branch is kept separate).

**Release status:** The initial scalability changes are committed to GitHub. This is a **code update, not a completed production rollout or proof of 100,000 concurrent users**. Production infrastructure, historical media migration, and scale testing still require explicit operator action.

| Area | Current status | What changed / what is still needed |
| --- | --- | --- |
| Public search and browse | Implemented in code | Database-side filtering and bounded pages instead of loading every matching business into application memory; benchmark indexes and large datasets. |
| MongoDB indexing | Implemented in code | Additional indexes for bookings, messages, businesses and products; inspect actual query plans under load. |
| Separate media MongoDB | **Optional; requires configuration** | GridFS media store behind `MEDIA_MONGO_URI`; public URLs and signed private attachment links. Without configuration, legacy Base64 behavior remains. |
| Existing media data | Migration script available, **not automatically migrated** | Backup both databases; run `--dry-run` before the real migration. |
| Image upload and delivery | **Partial** | Browser forms now transfer binary when GridFS is enabled; Base64 fallback remains without GridFS. Responsive WebP/AVIF thumbnail variants are not implemented. |
| RabbitMQ for chat | **Optional worker implemented** | Self-hosted RabbitMQ event pipeline with persistent message metadata events; realtime message delivery still uses Socket.IO. Requires a broker and worker to be running. |
| Redis | Infrastructure example only | Redis service is supplied, but Socket.IO Redis adapter and distributed API rate limiting are not yet wired up. |
| API protection | Baseline implemented | Local, per-process rate limiting; add distributed limits before multiple API replicas. |
| Message history | Implemented in code | 50-message cursor pages, `hasMoreMessages`, and a frontend **Load older messages** control. |
| CI and load testing | Initial coverage | CI includes `betta-vone` and verifies client build, backend syntax and media tests; a k6 ramp-to-100-virtual-users script is included but a passing scale benchmark is not established. |
| Production scale / high availability | **Not verified** | Booking race-condition hardening, full API pagination, horizontal scaling, cross-instance websockets, backups and 100K-user validation remain open. |

### Pull the updated branch

From your existing repository checkout:

```bash
git fetch origin && git checkout betta-vone && git pull origin betta-vone
```

To start the application locally (with a running MongoDB server and valid `server/.env`):

```bash
# Terminal 1
cd server && npm install && npm run dev

# Terminal 2 (from repository root)
cd client && npm install && npm run dev
```

The **separate media database, RabbitMQ and Redis are opt-in**. For a self-hosted VPS setup, follow [Separate MongoDB GridFS media storage](#1-separate-mongodb-gridfs-media-storage) and [Self-host RabbitMQ and Redis](#2-self-host-rabbitmq-and-redis-on-your-vps). Example infrastructure is in `infrastructure/compose.services.yml`. **Cloudflare R2 is not part of this implementation.** RabbitMQ Community Edition is self-hostable without a software subscription, although VPS, storage, administration and bandwidth can cost money.

### Validation before production

1. Create and securely back up both MongoDB databases before migrating legacy Base64 media; test the migration in staging first.
2. Configure and verify the opt-in media database and RabbitMQ worker, then exercise profile images, business/service/product images, private message attachments and chat.
3. Run the client build, backend checks and media tests in CI; run [k6 public discovery testing](#6-public-discovery-load-test-baseline) against a staging deployment.
4. Validate booking conflicts under concurrent requests, API pagination and Socket.IO messaging across multiple server instances before increasing production traffic.
5. Configure TLS, private broker/database networking, monitoring, automated backups and restore drills.

For the full architecture, environment variables, scripts, limitations and remaining roadmap, read [Betta V1 — Self-hosted scalability upgrade](#betta-v1--self-hosted-scalability-upgrade-betta-vone) below.

## Account lifecycle

Public registration at /register always creates:

~~~js
{
  role: "business",
  accountStatus: "active"
}
~~~

The supported roles are:

~~~js
role: {
  type: String,
  enum: ["business", "admin"],
  default: "business"
}
~~~

Account status is separate from role:

~~~js
accountStatus: {
  type: String,
  enum: ["active", "paused", "disabled"],
  default: "active"
}
~~~

### Business status behavior

| Status | Sign in | Edit profile | Manage existing bookings | Create drafts | Publish new services | Receive new guest bookings | Public profile |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Active | Yes | Yes | Yes | Yes | Yes | Yes | Visible |
| Paused | Yes | Yes | Yes | Yes | No | No | Visible with “Temporarily unavailable” |
| Disabled | No | No | No | No | No | No | Hidden |

A paused business keeps its data. Existing published services remain visible, but booking buttons are disabled and the API rejects new guest bookings.

A disabled account is blocked by REST authentication and WebSocket authentication. Its business profile and services are excluded from public discovery.

## Registration

### Business registration

Normal registration is available at:

~~~text
/register
~~~

There is no role selector and no administrator approval step. Registration creates the business account and its linked business profile immediately.

### Administrator registration

Administrator creation remains restricted:

~~~text
/register/admin/:inviteKey
~~~

The invite key is validated on the server using:

~~~env
ADMIN_REGISTRATION_KEY=replace_with_a_random_secret_at_least_32_characters
~~~

Administrators can also be promoted by email using:

~~~env
ADMIN_EMAILS=owner@example.com
~~~

For production, prefer controlled administrator provisioning rather than sharing administrator registration links broadly.

## Public experience

Guests can use BookFlow without an account to search businesses and public services, view business profiles, view public service pages, submit booking requests, provide phone and service-location details, optionally share browser geolocation after explicit permission, and leave a verified review using the one-time review link created from a completed booking.

| Page | Route |
| --- | --- |
| Search | / and /search |
| Business profile | /profile/:username |
| Service details | /services/:contentId |
| Guest booking | /b/:userId |
| Verified booking review | /review/:token |
| Forum | /forum |

## Guest booking flow

A guest booking stores the business/service relationship and guest contact details:

~~~js
{
  user,
  business,
  content,
  guestName,
  guestEmail,
  guestPhone,
  locationLabel,
  locationLatitude,
  locationLongitude,
  locationAccuracy,
  service,
  servicePrice,
  currency,
  bookingDate,
  completedAt,
  notes,
  status
}
~~~

Booking statuses are pending, confirmed, in_progress, completed, cancelled, and no_show.

The recommended service lifecycle is:

~~~text
Pending → Confirmed → In Progress → Completed → Sale recorded
~~~

Cancelled and No Show never count as sales. When a completed booking is reopened, its linked sale is voided rather than deleted so the audit history is preserved.

### Phone number

New public booking requests require a phone number. Businesses see the number in booking lists and booking details, where it is exposed as a clickable tel link.

### Location and geolocation

The guest may type a service address, barangay, city, or area manually.

The booking form also provides **Use my current location**. BookFlow does not request location automatically. Coordinates are stored only after the visitor presses the button and approves the browser permission prompt.

Stored geolocation fields are latitude, longitude, and browser-reported accuracy in meters. If permission is denied or geolocation is unsupported, manual location entry continues to work.

Booking details provide an OpenStreetMap link when coordinates were shared. Browser geolocation normally requires HTTPS in production.

## Verified booking reviews

Business-profile reviews are tied to completed bookings instead of anonymous or customer-account ratings.

When a business changes a booking to completed, the backend creates a unique review invitation using a cryptographically random token. The business can copy a link such as:

~~~text
/review/8fd72a...
~~~

The guest can use that link to submit one rating and an optional comment.

A review stores:

~~~js
{
  booking,
  business,
  businessOwner,
  reviewToken,
  rating,
  comment,
  verified,
  submittedAt
}
~~~

A review is accepted only when the token exists, the linked booking still has completed status, the invitation has not already been submitted, and the rating is an integer from 1 through 5.

Public business profiles display the aggregate verified-review rating and recent verified comments.\n\n### Direct business-profile ratings\n\nBookFlow also keeps a separate **Business Rating** for profile-level reputation. An authenticated account can rate another business from 1 through 5 stars, update that rating later, or remove it. Each account has at most one direct rating per business, businesses cannot rate themselves, and disabled accounts cannot submit ratings.\n\nDirect Business Ratings, Verified Booking Reviews, and per-service ratings remain separate signals. Direct ratings are never presented as verified booking feedback and are not averaged into the verified-review score.

The current implementation generates and exposes the review link to the business. It does not automatically email or SMS the guest.

## Business dashboard

Business accounts have access to Dashboard, Services, Bookings, Sales & Analytics, Messages, Profile, Notifications, Forum, Settings, and Search. The authenticated dashboard uses one responsive layout across desktop, tablet, and phone sizes. On desktop, the left navigation is a compact icon rail by default and expands on hover or keyboard focus to reveal labels and account details. On smaller screens the same navigation moves to a sticky horizontal bar at the top; there is no separate mobile dashboard or bottom navigation.

### Services

Businesses can create service drafts, edit services, publish/unpublish services, set public/private visibility, configure price and currency, upload a cover image and gallery, enable/disable service ratings, enable/disable booking, and receive comments and reactions.

Bookable services also support native scheduling metadata:

- service duration in minutes;
- buffer time after a service;
- simultaneous slot capacity;
- up to 12 custom guest booking questions;
- short text, long text, select, and checkbox question types.

These settings do not require a third-party scheduling API.

Paused businesses may keep editing existing services and create drafts, but cannot publish a previously unpublished service.

### Bookings

Businesses can view guest bookings, open booking details, see guest name/email/phone/location/service/price/schedule/notes/status, create internal booking records while active, and move bookings through Pending, Confirmed, In Progress, Completed, Cancelled, or No Show.

The booking workspace includes:

- list, calendar, and customer-history views;
- booking reference numbers such as `BF-2026-ABC123`;
- service duration and buffer snapshots;
- native rescheduling with conflict checking;
- search by reference, customer, phone, service, or location;
- status filtering;
- private internal business notes;
- guest custom-question answers;
- chronological booking history for creation, status changes, and reschedules;
- returning-customer indicators and booking/no-show/upcoming counts.

BookFlow prevents overlapping reservations according to the configured service capacity.

Marking a booking **Completed** automatically creates one linked sale using the service price and currency snapshotted on the booking. Reopening a completed booking voids that sale while keeping the audit record. A completed booking with a sales audit record cannot be deleted, and its price/service/date cannot be silently rewritten while still completed.

Completing a booking also creates the verified-review invitation.

### Native availability and scheduling

The **Bookings → Availability** view contains the scheduling controls that power the public booking experience without a paid API.

Businesses can configure:

~~~text
Timezone
Weekly opening hours
Minimum booking notice
Maximum advance-booking window
Slot interval
Blackout / unavailable dates
~~~

The public booking page requests available slots from the BookFlow backend. Slots are generated from the business schedule and selected service duration, buffer, and capacity. Unavailable or overlapping times are rejected again on the server when the booking is submitted, protecting against two guests selecting the same slot at the same time.

Guests no longer need to type an arbitrary appointment time. They choose a date and then select from BookFlow-generated available times.

### MVP onboarding and QR booking

The business dashboard includes a launch checklist covering:

- Business Page completion;
- profile and cover photos;
- first service creation;
- working availability;
- a published bookable service;
- sharing the booking link or QR code.

The Profile hub generates a scannable booking QR code directly in the browser. No QR API is used. Businesses can copy the booking link or download the QR as an SVG for printing or social media.

### Products, POS, Orders & Sales

Businesses manage product inventory and in-store checkout from:

~~~text
/dashboard/products
~~~

Sales analytics, online-order management, and transaction history remain at:

~~~text
/dashboard/sales
~~~

#### Product management

Businesses can create products, edit existing product data, update SKU/description/price/stock, publish or unpublish products on the public profile, and delete products. The Products page displays the catalog as selectable product cards. Selecting an in-stock product opens a quantity dialog and adds the chosen quantity to a cart. Published products are shown on the business public profile with their current price and available stock.

#### Point of Sale (POS)

The built-in POS supports an in-store cart workflow. A business selects a product, chooses its quantity, adds it to the cart, can adjust or remove cart quantities, optionally records a customer name, chooses Cash, GCash, Maya, Card, or Other as the recorded payment method, and checks out the cart. Completing a POS transaction creates an invoice record and automatically deducts the sold quantity from inventory. The payment-method field records how the business says the customer paid; it does not independently verify payment with GCash, Maya, or a card processor.

#### Public product ordering

Guests can order published, in-stock products directly from a business public profile without creating an account. The public order form records quantity, customer name, phone, optional email, and optional notes. New orders appear in the business Sales workspace.

Online product order statuses are:

~~~text
Pending → Confirmed → Processing → Completed
                       ↘ Cancelled
~~~

Inventory is deducted when the business marks an online order **Completed**. Completed orders cannot be reopened through the normal status control because their inventory movement has already been recorded.

#### Sales records versus booking records

**Bookings** remains the workspace for appointment records, guest details, schedules, booking history, rescheduling, and booking status management.

**Sales** is the financial/transaction workspace. A completed service booking contributes a **Service Sale**, but Sales should treat it as a sale transaction rather than as a second booking-management record. Product transactions are tracked as **POS Sales** or **Online Product Sales**.

The sales system currently tracks:

- completed service-sale value;
- POS product transactions and invoice numbers;
- completed public product-order value;
- automatic POS stock deduction;
- automatic stock deduction when an online order is completed;
- product/order customer information;
- Daily / Weekly / Monthly / Annual unified sales trend grouping across service, POS, and completed online-product transactions;
- Today / 7 Days / This Month / This Year / All Time / Custom date filters;
- multi-currency service summaries when applicable;
- separate service-sales and product-sales totals;
- Service Sales / POS Sales / Online Product Sales channel breakdowns;
- POS payment-method breakdowns for recorded Cash, GCash, Maya, Card, and Other methods;
- unified spreadsheet export covering service, POS, and completed online-product transactions.

A recorded BookFlow sale is an internal sales record. It is **not proof of settled payment** until a supported payment provider is integrated and payment confirmation is verified server-side.

### Profile and Business Page

The authenticated profile area is split into three distinct routes:

~~~text
/dashboard/profile
/dashboard/profile/edit
/dashboard/profile/business
~~~

**Profile** is the account profile hub. It shows the connected cover/profile-photo header, profile summary, public-profile link, and entry points to Edit Profile and Business Page.

**Edit Profile** manages account-facing fields such as name, username, biography, headline, location, website, cover photo, profile photo, and profile-photo positioning.

**Business Page** manages business-specific fields such as business name, category, description, business location, email, phone, website, and logo. Booking schedule settings are intentionally managed only from **Bookings → Availability** to keep one scheduling source of truth. Business Page is not a main sidebar navigation item; it is reached from the Profile page.

The cover photo and profile photo use one LinkedIn-style connected header. The profile photo overlaps the cover and its complete photo-selection/clickable area is circular, including the image container and edit target. Clicking or tapping the cover opens change/remove actions. Clicking or tapping the profile photo opens view/change/reposition/delete actions. Destructive removal actions require confirmation, and the controls work for pointer and touch interaction.

No approval or resubmission state exists.

### Interface shape and layout conventions

BookFlow uses a compact **5px corner radius** for standard interface surfaces such as cards, panels, inputs, buttons, dropdowns, menus, message bubbles, and form controls. Profile photos and user avatars remain circular. The main dashboard sidebar/drawer intentionally uses **0px radius** so it stays flush with the viewport edge.

The Bookings workspace includes dedicated bottom spacing so long create/edit forms and their final controls do not sit against the viewport or container boundary. Public business-profile actions use responsive spacing and wrapping so friendship, messaging, booking, and profile controls remain usable across desktop and mobile layouts.

## Admin dashboard

Admins have a dedicated business directory:

~~~text
/dashboard/businesses
~~~

Each row includes business identity, account status, service count, booking count, verified-review summary, and account actions.

Admins can open:

~~~text
/dashboard/businesses/:businessId
~~~

to inspect the business profile, recent services, recent bookings, recorded sales summary, review summary, and account state.

Admin actions are:

- **Pause** — the business stays signed in and can manage existing data, but cannot publish new services or receive new guest bookings.
- **Reactivate** — returns a paused or disabled business to normal active operation.
- **Disable** — blocks authentication, disconnects active WebSocket sessions, and removes the business from public discovery.

There is no business application queue.

Legacy URLs /dashboard/customers and /dashboard/business-requests redirect to the business-management page and are not part of current navigation.

## Messaging

Messaging is available only to authenticated Business and Admin accounts. Normal direct messaging is friend-based: businesses can search accounts, send and accept friend requests, and message accepted friends. Admin accounts retain a messaging exception for platform/support communication.

### Business profile friendship controls

Friendship is also integrated directly into public business profiles. When a signed-in registered Business views another business profile, the profile header shows the appropriate relationship action:

- **Add Friend** — sends a friend request.
- **Request Sent** — indicates an outgoing pending request.
- **Accept Friend** — appears when the viewed business has already sent the current user a request.
- **Friends** — indicates an accepted friendship and provides the relationship state used by messaging.

A business never sees an Add Friend control on its own profile. Guests do not receive friendship controls. The **Message** action is available to accepted business friends, while Admin retains the platform/support messaging exception.\n\nThe Messages workspace uses a viewport-sized layout with independently scrollable conversation and message panes and a composer that remains accessible at the bottom. Conversations are ordered with pinned conversations first and then by latest activity. Unread conversations display bold text and unread counts. Users can pin/unpin, restrict/unrestrict, block/unblock, unfriend, delete a conversation for themselves, delete individual messages for themselves, and unsend their own messages.\n\nMessages support emoji reactions, read tracking, file attachments up to 5 MB for supported image/document formats, business-profile sharing cards, persistent history, direct profile-to-message navigation, and real-time delivery through authenticated Socket.IO rooms. The realtime client can begin with HTTP polling and upgrade to WebSocket instead of requiring a WebSocket-only initial connection.

Guests do not receive permanent messaging accounts.

## Notifications

Authenticated accounts receive notifications for supported events, including new messages, booking requests, comments, business status changes, and verified reviews.

## Search and discovery

Public search describes people results as **Businesses**, not users/customers.

Search supports business name, username, business category, business location, service title, service description, service category, and minimum service rating.

Active and paused businesses can appear publicly. Disabled businesses are excluded.

## Forum

The forum remains publicly readable. Authenticated Business/Admin accounts can create posts and replies.

## Real-time architecture

Socket.IO authenticates connections with the same JWT used by the API. Disabled or unsupported legacy accounts cannot establish authenticated WebSocket connections.

Real-time events include message:new, booking:created, booking:updated, booking:deleted, service:reactions, comment:created, comment:updated, comment:deleted, message:reaction, and comment:reaction.

## API summary

### Authentication

~~~text
POST /api/auth/register
POST /api/auth/register/admin/:inviteKey
POST /api/auth/login
GET  /api/auth/me
~~~

### Business profile

~~~text
GET /api/businesses/mine
PUT /api/businesses/mine
~~~

### Services

~~~text
GET    /api/content
GET    /api/content/:id
POST   /api/content
PUT    /api/content/:id
PATCH  /api/content/:id/publish
DELETE /api/content/:id
~~~

### Business bookings

~~~text
GET    /api/bookings
GET    /api/bookings/customers/summary
GET    /api/bookings/:id
POST   /api/bookings
PUT    /api/bookings/:id
PATCH  /api/bookings/:id/reschedule
PATCH  /api/bookings/:id/status
DELETE /api/bookings/:id
~~~

### Products, orders, POS and sales analytics

~~~text
GET    /api/sales/products
POST   /api/sales/products
PUT    /api/sales/products/:id
DELETE /api/sales/products/:id
GET    /api/sales/pos
POST   /api/sales/pos
GET    /api/sales/orders
PATCH  /api/sales/orders/:id/status
GET    /api/sales/analytics?range=month&group=daily
~~~

Supported ranges are today, 7d, month, year, all, and custom. Supported chart grouping is daily, weekly, monthly, and annual.

### Public discovery and booking

~~~text
GET  /api/public/profile/:username
GET  /api/public/content/:contentId
GET  /api/public/browse
GET  /api/public/search
GET  /api/public/book/:userId
GET  /api/public/book/:userId/slots?date=YYYY-MM-DD&contentId=...
POST /api/public/book/:userId
POST /api/public/products/:userId/order
~~~

### Verified reviews

~~~text
GET /api/public/reviews/:token
PUT /api/public/reviews/:token
~~~

### Admin business management

~~~text
GET   /api/admin/overview
GET   /api/admin/businesses
GET   /api/admin/businesses/:id
PATCH /api/admin/businesses/:id/status
~~~

Valid accountStatus values are active, paused, and disabled.

## Legacy-data migration

On server startup BookFlow performs a compatibility migration for the previous Customer → Business Approval architecture.

The migration:

1. promotes owners of legacy Business records to role business;
2. maps legacy suspended businesses to accountStatus paused;
3. maps legacy approved/pending/rejected business applicants to active business accounts because approval is no longer required;
4. marks customer-only accounts without a business profile as disabled business-role records so historical references are retained without keeping a customer role;
5. ensures active/paused business accounts have a linked Business profile;
6. removes obsolete Business approval fields such as status, rejectionReason, reviewedBy, and reviewedAt.

This preserves existing business, booking, message, and historical database references while moving all future account logic to Business/Admin only.

Server startup also backfills existing booking scheduling metadata, including booking references, end times, and an initial history entry when those fields are missing.

Existing completed bookings are also backfilled into the sales ledger. If an older completed booking did not store a price snapshot, BookFlow uses the currently linked service price/currency as the best available historical fallback.


## Responsive UI and navigation

BookFlow uses a responsive dashboard shell for desktop, tablet, and mobile layouts.

- Desktop keeps the persistent left navigation sidebar.
- Mobile uses a sticky BookFlow header with a hamburger button that opens the existing navigation as a slide-in drawer.
- The mobile drawer is flush to the viewport with square edges and closes after navigation, backdrop selection, or the Escape key.
- The mobile shell removes unintended spacing above the header.
- Sign out is intentionally available only from the **Settings** page rather than the navigation drawer.
- UI surfaces use square corners; profile imagery remains circular.
- Typography uses a native UI sans-serif stack (ui-sans-serif, system fonts, Segoe UI, Helvetica, Arial), with lighter normal text and stronger emphasis reserved for labels, active navigation, buttons, and headings.

## Booking workspace responsiveness

The Business Bookings workspace keeps the New Booking editor contained within its panel so controls do not overlap the Guest bookings list.

The Date and time, Duration, and Status controls use a flexible responsive row: Date and time receives more available width on desktop, Duration and Status retain usable widths, narrower layouts place Date and time on its own row with Duration and Status below, and very small mobile layouts stack all three controls vertically.

## Technology stack

Frontend: React 19, React Router, Vite, React Icons, Socket.IO Client.

Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Socket.IO.

Optional Betta V1 self-hosted services: separate MongoDB GridFS for media, RabbitMQ Community Edition for chat events, Redis infrastructure, and Nginx media caching.

## Development setup (historical notes and Docker recovery)

For the current `betta-vone` branch, follow **[Run the project — Betta V1](#run-the-project--betta-v1)** above. The older examples below are retained for reference; use `booking_app` consistently as the default local MongoDB database, and leave `VITE_SOCKET_URL` unset when using the Vite proxy.


### Server

~~~bash
cd server
npm install
cp .env.example .env
npm run dev
~~~

Configure:

~~~env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/booking_app
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
ADMIN_EMAILS=owner@example.com
ADMIN_REGISTRATION_KEY=replace_with_a_random_secret_at_least_32_characters
~~~

### Client

~~~bash
cd client
npm install
npm run dev
~~~

### GitHub Codespaces

When running the client in GitHub Codespaces, bind the Vite development server to `0.0.0.0` so the forwarded port can be opened from the Codespaces **Ports** tab:

~~~bash
cd /workspaces/codespaces-blank/booking-project/client
npm install
npm run dev -- --host 0.0.0.0
~~~

If dependencies are already installed:

~~~bash
cd /workspaces/codespaces-blank/booking-project/client
npm run dev -- --host 0.0.0.0
~~~

Keep the backend running in a separate Codespaces terminal:

~~~bash
cd /workspaces/codespaces-blank/booking-project/server
npm run dev
~~~

For local MongoDB running in Docker inside the Codespace:

~~~bash
docker start booking-mongodb
docker ps
~~~

If the MongoDB container has not been created yet:

~~~bash
docker run -d \
  --name booking-mongodb \
  -p 27017:27017 \
  -v booking-mongodb-data:/data/db \
  mongo:latest
~~~

### Fix a corrupted MongoDB Docker container

This is a **MongoDB/Docker problem, not a problem with your Node.js code**.

If the server is correctly trying to connect to:

~~~text
127.0.0.1:27017
~~~

but the existing `booking-mongodb` Docker container reports an error such as:

~~~text
RWLayer ... is unexpectedlynil
~~~

the container itself appears to be corrupted. The simplest fix is to delete **only that broken container** and recreate it. Your application files will not be deleted.

From the Codespace terminal, run:

~~~bash
docker rm -f booking-mongodb
~~~

Then recreate MongoDB:

~~~bash
docker run -d \
  --name booking-mongodb \
  -p 27017:27017 \
  -v booking-mongodb-data:/data/db \
  mongo:7
~~~

Check that it started:

~~~bash
docker ps
~~~

You should see something similar to:

~~~text
booking-mongodb    mongo:7    Up ...    0.0.0.0:27017->27017/tcp
~~~

Then test MongoDB:

~~~bash
docker logs booking-mongodb
~~~

Look for:

~~~text
Waiting for connections
~~~

Now return to the server:

~~~bash
cd /workspaces/codespaces-blank/booking-project/server
npm run dev
~~~

#### If Docker still gives `RWLayer ... unexpectedlynil`

That means the Codespace Docker storage itself may be damaged rather than just the MongoDB container. Run:

~~~bash
docker ps -a
docker volume ls
~~~

If `booking-mongodb-data` exists, **don't delete that volume yet** because it may contain the existing booking-app database.

Also check the server `.env`:

~~~bash
grep MONGO .env
~~~

For the current local Docker setup, expect something along the lines of:

~~~env
MONGO_URI=mongodb://127.0.0.1:27017/booking_app
~~~

The key issue is:

~~~text
Node/Mongoose
     ↓
127.0.0.1:27017
     ↓
MongoDB container
     ✗ container currently broken
~~~

So **don't change `server.js` yet**. Fix or recreate MongoDB first.

The server `.env` should use:

~~~env
MONGO_URI=mongodb://127.0.0.1:27017/booking_app
~~~

A typical Codespaces development session therefore uses three terminals:

~~~text
Terminal 1 → MongoDB / Docker
Terminal 2 → server → npm run dev
Terminal 3 → client → npm run dev -- --host 0.0.0.0
~~~

After starting Vite, open the forwarded client port (normally **5173**) from the Codespaces **Ports** tab.

Optional client environment variable:

~~~env
VITE_API_URL=/api
~~~

When `VITE_API_URL` is omitted, the client uses same-origin `/api` and the Vite development proxy; leave `VITE_SOCKET_URL` unset to proxy Socket.IO in Codespaces as well.

## Automated verification

GitHub Actions runs a client production build, backend JavaScript syntax checks (including `.mjs`), and media authorization tests on pull requests and pushes to `main`, `feature/**`, and `betta-vone`.

## Security notes

- Public users cannot choose a privileged role during registration.
- Normal registration always creates a business account.
- Admin registration uses a long server-side secret.
- Role and account-status checks are enforced on the backend, not only through hidden navigation.
- Disabled accounts are rejected by REST and WebSocket authentication.
- Public booking validates email, phone, dates, location coordinates, and service availability.
- Browser geolocation is opt-in.
- Verified review tokens are random and tied to a single completed booking.\n- Direct business ratings enforce one rating per account/business and reject self-rating.\n- Messaging authorization, friendship requirements, block state, attachment size/type checks, and message ownership are enforced on the backend.
- Private and unpublished services remain protected by server-side queries.
- JWT secrets and administrator registration keys must not be committed to source control.

## Current architecture

~~~text
BOOKFLOW

PUBLIC
 ├── Search businesses
 ├── View profiles
 ├── View services
 ├── View published products
 ├── Order products as a guest
 ├── Book services as a guest
 └── Leave verified booking reviews

BUSINESS ACCOUNT
 ├── Business profile
 ├── Services
 ├── Bookings
 ├── Products / Inventory
 ├── POS / Online Orders
 ├── Sales & Analytics
 ├── Messages
 ├── Notifications
 ├── Verified reviews
 ├── Forum
 └── Settings

ADMIN ACCOUNT
 ├── Business directory
 ├── View business details
 ├── Pause business
 ├── Reactivate business
 ├── Disable business
 ├── Messages / notifications
 └── Admin settings
~~~


## Production readiness

BookFlow validates required server configuration at startup. In production, `CLIENT_URL` must use HTTPS, MongoDB cannot point to localhost, and secrets must meet the documented minimum length. The repository also includes GitHub Actions validation for the client production build and critical server route syntax on pushes to `main` and pull requests.

Before a real production launch, the operator must still supply production infrastructure and secrets: a hosted MongoDB instance, HTTPS frontend/backend URLs, production environment variables, domain/DNS configuration, and an appropriate backup/monitoring policy. These are deployment credentials/infrastructure rather than missing BookFlow application features.

Automatic payment verification and payment-provider webhooks are intentionally outside the current implementation.


## Pull the shadcn-ui branch

Update the branch:

```bash
git checkout shadcn-ui && git pull origin shadcn-ui
```

Update the branch and immediately run the frontend in GitHub Codespaces:

```bash
git checkout shadcn-ui && git pull origin shadcn-ui && cd client && npm run dev -- --host 0.0.0.0
```


---

## Betta V1 — Self-hosted scalability upgrade (`betta-vone`)

The [betta-vone branch](https://github.com/joebanezair/booking-project/tree/betta-vone) contains **incremental, backward-compatible code changes** toward a 100,000+ registered-user goal. This is **not** a measured claim of 100,000 concurrent users and is **not yet a complete production rollout**. The original `shadcn-ui` branch is intentionally unchanged.

### What is already implemented

| Component | State | Details |
| --- | --- | --- |
| Public discovery | Code updated | MongoDB aggregation filters active business owners, returns 12 items per category/page plus has-more detection, and avoids materializing every business in the Node.js process. Existing response shape is preserved. |
| Indexes | Code updated | Added compound booking/message/product indexes and business search indexes. Compound search performance must be benchmarked with production-like datasets; substring regex queries remain expensive. |
| Media | Opt-in implementation | Separate MongoDB GridFS connection with public image and signed private attachment routes. Existing JSON forms can still submit Base64 and are converted before persistence once the media DB is configured. |
| Media migration | Script included | Dry-run and resumable-by-retry migration for users, businesses, services, products, and chat attachments. **Take backups first.** |
| API protection | Baseline only | Per-process rate limits for login, registration, public search, and booking endpoints. Not a substitute for distributed Redis/Nginx limits. |
| Self-hosted services | Configuration included | Optional Docker Compose examples for separate GridFS MongoDB, RabbitMQ Community Edition, Redis, and Nginx public-media caching. They are not automatically deployed. |
| RabbitMQ chat events | Opt-in implementation | Persisted message flag serves as an outbox. Standalone worker publishes persistent broker events with publisher confirms and idempotent consumer processing. Existing realtime Socket.IO behavior remains. |

### 1. Separate MongoDB GridFS media storage

Configure a distinct media MongoDB server/replica set using these `server/.env` values:

```dotenv
MONGO_URI=mongodb://main-user:YOUR_PASSWORD@main-host:27017/booking_app?authSource=admin
MEDIA_MONGO_URI=mongodb://media-user:YOUR_PASSWORD@media-host:27017/bookflow_media?authSource=admin
MEDIA_PUBLIC_BASE_URL=https://api.your-domain.example
MEDIA_SIGNING_SECRET=replace-with-a-unique-random-secret-at-least-32-characters
```

**Never commit the real credentials.** Configure `MEDIA_PUBLIC_BASE_URL` when the API is not served from the same origin as the frontend. Without `MEDIA_MONGO_URI`, existing Base64 upload behavior remains enabled to preserve development compatibility. Setting the media URI causes startup to require a working media DB.

Image and attachment behavior:

- Images: `/api/media/public/:id`, cacheable for 24 hours; JPEG, PNG, WebP, GIF, max 2 MB.
- Chat attachments: `/api/media/private/:id`, time-limited signed download URLs; allowed document/image MIME types, max 5 MB. Signed links expire after 15 minutes and are never cached publicly.
- New GridFS files use native binary storage; MongoDB #1 stores the resulting reference URL rather than the original Base64 string.
- For a future binary frontend, authenticated `POST /api/media/upload?visibility=public|private` accepts `application/octet-stream` with the actual type in the `X-File-Mime` header. Do not put bearer tokens in public HTML image URLs.
- Existing frontend upload dialogs remain visually unchanged, but now send binary files when GridFS is configured; they retain Base64 previews in browser memory and Base64/JSON fallback without media MongoDB. Generating responsive WebP/AVIF thumbnails is a **follow-up task**.
- GridFS is **not** an image CDN. Optional `infrastructure/nginx-media-cache.conf` caches public images only. The private route must never be publicly cached.

#### Migrate existing Base64 media

Back up main and media databases before migration. Test the dry-run in a clone/staging environment:

```bash
cd server
node scripts/migrate-media.js --dry-run
node scripts/migrate-media.js
```

Run with both `MONGO_URI` and `MEDIA_MONGO_URI` configured. Running the real migration uploads files then updates their references. Re-running after an interruption skips already converted values, but a crash between upload and reference update can leave orphaned GridFS files. Verify all references and keep backups until migration validation is complete. Do not migrate live data concurrently without additional write coordination.

### 2. Self-host RabbitMQ and Redis on your VPS

The included services file is a **development / single-host example**, not a production HA topology. Create `infrastructure/.env` locally with strong secrets and appropriate private-network URLs:

```dotenv
MEDIA_MONGO_USER=bookflowmedia
MEDIA_MONGO_PASSWORD=replace-with-long-unique-password
RABBITMQ_USER=bookflow
RABBITMQ_PASSWORD=replace-with-long-unique-password
REDIS_PASSWORD=replace-with-long-unique-password
# Required only if starting the optional chat-broker profile
MONGO_URI=mongodb://main-user:YOUR_PASSWORD@main-host:27017/booking_app?authSource=admin
RABBITMQ_URL=amqp://bookflow:URL_ENCODED_PASSWORD@rabbitmq:5672
```

```bash
docker compose --env-file infrastructure/.env -f infrastructure/compose.services.yml up -d
# Optional event publishing / processing worker:
docker compose --env-file infrastructure/.env -f infrastructure/compose.services.yml --profile chat up -d
```

Set `RABBITMQ_URL` in the **API server** environment only after the worker is running and both can reach the RabbitMQ broker. Newly created messages then carry `queuePending=true`, the worker publishes persisted events to a durable broker queue, and an idempotent handler records the processing acknowledgment. The queued payload contains metadata only, not message bodies or file bytes. Direct realtime messages and notifications are **still** delivered by existing Socket.IO/Express code; RabbitMQ does **not** replace Socket.IO or guarantee delivery to a browser. A broker crash/reconnect may cause duplicate events, handled idempotently.

VPS costs still apply; RabbitMQ Community Edition software itself does not require a subscription. Bind broker/Redis/MongoDB ports to loopback or a private VPN. Production deployments require proper authentication, TLS, monitoring, backups, and an HA design when uptime targets demand it. A single VPS is a single point of failure.

### 3. Rate limiting, search, indexes and monitoring

- API endpoints have basic in-process limits. Set `TRUST_PROXY=1` **only when Express is behind a trusted reverse proxy**. Use shared rate limits at the proxy/Redis layer for multiple API replicas.
- Search now executes user/provider filtering and pagination in the database; however case-insensitive substring matching and a large number of lookups can still become slow. Index analysis, dedicated search indexing, and performance testing with 100K+ synthetic business accounts are required.
- All existing service/profile/product API shapes remain compatible. Several main routes (private bookings, messaging contact lists, admin lists, sales) still have unbounded or heavy queries and require subsequent pagination/aggregation changes.
- `server/server.js` still contains startup backfills. Migrate them to a separate maintenance job **before** high-availability deployments; they are not removed in this iteration.
- `infrastructure/nginx-media-cache.conf` is a sample Nginx block; configure HTTPS, origin proxying, request limits, cache zone, and monitoring for your actual VPS.
- Database availability, migrations, backups, logs, alerting, CDN-equivalent cache efficiency, multiple API instances, and the Socket.IO Redis adapter are **not automatically configured** by the code changes.

#### Recommended caching strategy (planned; not deployed)

Caching should speed up repeated **public, read-only** requests without exposing private data or making bookings, orders, prices, or inventory stale. The policies below are **recommendations**, not enabled merely by this README update. Current code sets `Cache-Control: public, max-age=86400, immutable` for GridFS public media, `private, no-store` for private media, and `no-store` for order-tracking responses. Redis is only an optional Compose service; the Nginx media cache is an example configuration, not a confirmed deployment.

| Resource | Recommended policy | Correctness and invalidation |
| --- | --- | --- |
| Production JS/CSS/images with content-hashed filenames | Browser/CDN: `public, max-age=31536000, immutable` **only** for fingerprinted assets | New builds must publish new asset URLs; do not apply this to `index.html` or assets overwritten at the same URL. |
| `index.html` / application shell | `no-cache, must-revalidate` so clients check for a new build on navigation | Ensure updates appear after deployment; verify the actual hosting platform's response headers. |
| Public GridFS images (`/api/media/public/:id`) | Keep the existing 24-hour browser cache; optionally enable Nginx/CDN caching for this route | Only cache images intended to be public. Use new IDs/URLs or explicit purges when images change; monitor `X-Cache`/hit rates if Nginx is enabled. |
| Public search, categories, and published business/service summaries | **Proposed:** Redis cache-aside with a short 30–60-second TTL for non-personalized, non-availability data | Invalidate on publish/edit/unpublish/delete. Include tenant/business, normalized query, filters, page, language, and API version in cache keys. Never share personalized responses. |
| More stable public profile descriptions and business metadata | **Proposed:** 1–5-minute TTL **only** for fields that do not affect checkout, pricing, availability, or authorization | Invalidate on profile changes. Keep live stock/prices and booking availability out of this cache. |
| Bookings, appointment slots, product stock, checkout, order status, sales, authentication, messages, and admin/account data | Do **not** use shared/public caching; use `Cache-Control: no-store` for sensitive or fast-changing responses | Read authoritative data for writes and decisions. Always validate stock, price, booking capacity, and permissions on the server. Do not cache mutations. |
| Private media/attachments (`/api/media/private/:id`) | Keep `private, no-store`; never put signed private responses in a CDN/shared cache | Preserve authorization/signature checks and short-lived download links. |

**Implementation order and safeguards:**

1. **Audit current behavior first.** Inspect browser DevTools and response headers in staging/production, including deployment CDN behavior; Vite development behavior is not proof of production caching. Record baseline latency, DB query rates, and stale-content incidents.
2. **Configure browser/CDN assets and public image caching.** Use fingerprinted build assets, revalidated HTML, and the sample `infrastructure/nginx-media-cache.conf` only after adapting it for the actual HTTPS proxy and proving private endpoints cannot enter the cache.
3. **Introduce opt-in Redis cache-aside for measured public read hotspots.** Start with discovery listings (not orders or booking availability); bound entry size/memory, set TTLs with jitter, enforce tenant-safe keys, and handle Redis outages as normal uncached requests. Never use cached values as an authoritative write precondition.
4. **Invalidate immediately after successful writes** that affect cached public data; include event-driven invalidation or versioned keys when multiple API instances are added. Test publish/edit/delete, permissions, and concurrent updates; TTL expiry is only a fallback, not a correctness guarantee.
5. **Monitor and roll out gradually.** Track hit/miss rate, latency (p50/p95), DB load, Redis memory/evictions, cache-related errors, and stale-data regressions. Disable or shorten TTLs if freshness or security cannot be verified. Do not introduce an offline/service-worker cache for authenticated pages or transactional data without an explicit invalidation and privacy design.

##### First-phase Redis cache-aside implementation checklist (proposed)

Start with **`GET /api/public/browse`** and carefully selected, non-personalized results from **`GET /api/public/search`** in `server/routes/public.js`. These already query MongoDB; the cache should sit around successful public-read responses, not around booking, checkout, stock, or permission checks. This is an implementation plan, **not code currently enabled** on `betta-vone`.

1. **Run the optional Redis service securely.** Create `infrastructure/.env` locally with a strong `REDIS_PASSWORD` (do not commit it), then start only the Redis service from the repository root:

   ```bash
   docker compose --env-file infrastructure/.env -f infrastructure/compose.services.yml up -d redis
   ```

   The supplied Compose example binds port 6379 to host loopback. Use private networking and authentication in deployment; do not expose Redis publicly.
2. **Install and configure the server Redis client.** In `server/`, run `npm install redis`; add a `REDIS_URL` setting to the **server's** environment (not any `VITE_*` frontend variable). Example for a host-run API with Redis bound to host loopback:

   ```dotenv
   REDIS_URL=redis://:URL_ENCODED_PASSWORD@127.0.0.1:6379
   ```

   URL-encode special characters in the password. A containerized API needs a reachable **private** Redis address instead of its own `127.0.0.1`. Add connection timeouts and handle Redis unavailability without blocking public reads.
3. **Implement cache-aside on public GET handlers.** Normalize allowed query arguments; build versioned cache keys containing query, category, rating, and page (plus locale/tenant if applicable); check Redis; on a hit return the cached response; on a miss query MongoDB, return the result, and optionally store successful public responses using a short expiration (`EX`). Suggested starting TTLs: `/api/public/browse` **30 seconds**, public `/api/public/search` **30–60 seconds**. Add small TTL jitter and bounded payload sizes. Do not cache errors or sensitive/personalized responses.
4. **Keep all writes database-first.** Create/update/delete a service or product in MongoDB first; only after MongoDB confirms the write, invalidate affected public-listing/search cache keys (prefer versioned namespaces or a controlled key index over unrestricted Redis `KEYS`). Profile changes, publication changes, visibility changes, and account-status changes may also affect discovery results. Multi-instance deployments need shared invalidation. An invalidation failure must be logged/retried and may leave public listings stale until TTL expiry; **never** allow a cached value to authorize checkout, a booking, or a stock decrement.
5. **Fail open for the cache, not for the database.** When Redis is down or a key expires, query MongoDB directly. If MongoDB cannot save a booking/order, return an error rather than claiming success. Redis eviction/restart must not delete a confirmed MongoDB record; do not implement write-behind or cache-only order storage.
6. **Verify rollout in staging before enabling in production.** Test cache miss → hit, expiry, concurrent requests, edit/publish/unpublish invalidation, Redis shutdown/restart, cross-business isolation, and freshness of orders/slots/inventory. Measure cache hits, p95 latency, MongoDB load, Redis memory/evictions, and invalidation failures. Keep a configuration switch to disable caching quickly.

**Safety invariant:** `MongoDB write succeeds → invalidate affected cache → respond according to the committed result`. A read cache can be discarded at any time without losing permanent data. The checkout/booking workflow must continue to read and validate authoritative MongoDB state, and cache invalidation should never be mistaken for a database commit.

See also recommendation **19** (Redis TTL/invalidation) and **21** (Nginx public-media caching) below. Neither is currently fully deployed as a general application cache.

### 4. Remaining priority upgrades (not implemented yet)

1. **Booking concurrency:** a shared MongoDB mutation lease now serializes normal app booking writes across replicas, and reopening schedulable bookings rechecks capacity. Add truly atomic capacity claims, lease-expiry protection, and race tests before advertising zero double-bookings.
2. **Remaining pagination:** optional cursor/limit API pagination now covers private booking lists and the admin directory, but existing UI still loads legacy arrays. Migrate high-volume UI screens, and add pagination to sales, messaging contact lists, customer history, and public profile collections. Conversation history already uses a 50-message cursor and Load Older control.
3. **Image delivery:** binary browser uploads now work when GridFS is enabled (otherwise Base64 is retained); next generate responsive WebP/AVIF variants, clean abandoned media, and measure Nginx cache hit ratio.
4. **RabbitMQ operations:** the chat event worker now includes bounded retries and a durable dead-letter queue; add advanced retry/backoff policies, notification/email consumers, operational dashboards, and multiple broker nodes when availability warrants.
5. **Horizontal deployment:** add multiple API instances, configure cross-instance Socket.IO messaging (such as its Redis adapter), and distributed rate limits.
6. **Reliability:** basic readiness/liveness probes and graceful shutdown are now added; still extract remaining startup data migrations, implement backup/restore drills, structured logs, metrics, deployment rollback, and security tests.
7. **Validation:** functional/regression tests and k6/Artillery tests at 100, 1K, 5K, 10K+ concurrent users; **100K concurrent users remain unverified**.

Keep existing BookFlow behavior, designs, business profiles, messaging, bookings, products, POS, sales, reviews, and admin capabilities intact. Work only on `betta-vone` until each release candidate is tested.

### 5. Continuous validation and startup migrations

The CI workflow now runs on pushes to `betta-vone` and checks the client build and server `.js`/`.mjs` syntax. Historical account/booking/sales backfills no longer execute unconditionally at every server startup; use `RUN_LEGACY_MIGRATIONS=1` only during a controlled maintenance window after a backup. This switch does not replace a formal migration runner and needs operational oversight.

### 6. Public-discovery load-test baseline

Run a read-only ramp test against a controlled staging deployment after installing [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/):

```bash
k6 run -e BASE_URL=https://staging-api.example.com tests/load/public-discovery.js
```

The script ramps to 100 virtual users, checks API error rates and p95 duration for browse/search, and **does not prove 100K concurrency**. Test data, deployment capacity, and authorization scenarios must be representative before claiming a production capacity number. The API health route now reports 503 when the main MongoDB connection is unavailable.

### 7. Chat history pagination

Conversation retrieval now returns the most recent 50 messages and `hasMoreMessages`, retaining the existing `messages` response field. The frontend's **Load older messages** control requests previous pages using the earliest loaded message ID as its cursor. The messaging sidebar's latest-message aggregation also uses database grouping rather than transferring full histories to Node.js. Existing message and reaction controls remain available.


---

## Complete scalability recommendations (34 items)

**Target:** Design and validate BookFlow for **100,000+ registered accounts**, without assuming 100,000 simultaneous users. **Branch:** `betta-vone`. **Deployment preference:** Self-hosted VPS infrastructure (MongoDB, MongoDB GridFS, RabbitMQ Community Edition, Redis, Nginx), **not Cloudflare R2**.

**Status legend:**

- **Implemented (code):** present in the branch; still needs deployment and/or production validation.
- **Partial:** initial code or configuration exists, but related work remains.
- **Example only:** sample infrastructure provided; not deployed by the repository.
- **Pending:** a recommended next step, **not yet implemented or verified**.

These statuses are implementation assessments, **not guarantees of production readiness**. For how to operate the features currently included, see [Betta V1 — Self-hosted scalability upgrade](#betta-v1--self-hosted-scalability-upgrade-betta-vone).

### A. Database and media storage (1–9)

| # | Recommendation | Current status | Priority |
| --- | --- | --- | --- |
| 1 | Separate the primary application MongoDB and media MongoDB deployments | Partial — opt-in second connection and Compose example | Critical |
| 2 | Store uploaded image/file bytes in dedicated MongoDB GridFS and store their reference URLs in application documents | Partial — supported when media MongoDB is enabled; Base64 fallback remains | Critical |
| 3 | Migrate existing profile, business, service, product and attachment media out of Base64 fields | Pending execution — migration script supplied | Critical |
| 4 | Replace frontend Base64/JSON uploads with binary uploads | Partial — new binary upload path when GridFS is enabled; Base64 fallback preserved | High |
| 5 | Generate responsive, optimized WebP/AVIF image variants | Partial — optional browser-side image downscaling/WebP before binary upload; true responsive variants remain pending | High |
| 6 | Create and benchmark MongoDB indexes | Partial — indexes added; production-like query-plan analysis pending | Critical |
| 7 | Optimize database queries, projections and aggregations | Partial — public discovery and some message queries improved | Critical |
| 8 | Implement cursor/limit pagination throughout public and authenticated endpoints | Partial — discovery, conversation pages, and opt-in booking/admin/contact endpoints exist; legacy UI and more routes remain | Critical |
| 9 | Extract expensive legacy data migrations from API startup into controlled jobs | Partial — guarded startup backfills exist; separate migration runner pending | High |

### B. Real-time chat and messaging (10–17)

| # | Recommendation | Current status | Priority |
| --- | --- | --- | --- |
| 10 | Self-host RabbitMQ Community Edition on a VPS | Example only — Compose service supplied; requires deployment | High |
| 11 | Publish durable asynchronous chat events to RabbitMQ | Partial — opt-in worker/event outbox implemented; operational hardening remains | High |
| 12 | Keep Socket.IO for low-latency browser chat delivery | Implemented (code) — existing realtime path retained | Critical |
| 13 | Add the Socket.IO Redis adapter for multi-instance message delivery | Pending — Redis container alone does not enable the adapter | Critical |
| 14 | Implement delivery acknowledgements, retries and stronger reliability guarantees appropriate to the delivery stage | Partial — broker confirms and bounded worker retries exist; end-user delivery guarantees are not implemented | High |
| 15 | Add RabbitMQ dead-letter queues, backoff/retries and operational monitoring | Partial — dead-letter queue and bounded retries exist; dashboards/fault testing pending | High |
| 16 | Paginate message history and provide a Load older messages control | Implemented (code) — 50-message cursor pages; contact pagination is opt-in | High |
| 17 | Move heavy notifications/email and other non-realtime jobs into workers | Pending | Medium |

**Important:** RabbitMQ is for durable asynchronous events and background work; it **does not replace Socket.IO** or prove that a recipient's browser displayed a message. RabbitMQ Community Edition software does not need a paid subscription, but VPS, storage, networking and operations have costs.

### C. API, search and horizontal scaling (18–25)

| # | Recommendation | Current status | Priority |
| --- | --- | --- | --- |
| 18 | Optimize business, product and service discovery searches | Partial — database-side paging/filtering; regex/search performance still needs benchmarking | Critical |
| 19 | Add Redis caching with explicit TTLs and invalidation for frequently read data | Pending — infrastructure example only | High |
| 20 | Apply shared/distributed API rate limits across instances | Partial — opt-in MongoDB shared atomic rate limiter; prefer Redis/proxy at scale | Critical |
| 21 | Configure Nginx as an HTTPS reverse proxy, load balancer and public-media cache | Example only — media-cache sample provided | High |
| 22 | Run multiple Node.js API instances behind a load balancer | Pending | Critical |
| 23 | Protect booking capacity and rescheduling from cross-request and cross-instance races | Partial — MongoDB lease guards normal writes; transactions/fencing and race tests pending | Critical |
| 24 | Tune MongoDB pools, indexes and hot paths; eliminate remaining unbounded queries | Partial — configurable MongoDB pool, batch search reviews and paged opt-in private/admin/chat routes; sales and legacy UI remain | High |
| 25 | Introduce dedicated search indexing when regular MongoDB substring search becomes a measured bottleneck | Pending/conditional | Medium |

### D. Reliability, security and validation (26–34)

| # | Recommendation | Current status | Priority |
| --- | --- | --- | --- |
| 26 | Add structured logs, metrics, tracing as needed and actionable alerts | Pending | High |
| 27 | Automate MongoDB/media backups and practice tested restores | Pending | Critical |
| 28 | Restrict MongoDB/RabbitMQ/Redis to private networking and configure authentication/TLS as appropriate | Deployment required — localhost-bound examples do not secure a production deployment by themselves | Critical |
| 29 | Expand regression testing for bookings, chat, uploads, authentication and authorization | Partial — media/cursor tests and CI checks exist; integration and race tests pending | Critical |
| 30 | Expand CI/CD automated testing, security checks and deployment gates | Partial — build, syntax and media tests in CI | High |
| 31 | Add production health checks, safe releases and rollback procedures | Partial — health, readiness/liveness and graceful shutdown exist; release/rollback process pending | High |
| 32 | Perform measured load tests at 100, 1K, 5K and 10K+ **concurrent virtual users**, where infrastructure permits | Pending — a ramp-to-100 k6 script exists, not proof of results | Critical |
| 33 | Test realistic datasets containing 100K+ registered users, plus representative active-user traffic | Pending | Critical |
| 34 | Design redundancy/HA for critical components; remove single-VPS points of failure when needed | Pending | High |

### Recommended target architecture

This diagram is a **future-state target**, not a claim that every service is connected or deployed on `betta-vone`.

```mermaid
flowchart TB
    Users["Web and mobile users"]
    Proxy["Nginx: HTTPS, public media cache, rate limits, load balancing"]
    Users --> Proxy
    Proxy --> API1["Node.js API instance 1<br/>Express + Socket.IO"]
    Proxy --> API2["Node.js API instance 2<br/>Express + Socket.IO"]
    Proxy --> APIN["Node.js API instance 3+<br/>Express + Socket.IO"]
    API1 --> MainDB[("Main MongoDB<br/>users, products, bookings")]
    API2 --> MainDB
    APIN --> MainDB
    API1 --> MediaDB[("Media MongoDB GridFS<br/>images, attachments")]
    API2 --> MediaDB
    APIN --> MediaDB
    API1 -. "planned cache / Socket.IO adapter" .-> Redis[("Redis")]
    API2 -. "planned cache / Socket.IO adapter" .-> Redis
    APIN -. "planned cache / Socket.IO adapter" .-> Redis
    API1 -. "optional message events" .-> Broker[("RabbitMQ")]
    Broker --> Worker["Background workers<br/>events, notifications, jobs"]
    Worker --> MainDB
```

The media database holds binary GridFS content, while application documents hold media reference URLs. Protect private chat attachments with expiring signed links and avoid public caching. The current frontend still sends Base64 data inside JSON; direct binary upload and responsive image sizes are planned improvements. When scaling Socket.IO beyond one API instance, wire up the Redis adapter and verify cross-instance events and reconnection behavior. Neither Redis nor RabbitMQ alone solves horizontal scaling.

### Recommended implementation order

1. **Phase 1 — Database and media:** Configure separate media MongoDB, back up and migrate existing Base64 media, implement binary upload and responsive variants, benchmark indexes, and finish key pagination/query changes.
2. **Phase 2 — Chat and distributed infrastructure:** Deploy RabbitMQ/Redis on a secured VPS, enable the Socket.IO Redis adapter, harden broker retries/dead-letter handling, and introduce appropriate background workers.
3. **Phase 3 — Horizontal scaling:** Add Nginx reverse proxy/load balancing and multiple API instances, distributed rate limits, selective Redis cache, and race-safe booking capacity updates.
4. **Phase 4 — Production validation:** Benchmark representative read/write/WebSocket loads, test backups and restores, add logging/alerts, verify deployment rollback, and perform security/regression tests.

**Suggested next engineering priority:** Finish media migration, expensive query pagination, and atomic booking concurrency protection **before** relying on more application servers to increase capacity.

### What "100K users" means (and does not mean)

| Measurement | What to validate |
| --- | --- |
| **100,000+ registered users** | Account and business dataset size; database indexes, disk capacity and query-plan performance. |
| **Concurrent online users** | A separately measured quantity; registration count does not indicate concurrent traffic. |
| **Concurrent chat connections** | Cross-instance Socket.IO behavior, reconnects, messaging throughput and broker/Redis health. |
| **API response time** | p95/p99 latency, throughput and error rates for browse, search, booking, auth, profiles and messaging. |
| **Images and attachments** | Transfer sizes, thumbnail formats, GridFS throughput, Nginx cache hit rate and private-link authorization. |
| **Booking correctness** | Concurrency/race tests demonstrating no double-booking for configured capacity. |
| **Recovery** | Automated backup coverage, measured recovery procedures, alerting and failover plans. |

Use the supplied read-only k6 discovery script as a **baseline**; then extend tests to authenticated traffic, uploads, reservations and realtime messaging in a controlled staging environment. Avoid claiming support for **100K concurrent users** or guaranteed zero booking conflicts until repeatable results substantiate those claims.

### Branch update command

```bash
git fetch origin && git checkout betta-vone && git pull origin betta-vone
```

Keep the `shadcn-ui` branch unchanged during this work, and preserve all existing business profiles, services, products, POS, sales, messaging, bookings, reviews, admin functions and responsive UI.
