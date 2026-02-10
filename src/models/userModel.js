import db from "../db/db.js";

// async function getAccounts(){
// const [rows] = await pool.query("SELECT * FROM Account")
// return rows
// }

export async function getUserByEmail(email){
    try{
        const query =`SELECT * FROM Account where EmailAddress = ?`
        const [rows] = await db.promise().query(query,[email]);
        return rows[0] || null;
    }catch(err){
        console.error("Error fetching user: ", err);
        throw new Error("Error fetching user");
    }

}
export async function getUserByAccountID(id) {
  try {
    const query = `SELECT * FROM Account WHERE AccountID = ?`;
    const [results] = await db.promise().query(query, [id]);
    const account = results[0];
    if (!account) return null;
    return account;
  } catch (error) {
    console.error("Error fetching user: ", error);
    throw new Error("Error fetching user");
  }
}

export async function updateSessionId(accountId, sessionId) {
    try {
        const query = `UPDATE Account SET SessionId = ? WHERE AccountID = ?`;
        await db.promise().query(query, [sessionId, accountId]);
    } catch (error) {
        console.error("Error updating session id: ", error);
        throw new Error("Error updating session id");
    }
}

export async function clearSessionId(accountId) {
    try {
        const query = `UPDATE Account SET SessionId = NULL WHERE AccountID = ?`;
        await db.promise().query(query, [accountId]);
    } catch (error) {
        console.error("Error clearing session id: ", error);
        throw new Error("Error clearing session id");
    }
}



export async function createAccount(EmailAddress,Password,user,verification){
    try{
        const query = `INSERT INTO Account (EmailAddress,Password,User,VerificationStatus) Values(?, ?, ?, ?);`;
        console.log(EmailAddress,Password,user,verification)
        const [result] = await db.promise().query(query, [EmailAddress.toLowerCase(), Password,user.toLowerCase(), verification]);
        
        if (result){
            console.log("Account made",result);
            return result;
        }else{
            return null;
        }
    }catch(error){
        throw new Error("Unable to create an account")
    }

}

export async function getUserByUserName(userName){
    try{
        
        const query = `SELECT * FROM Account WHERE User = ?`;
        const [account] = await db.promise().query(query,[userName]);
        return account[0] || null;
    }catch(error){
        console.error("Error fetching user: ", error);
        throw new Error("Error fetching user");
    }
}


export async function getUserBySessionID(sessionId){
    try{
        
        const query = `SELECT * FROM Account WHERE SessionId = ?`;
        const [account] = await db.promise().query(query,[sessionId]);
        return account[0] || null;
    }catch(error){
        console.error("Error fetching user by Session ID: ", error);
        throw new Error("Error fetching user");
    }
}