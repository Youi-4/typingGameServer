import express from "express";
const router = express.Router();
import { getLoggedinUser, logout, refreshToken } from "../controllers/authController.js";
import { authValidate } from "../controllers/authValidateController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

router.get("/get-loggedin-user", verifyToken, getLoggedinUser);
router.get("/status", verifyToken, authValidate);
router.post("/logout", verifyToken, logout);
router.post("/refresh", refreshToken);

export default router;
