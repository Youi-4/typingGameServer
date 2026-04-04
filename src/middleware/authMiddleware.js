import jwt from "jsonwebtoken";

import {
  AUTH_COOKIE_NAME,
  getClearAuthCookieOptions,
  getJwtSecret,
} from "../config/auth.js";
import { getUserByAccountID } from "../models/userModel.js";

export function createVerifyToken({
  getUserByAccountId = getUserByAccountID,
  verifyJwt = jwt.verify,
  jwtSecret = getJwtSecret(),
  cookieName = AUTH_COOKIE_NAME,
  clearAuthCookieOptions = getClearAuthCookieOptions(),
}) {
  return async function verifyToken(req, res, next) {
    try {
      const token = req.cookies[cookieName];
      if (!token) {
        return res.status(401).json({
          error: "Unauthorized",
          tokenExpired: false,
        });
      }

      const decoded = verifyJwt(token, jwtSecret);

      req.accountID = decoded.account_id;
      req.roles = decoded.roles;
      req.primaryRole = decoded.primaryRole;

      const user = await getUserByAccountId(decoded.account_id);
      if (!user || !user.sessionid || user.sessionid !== decoded.session_id) {
        res.clearCookie(cookieName, clearAuthCookieOptions);
        return res.status(401).json({
          error: "Session invalidated. Please login again",
          sessionInvalid: true,
        });
      }

      return next();
    } catch (error) {
      res.clearCookie(cookieName, clearAuthCookieOptions);

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Token expired",
          tokenExpired: true,
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          error: "Invalid token",
          tokenExpired: false,
        });
      }

      return res.status(401).json({
        error: `Token verification failed: ${error.message}`,
        tokenExpired: false,
      });
    }
  };
}

export const verifyToken = createVerifyToken({});
