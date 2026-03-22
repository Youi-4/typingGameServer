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
        console.log("hkkkk")
        const query = `SELECT race_avg,race_last,race_best,race_won,race_completed FROM account_stats WHERE accountid = $1`;
        const { rows: race_rows } = await db.query(query, [accountId]);
        if (won) {

            const query_won_update = `UPDATE account_stats SET race_won = $1 WHERE accountid = $2`; 
            await db.query(query_won_update, [race_rows[0]?.race_won+1, accountId]);
        }
        if (race_rows[0]?.race_best < wpm){
            const query_race_best = `UPDATE account_stats SET race_best = $1 WHERE accountid = $2`; 
            await db.query(query_race_best, [wpm, accountId]);
        }
        const query_race_last = `UPDATE account_stats SET race_last = $1 WHERE accountid = $2`; 
        await db.query(query_race_last, [wpm, accountId]);
        
        const query_race_avg = `UPDATE account_stats SET race_avg = $1 WHERE accountid = $2`; 
        await db.query(query_race_avg, [((race_rows[0]?.race_avg * race_rows[0]?.race_completed) + wpm) / (race_rows[0]?.race_completed + 1), accountId]);



        const query_race_completed = `UPDATE account_stats SET race_completed = $1 WHERE accountid = $2`; 
        await db.query(query_race_completed, [race_rows[0]?.race_completed+1, accountId]);
        console.log(race_rows[0]?.race_won, wpm, won)


        return null;
    } catch (error) {
        console.error("Error creating account:", error);
        throw new Error("Unable to updateStats an account: " + error.message)
    }

}

export async function getStatsByUsername(userName) {
    try {
        const query = `
            SELECT a.race_avg, a.race_last, a.race_best, a.race_won, a.race_completed
            FROM account_stats a
            JOIN account acc ON a.accountid = acc.accountid
            WHERE acc."user" = $1`;
        const { rows } = await db.query(query, [userName]);
        return rows[0] || null;
    } catch (error) {
        throw new Error("Error fetching stats by username: " + error.message);
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