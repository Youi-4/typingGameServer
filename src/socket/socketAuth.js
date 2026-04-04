import cookie from "cookie";
import jwt from "jsonwebtoken";

import { getJwtSecret } from "../config/auth.js";
import { getUserByAccountID } from "../models/userModel.js";

export function createSocketAuthMiddleware({
  getUserByAccountId = getUserByAccountID,
  verifyJwt = jwt.verify,
  jwtSecret = getJwtSecret(),
} = {}) {
  return async function socketAuthMiddleware(socket, next) {
    try {
      let token = socket.handshake.auth?.token;

      if (!token) {
        const rawCookies = socket.request.headers.cookie;
        if (rawCookies) {
          token = cookie.parse(rawCookies).token;
        }
      }

      if (!token) {
        return next(new Error("No token"));
      }

      const decoded = verifyJwt(token, jwtSecret);

      if (decoded.is_guest) {
        socket.username = decoded.account_id;
        socket.accountId = decoded.account_id;
        socket.isGuest = true;
        return next();
      }

      const user = await getUserByAccountId(decoded.account_id);
      if (!user) {
        return next(new Error("User not found"));
      }

      if (!user.sessionid || user.sessionid !== decoded.session_id) {
        return next(new Error("Session invalid"));
      }

      socket.username = user.user;
      socket.accountId = user.accountid;
      socket.isGuest = false;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  };
}

export const socketAuthMiddleware = createSocketAuthMiddleware();
