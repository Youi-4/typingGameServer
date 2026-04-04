import express from "express";
import rateLimit from "express-rate-limit";

import {
  getGuestToken,
  getLoggedinUser,
  getSocketToken,
  logout,
  refreshToken,
} from "../controllers/authController.js";
import { authValidate } from "../controllers/authValidateController.js";
import { googleCallback, googleRedirect } from "../controllers/googleAuthController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export function createAuthRouter({
  verifyAuthToken = verifyToken,
  validateAuth = authValidate,
  handlers = {
    getLoggedinUser,
    logout,
    refreshToken,
    getSocketToken,
    getGuestToken,
  },
  googleHandlers = {
    googleRedirect,
    googleCallback,
  },
} = {}) {
  const router = express.Router();

  router.get("/get-loggedin-user", verifyAuthToken, handlers.getLoggedinUser);
  router.get("/status", verifyAuthToken, validateAuth);
  router.post("/logout", verifyAuthToken, handlers.logout);
  router.post("/refresh", refreshLimiter, handlers.refreshToken);
  router.get("/socket-token", verifyAuthToken, handlers.getSocketToken);
  router.get("/guest-token", handlers.getGuestToken);
  router.get("/google", googleHandlers.googleRedirect);
  router.get("/google/callback", googleHandlers.googleCallback);

  return router;
}

const router = createAuthRouter();

export default router;
