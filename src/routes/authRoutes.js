import express from "express";
const router = express.Router();
import { getLoggedinUser, logout, refreshToken, getSocketToken, getGuestToken } from "../controllers/authController.js";
import { authValidate } from "../controllers/authValidateController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

router.get("/get-loggedin-user", verifyToken, getLoggedinUser);
router.get("/status", verifyToken, authValidate);
router.post("/logout", verifyToken, logout);
router.post("/refresh", refreshToken);
router.get("/socket-token", verifyToken, getSocketToken);
router.get("/guest-token", getGuestToken);

export default router;
