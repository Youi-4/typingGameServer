import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getJwtSecret,
} from "../config/auth.js";
import { toLoginResponseDto } from "../dto/authDto.js";
import {
  toLeaderboardResponseDto,
  toPublicProfileDto,
  toStatsResponseDto,
} from "../dto/statsDto.js";
import {
  createAccount,
  getLeaderboard,
  getPublicProfileByUsername,
  getStats,
  getStatsByUsername,
  getUserByAccountID,
  getUserByEmail,
  getUserBySessionID,
  getUserByUserName,
  updateProfile,
  updateSessionId,
  updateStats,
} from "../models/userModel.js";

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_UPPER = /[A-Z]/;
const PASSWORD_LOWER = /[a-z]/;
const PASSWORD_DIGIT = /[0-9]/;
const PASSWORD_SPECIAL = /[@$!%*?&_#^()]/;

export function createUserController({
  getUserByEmailAddress = getUserByEmail,
  createUserAccount = createAccount,
  updateUserSessionId = updateSessionId,
  getUserByUserNameValue = getUserByUserName,
  getUserBySessionIdValue = getUserBySessionID,
  getUserByAccountId = getUserByAccountID,
  updateUserStatsInStore = updateStats,
  getUserStatsFromStore = getStats,
  getStatsByUserName = getStatsByUsername,
  getLeaderboardEntries = getLeaderboard,
  updateProfileInStore = updateProfile,
  getPublicProfileFromStore = getPublicProfileByUsername,
  comparePassword = bcrypt.compare,
  hashPassword = bcrypt.hash,
  signJwt = jwt.sign,
  verifyJwt = jwt.verify,
  createSessionId = () => crypto.randomBytes(32).toString("hex"),
  jwtSecret = getJwtSecret(),
  cookieName = AUTH_COOKIE_NAME,
  authCookieOptions = getAuthCookieOptions(),
}) {
  const userLogin = async (req, res) => {
    try {
      const { userName_or_email, password } = req.body;

      if (!userName_or_email || !password) {
        return res.status(400).json({
          id: "validation",
          error: "Email and password are required",
        });
      }

      const normalizedIdentifier = userName_or_email.trim().toLowerCase();
      let user = await getUserByEmailAddress(normalizedIdentifier);
      if (!user) {
        user = await getUserByUserNameValue(normalizedIdentifier);
      }

      if (!user || !user.password) {
        return res.status(401).json({
          id: "loginError",
          error: "Invalid username or password.",
        });
      }

      const isMatch = await comparePassword(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          id: "loginError",
          error: "Invalid username or password.",
        });
      }

      const sessionId = createSessionId();
      await updateUserSessionId(user.accountid, sessionId);

      const token = signJwt(
        {
          account_id: user.accountid,
          email: user.emailaddress,
          session_id: sessionId,
        },
        jwtSecret,
        { expiresIn: "7d" }
      );

      res.cookie(cookieName, token, authCookieOptions);
      return res.status(200).json(toLoginResponseDto(user));
    } catch (_error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  const signupUser = async (req, res) => {
    try {
      const { email, password, user, verified } = req.body;

      if (!user || !USERNAME_RE.test(user)) {
        return res.status(400).json({
          error: "Username must be 3-20 characters and contain only letters, numbers, _ or -.",
        });
      }
      if (!email || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "Invalid email address." });
      }
      if (!password || password.length < 6 || password.length > 64) {
        return res.status(400).json({ error: "Password must be between 6 and 64 characters." });
      }
      if (
        !PASSWORD_UPPER.test(password) ||
        !PASSWORD_LOWER.test(password) ||
        !PASSWORD_DIGIT.test(password) ||
        !PASSWORD_SPECIAL.test(password)
      ) {
        return res.status(400).json({
          error: "Password must contain uppercase, lowercase, a number, and a special character (@$!%*?&_#^()).",
        });
      }

      if (await getUserByEmailAddress(email)) {
        return res.status(409).json({ error: "Email already exists." });
      }

      if (await getUserByUserNameValue(user)) {
        return res.status(409).json({ error: "Username already exists." });
      }

      const hash = await hashPassword(password, 10);
      await createUserAccount(email, hash, user, verified);
      return res.status(201).json({ success: true, message: "User created successfully" });
    } catch (_error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  const getUserBySession = async (req, res) => {
    try {
      const token = req.cookies?.[cookieName];
      if (!token) {
        return res.status(401).json({ error: "Missing auth token" });
      }

      const decoded = verifyJwt(token, jwtSecret);
      const sessionId = decoded?.session_id;
      if (!sessionId) {
        return res.status(401).json({ error: "Invalid auth token" });
      }

      const user = await getUserBySessionIdValue(sessionId);
      if (!user) {
        return res.status(404).json({ error: "User could not be found." });
      }

      return res.status(200).json({ user });
    } catch (_error) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };

  const getUserByID = async (req, res) => {
    try {
      const { account_id } = req.body;
      const user = await getUserByAccountId(account_id);

      if (!user) {
        return res.status(404).json({ error: "User could not be found." });
      }

      return res.status(200).json({ user });
    } catch (_error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  const updateUserStats = async (req, res) => {
    try {
      if (!req.accountID) {
        return res.status(401).json({ error: "Missing auth token" });
      }

      const { won, wpm } = req.body;
      await updateUserStatsInStore(req.accountID, wpm, won);
      const updatedStats = await getUserStatsFromStore(req.accountID);

      return res.status(200).json(toStatsResponseDto(updatedStats));
    } catch (_error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  const getUserStats = async (req, res) => {
    try {
      if (!req.accountID) {
        return res.status(401).json({ error: "Missing auth token" });
      }

      const stats = await getUserStatsFromStore(req.accountID);
      return res.status(200).json(toStatsResponseDto(stats));
    } catch (_error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  const getPlayerStatsByName = async (req, res) => {
    try {
      const { username } = req.query;
      if (!username) {
        return res.status(400).json({ error: "Username required" });
      }

      const stats = await getStatsByUserName(username);
      return res.status(200).json(toStatsResponseDto(stats));
    } catch (_error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  const getLeaderboardHandler = async (_req, res) => {
    try {
      const players = await getLeaderboardEntries(10);
      return res.status(200).json(toLeaderboardResponseDto(players));
    } catch (_error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  const setProfile = async (req, res) => {
    try {
      if (!req.accountID) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { bio, avatarColor } = req.body;
      if (bio != null && bio.length > 200) {
        return res.status(400).json({ error: "Bio must be 200 characters or less." });
      }
      if (avatarColor != null && !/^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
        return res.status(400).json({ error: "Invalid avatar color." });
      }
      await updateProfileInStore(req.accountID, { bio, avatarColor });
      const user = await getUserByAccountId(req.accountID);
      return res.status(200).json({
        username: user.user,
        bio: user.bio ?? null,
        avatar_color: user.avatar_color ?? null,
      });
    } catch (_error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  const getPublicProfile = async (req, res) => {
    try {
      const { username } = req.params;
      if (!username) {
        return res.status(400).json({ error: "Username required" });
      }
      const profile = await getPublicProfileFromStore(username);
      if (!profile) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json({ profile: toPublicProfileDto(profile) });
    } catch (_error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  return {
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
  };
}

const userController = createUserController({});

export const {
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
} = userController;
