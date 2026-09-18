# BookFlow — Business Booking and Service Platform

BookFlow is a full-stack MERN application for service businesses. The account model is intentionally simple:

- **Business** — the normal registered account. Businesses register immediately, maintain a public profile, publish services, receive guest bookings, manage appointments, message other registered accounts, receive notifications, participate in the forum, and manage settings.
- **Admin** — a privileged platform operator. Admins manage business accounts and can pause, reactivate, or disable them. Admins do not approve normal business registration.
- **Guest** — not an account type. Public visitors can search businesses and services, view public profiles, and create booking requests without registering.

There is no customer account role and no customer-to-business approval workflow.

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

Public business profiles display the aggregate verified-review rating and recent verified comments.

The current implementation generates and exposes the review link to the business. It does not automatically email or SMS the guest.

## Business dashboard

Business accounts have access to Dashboard, Services, Bookings, Sales & Analytics, Messages, Profile, Notifications, Forum, Settings, and Search. The authenticated dashboard uses one responsive layout across desktop, tablet, and phone sizes. On smaller screens the same navigation moves to a sticky horizontal bar at the top; there is no separate mobile dashboard or bottom navigation.

### Services

Businesses can create service drafts, edit services, publish/unpublish services, set public/private visibility, configure price and currency, upload a cover image and gallery, enable/disable service ratings, enable/disable booking, and receive comments and reactions.

Paused businesses may keep editing existing services and create drafts, but cannot publish a previously unpublished service.

### Bookings

Businesses can view guest bookings, open booking details, see guest name/email/phone/location/service/price/schedule/notes/status, create internal booking records while active, and move bookings through Pending, Confirmed, In Progress, Completed, Cancelled, or No Show.

Marking a booking **Completed** automatically creates one linked sale using the service price and currency snapshotted on the booking. Reopening a completed booking voids that sale while keeping the audit record. A completed booking with a sales audit record cannot be deleted, and its price/service/date cannot be silently rewritten while still completed.

Completing a booking also creates the verified-review invitation.

### Sales & Analytics

Businesses have a dedicated page:

~~~text
/dashboard/sales
~~~

The page provides:

- recorded completed-service sales;
- completed service count;
- average sale value;
- distinct services sold;
- Daily / Weekly / Monthly / Annual trend grouping;
- Today / 7 Days / This Month / This Year / All Time / Custom date filters;
- sales-by-service performance bars;
- detailed completed-sale records;
- multi-currency summaries when applicable;
- Excel-compatible spreadsheet export.

The export contains Summary, Sales Records, Sales Trend, and Service Performance worksheets.

**Recorded Sale = Completed Booking Value.** This is not the same as confirmed payment until a payment provider is integrated.

### Business profile

Businesses can edit business name, category, description, location, email, phone, website, logo, username, biography/headline, cover photo, and draggable profile-photo crop.

No approval or resubmission state exists.

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

Messaging is available only to authenticated Business and Admin accounts. It includes a registered business/admin directory, one-to-one conversations, persistent history, read tracking, direct profile-to-message navigation for signed-in accounts, emoji reactions, and real-time delivery through authenticated Socket.IO rooms.

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
GET    /api/bookings/:id
POST   /api/bookings
PUT    /api/bookings/:id
PATCH  /api/bookings/:id/status
DELETE /api/bookings/:id
~~~

### Sales analytics

~~~text
GET /api/sales/analytics?range=month&group=daily
~~~

Supported ranges are today, 7d, month, year, all, and custom. Supported chart grouping is daily, weekly, monthly, and annual.

### Public discovery and booking

~~~text
GET  /api/public/profile/:username
GET  /api/public/content/:contentId
GET  /api/public/browse
GET  /api/public/search
GET  /api/public/book/:userId
POST /api/public/book/:userId
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

Server startup also backfills existing completed bookings into the sales ledger. If an older completed booking did not store a price snapshot, BookFlow uses the currently linked service price/currency as the best available historical fallback.

## Technology stack

Frontend: React 19, React Router, Vite, React Icons, Socket.IO Client.

Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Socket.IO.

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

Optional client environment variable:

~~~env
VITE_API_URL=http://localhost:5000/api
~~~

When VITE_API_URL is omitted, the client uses /api.

## Automated verification

GitHub Actions runs a client production build and backend JavaScript syntax checks on pull requests and pushes to main/feature branches.

## Security notes

- Public users cannot choose a privileged role during registration.
- Normal registration always creates a business account.
- Admin registration uses a long server-side secret.
- Role and account-status checks are enforced on the backend, not only through hidden navigation.
- Disabled accounts are rejected by REST and WebSocket authentication.
- Public booking validates email, phone, dates, location coordinates, and service availability.
- Browser geolocation is opt-in.
- Verified review tokens are random and tied to a single completed booking.
- Private and unpublished services remain protected by server-side queries.
- JWT secrets and administrator registration keys must not be committed to source control.

## Current architecture

~~~text
BOOKFLOW

PUBLIC
 ├── Search businesses
 ├── View profiles
 ├── View services
 ├── Book services as a guest
 └── Leave verified booking reviews

BUSINESS ACCOUNT
 ├── Business profile
 ├── Services
 ├── Bookings
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
