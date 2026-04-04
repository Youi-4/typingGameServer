import express from "express";
import rateLimit from "express-rate-limit";

import {
  getLeaderboardHandler,
  getPlayerStatsByName,
  getUserByID,
  getUserBySession,
  getUserStats,
  signupUser,
  updateUserStats,
  userLogin,
} from "../controllers/userController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many attempts, please try again later." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export function createUserRouter({
  verifyAuthToken = verifyToken,
  handlers = {
    userLogin,
    signupUser,
    getUserBySession,
    getUserByID,
    updateUserStats,
    getUserStats,
    getPlayerStatsByName,
    getLeaderboardHandler,
  },
} = {}) {
  const router = express.Router();

  router.post("/login", authLimiter, handlers.userLogin);
  router.post("/signup", authLimiter, handlers.signupUser);
  router.post("/profile/get/userBySession", handlers.getUserBySession);
  router.post("/profile/get", handlers.getUserByID);
  router.post("/profile/updateStats", verifyAuthToken, handlers.updateUserStats);
  router.post("/profile/getStats", verifyAuthToken, handlers.getUserStats);
  router.get("/profile/statsByUsername", handlers.getPlayerStatsByName);
  router.get("/profile/leaderboard", handlers.getLeaderboardHandler);

  return router;
}

const router = createUserRouter();

export default router;
