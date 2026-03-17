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

/* ------------------ Socket Auth (placeholder) ------------------ */

const authMiddleware = async (socket, next) => {
  try {
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

    if (decoded.is_guest) {
      socket.username = decoded.account_id;
      socket.accountId = decoded.account_id;
      socket.isGuest = true;
      console.log(`Socket authenticated (guest): ${socket.username}`);
      return next();
    }

    const user = await getUserByAccountID(decoded.account_id);
    if (!user) return next(new Error("User not found"));

    socket.username = user.user;
    socket.accountId = user.accountid;
    console.log(`Socket authenticated: ${socket.username}`);
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    next(new Error("Unauthorized"));
  }
};

/* ------------------ Socket Events ------------------ */

// publicRooms: Map<roomId, { paragraph, lastState, pendingBatch }>
const publicRooms = new Map();
let publicQueue = [];
let publicSharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();
let characterNumsPublic = [0, 1, 2, 3, 4];
const public_game = io.of("/public_game");
public_game.use(authMiddleware);
public_game.on("connection", (socket) => {
  console.log("\nUser connected:", socket.id);
  console.log("handshake.address:", socket.handshake.address);
  console.log("x-forwarded-for:", socket.handshake.headers["x-forwarded-for"]);
  console.log("remoteAddress:", socket.request.connection.remoteAddress, "\n");
  socket.on("join-room", ({ }) => {
    publicQueue.push({ socket });
    let index = Math.floor(Math.random() * characterNumsPublic.length);
    socket.characterNumber = characterNumsPublic[index];
    characterNumsPublic.splice(index, 1);
    socket.join(publicSharedRoomId);
    socket.currentRoomId = publicSharedRoomId;
    if (!publicRooms.has(publicSharedRoomId)) {
      const randomindex = Math.floor(Math.random() * paragraphs.length);
      publicRooms.set(publicSharedRoomId, {
        paragraph: paragraphs[randomindex],
        lastState: new Map(),
        pendingBatch: new Map()
      });
    }
    const room = publicRooms.get(publicSharedRoomId);
    socket.emit("room-state", {
      roomId: publicSharedRoomId,
      paragraph: room.paragraph,
      characterNumber: socket.characterNumber
    });
    for (const [, state] of room.lastState) {
      socket.emit("receive-message", state);
    }
    console.log(`User ${socket.id} joined room ${publicSharedRoomId}`);
    if (publicQueue.length >= 2) {
      console.log("NEW ROOM CREATED");
      publicQueue = [];
      characterNumsPublic = [0, 1, 2, 3, 4];
      public_game.to(publicSharedRoomId).emit("room-status", { status: "filled" });
      publicSharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();
    }
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const socketRoom = io.sockets.adapter.rooms.get(roomId);
        const roomSize = socketRoom ? socketRoom.size : 0;
        if (roomSize === 1) {
          publicRooms.delete(roomId);
          console.log(`Deleted data for room ${roomId}`);
        } else {
          publicRooms.get(roomId)?.lastState.delete(socket.id);
          public_game.to(roomId).emit("user-left", { senderId: socket.id });
        }
        console.log(`User ${socket.id} leaving room ${roomId}`);
      }
    }
  });

  socket.on("send-message", ({ message, typeObject }) => {
    const roomId = socket.currentRoomId;
    if (!roomId) return;
    const msg = {
      senderId: socket.id,
      senderName: socket.username || "Unknown",
      characterNumber: socket.characterNumber,
      message,
      typeObject
    };
    const room = publicRooms.get(roomId);
    if (!room) return;
    room.lastState.set(socket.id, msg);
    room.pendingBatch.set(socket.id, msg);
  });

  socket.on("disconnect", () => {
    publicQueue = publicQueue.filter(item => item.socket.id !== socket.id);
    console.log("User disconnected and removed from queue:", socket.id);
  });
});


/* Private Game */

// privateRooms: Map<roomId, { paragraph, lastState, pendingBatch, queue, characterNums, size }>
const privateRooms = new Map();
const private_game = io.of("/private_game");
private_game.use(authMiddleware);
let privateSharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();
private_game.on("connection", (socket) => {
  console.log("\nUser connected:$$$$$$$$$$$$$$$$", socket.id);
  socket.on("join-room", ({ roomId, roomSize }) => {
    socket.join(roomId);
    socket.currentRoomId = roomId;
    if (!privateRooms.has(roomId)) {
      const randomindex = Math.floor(Math.random() * paragraphs.length);
      privateRooms.set(roomId, {
        paragraph: paragraphs[randomindex],
        lastState: new Map(),
        pendingBatch: new Map(),
        queue: [socket],
        characterNums: [0, 1, 2, 3, 4],
        size: roomSize
      });
    } else {
      privateRooms.get(roomId).queue.push(socket);
    }
    const room = privateRooms.get(roomId);
    let index = Math.floor(Math.random() * room.characterNums.length);
    socket.characterNumber = room.characterNums[index];
    room.characterNums.splice(index, 1);
    socket.emit("room-state", {
      roomId,
      paragraph: room.paragraph,
      characterNumber: socket.characterNumber
    });
    for (const [, state] of room.lastState) {
      socket.emit("receive-message", state);
    }
    console.log(`User ${socket.id} joined room ${roomId} with queue length:`, room.queue.length);
    if (room.queue.length >= room.size) {
      console.log("NEW ROOM CREATED");
      private_game.to(roomId).emit("room-status", { status: "filled" });
    }
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const socketRoom = io.sockets.adapter.rooms.get(roomId);
        const roomSize = socketRoom ? socketRoom.size : 0;
        if (roomSize === 1) {
          privateRooms.delete(roomId);
          console.log(`Deleted data for room ${roomId}`);
        } else {
          privateRooms.get(roomId)?.lastState.delete(socket.id);
          private_game.to(roomId).emit("user-left", { senderId: socket.id });
        }
        console.log(`User ${socket.id} leaving room ${roomId}`);
      }
    }
  });

  socket.on("send-message", ({ message, typeObject }) => {
    const roomId = socket.currentRoomId;
    if (!roomId) return;
    const msg = {
      senderId: socket.id,
      senderName: socket.username || "Unknown",
      characterNumber: socket.characterNumber,
      message,
      typeObject
    };
    const room = privateRooms.get(roomId);
    if (!room) return;
    room.lastState.set(socket.id, msg);
    room.pendingBatch.set(socket.id, msg);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected and removed from queue:", socket.id);
  });
});

/* ------------------ Batch Flush Intervals ------------------ */

const BATCH_INTERVAL_MS = 200;

setInterval(() => {
  for (const [roomId, room] of publicRooms) {
    if (room.pendingBatch.size === 0) continue;
    public_game.to(roomId).emit("batch-update", Array.from(room.pendingBatch.values()));
    room.pendingBatch.clear();
  }
}, BATCH_INTERVAL_MS);

setInterval(() => {
  for (const [roomId, room] of privateRooms) {
    if (room.pendingBatch.size === 0) continue;
    private_game.to(roomId).emit("batch-update", Array.from(room.pendingBatch.values()));
    room.pendingBatch.clear();
  }
}, BATCH_INTERVAL_MS);

/* ------------------ Start Server ------------------ */

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
app.get("/api/create-room", (req, res) => {
  if (req.query.roomType == "private") {
    privateSharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();
    res.json({ privateSharedRoomId });
  } else if (req.query.roomType == "public") {
    res.json({ publicSharedRoomId });
  } else {
    privateSharedRoomId = req.query.roomType;
    res.json({ privateSharedRoomId });
  }
});