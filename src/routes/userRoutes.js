import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import {
  getLeaderboardHandler,
  getPlayerStatsByName,
  getPublicProfile,
  getRaceHistoryHandler,
  getUserByID,
  getUserBySession,
  getUserStats,
  saveRaceHistoryHandler,
  setProfile,
  signupUser,
  updateUserStats,
  userLogin,
} from "../controllers/userController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 10 : 500,
  message: { error: "Too many attempts, please try again later." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Per-user limit for stat submissions. verifyAuthToken runs first and sets
// req.accountID, so we key on that rather than IP to avoid penalising shared
// networks (offices, proxies, etc.).
const statsUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.accountID ?? ipKeyGenerator(req),
  message: { error: "Too many stat submissions, please slow down." },
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
    setProfile,
    getPublicProfile,
    saveRaceHistoryHandler,
    getRaceHistoryHandler,
  },
} = {}) {
  const router = express.Router();

  router.post("/login", authLimiter, handlers.userLogin);
  router.post("/signup", authLimiter, handlers.signupUser);
  router.post("/profile/get/userBySession", handlers.getUserBySession);
  router.post("/profile/get", handlers.getUserByID);
  router.post("/profile/updateStats", verifyAuthToken, statsUpdateLimiter, handlers.updateUserStats);
  router.post("/profile/getStats", verifyAuthToken, handlers.getUserStats);
  router.post("/profile/set", verifyAuthToken, handlers.setProfile);
  router.post("/profile/raceHistory", verifyAuthToken, statsUpdateLimiter, handlers.saveRaceHistoryHandler);
  router.get("/profile/raceHistory", verifyAuthToken, handlers.getRaceHistoryHandler);
  router.get("/profile/statsByUsername", handlers.getPlayerStatsByName);
  router.get("/profile/leaderboard", handlers.getLeaderboardHandler);
  router.get("/profile/public/:username", handlers.getPublicProfile);

  return router;
}

const router = createUserRouter();

export default router;
