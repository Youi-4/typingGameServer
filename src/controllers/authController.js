import { getUserByAccountID, clearSessionId } from "../models/userModel.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const getLoggedinUser = async (req, res) => {
  const userId = req.accountID;
  if (!userId) return res.status(400).json({ error: "User not logged in" });

  const user = await getUserByAccountID(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  return res.status(200).json({ user: user });
};

export const logout = async (req, res) => {
  if (req.accountID) {
    await clearSessionId(req.accountID);
  }
  // Clear cookie with same options used when setting it
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none"
  });
  res.json({ success: true });
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ message: 'No token found' });
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY || "your-secret-key");
    
    // Verify user still exists and session is valid
    const user = await getUserByAccountID(decoded.account_id);
    if (!user || !user.sessionid || user.sessionid !== decoded.session_id) {
      return res.status(401).json({ message: 'Invalid session' });
    }

    // Generate new token with same session
    const newToken = jwt.sign(
      { account_id: user.accountid, email: user.emailaddress, session_id: user.sessionid },
      process.env.SECRET_KEY || "your-secret-key",
      { expiresIn: '7d' }
    );

    // Set new cookie
    res.cookie("token", newToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ 
      success: true,
      message: 'Token refreshed successfully' 
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', expired: true });
    }
    res.status(401).json({ message: 'Invalid token' });
  }
};
