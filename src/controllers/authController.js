import { getUserByAccountID, clearSessionId } from "../models/userModel.js";

export const getLoggedinUser = async (req, res) => {
  const userId = req.accountID;
  if (!userId) return res.status(400).json({ error: "User not logged in" });

  const user = await getUserByAccountID(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  return res.status(200).json({ user: user });
};

export const logout = async (req, res) => {
  if (req.accountID) {
    await clearSessionId(req.accountID);
  }
  res.clearCookie("token"); // Clear the authentication token
  res.json({ success: true });
};
