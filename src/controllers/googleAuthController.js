import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

import { AUTH_COOKIE_NAME, getAuthCookieOptions, getJwtSecret } from '../config/auth.js';
import { findOrCreateGoogleUser, updateSessionId } from '../models/userModel.js';

const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

export const googleRedirect = (_req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['profile', 'email'],
        prompt: 'select_account',
    });
    res.redirect(url);
};

export const googleCallback = async (req, res) => {
    const clientUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:5173';
    try {
        const { code } = req.query;
        const { tokens } = await oauth2Client.getToken(code);

        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { sub: googleId, email, name } = ticket.getPayload();
        const user = await findOrCreateGoogleUser({ googleId, email, name });

        const sessionId = crypto.randomBytes(32).toString('hex');
        await updateSessionId(user.accountid, sessionId);

        const token = jwt.sign(
            { account_id: user.accountid, email: user.emailaddress, session_id: sessionId },
            getJwtSecret(),
            { expiresIn: '7d' }
        );

        res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

        res.redirect(`${clientUrl}/Home`);
    } catch (err) {
        console.error('Google OAuth error:', err.message, err.stack);
        res.redirect(`${clientUrl}/Login?error=${encodeURIComponent(err.message)}`);
    }
};
