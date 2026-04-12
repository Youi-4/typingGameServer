import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

import { paragraphs } from "./data/sentence.js";
import authRoutes, { createAuthRouter } from "./routes/authRoutes.js";
import userRoutes, { createUserRouter } from "./routes/userRoutes.js";
import { createRoomRouter } from "./routes/roomRoutes.js";
import { socketAuthMiddleware } from "./socket/socketAuth.js";
import { createPublicGameNamespace } from "./socket/publicGame.js";
import { createPrivateGameNamespace } from "./socket/privateGame.js";
import { createNotificationNamespace } from "./socket/notificationNamespace.js";

const BATCH_INTERVAL_MS = 250;

export function getAllowedOrigins(clientUrl = process.env.CLIENT_URL) {
  return clientUrl
    ? clientUrl.split(",").map((value) => value.trim()).filter(Boolean)
    : ["http://localhost:5173"];
}

export function createCorsOriginHandler(allowedOrigins) {
  return function corsOrigin(origin, callback) {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin)
    ) {
      return callback(null, origin);
    }

    return callback(new Error("Not allowed by CORS"));
  };
}

export function createExpressApp({
  authRouter = authRoutes,
  userRouter = userRoutes,
  logger = console,
} = {}) {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  const corsOrigin = createCorsOriginHandler(allowedOrigins);

  app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use(cookieParser());

  const myIp = process.env.MY_IP;
  const seenIps = new Set();
  app.use((req, _res, next) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    if (ip && ip !== myIp && !seenIps.has(ip)) {
      seenIps.add(ip);
      logger.log(`[NEW VISITOR] ${new Date().toISOString()} | IP: ${ip}`);
    }
    next();
  });

  app.use("/api/user", userRouter);
  app.use("/api/auth", authRouter);

  return { app, allowedOrigins, corsOrigin };
}

export function createApplicationServer({
  logger = console,
  authRouter = createAuthRouter(),
  userRouter = createUserRouter(),
  socketAuth = socketAuthMiddleware,
} = {}) {
  const { app, corsOrigin } = createExpressApp({ authRouter, userRouter, logger });
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  const publicGame = createPublicGameNamespace({
    io,
    authMiddleware: socketAuth,
    paragraphs,
    logger,
  });
  const privateGame = createPrivateGameNamespace({
    io,
    authMiddleware: socketAuth,
    paragraphs,
    logger,
  });

  createNotificationNamespace({
    io,
    authMiddleware: socketAuth,
    logger,
  });

  app.use("/api", createRoomRouter({
    getOpenPublicRoomId: publicGame.getOpenRoomId,
  }));

  const intervals = [
    setInterval(() => {
      publicGame.flushPendingBatches();
    }, BATCH_INTERVAL_MS),
    setInterval(() => {
      privateGame.flushPendingBatches();
    }, BATCH_INTERVAL_MS),
  ];

  function closeRealtime() {
    for (const intervalId of intervals) {
      clearInterval(intervalId);
    }
    io.close();
  }

  return {
    app,
    httpServer,
    io,
    publicGame,
    privateGame,
    closeRealtime,
  };
}
