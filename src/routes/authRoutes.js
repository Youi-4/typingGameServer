import express from "express";
import rateLimit from "express-rate-limit";
const router = express.Router();
import { getLoggedinUser, logout, refreshToken, getSocketToken, getGuestToken } from "../controllers/authController.js";
import { authValidate } from "../controllers/authValidateController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/get-loggedin-user", verifyToken, getLoggedinUser);
router.get("/status", verifyToken, authValidate);
router.post("/logout", verifyToken, logout);
router.post("/refresh", refreshLimiter, refreshToken);
router.get("/socket-token", verifyToken, getSocketToken);
router.get("/guest-token", getGuestToken);

export default router;
