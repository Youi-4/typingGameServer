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
let sharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();
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

app.get("/api/create-room", (_req, res) => {
  res.json({ sharedRoomId });
});

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
// const publicRooms = new Map();
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
let queue = [];

const public_game = io.of("/public_game");
public_game.use(authMiddleware);
public_game.on("connection", (socket) => {
  console.log("\nUser connected:", socket.id);
  console.log("handshake.address:", socket.handshake.address);
  console.log("x-forwarded-for:", socket.handshake.headers["x-forwarded-for"]);
  console.log("remoteAddress:", socket.request.connection.remoteAddress, "\n");

  socket.on("join-room", ({ }) => {


    // console.log(roomId,"$$$$$$$$$$$");
    // if (roomId === undefined){
    //   console.log("HEHHHHHHHHHHHHHHHHHHHHHHHHH");
    // } 

    // queue.push({socket});
    // if (queue.length >= 2) {
    //   const player1 = queue.shift();
    //   const player2 = queue.shift();
    //   const sharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();

    //   player1.socket.join(sharedRoomId);
    //   player2.socket.join(sharedRoomId);

    //   if (!roomParagraph.has(sharedRoomId)) {
    //     const randomindex = Math.floor(Math.random() * paragraphs.length);
    //     const selectedSentence = paragraphs[randomindex];
    //     roomParagraph.set(sharedRoomId, selectedSentence)

    //   }
    //   player1.socket.emit("room-state", {
    //     roomId:sharedRoomId,
    //     paragraph: roomParagraph.get(sharedRoomId)
    //   });
    //   player2.socket.emit("room-state", {
    //     roomId:sharedRoomId,
    //     paragraph: roomParagraph.get(sharedRoomId)
    //   });
    // }





    // console.log(roomId,"$$$$$$$$$$$");
    //   if (roomId === undefined){
    //     console.log("HEHHHHHHHHHHHHHHHHHHHHHHHHH");
    //   } 

    queue.push({ socket });
    // if (publicRooms.has(sharedRoomId)){
    //   publicRooms.set(sharedRoomId,publicRooms.get(sharedRoomId)+1);
    // }else{
    //   publicRooms.set(sharedRoomId,socket.id);
    // }
    socket.join(sharedRoomId);
    socket.currentRoomId = sharedRoomId;
    if (!roomParagraph.has(sharedRoomId)) {
      const randomindex = Math.floor(Math.random() * paragraphs.length);
      const selectedSentence = paragraphs[randomindex];
      roomParagraph.set(sharedRoomId, selectedSentence)

    }
    socket.emit("room-state", {
      roomId: sharedRoomId,
      paragraph: roomParagraph.get(sharedRoomId)
    });
    console.log(`User ${socket.id} joined room ${sharedRoomId}`);
    if (queue.length >= 2) {
      console.log("NEW ROOM CREATED")
      queue = [];
          socket.emit("room-status", {
            status: "filled"
    });
      sharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();
    }

  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const room = io.sockets.adapter.rooms.get(roomId);
        const roomSize = room ? room.size : 0;

        if (roomSize === 1) {
          roomParagraph.delete(roomId); // clean up last user
          console.log(`Deleted data for room ${roomId}`);
        } else {
          public_game.to(roomId).emit("user-left", { senderId: socket.id });
        }

        console.log(`User ${socket.id} leaving room ${roomId}`);
      }
    }
  });

  // socket.on("send-message", ({ roomId:sharedRoomId, message, typeObject }) => {
  //   // Broadcast to everyone in the room (including sender)
  //   public_game.to(sharedRoomId).emit("receive-message", {
  //     senderId: socket.id,
  //     senderName: socket.username || "Unknown",
  //     message,
  //     typeObject
  //   });
  // });
  socket.on("send-message", ({ message, typeObject }) => {
    const roomId = socket.currentRoomId;
    if (!roomId) return;

    public_game.to(roomId).emit("receive-message", {
      senderId: socket.id,
      senderName: socket.username || "Unknown",
      message,
      typeObject
    });
  });
  socket.on("disconnect", () => {
    queue = queue.filter(item => item.socket.id !== socket.id);
    // publicRooms = publicRooms.delete(socket.id);
    console.log("User disconnected and removed from queue:", socket.id);
  });
});


/* Private Game */

const private_game = io.of("/private_game");
private_game.use(authMiddleware);

private_game.on("connection", (socket) => {
  console.log("\nUser connected:$$$$$$$$$$$$$$$$", socket.id);
  // console.log("handshake.address:", socket.handshake.address);
  // console.log("x-forwarded-for:", socket.handshake.headers["x-forwarded-for"]);
  // console.log("remoteAddress:", socket.request.connection.remoteAddress,"\n");
  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);
    if (!roomParagraph.has(roomId)) {
      const randomindex = Math.floor(Math.random() * paragraphs.length);
      const selectedSentence = paragraphs[randomindex];
      roomParagraph.set(roomId, selectedSentence)

    }

    socket.emit("room-state", {
      roomId,
      paragraph: roomParagraph.get(roomId)
    });

    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const room = io.sockets.adapter.rooms.get(roomId);
        const roomSize = room ? room.size : 0;

        if (roomSize === 1) {
          roomParagraph.delete(roomId); // clean up last user
          console.log(`Deleted data for room ${roomId}`);
        } else {
          private_game.to(roomId).emit("user-left", { senderId: socket.id });
        }

        console.log(`User ${socket.id} leaving room ${roomId}`);
      }
    }
  });

  socket.on("send-message", ({ roomId, message, typeObject }) => {
    // Broadcast to everyone in the room (including sender)
    private_game.to(roomId).emit("receive-message", {
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
