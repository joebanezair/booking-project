# BookFlow — Service Search, Booking, and Messaging Platform

BookFlow is a full-stack MERN application where providers publish services, build public profiles, accept schedule requests, and communicate with other registered users. It includes public/private services, user and service search, ratings, reactions, threaded discussions, and authenticated real-time updates.

## Features

### Authentication and accounts

- Account registration and login
- Password hashing with bcrypt
- JWT-protected private APIs
- Persistent signed-in client sessions
- Automatically generated unique usernames
- Protected dashboard routes

### Separate application pages

Every major feature has its own route instead of being combined into one dashboard page:

| Page | Route |
| --- | --- |
| Dashboard overview | `/dashboard` |
| Service management | `/dashboard/services` |
| Post a service | `/dashboard/services/new` |
| Edit a service | `/dashboard/services/:serviceId/edit` |
| Booking management | `/dashboard/bookings` |
| Real-time messages | `/dashboard/messages` |
| Profile management | `/dashboard/profile` |
| Notification center | `/dashboard/notifications` |
| Appearance settings | `/dashboard/settings` |
| Public forum | `/forum` |
| User and service search | `/search` |
| Public service details | `/services/:serviceId` |
| Public user profile | `/profile/:username` |
| Public booking form | `/b/:userId` |

Legacy `/dashboard/content`, `/dashboard/content/new`, `/dashboard/content/:id/edit`, and `/content/:id` URLs remain available for backward compatibility.

### Profile management

- Edit name, username, headline, biography, location, and website
- Upload or remove a profile photo
- Reposition the profile photo horizontally and vertically
- Preview the selected profile-photo framing
- Upload, preview, or remove a profile cover photo
- Display the cover photo and positioned avatar on the public profile
- Preview the public profile from profile settings
- Display all public services belonging to the provider
- Share the public landing page with Open, Copy Link, and native Share actions
- Use one public `/profile/:username` link for the provider profile, services, ratings, discussions, and booking entry points

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
- Every public user profile also has its own independent 1–5-star rating summary
- Signed-in users can add, update, or remove a profile rating, while self-rating is blocked

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

### Booking management

- Create, view, edit, and delete bookings
- Pending, confirmed, and cancelled statuses
- Booking statistics
- Per-user protected booking data
- Public booking requests without requiring visitor registration
- Guest name, email, requested date/time, service, and notes
- Public requests default to `pending`
- Service-specific booking buttons on eligible public service pages
- Bookings retain a reference to the selected service
- Private or booking-disabled services reject public booking attempts
- Real-time booking creation, updates, and deletion

### Real-time messaging

- Registered-user directory
- One-to-one conversations
- Stored conversation history
- Message timestamps and backend read tracking
- Instant message delivery through authenticated WebSocket connections
- MongoDB message persistence
- Automatic WebSocket reconnection

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
```

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
POST /api/auth/login
```

### Profile

```text
GET /api/profile
PUT /api/profile
```

### Service management

The internal path remains `/api/content` for data compatibility.

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
GET    /api/public/book/:userId
POST   /api/public/book/:userId
```

### Messaging

```text
GET  /api/messages/users
GET  /api/messages/:userId
POST /api/messages/:userId
```

## Data models

- **User:** authentication, public profile, profile-photo position, and cover photo
- **Content/Service:** owner, details, price, images, visibility, publishing, rating option, and booking option
- **Booking:** owner, optional linked service, guest details, date/time, source, and status
- **Message:** sender, recipient, body, read timestamp, and timestamps
- **Rating:** unique user/service star rating
- **Reaction:** unique user/service Like or Dislike
- **Comment:** service, author, parent, nesting depth, edit state, and deletion placeholder state
- **ProfileRating:** unique user-to-profile star rating
- **Notification:** recipient, type, message, destination link, and read state
- **ForumPost:** public discussion post with category and embedded replies

## Compatibility notes

- Existing content records remain in the `Content` model and MongoDB collection
- Existing records without a visibility value behave as public
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

## Security notes

- Passwords are hashed with bcrypt
- Protected HTTP routes verify JWTs
- WebSocket connections verify JWTs before joining private user rooms
- Owner checks protect profile, service, booking, and comment-management operations
- Public queries exclude private services on the server
- Unique database indexes prevent duplicate ratings and reactions
- Input lengths, image formats, image sizes, identifiers, statuses, visibility, and reaction types are validated

This portfolio project stores JWTs in `localStorage`. A production deployment should use secure HttpOnly cookies, CSRF protection, rate limiting, stricter upload storage, anti-spam controls, refresh-token rotation, audit logging, and automated integration tests.
