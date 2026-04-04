# Typing Game Server

Express and Socket.IO backend for the multiplayer typing game. It handles authentication, room management, realtime race updates, and player stats.

## Stack

- Node.js
- Express
- Socket.IO
- PostgreSQL
- JWT cookies

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in your local database and auth values. Do not commit real secrets.
4. Start the server with `npm run dev`.

## Scripts

- `npm run dev` starts the backend with nodemon.
- `npm start` starts the production server.
- `npm test` runs the server test suite.

## Notes

- Keep screenshots and shared examples scrubbed of real tokens, secrets, and callback credentials.
- The client project lives separately and should point `VITE_API_URL` at this server.
