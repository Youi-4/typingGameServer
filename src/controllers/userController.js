import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
import { getUserByEmail, createAccount, updateSessionId,getUserByUserName } from "../models/userModel.js";

async function userLogin(req, res) {
    try {
        console.log("Login request received");
        console.log("Request body:", req.body);
        console.log("Request content-type:", req.get('content-type'));
        
        const { userName_or_email, password } = req.body;
        
        console.log("userName_or_email:", userName_or_email);
        console.log("password:", password);
        
        if (!userName_or_email || !password) {
            console.log("Missing fields - validation error");
            return res.status(400).json({ 
                id: "validation", 
                error: "Email and password are required" 
            });
        }

        let user = await getUserByEmail(userName_or_email.toLowerCase());
        if (!user) {
            user = await getUserByUserName(userName_or_email.toLowerCase());
            if(!user){
                return res.status(404).json({ 
                id: "email or userName", 
                error: "User not found" 
            });
            }

        }

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
            const sessionId = crypto.randomBytes(32).toString("hex");
            await updateSessionId(user.accountid, sessionId);

            // Generate JWT token with the fields expected by auth middleware
            const token = jwt.sign(
                { account_id: user.accountid, email: user.emailaddress, session_id: sessionId },
                process.env.SECRET_KEY || "your-secret-key",
                { expiresIn: "7d" }
            );

            // Set token in cookie using the name expected by middleware
            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            return res.status(200).json({
                success: true,
                message: "Login successful",
                user: {
                    id: user.accountid,
                    email: user.emailaddress,
                    name: user.user
                }
            });
        } else {
            return res.status(400).json({ 
                id: "loginPassword", 
                error: "Password is not matched." 
            });
        }
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: err.message });
    }
}

async function signupUser(req, res) {
  try {
    const { email, password,user, verified } = req.body;
    // add validation here
    const userCheck = await getUserByEmail(email);
    if (userCheck) {
      res.status(409).json({ error: "Email already exists." });
      return;
    }
    const userCheckTwo = await getUserByUserName(user);
    if (userCheckTwo) {
        console.log("\n\n",userCheckTwo,"\n\n");
      res.status(409).json({ error: "Username already exists." });
      return;
    }
    const saltRounds = 10; // 10–12 is common
    const hash = await bcrypt.hash(password, saltRounds);
    const results = await createAccount(email, hash,user, verified);
    console.log(results);
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
}


async function getUserBySession(req,res){
  try {
    const { sessionId} = req.body;
    // add validation here
    const user = await getUserBySessionId(sessionId);
    
    if (user){
        res.status(201).json({ message: user });
    }else{
        res.status(409).json({ error: "User could not be found." });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
} 
export { userLogin,signupUser ,getUserBySession};