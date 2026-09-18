# BookFlow — Service Search, Booking, and Messaging Platform

BookFlow is a full-stack MERN application with separate **admin**, **business**, and **customer** experiences. Business accounts publish services and manage their own bookings. Admins have those provider capabilities plus platform customer-directory access. Customers browse services, request bookings, and manage only their own appointments.

## Features

### Authentication and accounts

- Account registration and login
- Password hashing with bcrypt
- JWT-protected private APIs
- Persistent signed-in client sessions
- Automatically generated unique usernames
- Protected dashboard routes
- Role-based authorization enforced by both the frontend and backend
- Public registration always creates a `customer`; users cannot select a privileged role
- Invite-only administrator registration validated by a server-side environment key
- One business application per customer, submitted from Profile and approved by an administrator
- Personal/business mode switching after approval without creating another login
- Optional admin promotion through the server-side `ADMIN_EMAILS` environment variable

### User roles and permissions

| Capability | Admin | Business | Customer |
| --- | --- | --- | --- |
| Apply for one linked business profile | No | Legacy | Yes |
| Manage their own business services | Yes | Yes | After approval |
| Publish, unpublish, edit, or delete their own services | Yes | Yes | No |
| Manage incoming bookings for their account | Yes | Yes | No |
| View the platform customer directory | Yes | No | No |
| Browse public services | Yes | Yes | Yes |
| Request a service booking | Yes | Yes | Yes |
| View bookings linked to their customer account | No | No | Yes |
| Cancel their own customer booking requests | No | No | Yes |
| Use messages, notifications, forum, profile, and themes | Yes | Yes | Yes |

Role restrictions are enforced by API middleware. Hiding navigation links is only a convenience; unauthorized direct requests return HTTP `403`.

### Separate application pages

Every major feature has its own route instead of being combined into one dashboard page:

| Page | Route |
| --- | --- |
| Dashboard overview | `/dashboard` |
| Service management | `/dashboard/services` |
| Post a service | `/dashboard/services/new` |
| Edit a service | `/dashboard/services/:serviceId/edit` |
| Booking management | `/dashboard/bookings` |
| Booking details | `/dashboard/bookings/:bookingId` |
| Customer management (admin only) | `/dashboard/customers` |
| Business application review (admin only) | `/dashboard/business-requests` |
| Real-time messages | `/dashboard/messages` |
| Direct conversation | `/dashboard/messages/:userId` |
| Profile management | `/dashboard/profile` |
| Notification center | `/dashboard/notifications` |
| Appearance settings | `/dashboard/settings` |
| Invite-only registration | `/register/:role/:inviteKey` |
| Public forum | `/forum` |
| User and service search | `/search` |
| Public service details | `/services/:serviceId` |
| Public user profile | `/profile/:username` |
| Public booking form | `/b/:userId` |

Legacy `/dashboard/content`, `/dashboard/content/new`, `/dashboard/content/:id/edit`, and `/content/:id` URLs remain available for backward compatibility.

### Profile management

- Edit name, username, headline, biography, location, and website
- Upload or remove a profile photo
- Drag the profile photo directly inside its circular frame using mouse or touch
- Fine-tune profile-photo positioning with the keyboard arrow keys
- Upload, preview, or remove a profile cover photo
- Display the cover photo and positioned avatar on the public profile
- Preview the public profile from profile settings
- Display all public services belonging to the provider
- Share the public landing page with Open, Copy Link, and native Share actions
- Use one public `/profile/:username` link for the provider profile, services, ratings, discussions, and booking entry points
- Submit, update, and track one business application from the Profile tab
- Switch between personal bookings and approved business-management tools with the same account

### Appearance and design settings

- Dedicated Settings page for Light and Dark themes
- Theme selection applies across dashboard and public pages
- Theme preference persists in browser storage across sessions
- Accessible Light and Dark theme selection cards with React Icons
- Consistent 5px corner radius for cards, controls, forms, images, dialogs, and major containers
- Circular avatars, status indicators, and badges remain circular for clarity

### Service management

- Post, view, edit, publish, unpublish, and delete services
- Save services as drafts
- Add a title, description, price, currency, and category
- Upload a featured image and up to eight additional images
- Enable or disable ratings per service
- Enable or disable schedule booking per service
- Set visibility to public or private
- View public/private and published/draft status in service management
- MongoDB persistence and owner-only editing

The existing MongoDB `Content` collection and internal content API are intentionally preserved so existing records continue working. The user-facing product calls these records **services**.

### Public and private visibility

- Public services can appear in search, public profiles, public service pages, ratings, reactions, comments, and service-specific booking
- Private services are visible only to their owner through protected management routes
- Private services are excluded by server-side queries from public search and profiles
- Direct public requests for a private service return an error
- Ratings, reactions, comments, and public bookings enforce visibility on the server

### User and service search

- Search registered users and public services from one page
- Separate Users and Services result tabs
- Search users by name, username, headline, and location
- Search services by title, description, category, and provider
- Filter services by category and minimum rating
- Debounced search input
- Incremental **Load more** pagination
- Loading, empty, and error states
- Direct links to public profiles and public service pages
- Private services never appear in search results

### Ratings

- Rate eligible public services from one to five stars
- Display average rating and total rating count
- Update or remove an existing rating
- One rating per user per service
- Service owners cannot rate their own services
- Ratings require authentication
- Providers can disable ratings for an individual service
- Every public admin profile has an independent 1–5-star business rating summary
- Authenticated customers can add, update, or remove one rating per business
- Admins can view business ratings but cannot submit profile ratings
- Rating averages and totals update immediately without a full page reload

### Notifications

- Dedicated notification center with unread state and timestamps
- Mark individual notifications or all notifications as read
- Real-time notification delivery through authenticated WebSockets
- Notifications for new messages, booking requests, service comments, and profile ratings
- Notifications link directly to the relevant application page

### Public forum

- Publicly readable community forum at `/forum`
- Authenticated users can publish categorized discussion posts
- Authenticated users can reply to forum posts
- Author identity, timestamps, categories, and threaded post replies
- Real-time refresh events for new posts and replies

### Likes and dislikes

- Like or dislike an eligible public service
- Display separate like and dislike totals
- One reaction per user per service
- Switch directly between Like and Dislike
- Select the active reaction again to remove it
- Immediate interface updates without refreshing the page
- WebSocket reaction broadcasts
- Service owners cannot react to their own services
- Database uniqueness constraint prevents duplicate reactions

### Threaded discussions

- Comment on public services while signed in
- Reply directly to existing comments
- Nested replies up to three levels deep
- Expand and collapse reply threads
- Edit personal comments
- Delete personal comments
- Service owners can moderate comments on their services
- Deleted parent comments are preserved as placeholders when replies exist
- Author details, timestamps, and edited status
- WebSocket events for new, edited, and deleted comments
- Up to 200 comments loaded per service discussion

### Emoji reactions

- React to direct messages, top-level comments, and replies with 👍 ❤️ 😂 😮 😢 or 🙏
- Toggle each emoji independently, with one reaction of each type per user and target
- Display reaction totals and highlight the signed-in user's selections
- Accessible emoji picker with keyboard focus, Escape dismissal, outside-click dismissal, and touch-friendly controls
- Message reactions are authorized against conversation membership
- Comment reactions are authorized against accessible public services
- Real-time message-reaction updates are limited to the two conversation participants
- Real-time comment-reaction updates use service-specific Socket.IO rooms
- Existing service Like/Dislike reactions remain separate and unchanged

### Booking management

- Create, view, edit, and delete bookings
- Pending, confirmed, and cancelled statuses
- Booking statistics
- Admin booking records are scoped to the signed-in business administrator
- Authenticated customer requests are linked to the customer account
- Customers can view and cancel only their own linked booking requests
- Public booking requests without requiring visitor registration
- Guest name, email, phone number, requested date/time, service, and notes
- Optional service address/location label for in-person work
- Consent-based browser geolocation with latitude, longitude, and accuracy stored only after the visitor explicitly chooses **Use my current location** and approves the browser permission prompt
- Manual location entry remains available when geolocation is unavailable or permission is denied
- Booking details expose clickable phone links and an OpenStreetMap link when coordinates were shared
- Public requests default to `pending`
- Service-specific booking buttons on eligible public service pages
- Bookings retain a reference to the selected service
- Private or booking-disabled services reject public booking attempts
- Real-time booking creation, updates, and deletion
- Clickable booking cards with a dedicated detail page
- Booking details link back to the associated public service when available

### Connected navigation

- User names and avatars in comments link to public profiles
- Forum post and reply authors link to public profiles
- Message conversation headers link to the participant's public profile
- Booking cards link to complete booking details
- Service-linked bookings link to the corresponding public service
- Notifications link to the relevant message, booking, service, profile, or dashboard page

### Real-time messaging

- Registered-user directory
- One-to-one conversations
- Stored conversation history
- Message timestamps and backend read tracking
- Instant message delivery through authenticated WebSocket connections
- MongoDB message persistence
- Automatic WebSocket reconnection
- Start a direct conversation from a business profile without searching the Messages directory
- Reuse existing message history when a conversation already exists
- Preserve the selected conversation in `/dashboard/messages/:userId` across refreshes
- Redirect signed-out profile visitors through login and back to the intended conversation

### Real-time architecture

Socket.IO provides authenticated WebSocket communication. Each signed-in user joins a private room based on their verified JWT subject.

Real-time events include:

- `message:new`
- `booking:created`
- `booking:updated`
- `booking:deleted`
- `service:reactions`
- `comment:created`
- `comment:updated`
- `comment:deleted`
- `message:reaction`
- `comment:reaction`

Authenticated clients viewing a service join `service:<serviceId>` while that service page is open and leave the room during cleanup.

## Technology stack

### Frontend

- React 19
- React Router
- Vite
- JavaScript
- CSS
- Socket.IO client

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- Socket.IO
- JSON Web Tokens
- bcrypt

## Project structure

```text
booking-project/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── realtime.js
│   │   └── styles.css
│   ├── .env.example
│   └── package.json
├── server/
│   ├── middleware/
│   ├── models/
│   │   ├── Booking.js
│   │   ├── Comment.js
│   │   ├── Content.js
│   │   ├── EmojiReaction.js
│   │   ├── Message.js
│   │   ├── Rating.js
│   │   ├── Reaction.js
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── bookings.js
│   │   ├── comments.js
│   │   ├── content.js
│   │   ├── messages.js
│   │   ├── profile.js
│   │   ├── public.js
│   │   ├── ratings.js
│   │   └── reactions.js
│   ├── .env.example
│   ├── server.js
│   └── package.json
└── README.md
```

## Local setup

### 1. Clone and update

```bash
git clone https://github.com/joebanezair/booking-project.git
cd booking-project
git checkout main
git pull origin main
```

### 2. Configure and run the backend

```bash
cd server
cp .env.example .env
npm install
```

Configure `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/booking_app
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
ADMIN_EMAILS=owner@example.com
ADMIN_REGISTRATION_KEY=replace_with_a_random_secret_at_least_32_characters
```

### Creating the initial administrator securely

Generate a high-entropy key. A hexadecimal key avoids URL-encoding problems:

```bash
openssl rand -hex 32
```

Place it in `ADMIN_REGISTRATION_KEY`, restart the backend, and open:

```text
http://localhost:5173/register/admin/<ADMIN_REGISTRATION_KEY>
```

For production, replace the origin with the deployed frontend URL. Anyone possessing this URL can create an administrator, so treat it like a password, share it privately, and rotate the key after use. Placeholder or shorter-than-32-character keys are rejected.

Normal registration remains customer-only. A customer creates one business application from **Dashboard → Profile**. Administrators review it at **Dashboard → Business requests**. Approval unlocks a Personal/Business mode selector; rejection includes feedback and permits resubmission. The former secret business-registration URL is no longer available.

`ADMIN_EMAILS` remains available as an alternative way to promote a known account:

1. Register the intended owner account normally, or use an existing account.
2. Add its normalized email address to `ADMIN_EMAILS` in `server/.env`.
3. Restart the backend. On startup, matching accounts are promoted to `admin`.
4. Sign in again. The `/api/auth/me` session refresh also updates an already stored browser session with the current role.

Multiple admin emails may be supplied as a comma-separated list:

```env
ADMIN_EMAILS=owner@example.com,manager@example.com
```

Removing an address from the environment variable does not automatically demote the account. Change its `role` to `customer` in the database if access must be revoked.

Start the API and WebSocket server:

```bash
npm run dev
```

### 3. Configure and run the frontend

In another terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Frontend environment variables:

```env
VITE_API_URL=/api
VITE_SOCKET_URL=http://localhost:5000
```

The frontend normally runs on `http://localhost:5173`, while the API and WebSocket server run on `http://localhost:5000`.

For GitHub Codespaces, set `CLIENT_URL` to the exact forwarded frontend URL. Set `VITE_SOCKET_URL` to the forwarded backend URL.

## API overview

Protected endpoints require:

```http
Authorization: Bearer <token>
```

### Authentication

```text
POST /api/auth/register
POST /api/auth/register/:role/:inviteKey
POST /api/auth/login
GET  /api/auth/me
```

### Profile

```text
GET /api/profile
PUT /api/profile
```

### Business applications

```text
GET  /api/businesses/mine
POST /api/businesses/mine
PUT  /api/businesses/mine

GET   /api/admin/business-requests
PATCH /api/admin/business-requests/:id
```

Only administrators may review applications. Business-management requests from approved customer accounts must include `X-Account-Mode: business`; the frontend adds this header when Business mode is selected.

### Emoji reactions

```text
PUT /api/emoji-reactions/message/:messageId
PUT /api/emoji-reactions/comment/:commentId
```

Request body:

```json
{
  "emoji": "❤️"
}
```

Calling the same endpoint with the same emoji toggles the current user's reaction. Supported values are `👍`, `❤️`, `😂`, `😮`, `😢`, and `🙏`.

### Service management

The internal path remains `/api/content` for data compatibility.
Every endpoint in this section requires an administrator, a legacy business account, or a customer with an approved business in Business mode. Records remain scoped to the authenticated owner and linked business.

```text
GET    /api/content
GET    /api/content/:id
POST   /api/content
PUT    /api/content/:id
PATCH  /api/content/:id/publish
DELETE /api/content/:id
```

### Search and public pages

```text
GET /api/public/search
GET /api/public/browse
GET /api/public/profile/:username
GET /api/public/content/:serviceId
```

Search parameters:

```text
q=<search text>
category=<category>
minRating=<0-5>
page=<page number>
```

### Ratings and reactions

```text
PUT    /api/ratings/:serviceId
DELETE /api/ratings/:serviceId
PUT    /api/reactions/:serviceId
```

Reaction request example:

```json
{
  "type": "like"
}
```

### Threaded comments

```text
POST   /api/comments/:serviceId
PUT    /api/comments/:commentId
DELETE /api/comments/:commentId
```

Reply request example:

```json
{
  "comment": "This is a reply.",
  "parentId": "parent-comment-id"
}
```

### Bookings

```text
GET    /api/bookings
POST   /api/bookings
PUT    /api/bookings/:id
DELETE /api/bookings/:id
PATCH  /api/bookings/:id/cancel
GET    /api/public/book/:userId
POST   /api/public/book/:userId
```

- Admins receive bookings owned by their business account and may create, update, or delete them.
- Customers receive only bookings whose `customer` field matches their authenticated account and may cancel those bookings.
- Public/guest booking remains available for backward compatibility. A signed-in customer booking is automatically linked to that customer.

### Admin

```text
GET /api/admin/customers
```

Returns registered customer accounts and booking counts. Requires the `admin` role; business accounts receive HTTP `403`.

### Messaging

```text
GET  /api/messages/users
GET  /api/messages/:userId
POST /api/messages/:userId
```

Conversation responses include `emojiReactions` for each message. The backend rejects self-messaging and any reaction to a message outside the authenticated user's conversations.

## Data models

- **User:** authentication, `admin`/`business`/`customer` role, public profile, profile-photo position, and cover photo
- **Business:** one owner-linked application, public business details, approval status, reviewer, and review feedback
- **Content/Service:** owner, details, price, images, visibility, publishing, rating option, and booking option
- **Booking:** admin/business owner, optional authenticated customer, optional linked service, guest details, date/time, source, and status
- **Message:** sender, recipient, body, read timestamp, and timestamps
- **Rating:** unique user/service star rating
- **Reaction:** unique user/service Like or Dislike
- **Comment:** service, author, parent, nesting depth, edit state, and deletion placeholder state
- **ProfileRating:** unique user-to-profile star rating
- **Notification:** recipient, type, message, destination link, and read state
- **EmojiReaction:** target type, target ID, reacting user, emoji, and timestamps, protected by a unique compound index
- **ForumPost:** public discussion post with category and embedded replies

## Compatibility notes

- Existing content records remain in the `Content` model and MongoDB collection
- Existing records without a visibility value behave as public
- Existing user records without a role behave as `customer` through the schema and authorization fallbacks
- Existing bookings without a customer reference remain available to their admin owner but are not exposed to customer accounts
- Old content URLs continue to resolve
- Existing ratings, comments, bookings, messages, and user accounts are preserved
- New comment fields have safe defaults, so existing comments become top-level discussion entries

## Verification checklist

### Services and privacy

1. Post a public service and confirm it appears in search and on the public profile.
2. Post a private service and confirm it appears only in the owner's service manager.
3. Open the private service URL while signed out and confirm access is denied.

### Search

1. Search for a user by name, username, headline, and location.
2. Search for a service by title, description, category, and provider.
3. Test category and minimum-rating filters.
4. Test incremental loading when more than 12 results exist.

### Ratings and reactions

1. Rate another user's public service.
2. Update and remove the rating.
3. Like the service, switch to Dislike, and remove the reaction.
4. Confirm service owners cannot rate or react to their own service.
5. As a customer, rate a public business profile, update the rating, and remove it.
6. Confirm admins cannot submit business-profile ratings.

### Emoji reactions

1. Add and remove each supported emoji on a direct message.
2. Confirm both participants receive the updated message totals in real time.
3. React to a top-level service comment and a nested reply from two accounts.
4. Confirm totals do not duplicate when realtime events and API responses arrive together.
5. Attempt to react to an unrelated message or inaccessible comment and confirm access is denied.
6. Confirm service Like/Dislike counts remain independent.

### Threaded discussions

1. Post a top-level comment.
2. Add nested replies.
3. Edit a personal comment.
4. Delete a parent with replies and confirm the placeholder remains.
5. Confirm a service owner can moderate another user's comment.

### Booking and messaging

1. Request a booking from a public service page.
2. Confirm it appears on the owner's booking page in real time.
3. Confirm a private or booking-disabled service rejects the request.
4. Open two accounts in separate browsers and test real-time messaging.
5. Click **Message** on a business profile and confirm the correct conversation opens directly.
6. Refresh the direct-conversation URL and confirm the same recipient remains selected.
7. Start signed out, click **Sign in to message**, authenticate, and confirm the intended conversation opens.

### Roles and authorization

1. Register normally and confirm the account is a `customer` even if a `role` field is submitted.
2. Submit a business application from Profile and confirm a second application is rejected.
3. Confirm pending and rejected applications cannot access service-management APIs.
4. Approve the application as an admin and confirm the owner receives a notification.
5. Switch between Personal and Business modes and confirm bookings are separated correctly.
6. Reject an application with feedback, update it, and confirm it can be resubmitted.
7. Suspend an approved business and confirm provider APIs return HTTP `403`.
8. Use the admin invite URL and confirm it creates an `admin` account with review and customer-directory access.
9. Create services under two approved businesses and confirm each manages only its own records.

## Security notes

- Passwords are hashed with bcrypt
- Protected HTTP routes verify JWTs
- WebSocket connections verify JWTs before joining private user rooms
- Owner checks protect profile, service, booking, and comment-management operations
- Database-backed role and business-status checks protect privileged APIs even if browser state is stale
- A unique owner index enforces one business application per user
- Invite registration keys are verified server-side with constant-time comparison and are never accepted from ordinary registration
- Public queries exclude private services on the server
- Unique database indexes prevent duplicate ratings and reactions
- Message and comment emoji targets are authorized server-side before toggling reactions
- Input lengths, image formats, image sizes, identifiers, statuses, visibility, and reaction types are validated

This portfolio project stores JWTs in `localStorage`. A production deployment should use secure HttpOnly cookies, CSRF protection, rate limiting, stricter upload storage, anti-spam controls, refresh-token rotation, audit logging, and automated integration tests.
