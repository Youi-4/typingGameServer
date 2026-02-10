import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getUserByAccountID } from "../models/userModel.js";
dotenv.config();

//node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const secretKey = process.env.SECRET_KEY;

export async function verifyToken(req, res, next) {
    try {
        const token = req.cookies.token;
        if (!token) {
          return res.status(401).json({ 
            error: 'Unauthorized',
            tokenExpired: false 
          });
        }

        const decoded = jwt.verify(token, secretKey);
        
        req.accountID = decoded.account_id;
        req.roles = decoded.roles;
        req.primaryRole = decoded.primaryRole;

        // Verify user and session
        const user = await getUserByAccountID(decoded.account_id);
        if (!user || !user.sessionid || user.sessionid !== decoded.session_id) {
          res.clearCookie('token', {
            httpOnly: true,
            secure: true,
            sameSite: "none"
          });
          return res.status(401).json({ 
            error: 'Session invalidated. Please login again',
            sessionInvalid: true 
          });
        }
        
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error.message);
        
        // Clear cookie with proper options
        res.clearCookie('token', {
          httpOnly: true,
          secure: true,
          sameSite: "none"
        });
        
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            error: 'Token expired',
            tokenExpired: true 
          });
        } else if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({ 
            error: 'Invalid token',
            tokenExpired: false 
          });
        } else {
          return res.status(401).json({ 
            error: 'Token verification failed: ' + error.message,
            tokenExpired: false 
          });
        }
    }
}

