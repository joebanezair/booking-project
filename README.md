# BookFlow — Business Booking and Service Platform

BookFlow is a full-stack MERN application for service businesses. The account model is intentionally simple:

- **Business** — the normal registered account. Businesses register immediately, maintain a public profile, publish services, receive guest bookings, manage appointments, message other registered accounts, receive notifications, participate in the forum, and manage settings.
- **Admin** — a privileged platform operator. Admins manage business accounts and can pause, reactivate, or disable them. Admins do not approve normal business registration.
- **Guest** — not an account type. Public visitors can search businesses and services, view public profiles, and create booking requests without registering.

There is no customer account role and no customer-to-business approval workflow.

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

## Development setup

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
MONGO_URI=mongodb://127.0.0.1:27017/booking
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
MONGO_URI=mongodb://localhost:27017/booking-project
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
VITE_API_URL=http://localhost:5000/api
~~~

When VITE_API_URL is omitted, the client uses /api.

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
