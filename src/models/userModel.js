import db from "../db/db.js";

export async function getUserByEmail(email){
    try{
        const query = `SELECT * FROM Account WHERE emailaddress = $1`;
        const { rows } = await db.query(query, [email]);
        return rows[0] || null;
    }catch(err){
        console.error("Error fetching user: ", err);
        throw new Error("Error fetching user");
    }

}
export async function getUserByAccountID(id) {
  try {
    const query = `SELECT * FROM Account WHERE accountid = $1`;
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
        const query = `UPDATE Account SET sessionid = $1 WHERE accountid = $2`;
        await db.query(query, [sessionId, accountId]);
    } catch (error) {
        console.error("Error updating session id: ", error);
        throw new Error("Error updating session id");
    }
}

export async function clearSessionId(accountId) {
    try {
        const query = `UPDATE Account SET sessionid = NULL WHERE accountid = $1`;
        await db.query(query, [accountId]);
    } catch (error) {
        console.error("Error clearing session id: ", error);
        throw new Error("Error clearing session id");
    }
}



export async function createAccount(EmailAddress,Password,user,verification){
    try{
        const query = `INSERT INTO Account (emailaddress, password, "user", verificationstatus) VALUES ($1, $2, $3, $4) RETURNING *`;
        console.log(EmailAddress,Password,user,verification)
        const { rows } = await db.query(query, [EmailAddress.toLowerCase(), Password, user.toLowerCase(), verification]);
        
        if (rows[0]){
            console.log("Account made", rows[0]);
            return rows[0];
        }else{
            return null;
        }
    }catch(error){
        console.error("Error creating account:", error);
        throw new Error("Unable to create an account: " + error.message)
    }

}

export async function getUserByUserName(userName){
    try{
        
        const query = `SELECT * FROM Account WHERE "user" = $1`;
        const { rows } = await db.query(query, [userName]);
        return rows[0] || null;
    }catch(error){
        console.error("Error fetching user: ", error);
        throw new Error("Error fetching user");
    }
}


export async function getUserBySessionID(sessionId){
    try{
        
        const query = `SELECT * FROM Account WHERE sessionid = $1`;
        const { rows } = await db.query(query, [sessionId]);
        return rows[0] || null;
    }catch(error){
        console.error("Error fetching user by Session ID: ", error);
        throw new Error("Error fetching user");
    }
}