# BookFlow — MERN Booking App

A full-stack booking manager built with the MERN stack and added to the `profile02` repository as a standalone portfolio project.

## Highlights

- React + Vite responsive dashboard
- Node.js + Express REST API
- MongoDB + Mongoose persistence
- Email/password registration and login
- bcrypt password hashing
- JWT authentication
- Protected per-user booking routes
- Create, read, update and delete bookings
- Search bookings by guest, service or notes
- Filter bookings by status
- Dashboard statistics for total, upcoming, confirmed and pending bookings
- Quick status updates
- Responsive desktop/mobile interface
- Backend input validation and ObjectId checks

## Quick Start in Your Existing Codespace

If this repository is already open in your GitHub Codespace, first make sure you are using the BookFlow feature branch and have the latest changes:

```bash
git fetch
git checkout feature/mern-booking-app
git pull
```

### Backend terminal

From the repository root:

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Before starting the API successfully, edit `server/.env` and provide a working MongoDB connection string and a private JWT secret:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_this_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
```

Do not commit your real `.env` file or JWT secret to GitHub.

### Frontend terminal

Open a second Codespaces terminal and run:

```bash
cd client
npm install
npm run dev
```

Vite uses port `5173` and the Express API uses port `5000`. GitHub Codespaces should detect these ports and show them in the **Ports** tab. Open the forwarded URL for port `5173` to use BookFlow.

If the frontend opens but API requests are blocked by CORS, copy the forwarded URL for port `5173` from the Codespaces **Ports** tab and use that exact URL for `CLIENT_URL` in `server/.env`. Restart the backend after changing the environment file.

### First test

1. Open the forwarded frontend on port `5173`.
2. Choose **Create an account**.
3. Register with a test name, email and password of at least 8 characters.
4. Create a booking.
5. Confirm it appears in the dashboard.
6. Test search, status changes, editing and deletion.

### Common problems

If `npm run dev` reports that `MONGO_URI` is missing, check that `server/.env` exists. If MongoDB refuses the connection, verify your MongoDB connection string and network/database permissions. If the frontend cannot reach the backend, make sure port `5000` is running and forwarded in Codespaces.

## Run in GitHub Codespaces

### 1. Configure the API

Create `server/.env` from `server/.env.example`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=use_a_long_random_secret_here
CLIENT_URL=http://localhost:5173
```

For GitHub Codespaces, after Vite forwards port 5173, set `CLIENT_URL` to the forwarded frontend URL if required by CORS.

### 2. Start the API

```bash
cd server
npm install
npm run dev
```

### 3. Start the React frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the forwarded port for 5173.

## REST API

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`

### Bookings

All booking endpoints require:

```
Authorization: Bearer <token>
```

- `GET /api/bookings`
- `GET /api/bookings?status=confirmed`
- `GET /api/bookings?search=consultation`
- `POST /api/bookings`
- `PUT /api/bookings/:id`
- `DELETE /api/bookings/:id`

## Security note

This portfolio project stores the JWT in `localStorage` to keep the learning architecture easy to understand. A production deployment should consider secure HttpOnly cookies, CSRF protection, request rate limiting, refresh/session rotation, schema validation, logging and automated tests.
