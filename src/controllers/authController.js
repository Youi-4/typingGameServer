import jwt from "jsonwebtoken";

import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
  getJwtSecret,
} from "../config/auth.js";
import {
  toRefreshTokenResponseDto,
  toSocketTokenResponseDto,
} from "../dto/authDto.js";
import { clearSessionId, getUserByAccountID } from "../models/userModel.js";

export function createAuthController({
  getUserByAccountId = getUserByAccountID,
  clearUserSessionId = clearSessionId,
  signJwt = jwt.sign,
  verifyJwt = jwt.verify,
  jwtSecret = getJwtSecret(),
  cookieName = AUTH_COOKIE_NAME,
  authCookieOptions = getAuthCookieOptions(),
  clearAuthCookieOptions = getClearAuthCookieOptions(),
  createGuestId = () => `guest_${Math.random().toString(36).slice(2, 6)}`,
}) {
  const logout = async (req, res) => {
    if (req.accountID) {
      await clearUserSessionId(req.accountID);
    }

    res.clearCookie(cookieName, clearAuthCookieOptions);
    return res.status(200).json({ success: true });
  };

  const getSocketToken = async (req, res) => {
    try {
      const user = await getUserByAccountId(req.accountID);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const socketToken = signJwt(
        { account_id: user.accountid, session_id: user.sessionid },
        jwtSecret,
        { expiresIn: "30s" }
      );

      return res.status(200).json(toSocketTokenResponseDto(socketToken));
    } catch (_error) {
      return res.status(500).json({ error: "Failed to generate socket token" });
    }
  };

  const getGuestToken = (_req, res) => {
    const guestId = createGuestId();
    const socketToken = signJwt(
      { account_id: guestId, is_guest: true },
      jwtSecret,
      { expiresIn: "2h" }
    );

    return res.status(200).json(toSocketTokenResponseDto(socketToken, guestId));
  };

  const refreshToken = async (req, res) => {
    try {
      const token = req.cookies[cookieName];
      if (!token) {
        return res.status(401).json({ message: "No token found" });
      }

      const decoded = verifyJwt(token, jwtSecret);
      const user = await getUserByAccountId(decoded.account_id);

      if (!user || !user.sessionid || user.sessionid !== decoded.session_id) {
        return res.status(401).json({ message: "Invalid session" });
      }

      const newToken = signJwt(
        {
          account_id: user.accountid,
          email: user.emailaddress,
          session_id: user.sessionid,
        },
        jwtSecret,
        { expiresIn: "7d" }
      );

      res.cookie(cookieName, newToken, authCookieOptions);
      return res.status(200).json(toRefreshTokenResponseDto());
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired", expired: true });
      }

      return res.status(401).json({ message: "Invalid token" });
    }
  };

  return {
    logout,
    getSocketToken,
    getGuestToken,
    refreshToken,
  };
}

const authController = createAuthController({});

export const {
  logout,
  getSocketToken,
  getGuestToken,
  refreshToken,
} = authController;
