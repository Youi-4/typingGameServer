import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import { paragraphs, paragraphWordMeans } from "./src/data/sentence.js";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import { getUserByAccountID } from "./src/models/userModel.js";
import userRoutes from "./src/routes/userRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";

dotenv.config();

const app = express();

console.log("CLIENT_URL =", process.env.CLIENT_URL);

/* ------------------ Middleware ------------------ */

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map(s => s.trim())
  : ["http://localhost:5173"];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin)  // allow all Vercel preview deployments
    ) {
      return callback(null, origin);
    }
    callback(new Error("Not allowed by CORS"));
  },
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
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin)
      ) {
        return callback(null, origin);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  }
});

const roomParagraph = new Map();

/* ------------------ Socket Auth (placeholder) ------------------ */

io.use(async (socket, next) => {
  try {
    // Accept token from auth option (cross-origin) or fall back to cookie (same-origin)
    let token = socket.handshake.auth?.token;
    if (!token) {
      const raw = socket.request.headers.cookie;
      if (raw) {
        const cookies = cookie.parse(raw);
        token = cookies.token;
      }
    }
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.SECRET_KEY || "your-secret-key");
    const user = await getUserByAccountID(decoded.account_id);
    if (!user) return next(new Error("User not found"));

    // Attach user info to the socket for later use
    socket.username = user.user;
    socket.accountId = user.accountid;
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

  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);
    if (!roomParagraph.has(roomId)) {
      const randomindex = Math.floor(Math.random() * paragraphs.length);
      const selectedSentence = paragraphs[randomindex];
      roomParagraph.set(roomId,selectedSentence)
    
    }

    socket.emit("room-state", {
      roomId,
      paragraph: roomParagraph.get(roomId)
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

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
