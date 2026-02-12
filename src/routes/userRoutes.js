import express from "express";
import { userLogin,signupUser,getUserBySession,getUserByID} from "../controllers/userController.js";

const router = express.Router();

// Login route
router.post("/login", userLogin);
router.post("/signup", signupUser);
router.post("/profile/get/userBySession", getUserBySession);
router.post("/profile/get", getUserByID);

export default router;
