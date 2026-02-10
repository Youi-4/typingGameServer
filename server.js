import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

import cookie from "cookie";
import jwt from "jsonwebtoken";
import { getUserByAccountID } from "./src/models/userModel.js";
import userRoutes from "./src/routes/userRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";

dotenv.config();

const app = express();

/* ------------------ Middleware ------------------ */

const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

/* ------------------ Routes ------------------ */

app.use("/api/user", userRoutes);
app.use("/api/auth", authRoutes);


/* ------------------ HTTP + WebSocket Server ------------------ */

// IMPORTANT: create HTTP server from Express app
const httpServer = createServer(app);

// Attach Socket.IO to the SAME server + port
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true
  }
});

const roomParagraphIndex = new Map();

/* ------------------ Socket Auth (placeholder) ------------------ */

io.use(async (socket, next) => {
  try {
    const raw = socket.request.headers.cookie;
    if (!raw) return next(new Error("No cookies"));

    const cookies = cookie.parse(raw);
    const token = cookies.token;
    if (!token) return next(new Error("No token cookie"));

    const decoded = jwt.verify(token, process.env.SECRET_KEY || "your-secret-key");
    const user = await getUserByAccountID(decoded.account_id);
    if (!user) return next(new Error("User not found"));

    // Attach user info to the socket for later use
    socket.username = user.User;
    socket.accountId = user.AccountID;
    console.log(`Socket authenticated: ${socket.username}`);
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    next(new Error("Unauthorized"));
  }
});

/* ------------------ Socket Events ------------------ */

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, paragraphCount }) => {
    socket.join(roomId);
    if (!roomParagraphIndex.has(roomId)) {
      const safeCount = Number.isInteger(paragraphCount) && paragraphCount > 0
        ? paragraphCount
        : 1;
      const index = Math.floor(Math.random() * safeCount);
      roomParagraphIndex.set(roomId, index);
    }

    socket.emit("room-state", {
      roomId,
      paragraphIndex: roomParagraphIndex.get(roomId)
    });

    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  socket.on("send-message", ({ roomId, message, typeObject }) => {
    // Broadcast to everyone in the room (including sender)
    io.to(roomId).emit("receive-message", {
      senderId: socket.id,
      senderName: socket.username || "Unknown",
      message,
      typeObject
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

/* ------------------ Start Server ------------------ */

const PORT = process.env.SERVER_PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
