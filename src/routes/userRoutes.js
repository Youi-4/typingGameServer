import express from "express";
import rateLimit from "express-rate-limit";
import { userLogin,signupUser,getUserBySession,getUserByID,updateUserStats,getPlayerStatsByName} from "../controllers/userController.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,                 // max 10 attempts per window
  message: { error: "Too many attempts, please try again later." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Login route
router.post("/login", authLimiter, userLogin);
router.post("/signup", authLimiter, signupUser);
router.post("/profile/get/userBySession", getUserBySession);
router.post("/profile/get", getUserByID);
router.post("/profile/updateStats",updateUserStats)
router.post("/profile/stats/byUsername", getPlayerStatsByName)
export default router;
