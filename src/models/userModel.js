import db from "../db/db.js";

export async function getUserByEmail(email) {
    try {
        const query = `SELECT * FROM account WHERE emailaddress = $1`;
        const { rows } = await db.query(query, [email.toLowerCase()]);
        return rows[0] || null;
    } catch (err) {
        console.error("Error fetching user: ", err);
        throw new Error("Error fetching user");
    }

}
export async function getUserByAccountID(id) {
    try {
        const query = `SELECT * FROM account WHERE accountid = $1`;
        const { rows } = await db.query(query, [id]);
        const account = rows[0];
        if (!account) return null;
        return account;
    } catch (error) {
        console.error("Error fetching user: ", error);
        throw new Error("Error fetching user");
    }
}

export async function updateSessionId(accountId, sessionId) {
    try {
        const query = `UPDATE account SET sessionid = $1 WHERE accountid = $2`;
        await db.query(query, [sessionId, accountId]);
    } catch (error) {
        console.error("Error updating session id: ", error);
        throw new Error("Error updating session id");
    }
}

export async function clearSessionId(accountId) {
    try {
        const query = `UPDATE account SET sessionid = NULL WHERE accountid = $1`;
        await db.query(query, [accountId]);
    } catch (error) {
        console.error("Error clearing session id: ", error);
        throw new Error("Error clearing session id");
    }
}



export async function createAccount(emailAddress, password, user, verification) {
    try {
        const query = `INSERT INTO account (emailaddress, password, "user", verificationstatus) VALUES ($1, $2, $3, $4) RETURNING *`;
        const { rows } = await db.query(query, [emailAddress.toLowerCase(), password, user.toLowerCase(), verification]);
        const query2 = `INSERT INTO account_stats (accountid) VALUES ($1)`;

        await db.query(query2, [rows[0]?.accountid])

        return rows[0] || null;
    } catch (error) {
        console.error("Error creating account:", error);
        throw new Error("Unable to create an account: " + error.message)
    }

}


export async function updateStats(accountId, wpm, won) {
    try {
        await db.query(
            `UPDATE account_stats SET
                race_won       = COALESCE(race_won, 0) + $1,
                race_best      = GREATEST(COALESCE(race_best, 0), $2),
                race_last      = $2,
                race_avg       = (COALESCE(race_avg, 0) * COALESCE(race_completed, 0) + $2) / (COALESCE(race_completed, 0) + 1),
                race_completed = COALESCE(race_completed, 0) + 1
            WHERE accountid = $3`,
            [won ? 1 : 0, wpm, accountId]
        );
        return null;
    } catch (error) {
        console.error("Error updating stats:", error);
        throw new Error("Unable to updateStats: " + error.message)
    }
}

export async function getStats(accountId) {
    try {
        const query = `SELECT race_avg,race_last,race_best,race_won,race_completed FROM account_stats WHERE accountid = $1`;
        const { rows } = await db.query(query, [accountId]);
        return rows[0] || null;
    } catch (error) {
        throw new Error("Unable to getStats: " + error.message);
    }
}

export async function getStatsByUsername(username) {
    try {
        const query = `
            SELECT s.race_avg, s.race_last, s.race_best, s.race_won, s.race_completed
            FROM account_stats s
            JOIN account a ON a.accountid = s.accountid
            WHERE LOWER(a."user") = LOWER($1)
        `;
        const { rows } = await db.query(query, [username]);
        return rows[0] || null;
    } catch (error) {
        throw new Error("Unable to getStatsByUsername: " + error.message);
    }
}

export async function getUserByUserName(userName) {
    try {
        const query = `SELECT * FROM account WHERE LOWER("user") = LOWER($1)`;
        const { rows } = await db.query(query, [userName]);
        return rows[0] || null;
    } catch (error) {
        console.error("Error fetching user: ", error);
        throw new Error("Error fetching user");
    }
}


export async function getLeaderboard(limit = 10) {
    try {
        const query = `
            SELECT a."user" AS username, s.race_best, s.race_avg, s.race_won, s.race_completed
            FROM account_stats s
            JOIN account a ON a.accountid = s.accountid
            WHERE s.race_completed > 0
            ORDER BY s.race_best DESC
            LIMIT $1
        `;
        const { rows } = await db.query(query, [limit]);
        return rows;
    } catch (error) {
        throw new Error("Unable to getLeaderboard: " + error.message);
    }
}

export async function findOrCreateGoogleUser({ googleId, email, name }) {
    try {
        let { rows } = await db.query(`SELECT * FROM account WHERE google_id = $1`, [googleId]);
        if (rows[0]) return rows[0];

        ({ rows } = await db.query(`SELECT * FROM account WHERE emailaddress = $1`, [email.toLowerCase()]));
        if (rows[0]) {
            await db.query(`UPDATE account SET google_id = $1 WHERE accountid = $2`, [googleId, rows[0].accountid]);
            return rows[0];
        }

        let username = name.replace(/\s+/g, '').toLowerCase().slice(0, 15);
        const { rows: existing } = await db.query(`SELECT 1 FROM account WHERE "user" = $1`, [username]);
        if (existing[0]) username = username + Math.floor(Math.random() * 9000 + 1000);

        const { rows: newRows } = await db.query(
            `INSERT INTO account (emailaddress, password, "user", verificationstatus, google_id) VALUES ($1, NULL, $2, TRUE, $3) RETURNING *`,
            [email.toLowerCase(), username, googleId]
        );
        await db.query(`INSERT INTO account_stats (accountid) VALUES ($1)`, [newRows[0].accountid]);
        return newRows[0];
    } catch (error) {
        console.error("Error in findOrCreateGoogleUser:", error);
        throw new Error("Unable to find or create Google user: " + error.message);
    }
}

export async function getUserBySessionID(sessionId) {
    try {
        const query = `SELECT "user", emailaddress, bio, avatar_color FROM account WHERE sessionid = $1`;
        const { rows } = await db.query(query, [sessionId]);
        return rows[0] || null;
    } catch (error) {
        console.error("Error fetching user by Session ID: ", error);
        throw new Error("Error fetching user");
    }
}

export async function updateProfile(accountId, { bio, avatarColor }) {
    try {
        await db.query(
            `UPDATE account SET bio = $1, avatar_color = $2 WHERE accountid = $3`,
            [bio ?? null, avatarColor ?? null, accountId]
        );
    } catch (error) {
        console.error("Error updating profile:", error);
        throw new Error("Error updating profile");
    }
}

export async function saveRaceHistory(accountId, wpm, accuracy, mode) {
    try {
        await db.query(
            `INSERT INTO race_history (accountid, wpm, accuracy, mode) VALUES ($1, $2, $3, $4)`,
            [accountId, wpm, accuracy, mode]
        );
    } catch (error) {
        console.error("Error saving race history:", error);
        throw new Error("Unable to save race history: " + error.message);
    }
}

export async function getRaceHistory(accountId, limit = 50) {
    try {
        const { rows } = await db.query(
            `SELECT wpm, accuracy, mode, created_at
             FROM race_history
             WHERE accountid = $1
             ORDER BY created_at ASC
             LIMIT $2`,
            [accountId, limit]
        );
        return rows;
    } catch (error) {
        throw new Error("Unable to getRaceHistory: " + error.message);
    }
}

export async function getPublicProfileByUsername(username) {
    try {
        const { rows } = await db.query(`
            SELECT a."user" AS username, a.bio, a.avatar_color,
                   s.race_avg, s.race_best, s.race_won, s.race_completed
            FROM account a
            LEFT JOIN account_stats s ON s.accountid = a.accountid
            WHERE LOWER(a."user") = LOWER($1)
        `, [username]);
        return rows[0] || null;
    } catch (error) {
        console.error("Error fetching public profile:", error);
        throw new Error("Error fetching public profile");
    }
}