# BookFlow — MERN Booking & Messaging App

BookFlow is a full-stack MERN scheduling application for managing appointments, accepting public booking requests, and communicating directly with other registered users.

## Features

### Booking management
- Create, view, edit, and delete bookings
- Pending, confirmed, and cancelled booking statuses
- Dashboard statistics
- MongoDB persistence
- Per-user protected booking data

### Public booking pages
Every registered user automatically gets a shareable booking page:

```
/book/<user-id>
```

The dashboard includes **Open page** and **Copy link** actions.

Visitors do not need a BookFlow account. They can submit:
- Name
- Email
- Service
- Requested date and time
- Notes

Public requests are created as **pending** bookings and automatically appear in the booking owner's dashboard with a **Public request** indicator.

### User-to-user messaging
Registered users can message other registered BookFlow users.

The messaging interface includes:
- Registered-user directory
- One-to-one conversations
- Stored conversation history
- Message timestamps
- Read tracking in the backend
- MongoDB message persistence

Messaging routes require JWT authentication.

Messages and booking changes are delivered live over an authenticated WebSocket connection. The dashboard now uses separate pages for content, bookings, messages, and profile management.

## Tech Stack

**Frontend**
- React 19
- Vite
- JavaScript
- CSS
- Socket.IO client

**Backend**
- Node.js
- Express
- MongoDB
- Mongoose
- Socket.IO WebSocket server

**Authentication**
- JWT
- bcrypt password hashing

## Project Structure

```
booking-project/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── styles.css
│   └── package.json
├── server/
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── Booking.js
│   │   ├── Message.js
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── bookings.js
│   │   ├── messages.js
│   │   └── public.js
│   ├── server.js
│   └── package.json
└── README.md
```

## Run in GitHub Codespaces

Get the latest version:

```bash
git checkout main
git pull origin main
```

### 1. Configure the backend

```bash
cd server
cp .env.example .env
npm install
```

Edit `server/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_this_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
```

Never commit your real `.env`, MongoDB credentials, or JWT secret.

Start the API:

```bash
npm run dev
```

### 2. Start the frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

Vite normally runs on port `5173` and the API on port `5000`.

In GitHub Codespaces, use the forwarded frontend URL. If CORS blocks API requests, set `CLIENT_URL` in `server/.env` to the exact forwarded frontend URL and restart the backend.

## REST API

### Authentication

```
POST /api/auth/register
POST /api/auth/login
```

### Protected bookings

Requires:

```
Authorization: Bearer <token>
```

Endpoints:

```
GET    /api/bookings
POST   /api/bookings
PUT    /api/bookings/:id
DELETE /api/bookings/:id
```

### Messaging

All messaging endpoints require authentication.

```
GET  /api/messages/users
GET  /api/messages/:userId
POST /api/messages/:userId
```

`GET /api/messages/users` lists other registered users.

`GET /api/messages/:userId` retrieves the conversation with another user and marks their unread messages as read.

`POST /api/messages/:userId` sends a message to another registered user.

Example request:

```json
{
  "body": "Hi! I wanted to follow up about our booking."
}
```

### Public booking API

These endpoints intentionally do **not** require authentication:

```
GET  /api/public/book/:userId
POST /api/public/book/:userId
```

The GET endpoint loads the booking owner's public profile information and available service choices.

Example public booking request:

```json
{
  "guestName": "Alex Johnson",
  "guestEmail": "alex@example.com",
  "service": "Consultation",
  "bookingDate": "2026-09-20T14:00",
  "notes": "I'd like to discuss a new project."
}
```

New public bookings default to `pending`.

## Testing the New Features

### Public booking
1. Register or sign in.
2. Find **Your Public Booking Page** on the dashboard.
3. Click **Open page** or **Copy link**.
4. Open the link in another browser/incognito window.
5. Submit a booking without signing in.
6. Return to the owner's dashboard.
7. Confirm the request appears as a pending **Public request**.

### Messaging
1. Create at least two BookFlow accounts.
2. Sign in as the first user.
3. Open **Messages**.
4. Select the second registered user.
5. Send a message.
6. Sign in as the second user to view the conversation and reply.

## Data Models

### User
Stores the user's name, email, and hashed password.

### Booking
Stores the booking owner, guest information, service, requested date/time, notes, status, and whether the booking came from the dashboard or public booking page.

### Message
Stores sender, recipient, message body, read timestamp, and creation/update timestamps.

## Security Notes

BookFlow hashes passwords with bcrypt and protects private API routes using JWT authentication.

For simplicity, this portfolio version stores JWTs in `localStorage`. A production version should consider HttpOnly secure cookies, CSRF protection, rate limiting, stronger schema validation, spam protection for public booking endpoints, session/refresh-token rotation, logging, and automated tests.

## Current Update

The latest update adds:
- Direct messaging between registered users
- Public shareable booking pages
- Guest email capture
- Public booking source tracking
- Dashboard sharing controls
- New messaging and public-booking API routes
- Responsive messaging and public booking interfaces
