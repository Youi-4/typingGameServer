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
        //console.log(emailAddress,password,user,verification)
        const { rows } = await db.query(query, [emailAddress.toLowerCase(), password, user.toLowerCase(), verification]);
        const query2 = `INSERT INTO account_stats (accountid) VALUES ($1)`
        await db.query(query2, [rows[0]?.accountid])

        if (rows[0]) {
            console.log("account made", rows[0]);
            return rows[0];
        } else {
            return null;
        }
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
            WHERE a."user" = $1
        `;
        const { rows } = await db.query(query, [username]);
        return rows[0] || null;
    } catch (error) {
        throw new Error("Unable to getStatsByUsername: " + error.message);
    }
}

export async function getUserByUserName(userName) {
    try {

        const query = `SELECT * FROM account WHERE "user" = $1`;
        const { rows } = await db.query(query, [userName]);
        return rows[0] || null;
    } catch (error) {
        console.error("Error fetching user: ", error);
        throw new Error("Error fetching user");
    }
}


export async function getUserBySessionID(sessionId) {
    try {

        const query = `SELECT "user", emailaddress FROM account WHERE sessionid = $1`;
        console.log("getting sessionID::::", sessionId);
        const { rows } = await db.query(query, [sessionId]);
        return rows[0] || null;
    } catch (error) {
        console.error("Error fetching user by Session ID: ", error);
        throw new Error("Error fetching user");
    }
}