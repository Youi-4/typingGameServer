import dotenv from "dotenv";
dotenv.config();
import { getUserByAccountID } from "../models/userModel.js";

export const authValidate = async (req, res) => {
    const user = await getUserByAccountID(req.accountID);
    if(!user) return res.status(404).json({error: "User not found"});

    res.json({
      success: true,
      user: {
        accountId: req.accountID,
        primaryRole: req.primaryRole,
        roles: req.roles,
        firstName: user.FirstName,
        lastName: user.LastName
      },
    });
}