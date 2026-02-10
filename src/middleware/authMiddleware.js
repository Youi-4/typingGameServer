import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getUserByAccountID } from "../models/userModel.js";
dotenv.config();

//node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const secretKey = process.env.SECRET_KEY;

export async function verifyToken(req, res, next) {
    try {
        // const token = req.header('Authorization').replace('Bearer ', '');
        const token = req.cookies.token;
        if (!token) {
          // Handle case where token is not present
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, secretKey);
    console.log(`decoded.account_id ${decoded.account_id}, decoded.roles ${decoded.roles}, decoded.primaryRole ${decoded.primaryRole}`)
        req.accountID = decoded.account_id;
        req.roles = decoded.roles;
        req.primaryRole = decoded.primaryRole;
        if (!decoded) {
            res.status(401).json({ error: 'Unauthorized. Please login again' });
            return;
        }

    const user = await getUserByAccountID(decoded.account_id);
    if (!user || !user.SessionId || user.SessionId !== decoded.session_id) {
      res.clearCookie('token');
      return res.status(401).json({ error: 'Session invalidated. Please login again' });
    }
        next();
    }
    catch (error) {
        let retunError = "";
        res.clearCookie('token');
        if (error.name === 'TokenExpiredError') {
          retunError = 'Token expired';
          console.error(retunError);
        } else if (error.name === 'JsonWebTokenError') {
          retunError = 'Invalid token';
          console.error(retunError);
        } else {
          retunError = 'Token verification failed:' + error.message;
          console.error(retunError);
        }
        res.status(401).json({ error: retunError});
    }
}

