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

const publicRoomParagraph = new Map();
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
let publicQueue = [];
let publicSharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();
let characterNumsPublic = [0,1,2,3,4];
const publicRoomLastState = new Map(); // roomId -> Map(socketId -> lastMessage)
const public_game = io.of("/public_game");
public_game.use(authMiddleware);
public_game.on("connection", (socket) => {
  console.log("\nUser connected:", socket.id);
  console.log("handshake.address:", socket.handshake.address);
  console.log("x-forwarded-for:", socket.handshake.headers["x-forwarded-for"]);
  console.log("remoteAddress:", socket.request.connection.remoteAddress, "\n");
  socket.on("join-room", ({ }) => {


    // if (publicQueue.some(item => item.socket.id === socket.id)) return;
    publicQueue.push({ socket });
    let index = characterNumsPublic[Math.floor(Math.random()*characterNumsPublic.length)];
    socket.characterNumber = index
    characterNumsPublic.splice(index, 1);
    // if (publicRooms.has(publicSharedRoomId)){
    //   publicRooms.set(publicSharedRoomId,publicRooms.get(publicSharedRoomId)+1);
    // }else{
    //   publicRooms.set(publicSharedRoomId,socket.id);
    // }
    socket.join(publicSharedRoomId);
    socket.currentRoomId = publicSharedRoomId;
    if (!publicRoomParagraph.has(publicSharedRoomId)) {
      const randomindex = Math.floor(Math.random() * paragraphs.length);
      const selectedSentence = paragraphs[randomindex];
      publicRoomParagraph.set(publicSharedRoomId, selectedSentence)

    }
    socket.emit("room-state", {
      roomId: publicSharedRoomId,
      paragraph: publicRoomParagraph.get(publicSharedRoomId),
      characterNumber: socket.characterNumber
    });
    if (publicRoomLastState.has(publicSharedRoomId)) {
      for (const [, state] of publicRoomLastState.get(publicSharedRoomId)) {
        socket.emit("receive-message", state);
      }
    }
    console.log(`User ${socket.id} joined room ${publicSharedRoomId}`);
    if (publicQueue.length >= 2) {
      console.log("NEW ROOM CREATED")
      publicQueue = [];
      characterNumsPublic = [0,1,2,3,4];
      public_game.to(publicSharedRoomId).emit("room-status", { status: "filled" });
      publicSharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();
    }

  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const room = io.sockets.adapter.rooms.get(roomId);
        const roomSize = room ? room.size : 0;

        if (roomSize === 1) {
          publicRoomParagraph.delete(roomId);
          publicRoomLastState.delete(roomId);
          console.log(`Deleted data for room ${roomId}`);
        } else {
          publicRoomLastState.get(roomId)?.delete(socket.id);
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
    if (!publicRoomLastState.has(roomId)) publicRoomLastState.set(roomId, new Map());
    publicRoomLastState.get(roomId).set(socket.id, msg);
    public_game.to(roomId).emit("receive-message", msg);
  });
  socket.on("disconnect", () => {
    publicQueue = publicQueue.filter(item => item.socket.id !== socket.id);
    // publicRooms = publicRooms.delete(socket.id);
    console.log("User disconnected and removed from queue:", socket.id);
  });
});

// const private_game = io.of("/private_game");
// private_game.use(authMiddleware);

// private_game.on("connection", (socket) => {
//   console.log("\nUser connected:$$$$$$$$$$$$$$$$", socket.id);
//   // console.log("handshake.address:", socket.handshake.address);
//   // console.log("x-forwarded-for:", socket.handshake.headers["x-forwarded-for"]);
//   // console.log("remoteAddress:", socket.request.connection.remoteAddress,"\n");
//   socket.on("join-room", ({ roomId }) => {
//     socket.join(roomId);
//     if (!roomParagraph.has(roomId)) {
//       const randomindex = Math.floor(Math.random() * paragraphs.length);
//       const selectedSentence = paragraphs[randomindex];
//       roomParagraph.set(roomId, selectedSentence)

//     }

//     socket.emit("room-state", {
//       roomId,
//       paragraph: roomParagraph.get(roomId)
//     });

//     console.log(`User ${socket.id} joined room ${roomId}`);
//   });

//   socket.on("disconnecting", () => {
//     for (const roomId of socket.rooms) {
//       if (roomId !== socket.id) {
//         const room = io.sockets.adapter.rooms.get(roomId);
//         const roomSize = room ? room.size : 0;

//         if (roomSize === 1) {
//           roomParagraph.delete(roomId); // clean up last user
//           console.log(`Deleted data for room ${roomId}`);
//         } else {
//           private_game.to(roomId).emit("user-left", { senderId: socket.id });
//         }

//         console.log(`User ${socket.id} leaving room ${roomId}`);
//       }
//     }
//   });

//   socket.on("send-message", ({ roomId, message, typeObject }) => {
//     // Broadcast to everyone in the room (including sender)
//     private_game.to(roomId).emit("receive-message", {
//       senderId: socket.id,
//       senderName: socket.username || "Unknown",
//       message,
//       typeObject
//     });
//   });

//   socket.on("disconnect", () => {
//     console.log("User disconnected:", socket.id);
//   });
// });

/* Private Game */
const privateRoomParagraph = new Map();
const privateRoomLastState = new Map(); // roomId -> Map(socketId -> lastMessage)
const privateRoomQueue =  new Map();
const characterNumsPrivate = new Map();
const privateRoomSize =  new Map();
const private_game = io.of("/private_game");
private_game.use(authMiddleware);
let privateSharedRoomId = Math.random().toString(36).slice(2, 8).toLowerCase();
private_game.on("connection", (socket) => {
  console.log("\nUser connected:$$$$$$$$$$$$$$$$", socket.id);
  // console.log("handshake.address:", socket.handshake.address);
  // console.log("x-forwarded-for:", socket.handshake.headers["x-forwarded-for"]);
  // console.log("remoteAddress:", socket.request.connection.remoteAddress,"\n");
  socket.on("join-room", ({ roomId, roomSize}) => {

    console.log((roomId)?`THERE IS ROOM ID:${roomId}`:"THERE IS NO ROOM ID");
    console.log("roomSize:",roomSize);
    // if (publicRooms.has(privateSharedRoomId)){
    //   publicRooms.set(privateSharedRoomId,publicRooms.get(privateSharedRoomId)+1);
    // }else{
    //   publicRooms.set(privateSharedRoomId,socket.id);
    // }
    socket.join(roomId);
    socket.currentRoomId = roomId;
    
    if (!privateRoomQueue.has(roomId)){
      privateRoomSize.set(roomId,roomSize);
      privateRoomQueue.set(roomId,[socket]);
      characterNumsPrivate.set(roomId,[0,1,2,3,4]);
    }else{
      privateRoomQueue.get(roomId).push(socket);
    }
    let index = characterNumsPrivate.get(roomId)[Math.floor(Math.random()*characterNumsPrivate.get(roomId).length)];
    socket.characterNumber = index
    characterNumsPrivate.get(roomId).splice(index, 1);
    if (!privateRoomParagraph.has(roomId)) {
      const randomindex = Math.floor(Math.random() * paragraphs.length);
      const selectedSentence = paragraphs[randomindex];
      privateRoomParagraph.set(roomId, selectedSentence);
    }
    socket.emit("room-state", {
      roomId: roomId,
      paragraph: privateRoomParagraph.get(roomId),
      characterNumber: socket.characterNumber
    });
    if (privateRoomLastState.has(roomId)) {
      for (const [, state] of privateRoomLastState.get(roomId)) {
        socket.emit("receive-message", state);
      }
    }
    console.log(`User ${socket.id} joined room ${roomId} with privateRoomQueue.get(roomId).length being:`,privateRoomQueue.get(roomId).length );
    if (privateRoomQueue.get(roomId).length >= privateRoomSize.get(roomId)) {
      console.log("NEW ROOM CREATED")
      private_game.to(roomId).emit("room-status", { status: "filled" });
    }

  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const room = io.sockets.adapter.rooms.get(roomId);
        const roomSize = room ? room.size : 0;

        if (roomSize === 1) {
          privateRoomParagraph.delete(roomId);
          privateRoomLastState.delete(roomId);
          characterNumsPrivate.delete(roomId);
          privateRoomQueue.delete(roomId);
          privateRoomSize.delete(roomId);
          console.log(`Deleted data for room ${roomId}`);
        } else {
          privateRoomLastState.get(roomId)?.delete(socket.id);
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
    if (!privateRoomLastState.has(roomId)) privateRoomLastState.set(roomId, new Map());
    privateRoomLastState.get(roomId).set(socket.id, msg);
    private_game.to(roomId).emit("receive-message", msg);
  });
  socket.on("disconnect", () => {
    console.log("User disconnected and removed from queue:", socket.id);
  });
});

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
  }else{
    privateSharedRoomId = req.query.roomType;
    res.json({ privateSharedRoomId });
  }

});